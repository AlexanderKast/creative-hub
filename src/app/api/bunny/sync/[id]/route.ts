import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { createBunnyVideo, uploadToBunny, isBunnyConfigured } from "@/lib/bunny";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/bunny/sync/[id] — descarga el archivo de Drive y lo sube a Bunny Stream
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isBunnyConfigured()) {
    return NextResponse.json({ error: "Bunny Stream no configurado. Agrega BUNNY_STREAM_API_KEY, BUNNY_LIBRARY_ID y BUNNY_CDN_HOSTNAME en .env.local" }, { status: 503 });
  }

  const { id } = await params;
  const { fileName, mimeType } = await req.json() as { fileName: string; mimeType: string };

  try {
    // Marcar como procesando
    await supabase.from("creatives").update({ bunny_status: "processing" }).eq("id", id);

    // 1. Crear video en Bunny (obtiene videoId)
    const bunnyVideo = await createBunnyVideo(fileName);

    // 2. Descargar de Drive vía proxy interno
    const driveRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/file/${id}`,
      { headers: { Cookie: req.headers.get("cookie") ?? "" } }
    );

    if (!driveRes.ok) {
      throw new Error(`No se pudo descargar de Drive: ${driveRes.status}`);
    }

    // 3. Subir a Bunny
    const buffer = Buffer.from(await driveRes.arrayBuffer());
    await uploadToBunny(bunnyVideo.guid, buffer, mimeType);

    // 4. Guardar en DB
    await supabase
      .from("creatives")
      .update({ bunny_video_id: bunnyVideo.guid, bunny_status: "ready" })
      .eq("id", id);

    return NextResponse.json({ bunnyVideoId: bunnyVideo.guid, status: "ready" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("creatives").update({ bunny_status: "error" }).eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
