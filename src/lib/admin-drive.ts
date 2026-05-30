import { google } from "googleapis";
import { supabase } from "./supabase";

async function getStoredRefreshToken(): Promise<string> {
  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    return process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  }
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "drive_refresh_token")
    .single();
  if (!data?.value) {
    throw new Error("Drive no configurado. El administrador debe volver a iniciar sesión.");
  }
  return data.value as string;
}

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  );
}

export async function getAdminDrive() {
  const refreshToken = await getStoredRefreshToken();
  const auth = buildOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });

  auth.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      try {
        await supabase
          .from("app_settings")
          .upsert({ key: "drive_refresh_token", value: tokens.refresh_token, updated_at: new Date().toISOString() }, { onConflict: "key" });
      } catch {}
    }
  });

  return google.drive({ version: "v3", auth });
}

// Returns a fresh access token suitable for direct fetch calls (e.g. streaming)
export async function getAdminAccessToken(): Promise<string> {
  const refreshToken = await getStoredRefreshToken();
  const auth = buildOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No se pudo obtener access token del admin");
  return token;
}
