import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { deltaDriveSync } from "@/lib/drive-sync";
import { getGlobalRole } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

let deltaRunning = false;

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  if (deltaRunning) {
    return NextResponse.json({ error: "Sincronización delta ya en curso." }, { status: 429 });
  }

  deltaRunning = true;
  try {
    const result = await deltaDriveSync();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    deltaRunning = false;
  }
}
