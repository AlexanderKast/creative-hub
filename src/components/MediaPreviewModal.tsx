"use client";

import { useEffect, useCallback, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { X, ExternalLink, Pencil, Sparkles, FileText, Trash2, CloudUpload, CheckCircle2, Loader2, Download } from "lucide-react";
import { Creative } from "@/types";
import { ContentTypeBadge, StatusBadge, PlatformBadge } from "./TagBadge";
import { CopyGeneratorModal } from "./CopyGeneratorModal";
import { VideoPlayer } from "./VideoPlayer";

interface Props {
  creative: Creative;
  onClose: () => void;
  onTag: (id: string) => void;
  onEdit: (creative: Creative) => void;
  onDelete: (id: string) => void;
  onBunnySynced?: (id: string, bunnyVideoId: string) => void;
}

export function MediaPreviewModal({ creative, onClose, onTag, onEdit, onDelete, onBunnySynced }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [showCopy, setShowCopy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncingBunny, setIsSyncingBunny] = useState(false);
  const [bunnyId, setBunnyId] = useState(creative.bunnyVideoId ?? null);
  const [bunnyError, setBunnyError] = useState("");

  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/file/${creative.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete(creative.id);
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const syncToBunny = async () => {
    setIsSyncingBunny(true);
    setBunnyError("");
    try {
      const res = await fetch(`/api/bunny/sync/${creative.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: creative.name, mimeType: creative.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBunnyError(data.error ?? "Error al sincronizar con Bunny");
        return;
      }
      setBunnyId(data.bunnyVideoId);
      onBunnySynced?.(creative.id, data.bunnyVideoId);
    } finally {
      setIsSyncingBunny(false);
    }
  };

  const isVideo = creative.fileType === "video";
  const driveSrc = `/api/file/${creative.id}`;
  const thumbSrc = `/api/thumb/${creative.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={trapRef} className="relative bg-black rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: "min(520px, 95vw)", maxHeight: "95vh", width: "100%" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate" title={creative.name}>
              {creative.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1.5">
              {creative.folderName}{creative.size ? ` · ${creative.size}` : ""}
              {bunnyId && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-900/60 text-orange-300 rounded text-[9px] font-semibold">
                  <CheckCircle2 size={9} /> Bunny HLS
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowCopy(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white hover:bg-purple-500 rounded-lg transition-colors text-xs font-medium"
              title="Generar copy con IA">
              <FileText size={12} /> Copy
            </button>
            {/* Bunny sync — solo para videos */}
            {isVideo && !bunnyId && (
              <button onClick={syncToBunny} disabled={isSyncingBunny}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white hover:bg-orange-500 rounded-lg transition-colors text-xs font-medium disabled:opacity-60"
                title="Subir a Bunny Stream (HLS)">
                {isSyncingBunny
                  ? <Loader2 size={12} className="animate-spin" />
                  : <CloudUpload size={12} />}
                {isSyncingBunny ? "Subiendo…" : "Bunny"}
              </button>
            )}
            <a href={`/api/download/${creative.id}`} download
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Descargar en máxima calidad">
              <Download size={14} />
            </a>
            {creative.webViewLink && (
              <a href={creative.webViewLink} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="Abrir en Drive">
                <ExternalLink size={14} />
              </a>
            )}
            <button onClick={() => { onEdit(creative); onClose(); }}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Editar etiquetas">
              <Pencil size={14} />
            </button>
            <button onClick={() => { onTag(creative.id); onClose(); }}
              disabled={creative.isTagging}
              className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
              title="Auto-etiquetar">
              <Sparkles size={14} />
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
              title="Eliminar de Drive">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Error de Bunny */}
        {bunnyError && (
          <div className="bg-red-900/60 px-4 py-2 text-xs text-red-300 flex items-center justify-between shrink-0">
            {bunnyError}
            <button onClick={() => setBunnyError("")} className="text-red-400 hover:text-red-200 ml-2">✕</button>
          </div>
        )}

        {/* Confirm delete banner */}
        {confirmDelete && (
          <div className="bg-red-900/80 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
            <p className="text-sm text-red-200">¿Eliminar de Drive permanentemente?</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 text-xs text-gray-300 hover:text-white border border-gray-600 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold disabled:opacity-60 transition-colors">
                {isDeleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        )}

        {/* Media — portrait 9:16 */}
        <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden"
          style={{ aspectRatio: "9/16" }}>
          {isVideo ? (
            <VideoPlayer
              src={driveSrc}
              poster={thumbSrc}
              className="w-full h-full"
              style={{ maxHeight: "75vh" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={driveSrc}
              alt={creative.name}
              className="w-full h-full object-contain"
              style={{ maxHeight: "75vh" }}
            />
          )}
        </div>

        {/* Tags */}
        <div className="px-4 py-2.5 bg-gray-900 flex flex-wrap items-center gap-1.5 shrink-0">
          <ContentTypeBadge type={creative.tags.contentType} />
          <StatusBadge status={creative.tags.status} />
          {creative.tags.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
          {creative.tags.custom.map((t) => (
            <span key={t} className="px-2 py-0.5 bg-indigo-900 text-indigo-300 rounded-full text-xs">#{t}</span>
          ))}
        </div>
      </div>

      {showCopy && (
        <CopyGeneratorModal creative={creative} onClose={() => setShowCopy(false)} />
      )}
    </div>
  );
}
