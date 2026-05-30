import { NextRequest, NextResponse } from "next/server";
import { deltaDriveSync, fullDriveSync } from "@/lib/drive-sync";
import { getSyncState } from "@/lib/db-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel cron passes Authorization: Bearer CRON_SECRET
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    const state = await getSyncState();

    // First ever run: do a full sync to populate the DB
    if (!state?.last_full_scan) {
      let indexed = 0;
      await fullDriveSync(({ indexed: n }) => { indexed = n; });
      return NextResponse.json({ type: "full", indexed, duration_ms: Date.now() - start });
    }

    const result = await deltaDriveSync();
    return NextResponse.json({ type: "delta", ...result, duration_ms: Date.now() - start });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Cron sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
