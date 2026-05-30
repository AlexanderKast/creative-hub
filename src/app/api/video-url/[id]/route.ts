/**
 * GET /api/video-url/[id]
 *
 * Retorna una URL directa a googleapis.com para reproducir el video sin proxy.
 * El browser descarga el video directo de Google — elimina el hop por Vercel.
 *
 * Seguridad:
 * - Requiere sesion autenticada (NextAuth)
 * - Valida que el usuario tenga acceso al archivo via resolveAccessibleCreative
 * - El access_token de Drive queda en la URL del video: aceptable para uso
 *   interno (agencia), no recomendado para plataformas publicas
 * - El token expira en maximo 3600s (Drive lo invalida en Google)
 *
 * Uso en el player:
 *   const { url } = await fetch(`/api/video-url/${fileId}`).then(r => r.json());
 *   videoElement.src = url; // o player.source = { type: "video", sources: [{ src: url }] }
 *
 * Range requests:
 *   El browser envia Range headers directamente a googleapis.com.
 *   Drive responde con 206 Partial Content — seeking funciona nativamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { resolveAccessibleCreative } from "@/lib/db-queries";
import { getCachedAccessToken, invalidateTokenCache } from "@/lib/drive-token-cache";

export const dynamic = "force-dynamic";

/** Tiempo de vida que anunciamos al cliente para que sepa cuando renovar */
const TOKEN_TTL_SECONDS = 3300; // 55 minutos (Drive emite tokens de 60 min)

interface VideoUrlResponse {
  url: string;
  /** Unix timestamp en segundos cuando la URL dejara de funcionar */
  expiresAt: number;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;

  // Validar acceso al archivo en nuestra base de datos
  const creative = await resolveAccessibleCreative(session.user.email, id);
  if (!creative) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    let accessToken = await getCachedAccessToken();

    // Construir URL directa a Drive API con el token embebido
    const driveUrl = buildDriveMediaUrl(id, accessToken);

    // Verificar que Drive acepta el token antes de devolverlo al cliente.
    // HEAD request: sin body, solo verifica autorizacion. Timeout corto.
    const probe = await fetch(driveUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(8_000),
    });

    if (probe.status === 401 || probe.status === 403) {
      // Token invalido o expirado antes del margen — invalidar cache y reintentar
      invalidateTokenCache();
      accessToken = await getCachedAccessToken();
      const retryUrl = buildDriveMediaUrl(id, accessToken);

      const retryProbe = await fetch(retryUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(8_000),
      });

      if (!retryProbe.ok && retryProbe.status !== 206) {
        console.error("[video-url] Drive rechaza token tras refresco", {
          fileId: id,
          status: retryProbe.status,
        });
        return new NextResponse(null, { status: 502 });
      }

      const body: VideoUrlResponse = {
        url: retryUrl,
        expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      };
      return NextResponse.json(body, { headers: noCacheHeaders() });
    }

    if (!probe.ok && probe.status !== 206) {
      console.error("[video-url] Drive retorno error inesperado", {
        fileId: id,
        status: probe.status,
      });
      return new NextResponse(null, { status: probe.status });
    }

    const body: VideoUrlResponse = {
      url: driveUrl,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    return NextResponse.json(body, { headers: noCacheHeaders() });
  } catch (err) {
    console.error("[video-url] Error al generar URL de Drive", {
      fileId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse(null, { status: 502 });
  }
}

function buildDriveMediaUrl(fileId: string, accessToken: string): string {
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
    access_token: accessToken,
  });
  return `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`;
}

function noCacheHeaders(): HeadersInit {
  return {
    // La URL contiene un token — nunca cachear en CDN ni browser
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Content-Type": "application/json",
  };
}
