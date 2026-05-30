import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getCreativesPage, getSyncState, getGlobalRole, CreativesPageOptions } from "@/lib/db-queries";
import { getDrivePage } from "@/lib/drive";
import { getAdminAccessToken } from "@/lib/admin-drive";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const email = session.user.email;

  // ── Authorization gate (mirrors resolveAccessibleCreative) ───────────────────
  const globalRole = await getGlobalRole(email);
  if (!globalRole) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Admins see everything; non-admins only see their project creatives + unattributed ones.
  let allowedProjectIds: string[] | null = null; // null = no restriction
  if (globalRole !== "admin") {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("email", email);
    allowedProjectIds = (memberships ?? []).map((r) => r.project_id as string);
  }

  const p = req.nextUrl.searchParams;
  const offsetStr = p.get("offset");
  const cursor = p.get("c") ?? undefined;

  try {
    const syncState = await getSyncState();
    const { count: actualCount } = await supabase
      .from("creatives")
      .select("*", { count: "exact", head: true });
    const dbPopulated = (actualCount ?? 0) >= 50 && syncState?.last_full_scan != null;

    // ── DB mode (fast) ────────────────────────────────────────────────────────
    if (dbPopulated && !cursor) {
      const offset = offsetStr ? parseInt(offsetStr) : 0;
      const minSizeMB = p.get("minSizeMB");
      const maxSizeMB = p.get("maxSizeMB");
      const minDurSecs = p.get("minDurSecs");
      const maxDurSecs = p.get("maxDurSecs");

      const minScore = p.get("minScore");
      const maxScore = p.get("maxScore");

      const result = await getCreativesPage({
        cursor: offset,
        limit: 50,
        folderId: p.get("folderId") ?? undefined,
        fileType: (p.get("fileType") as "video" | "image" | "all") ?? "all",
        status: p.get("status") ?? undefined,
        contentType: p.get("contentType") ?? undefined,
        platform: p.get("platform") ?? undefined,
        search: p.get("search") ?? undefined,
        customTag: p.get("customTag") ?? undefined,
        dateFrom: p.get("dateFrom") ?? undefined,
        dateTo: p.get("dateTo") ?? undefined,
        sort: (p.get("sort") as CreativesPageOptions["sort"]) ?? undefined,
        minSizeBytes: minSizeMB ? Math.round(parseFloat(minSizeMB) * 1_048_576) : undefined,
        maxSizeBytes: maxSizeMB ? Math.round(parseFloat(maxSizeMB) * 1_048_576) : undefined,
        minDurSecs: minDurSecs ? parseInt(minDurSecs) : undefined,
        maxDurSecs: maxDurSecs ? parseInt(maxDurSecs) : undefined,
        funnelStage:    p.get("funnelStage")    ?? undefined,
        emotionalAngle: p.get("emotionalAngle") ?? undefined,
        minScore: minScore ? parseInt(minScore) : undefined,
        maxScore: maxScore ? parseInt(maxScore) : undefined,
        allowedProjectIds,
      });

      return NextResponse.json({
        files: result.creatives,
        folders: result.folders,
        total: result.total,
        nextOffset: offset + result.creatives.length < result.total
          ? offset + result.creatives.length
          : null,
        source: "db",
        syncState: {
          status: syncState?.status,
          total_indexed: syncState?.total_indexed,
          last_full_scan: syncState?.last_full_scan,
        },
      });
    }

    // ── Drive fallback (DB vacía o cursor explícito) ──────────────────────────
    // Drive mode returns only what the admin service account can see; non-admins
    // in Drive mode receive an empty result rather than leaking all Drive files.
    if (globalRole !== "admin") {
      return NextResponse.json({
        files: [],
        source: "drive",
        syncState: { status: syncState?.status ?? "idle", total_indexed: 0 },
        message: "Sincroniza primero la base de datos para acceder al contenido.",
      });
    }

    const accessToken = await getAdminAccessToken();
    const page = await getDrivePage(accessToken, cursor);
    return NextResponse.json({
      ...page,
      source: "drive",
      syncState: { status: syncState?.status ?? "idle", total_indexed: 0 },
    });

  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err);
    console.error("Drive page error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
