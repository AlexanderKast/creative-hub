import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAdminDrive, getAdminAccessToken } from "@/lib/admin-drive";
import { updateCreativeName, moveCreative, deleteCreative, resolveAccessibleCreative, getProjectFolderRecord, getUserProjectRole } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;

  const creative = await resolveAccessibleCreative(session.user.email!, id);
  if (!creative) return new NextResponse(null, { status: 404 });

  const range = req.headers.get("range");

  try {
    const accessToken = await getAdminAccessToken();
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (range) fetchHeaders["Range"] = range;

    // Range requests (video streaming) need a long timeout; metadata-only fetches use 30s.
    const timeout = AbortSignal.timeout(range ? 600_000 : 30_000);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
      { headers: fetchHeaders, signal: timeout },
    );

    if (!res.ok) return new NextResponse(null, { status: res.status });

    const rawContentType = res.headers.get("Content-Type") ?? "application/octet-stream";
    const SAFE_MIMES = /^(image\/(jpeg|png|gif|webp|bmp|tiff)|video\/(mp4|webm|quicktime|ogg|avi|mov|mpeg|x-msvideo|x-ms-wmv)|application\/octet-stream)/;
    const safeContentType = SAFE_MIMES.test(rawContentType) ? rawContentType : "application/octet-stream";

    const responseHeaders = new Headers({
      "Content-Type": safeContentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    });

    if (range) {
      // For 206 responses, Content-Range is authoritative; omit Content-Length to
      // avoid ERR_CONTENT_LENGTH_MISMATCH when the stream is terminated early.
      const contentRange = res.headers.get("Content-Range");
      if (contentRange) responseHeaders.set("Content-Range", contentRange);
    } else {
      const contentLength = res.headers.get("Content-Length");
      if (contentLength) responseHeaders.set("Content-Length", contentLength);
    }

    return new NextResponse(res.body, {
      status: range ? 206 : 200,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

// PATCH /api/file/[id] — renombra y/o mueve el archivo en Google Drive
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const creative = await resolveAccessibleCreative(session.user.email!, id);
  if (!creative) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const { name, folderId, currentFolderId } = body as {
    name?: string;
    folderId?: string;
    currentFolderId?: string;
  };

  if (!name?.trim() && !folderId) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  // Validate move destination: must be a registered project folder the user can access.
  let resolvedDestFolderName: string | undefined;
  if (folderId && currentFolderId && folderId !== currentFolderId) {
    // Cross-check source folder against what we have stored for this creative
    if (creative.folderId !== currentFolderId) {
      return NextResponse.json({ error: "Carpeta de origen incorrecta" }, { status: 400 });
    }

    const destFolder = await getProjectFolderRecord(folderId);
    if (!destFolder) {
      return NextResponse.json({ error: "Carpeta destino no registrada" }, { status: 400 });
    }
    const destRole = await getUserProjectRole(session.user.email!, destFolder.projectId);
    if (!destRole) {
      return NextResponse.json({ error: "Sin acceso a la carpeta destino" }, { status: 403 });
    }
    resolvedDestFolderName = destFolder.folderName;
  }

  try {
    const drive = await getAdminDrive();

    // Rename
    if (name?.trim()) {
      await drive.files.update({
        fileId: id,
        supportsAllDrives: true,
        requestBody: { name: name.trim() },
        fields: "id, name",
      });
      await updateCreativeName(id, name.trim()).catch(() => {});
    }

    // Move to new folder
    if (folderId && currentFolderId && folderId !== currentFolderId && resolvedDestFolderName !== undefined) {
      await drive.files.update({
        fileId: id,
        supportsAllDrives: true,
        addParents: folderId,
        removeParents: currentFolderId,
        requestBody: {},
        fields: "id, parents",
      });
      await moveCreative(id, folderId, resolvedDestFolderName).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/file/[id] — elimina el archivo de Google Drive y la DB
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const creative = await resolveAccessibleCreative(session.user.email!, id);
  if (!creative) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const drive = await getAdminDrive();
    try {
      await drive.files.delete({ fileId: id, supportsAllDrives: true });
    } catch (driveErr: unknown) {
      // 404 / 410 = file already gone from Drive — still clean up our DB record
      const httpStatus = (driveErr as { response?: { status?: number } })?.response?.status;
      if (httpStatus !== 404 && httpStatus !== 410) throw driveErr;
    }
    await deleteCreative(id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/file]", id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
