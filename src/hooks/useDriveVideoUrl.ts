"use client";

/**
 * useDriveVideoUrl
 *
 * Obtiene una URL directa a googleapis.com para reproducir un video de Drive
 * sin pasar por el proxy de Next.js (/api/file/[id]).
 *
 * - Llama a /api/video-url/[id] para obtener la URL con token embebido
 * - Renueva automaticamente la URL 5 minutos antes de que expire
 * - Mientras carga, retorna null (el caller puede mostrar el proxy como fallback)
 *
 * Uso:
 *   const directUrl = useDriveVideoUrl(creative.id);
 *   const src = directUrl ?? `/api/file/${creative.id}`;
 */

import { useState, useEffect, useRef } from "react";

interface VideoUrlResponse {
  url: string;
  expiresAt: number; // Unix timestamp en segundos
}

const RENEWAL_MARGIN_SECONDS = 5 * 60; // Renovar 5 min antes de expirar

export function useDriveVideoUrl(fileId: string): string | null {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const renewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchUrl() {
      // Cancelar peticion anterior si el fileId cambio
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/video-url/${fileId}`, {
          signal: abortRef.current.signal,
          // No cachear: cada llamada debe tener un token fresco
          cache: "no-store",
        });

        if (!res.ok || !mounted) return;

        const data: VideoUrlResponse = await res.json();
        if (!mounted) return;

        setDirectUrl(data.url);

        // Programar renovacion automatica
        const secondsUntilRenewal = data.expiresAt - Math.floor(Date.now() / 1000) - RENEWAL_MARGIN_SECONDS;

        if (secondsUntilRenewal > 0) {
          renewTimerRef.current = setTimeout(() => {
            if (mounted) fetchUrl();
          }, secondsUntilRenewal * 1000);
        }
      } catch (err) {
        // AbortError es esperado cuando el componente se desmonta o fileId cambia
        if (err instanceof Error && err.name === "AbortError") return;
        console.warn("[useDriveVideoUrl] No se pudo obtener URL directa, usando proxy", err);
        // No setear directUrl — el caller usa el proxy como fallback
      }
    }

    setDirectUrl(null); // Reset al cambiar fileId
    fetchUrl();

    return () => {
      mounted = false;
      abortRef.current?.abort();
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
    };
  }, [fileId]);

  return directUrl;
}
