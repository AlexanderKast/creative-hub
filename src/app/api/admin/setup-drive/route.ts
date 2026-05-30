import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuth } from "@/lib/auth";
import { getGlobalRole } from "@/lib/db-queries";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/admin/setup-drive
// Reads the Drive refresh token from the admin's current session JWT and stores it
// in app_settings. Call this once after the first Drive-scoped login to bootstrap
// admin credentials. After that, all users can use the app with basic Google scope.
export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! });
  const refreshToken = token?.refreshToken as string | undefined;

  if (!refreshToken) {
    return NextResponse.json({
      error: "No hay refresh token en la sesión actual. Cierra sesión, inicia sesión con Drive scope habilitado en auth.ts, visita esta ruta, luego revierte el scope.",
      hint: "O configura GOOGLE_DRIVE_REFRESH_TOKEN en .env.local directamente.",
    }, { status: 400 });
  }

  try {
    await supabase
      .from("app_settings")
      .upsert(
        { key: "drive_refresh_token", value: refreshToken, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    return NextResponse.json({ ok: true, message: "Drive token guardado. Ya puedes usar el scope básico para todos los usuarios." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
