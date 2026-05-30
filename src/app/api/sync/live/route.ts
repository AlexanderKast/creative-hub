import { getAuth } from "@/lib/auth";
import { getGlobalRole } from "@/lib/db-queries";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { Creative } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel max; client reconnects transparently via EventSource

// Batch window: collect Realtime events for 150ms before flushing to client.
// Prevents flooding when the cron syncs many files at once.
const BATCH_MS = 150;
const HEARTBEAT_MS = 25_000;

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.email) return new Response(null, { status: 401 });

  const role = await getGlobalRole(session.user.email);
  if (!role) return new Response(null, { status: 403 });

  const encoder = new TextEncoder();
  let closed = false;
  let hbTimer: ReturnType<typeof setInterval> | null = null;
  let batchTimer: ReturnType<typeof setTimeout> | null = null;
  let rtChannel: RealtimeChannel | null = null;

  // Pending batch accumulator
  const pendingDeleted: string[] = [];
  const pendingUpdated: Creative[] = [];

  // Create a dedicated Supabase client per connection (Realtime needs its own WS)
  const rt = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } }
  );

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const flushBatch = () => {
        if (pendingDeleted.length === 0 && pendingUpdated.length === 0) return;
        send({ type: "delta", deleted: [...pendingDeleted], updated: [...pendingUpdated] });
        pendingDeleted.length = 0;
        pendingUpdated.length = 0;
        batchTimer = null;
      };

      const queue = (del?: string, upd?: Creative) => {
        if (del) pendingDeleted.push(del);
        if (upd) pendingUpdated.push(upd);
        if (!batchTimer) batchTimer = setTimeout(flushBatch, BATCH_MS);
      };

      send({ type: "connected" });

      rtChannel = rt
        .channel("creatives-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "creatives" },
          (payload) => {
            if (closed) return;
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              if (id) queue(id, undefined);
            } else {
              queue(undefined, mapRow(payload.new as Record<string, unknown>));
            }
          }
        )
        .subscribe((status) => {
          // Notify client if Realtime connection fails (e.g. table not in publication)
          if (status === "CHANNEL_ERROR") {
            send({ type: "error", message: "Realtime no disponible. Habilita la tabla 'creatives' en Supabase → Database → Replication." });
          }
        });

      hbTimer = setInterval(() => send({ type: "hb" }), HEARTBEAT_MS);
    },

    cancel() {
      closed = true;
      if (hbTimer) clearInterval(hbTimer);
      if (batchTimer) clearTimeout(batchTimer);
      if (rtChannel) rt.removeChannel(rtChannel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Creative {
  return {
    id: row.id as string,
    name: row.name as string,
    mimeType: row.mime_type as string,
    fileType: row.file_type as "video" | "image" | "other",
    folderId: (row.folder_id as string) ?? "",
    folderName: (row.folder_name as string) ?? "",
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    webViewLink: (row.web_view_link as string) ?? null,
    size: row.size_bytes ? formatSize(row.size_bytes as number) : null,
    sizeBytes: (row.size_bytes as number) ?? null,
    durationSeconds: (row.duration_seconds as number) ?? null,
    createdTime: (row.created_time as string) ?? "",
    modifiedTime: (row.modified_time as string) ?? "",
    projectId: (row.project_id as string) ?? null,
    tags: {
      contentType: ((row.tag_content_type as string) ?? "sin_clasificar") as Creative["tags"]["contentType"],
      platforms: ((row.tag_platforms as string[]) ?? []) as Creative["tags"]["platforms"],
      status: ((row.tag_status as string) ?? "sin_estado") as Creative["tags"]["status"],
      custom: (row.tag_custom as string[]) ?? [],
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}
