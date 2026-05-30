"use client";

import { useEffect, useRef } from "react";
import "plyr/dist/plyr.css";

interface Props {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  autoPlay?: boolean;
}

export function VideoPlayer({ src, poster, className, style, autoPlay = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<import("plyr") | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    let cancelled = false;

    import("plyr").then(({ default: Plyr }) => {
      if (cancelled || !videoRef.current) return;
      playerRef.current = new Plyr(videoRef.current, {
        controls: [
          "play-large", "play", "progress", "current-time", "duration",
          "mute", "volume", "settings", "pip", "fullscreen",
        ],
        settings: ["speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        autoplay: autoPlay,
        resetOnEnd: false,
        invertTime: false,
        tooltips: { controls: false, seek: true },
        i18n: {
          play: "Reproducir",
          pause: "Pausar",
          mute: "Silenciar",
          unmute: "Activar sonido",
          enterFullscreen: "Pantalla completa",
          exitFullscreen: "Salir",
          speed: "Velocidad",
          normal: "Normal",
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [src, autoPlay]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      playsInline
      className={className}
      style={style}
    />
  );
}
