import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getAdminDrive, getAdminAccessToken } from "@/lib/admin-drive";
import { resolveAccessibleCreative } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

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

  try {
    const drive = await getAdminDrive();

    let fileName = creative.name ?? id;
    let mimeType = creative.mimeType ?? "application/octet-stream";
    try {
      const meta = await drive.files.get({ fileId: id, fields: "name,mimeType", supportsAllDrives: true });
      fileName = meta.data.name ?? fileName;
      mimeType = meta.data.mimeType ?? mimeType;
    } catch {}

    const accessToken = await getAdminAccessToken();
    const timeout = AbortSignal.timeout(60_000);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: timeout }
    );

    if (!res.ok) return new NextResponse(null, { status: res.status });

    const contentLength = res.headers.get("Content-Length");
    const safeFileName = encodeURIComponent(fileName).replace(/%20/g, "+");

    const headers = new Headers({
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${safeFileName}`,
      "Cache-Control": "private, no-cache",
    });
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(res.body, { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[download]", id, msg);
    return new NextResponse(null, { status: 502 });
  }
}
