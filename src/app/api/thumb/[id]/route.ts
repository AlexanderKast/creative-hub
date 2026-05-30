import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAdminAccessToken } from "@/lib/admin-drive";
import { resolveAccessibleCreative, updateCreativeThumbnailUrl } from "@/lib/db-queries";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "thumbnails";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;

  const creative = await resolveAccessibleCreative(session.user.email!, id);
  if (!creative) return new NextResponse(null, { status: 404 });

  // Thumbnail ya cacheado en Supabase Storage → redirect directo (sin proxy)
  if (creative.thumbnailUrl) {
    return NextResponse.redirect(creative.thumbnailUrl, { status: 302 });
  }

  // Primera vez: obtener de Drive y cachear en background
  try {
    const accessToken = await getAdminAccessToken();
    const res = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w400-h400`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return new NextResponse(null, { status: 404 });

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("Content-Type") ?? "image/jpeg";

    // Subir a Supabase Storage en background (no bloquea la respuesta)
    cacheToStorage(id, buffer, contentType).catch(() => {});

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

async function cacheToStorage(id: string, buffer: Buffer, contentType: string) {
  // Crear bucket si no existe (idempotente)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${id}.jpg`, buffer, { contentType, upsert: true });

  if (error) return;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${id}.jpg`);
  await updateCreativeThumbnailUrl(id, data.publicUrl);
}
