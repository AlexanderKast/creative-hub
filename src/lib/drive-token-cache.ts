/**
 * drive-token-cache.ts
 *
 * Cache en memoria del access_token de Drive para el proceso Node.js.
 * Evita hacer una peticion HTTP a Google en cada request de video.
 *
 * En Vercel (serverless), cada instancia de funcion mantiene su propio cache.
 * El beneficio es para instancias "calientes" que reciben multiples requests
 * antes de ser recicladas — reduce latencia de ~200ms por token refresh.
 *
 * Env vars requeridas (ya existentes en admin-drive.ts):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_DRIVE_REFRESH_TOKEN  (o en Supabase app_settings)
 */

import { google } from "googleapis";
import { supabase } from "./supabase";

interface CachedToken {
  token: string;
  /** Timestamp en ms cuando expira el token (Google: 3600s desde emision) */
  expiresAt: number;
}

// Singleton en memoria del proceso. Sobrevive entre requests en el mismo worker.
let _cache: CachedToken | null = null;

/**
 * Margen de seguridad: refrescar el token 5 minutos antes de que expire.
 * Previene que un request largo falle a mitad de stream por token expirado.
 */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function isTokenValid(cached: CachedToken): boolean {
  return Date.now() < cached.expiresAt - EXPIRY_MARGIN_MS;
}

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
    throw new Error("Drive no configurado. El administrador debe volver a iniciar sesion.");
  }
  return data.value as string;
}

/**
 * Retorna un access_token valido, usando cache en memoria cuando sea posible.
 * Thread-safe para el modelo single-thread de Node.js.
 */
export async function getCachedAccessToken(): Promise<string> {
  if (_cache && isTokenValid(_cache)) {
    return _cache.token;
  }

  const refreshToken = await getStoredRefreshToken();
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  );
  auth.setCredentials({ refresh_token: refreshToken });

  const { token, res } = await auth.getAccessToken();
  if (!token) throw new Error("No se pudo obtener access token de Drive");

  // Google retorna expiry_date en ms desde epoch en el response
  const expiryDate =
    (res?.data as { expiry_date?: number } | undefined)?.expiry_date ??
    Date.now() + 3600 * 1000;

  _cache = { token, expiresAt: expiryDate };
  return token;
}

/**
 * Invalida el cache manualmente. Util si una peticion falla con 401.
 */
export function invalidateTokenCache(): void {
  _cache = null;
}
