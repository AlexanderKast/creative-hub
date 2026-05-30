import { upsertCreatives, updateSyncState, getSyncState, deleteCreatives } from "./db-queries";
import { getAdminDrive } from "./admin-drive";
import { Creative } from "@/types";

const IMAGE_MIMES = new Set(["image/jpeg","image/png","image/gif","image/webp","image/bmp","image/tiff","image/svg+xml"]);
const VIDEO_MIMES = new Set(["video/mp4","video/quicktime","video/avi","video/mov","video/wmv","video/flv","video/webm","video/mkv","video/x-msvideo","video/x-ms-wmv","video/mpeg"]);
const MIME_QUERY = [...IMAGE_MIMES, ...VIDEO_MIMES].map((m) => `mimeType = '${m}'`).join(" or ");
const SHARED = { includeItemsFromAllDrives: true, supportsAllDrives: true } as const;

function fileType(mime: string): "video" | "image" | "other" {
  if (VIDEO_MIMES.has(mime)) return "video";
  if (IMAGE_MIMES.has(mime)) return "image";
  return "other";
}

type Drive = Awaited<ReturnType<typeof getAdminDrive>>;

// ─── FILE PAGE FETCH ─────────────────────────────────────────────────────────

function fetchFilePage(drive: Drive, pageToken?: string) {
  return drive.files.list({
    q: `(${MIME_QUERY}) and trashed=false`,
    fields: "nextPageToken, files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,driveId)",
    pageSize: 200,
    corpora: "allDrives",
    orderBy: "modifiedTime desc",
    ...SHARED,
    pageToken,
  });
}

interface DriveFile {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  parents?: string[] | null;
  driveId?: string | null;
}

function mapFiles(
  files: DriveFile[] | null | undefined,
  driveMap: Map<string, string>,
  folderMap: Map<string, string>,
): Creative[] {
  return (files ?? []).map((f) => {
    const parentId = f.parents?.[0] ?? "";
    const driveName = f.driveId ? driveMap.get(f.driveId) : null;
    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      fileType: fileType(f.mimeType!),
      folderId: parentId,
      folderName: folderMap.get(parentId) ?? driveName ?? "Mi unidad",
      thumbnailUrl: null,
      webViewLink: f.webViewLink ?? null,
      size: f.size ?? null,
      createdTime: f.createdTime!,
      modifiedTime: f.modifiedTime!,
      tags: { contentType: "sin_clasificar", platforms: [], status: "sin_estado", custom: [] },
    };
  });
}

// ─── MAPS ─────────────────────────────────────────────────────────────────────

async function buildDriveMap(drive: Drive) {
  const map = new Map<string, string>();
  let pt: string | undefined;
  do {
    const r = await drive.drives.list({ pageSize: 100, fields: "nextPageToken, drives(id,name)", pageToken: pt });
    for (const d of r.data.drives ?? []) if (d.id && d.name) map.set(d.id, d.name);
    pt = r.data.nextPageToken ?? undefined;
  } while (pt);
  return map;
}

async function buildFolderMap(drive: Drive) {
  const map = new Map<string, string>();
  let pt: string | undefined;
  do {
    const r = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "nextPageToken, files(id,name)",
      pageSize: 500, corpora: "allDrives", ...SHARED, pageToken: pt,
    });
    for (const f of r.data.files ?? []) if (f.id && f.name) map.set(f.id, f.name);
    pt = r.data.nextPageToken ?? undefined;
  } while (pt);
  return map;
}

// ─── FULL SYNC (con pipeline fetch/upsert paralelo) ──────────────────────────

export type SyncProgress = { indexed: number; batch: number };

export async function fullDriveSync(
  onProgress: (p: SyncProgress) => void
): Promise<number> {
  const drive = await getAdminDrive();

  await updateSyncState({ status: "running", error_message: null });

  // Paralelizar: mapas + startPageToken para Changes API
  const [driveMap, folderMap, startTokenRes] = await Promise.all([
    buildDriveMap(drive),
    buildFolderMap(drive),
    drive.changes.getStartPageToken({ supportsAllDrives: true }),
  ]);

  const changesToken = startTokenRes.data.startPageToken ?? undefined;
  let totalIndexed = 0;

  try {
    // Recolectar todos los IDs de Drive en esta pasada
    const driveIds = new Set<string>();
    let pendingFetch = fetchFilePage(drive, undefined);

    while (true) {
      const res = await pendingFetch;
      const nextToken = res.data.nextPageToken ?? undefined;
      if (nextToken) pendingFetch = fetchFilePage(drive, nextToken);

      const batch = mapFiles(res.data.files, driveMap, folderMap);

      if (batch.length > 0) {
        for (const f of batch) driveIds.add(f.id);
        await upsertCreatives(batch);
        totalIndexed += batch.length;
        onProgress({ indexed: totalIndexed, batch: batch.length });
      }

      if (!nextToken) break;
    }

    // Eliminar de la DB los archivos que ya no existen en Drive (paginado para evitar lectura ilimitada)
    if (driveIds.size > 0) {
      const { supabase: sb } = await import("./supabase");
      const stale: string[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data: page } = await sb
          .from("creatives")
          .select("id")
          .range(from, from + PAGE - 1);
        if (!page || page.length === 0) break;
        for (const r of page) {
          if (!driveIds.has(r.id as string)) stale.push(r.id as string);
        }
        if (page.length < PAGE) break;
        from += PAGE;
      }
      if (stale.length > 0) await deleteCreatives(stale);
    }

    await updateSyncState({
      status: "idle",
      last_full_scan: new Date().toISOString(),
      last_delta_scan: new Date().toISOString(),
      total_indexed: totalIndexed,
      drive_changes_token: changesToken,
    });

    return totalIndexed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncState({ status: "error", error_message: msg });
    throw err;
  }
}

// ─── DELTA SYNC (Drive Changes API) ─────────────────────────────────────────
//
// Si tenemos drive_changes_token (post first full-sync) usamos la Changes API:
// detecta borrados, movidos y renombrados además de modificaciones.
// Sin token: fallback a filtrar por modifiedTime (legado).

export async function deltaDriveSync(
  onChanges?: (changes: { deleted: string[]; updated: Creative[] }) => void,
): Promise<{ updated: number; deleted: number }> {
  const state = await getSyncState();
  const drive = await getAdminDrive();

  // ── Changes API (token disponible) ──────────────────────────────────────
  if (state?.drive_changes_token) {
    const [driveMap, folderMap] = await Promise.all([
      buildDriveMap(drive),
      buildFolderMap(drive),
    ]);

    let pageToken: string = state.drive_changes_token;
    let newStartToken = pageToken;
    let totalUpserted = 0;
    let totalDeleted = 0;
    const allDeleted: string[] = [];
    const allUpdated: Creative[] = [];

    do {
      const res = await drive.changes.list({
        pageToken,
        fields: "nextPageToken, newStartPageToken, changes(removed, fileId, file(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,driveId,trashed))",
        pageSize: 200,
        ...SHARED,
      });

      const batchUpsert: Creative[] = [];
      const batchDelete: string[] = [];

      for (const change of res.data.changes ?? []) {
        const { removed, fileId, file } = change;
        if (!fileId) continue;

        if (removed || file?.trashed) {
          batchDelete.push(fileId);
          continue;
        }
        if (!file?.mimeType) continue;
        if (!IMAGE_MIMES.has(file.mimeType) && !VIDEO_MIMES.has(file.mimeType)) continue;

        const parentId = file.parents?.[0] ?? "";
        const driveName = file.driveId ? driveMap.get(file.driveId) : null;
        batchUpsert.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          fileType: fileType(file.mimeType!),
          folderId: parentId,
          folderName: folderMap.get(parentId) ?? driveName ?? "Mi unidad",
          thumbnailUrl: null,
          webViewLink: file.webViewLink ?? null,
          size: file.size ?? null,
          createdTime: file.createdTime!,
          modifiedTime: file.modifiedTime!,
          tags: { contentType: "sin_clasificar", platforms: [], status: "sin_estado", custom: [] },
        });
      }

      // Process each page immediately — avoids accumulating everything in memory
      await Promise.all([
        batchDelete.length > 0 ? deleteCreatives(batchDelete) : Promise.resolve(),
        batchUpsert.length > 0 ? upsertCreatives(batchUpsert) : Promise.resolve(),
      ]);
      totalDeleted += batchDelete.length;
      totalUpserted += batchUpsert.length;
      allDeleted.push(...batchDelete);
      allUpdated.push(...batchUpsert);

      if (res.data.newStartPageToken) newStartToken = res.data.newStartPageToken;
      pageToken = res.data.nextPageToken ?? "";
    } while (pageToken);

    if (onChanges && (totalDeleted > 0 || totalUpserted > 0)) {
      onChanges({ deleted: allDeleted, updated: allUpdated });
    }

    await updateSyncState({
      last_delta_scan: new Date().toISOString(),
      drive_changes_token: newStartToken,
      total_indexed: Math.max(0, (state?.total_indexed ?? 0) + totalUpserted - totalDeleted),
    });

    return { updated: totalUpserted, deleted: totalDeleted };
  }

  // ── Fallback: filtrar por modifiedTime ────────────────────────────────────
  const since = state?.last_delta_scan ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceISO = new Date(since).toISOString().replace("T", " ").replace("Z", "");

  const [driveMap, folderMap] = await Promise.all([
    buildDriveMap(drive),
    buildFolderMap(drive),
  ]);

  let pageToken: string | undefined;
  let totalUpdated = 0;

  do {
    const res = await drive.files.list({
      q: `(${MIME_QUERY}) and trashed=false and modifiedTime > '${sinceISO}'`,
      fields: "nextPageToken, files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,driveId)",
      pageSize: 200,
      corpora: "allDrives",
      ...SHARED,
      pageToken,
    });

    const batch = mapFiles(res.data.files, driveMap, folderMap);
    if (batch.length > 0) {
      await upsertCreatives(batch);
      totalUpdated += batch.length;
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (onChanges && totalUpdated > 0) {
    // Fallback mode: no deletes detected, but updated items are already upserted
    // We can't reconstruct them here; caller gets no updates to relay to UI.
  }

  await updateSyncState({
    last_delta_scan: new Date().toISOString(),
    total_indexed: (state?.total_indexed ?? 0) + totalUpdated,
  });

  return { updated: totalUpdated, deleted: 0 };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
