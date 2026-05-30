import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { fullDriveSync } from "@/lib/drive-sync";
import { getGlobalRole } from "@/lib/db-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

let fullSyncRunning = false;

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  if (fullSyncRunning) {
    return NextResponse.json({ error: "Sincronización ya en curso. Espera a que termine." }, { status: 429 });
  }

  const encoder = new TextEncoder();

  fullSyncRunning = true;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (cancelled) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
      };

      try {
        send({ type: "start" });

        const total = await fullDriveSync(({ indexed, batch }) => {
          send({ type: "progress", indexed, batch });
        });

        send({ type: "done", total });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
      } finally {
        fullSyncRunning = false;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      cancelled = true;
      fullSyncRunning = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
