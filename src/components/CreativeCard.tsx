"use client";

import { memo, useState } from "react";
import { Play, ImageIcon, Pencil, Sparkles, ExternalLink, Maximize2, FileText, Download, Star } from "lucide-react";
import { Creative } from "@/types";
import { ContentTypeBadge, StatusBadge, PlatformBadge } from "./TagBadge";
import { CopyGeneratorModal } from "./CopyGeneratorModal";

interface Props {
  creative: Creative;
  onTag: (id: string) => void;
  onScore: (id: string) => void;
  onEdit: (creative: Creative) => void;
  onPreview: (creative: Creative) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const { bg, ring } = score >= 70
    ? { bg: "bg-emerald-500", ring: "ring-emerald-400" }
    : score >= 40
    ? { bg: "bg-amber-400",   ring: "ring-amber-300" }
    : { bg: "bg-red-500",     ring: "ring-red-400" };
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ring-1 ${bg} ${ring}`}
      title={`Score: ${score}/100`}
    >
      <Star size={7} fill="white" aria-hidden="true" />
      {score}
    </span>
  );
}

export const CreativeCard = memo(function CreativeCard({ creative, onTag, onScore, onEdit, onPreview }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showCopy, setShowCopy] = useState(false);

  const isVideo = creative.fileType === "video";
  // Proxy server-side: evita problemas de cookies/auth de Google
  const thumbSrc = imgError ? null : `/api/thumb/${creative.id}`;

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Thumbnail — portrait 9:16 */}
      <div
        className="relative bg-gray-100 overflow-hidden cursor-pointer"
        style={{ aspectRatio: "9/16" }}
        onClick={() => onPreview(creative)}
      >
        {/* Skeleton */}
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-100 animate-pulse" />
        )}

        {thumbSrc && (
          <img
            src={thumbSrc}
            alt={creative.name}
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}

        {/* Fallback sin thumbnail */}
        {imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-300 px-2">
            {isVideo ? <Play size={28} /> : <ImageIcon size={28} />}
            <span className="text-[9px] text-center text-gray-400 leading-tight line-clamp-2">
              {creative.name}
            </span>
          </div>
        )}

        {/* Badge VIDEO */}
        {isVideo && (
          <div className="absolute top-2 left-2 z-10">
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded-full backdrop-blur-sm font-semibold tracking-wide">
              <Play size={7} fill="white" /> VIDEO
            </span>
          </div>
        )}

        {/* Hover — play/expand */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
            {isVideo
              ? <Play size={24} className="text-white" fill="white" />
              : <Maximize2 size={20} className="text-white" />}
          </div>
        </div>

        {/* Acciones — esquina superior derecha */}
        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCopy(true); }}
            className="p-1.5 bg-purple-600/90 rounded-lg text-white hover:bg-purple-600 shadow-sm transition-colors"
            aria-label="Generar copy con IA"
          >
            <FileText size={11} aria-hidden="true" />
          </button>
          <a
            href={`/api/download/${creative.id}`}
            download
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white shadow-sm transition-colors"
            aria-label="Descargar en máxima calidad"
          >
            <Download size={11} aria-hidden="true" />
          </a>
          {creative.webViewLink && (
            <a
              href={creative.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white shadow-sm transition-colors"
              aria-label="Abrir en Drive"
            >
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(creative); }}
            className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white shadow-sm transition-colors"
            aria-label="Editar etiquetas"
          >
            <Pencil size={11} aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTag(creative.id); }}
            disabled={creative.isTagging}
            className="p-1.5 bg-indigo-600/90 rounded-lg text-white hover:bg-indigo-600 shadow-sm transition-colors disabled:opacity-50"
            aria-label="Auto-etiquetar con IA"
          >
            <Sparkles size={11} aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onScore(creative.id); }}
            disabled={creative.isScoring}
            className="p-1.5 bg-amber-500/90 rounded-lg text-white hover:bg-amber-500 shadow-sm transition-colors disabled:opacity-50"
            aria-label="Calcular Winning Ad Score"
          >
            <Star size={11} aria-hidden="true" />
          </button>
        </div>

        {/* Tagging / scoring spinner */}
        {(creative.isTagging || creative.isScoring) && (
          <div className="absolute inset-0 z-30 bg-black/50 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 space-y-1 flex-1">
        <p className="text-[11px] font-medium text-gray-800 leading-tight line-clamp-2" title={creative.name}>
          {creative.name}
        </p>
        <p className="text-[10px] text-gray-400 truncate">{creative.folderName}{creative.size ? ` · ${creative.size}` : ""}</p>
        <div className="flex flex-wrap gap-0.5 items-center">
          <ContentTypeBadge type={creative.tags.contentType} />
          <StatusBadge status={creative.tags.status} />
          {creative.score != null && <ScoreBadge score={creative.score} />}
        </div>
        {creative.tags.platforms.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {creative.tags.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
          </div>
        )}
      </div>

      {showCopy && (
        <CopyGeneratorModal creative={creative} onClose={() => setShowCopy(false)} />
      )}
    </div>
  );
});
