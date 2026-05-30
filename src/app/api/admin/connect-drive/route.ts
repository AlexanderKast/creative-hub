import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuth } from "@/lib/auth";
import { getGlobalRole } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

const CALLBACK_URL = `${process.env.NEXTAUTH_URL}/api/admin/connect-drive/callback`;

// GET /api/admin/connect-drive
// Redirige al admin a Google OAuth con scope de Drive para capturar el refresh token.
// Solo necesita hacerse UNA vez. Después todos los usuarios usan scope básico.
export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    CALLBACK_URL,
  );

  const state = crypto.randomUUID();

  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
