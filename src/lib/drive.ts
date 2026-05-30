import { google } from "googleapis";
import { Creative, DriveFolder } from "@/types";

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/bmp", "image/tiff", "image/svg+xml",
]);
const VIDEO_MIMES = new Set([
  "video/mp4", "video/quicktime", "video/avi", "video/mov",
  "video/wmv", "video/flv", "video/webm", "video/mkv",
  "video/x-msvideo", "video/x-ms-wmv", "video/mpeg",
]);

const SHARED = { includeItemsFromAllDrives: true, supportsAllDrives: true } as const;
const PAGE_SIZE = 50;
const MIME_QUERY = [...IMAGE_MIMES, ...VIDEO_MIMES].map((m) => `mimeType = '${m}'`).join(" or ");

function fileType(mime: string): "video" | "image" | "other" {
  if (VIDEO_MIMES.has(mime)) return "video";
  if (IMAGE_MIMES.has(mime)) return "image";
  return "other";
}
function formatSize(bytes: string | null): string | null {
  if (!bytes) return null;
  const n = parseInt(bytes);
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(2)} GB`;
}

// Server-side folder cache keyed by access token (10 min TTL)
interface FolderCache {
  folderMap: Map<string, string>;
  driveMap: Map<string, string>;
  expiresAt: number;
}
const cache = new Map<string, FolderCache>();

async function getFolderMaps(drive: ReturnType<typeof google.drive>, tokenKey: string) {
  const now = Date.now();
  const hit = cache.get(tokenKey);
  if (hit && hit.expiresAt > now) return { folderMap: hit.folderMap, driveMap: hit.driveMap };

  const [driveMap, folderMap] = await Promise.all([
    (async () => {
      const map = new Map<string, string>();
      let pt: string | undefined;
      do {
        const r = await drive.drives.list({ pageSize: 100, fields: "nextPageToken, drives(id,name)", pageToken: pt });
        for (const d of r.data.drives ?? []) if (d.id && d.name) map.set(d.id, d.name);
        pt = r.data.nextPageToken ?? undefined;
      } while (pt);
      return map;
    })(),
    (async () => {
      const map = new Map<string, string>();
      let pt: string | undefined;
      do {
        const r = await drive.files.list({
          q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: "nextPageToken, files(id,name,driveId)",
          pageSize: 500, corpora: "allDrives", ...SHARED, pageToken: pt,
        });
        for (const f of r.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
        pt = r.data.nextPageToken ?? undefined;
      } while (pt);
      return map;
    })(),
  ]);

  cache.set(tokenKey, { folderMap, driveMap, expiresAt: now + 10 * 60_000 });
  return { folderMap, driveMap };
}

export interface DrivePage {
  files: Creative[];
  folders?: DriveFolder[];
  nextCursor: string | null;
}

export async function getDrivePage(accessToken: string, cursor?: string): Promise<DrivePage> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth });

  // On first load (no cursor) build folder list to return to client
  const isFirst = !cursor;

  const [{ folderMap, driveMap }, fileRes] = await Promise.all([
    getFolderMaps(drive, accessToken.slice(-20)),
    drive.files.list({
      q: `(${MIME_QUERY}) and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,parents,driveId)",
      pageSize: PAGE_SIZE,
      corpora: "allDrives",
      orderBy: "modifiedTime desc",
      ...SHARED,
      pageToken: cursor,
    }),
  ]);

  const files: Creative[] = (fileRes.data.files ?? []).map((f) => {
    const parentId = f.parents?.[0] ?? "";
    const driveName = f.driveId ? driveMap.get(f.driveId) : null;
    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      fileType: fileType(f.mimeType!),
      folderId: parentId,
      folderName: folderMap.get(parentId) ?? driveName ?? "Mi unidad",
      thumbnailUrl: f.thumbnailLink ?? null,
      webViewLink: f.webViewLink ?? null,
      size: formatSize(f.size ?? null),
      createdTime: f.createdTime!,
      modifiedTime: f.modifiedTime!,
      tags: { contentType: "sin_clasificar", platforms: [], status: "sin_estado", custom: [] },
    };
  });

  const folders: DriveFolder[] | undefined = isFirst
    ? Array.from(folderMap.entries()).map(([id, name]) => ({ id, name }))
    : undefined;

  return {
    files,
    folders,
    nextCursor: fileRes.data.nextPageToken ?? null,
  };
}
