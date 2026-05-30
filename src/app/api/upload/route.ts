import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAdminDrive } from "@/lib/admin-drive";
import { supabase } from "@/lib/supabase";
import { getGlobalRole, getUserProjectRole, getProjectIdByFolderId } from "@/lib/db-queries";
import { Readable } from "stream";

const uploadsInFlight = new Map<string, number>();

export const dynamic = "force-dynamic";

const IMAGE_MIMES = new Set(["image/jpeg","image/png","image/gif","image/webp","image/bmp","image/tiff"]);
const VIDEO_MIMES = new Set(["video/mp4","video/quicktime","video/avi","video/mov","video/wmv","video/webm","video/mkv","video/mpeg"]);

function fileType(mime: string) {
  if (VIDEO_MIMES.has(mime)) return "video";
  if (IMAGE_MIMES.has(mime)) return "image";
  return "other";
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestedFolderId = formData.get("folderId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  }

  // Validate MIME type and file size before accepting the upload
  const ALLOWED_MIMES = /^(image\/(jpeg|png|gif|webp|bmp|tiff)|video\/(mp4|quicktime|avi|mov|wmv|webm|mkv|mpeg|x-msvideo|x-ms-wmv))/;
  if (!file.type || !ALLOWED_MIMES.test(file.type)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }
  const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 2 GB" }, { status: 400 });
  }

  // Validate folderId: must be the default upload folder or a registered project folder.
  // In all cases, the user must have a valid role — no unauthenticated uploads.
  let targetFolderId = process.env.UPLOAD_FOLDER_ID!;
  if (requestedFolderId && requestedFolderId !== process.env.UPLOAD_FOLDER_ID) {
    const projectId = await getProjectIdByFolderId(requestedFolderId);
    if (!projectId) {
      return NextResponse.json({ error: "Carpeta no válida" }, { status: 400 });
    }
    const role = await getUserProjectRole(session.user.email!, projectId);
    if (!role) {
      return NextResponse.json({ error: "Sin acceso a esa carpeta" }, { status: 403 });
    }
    targetFolderId = requestedFolderId;
  } else {
    // Default folder (UPLOAD_FOLDER_ID) or explicit match — require global team role
    const globalRole = await getGlobalRole(session.user.email!);
    if (!globalRole) {
      return NextResponse.json({ error: "Sin permisos para subir a esta carpeta" }, { status: 403 });
    }
    if (requestedFolderId) targetFolderId = requestedFolderId;
  }

  // Enforce per-user concurrency limit (max 5 simultaneous uploads)
  const userEmail = session.user.email!;
  const current = uploadsInFlight.get(userEmail) ?? 0;
  if (current >= 5) {
    return NextResponse.json({ error: "Demasiadas subidas simultáneas. Espera a que terminen." }, { status: 429 });
  }
  uploadsInFlight.set(userEmail, current + 1);

  const drive = await getAdminDrive();

  try {
    const readable = Readable.fromWeb(
      file.stream() as Parameters<typeof Readable.fromWeb>[0]
    );

    const driveRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: file.name,
        parents: [targetFolderId],
      },
      media: {
        mimeType: file.type,
        body: readable,
      },
      fields: "id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents",
    });

    const f = driveRes.data;
    const type = fileType(f.mimeType!);

    // Indexar en DB
    await supabase.from("creatives").upsert({
      id: f.id!,
      folder_id: targetFolderId,
      folder_name: "Uploads",
      name: f.name!,
      mime_type: f.mimeType!,
      file_type: type,
      size_bytes: f.size ? parseInt(f.size) : null,
      created_time: f.createdTime,
      modified_time: f.modifiedTime,
      web_view_link: f.webViewLink,
      tag_content_type: "sin_clasificar",
      tag_platforms: [],
      tag_status: "revisar",
      tag_custom: [],
      uploaded_via_app: true,
    }, { onConflict: "id" });

    return NextResponse.json({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      fileType: type,
      folderId: targetFolderId,
      folderName: "Uploads",
      thumbnailUrl: null,
      webViewLink: f.webViewLink ?? null,
      size: f.size ?? null,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      tags: { contentType: "sin_clasificar", platforms: [], status: "revisar", custom: [] },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    const after = (uploadsInFlight.get(userEmail) ?? 1) - 1;
    if (after <= 0) uploadsInFlight.delete(userEmail);
    else uploadsInFlight.set(userEmail, after);
  }
}
