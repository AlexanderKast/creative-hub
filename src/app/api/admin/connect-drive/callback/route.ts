import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuth } from "@/lib/auth";
import { getGlobalRole } from "@/lib/db-queries";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CALLBACK_URL = `${process.env.NEXTAUTH_URL}/api/admin/connect-drive/callback`;

// GET /api/admin/connect-drive/callback
// Recibe el código de autorización de Google, lo intercambia por tokens y guarda
// el refresh token en app_settings para que todos los usuarios puedan usar Drive.
export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/?drive_error=no_auth", req.url));
  }

  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.redirect(new URL("/?drive_error=no_admin", req.url));
  }

  const stateParam = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;
  if (!stateParam || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(new URL("/?drive_error=invalid_state", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/?drive_error=${error ?? "no_code"}`, req.url));
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    CALLBACK_URL,
  );

  try {
    const { tokens } = await auth.getToken(code);

    if (!tokens.refresh_token) {
      // Si no viene refresh_token, el usuario ya había autorizado antes.
      // Pídele que revoque el acceso en myaccount.google.com/permissions y reintente.
      return NextResponse.redirect(
        new URL("/?drive_error=no_refresh_token&hint=revoke_and_retry", req.url)
      );
    }

    await supabase
      .from("app_settings")
      .upsert(
        { key: "drive_refresh_token", value: tokens.refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    const success = NextResponse.redirect(new URL("/?drive_connected=1", req.url));
    success.cookies.delete("oauth_state");
    return success;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[connect-drive/callback]", msg);
    return NextResponse.redirect(new URL(`/?drive_error=token_exchange_failed`, req.url));
  }
}
