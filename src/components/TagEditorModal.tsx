"use client";

import { useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { X, Plus, Loader2, CheckCircle, AlertCircle, Trash2, FolderInput } from "lucide-react";
import { Creative, ContentType, Platform, CreativeStatus, CreativeTags, DriveFolder } from "@/types";

interface Props {
  creative: Creative;
  folders: DriveFolder[];
  onSave: (id: string, tags: CreativeTags, newName: string, newFolderId?: string, newFolderName?: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CONTENT_TYPES: ContentType[] = ["UGC", "testimonio", "demo", "educativo", "producto", "sin_clasificar"];
const PLATFORMS: Platform[] = ["Meta", "TikTok", "YouTube", "Instagram", "sin_sugerencia"];
const STATUSES: CreativeStatus[] = ["listo_para_pautar", "revisar", "descartar", "sin_estado"];

const statusLabels: Record<CreativeStatus, string> = {
  listo_para_pautar: "Listo para pautar",
  revisar: "Revisar",
  descartar: "Descartar",
  sin_estado: "Sin estado",
};

export function TagEditorModal({ creative, folders, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(creative.name);
  const [tags, setTags] = useState<CreativeTags>({ ...creative.tags, custom: [...creative.tags.custom] });
  const [selectedFolderId, setSelectedFolderId] = useState(creative.folderId);
  const [newTag, setNewTag] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const nameChanged = name.trim() !== creative.name;
  const folderChanged = selectedFolderId !== creative.folderId;
  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const togglePlatform = (p: Platform) => {
    setTags((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));
  };

  const addCustomTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.custom.includes(trimmed)) {
      setTags((prev) => ({ ...prev, custom: [...prev.custom, trimmed] }));
    }
    setNewTag("");
  };

  const removeCustomTag = (tag: string) => {
    setTags((prev) => ({ ...prev, custom: prev.custom.filter((t) => t !== tag) }));
  };

  const handleSave = async () => {
    setSaveState("saving");
    setSaveError("");
    try {
      const body: Record<string, string> = {};
      if (nameChanged) body.name = name.trim();
      if (folderChanged && selectedFolder) {
        body.folderId = selectedFolder.id;
        body.currentFolderId = creative.folderId;
        body.folderName = selectedFolder.name;
      }

      if (nameChanged || folderChanged) {
        const res = await fetch(`/api/file/${creative.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setSaveError(data.error ?? "Error al guardar en Drive");
          setSaveState("error");
          return;
        }
      }

      // Persist tags to Supabase
      await fetch("/api/tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: creative.id, tags }),
      }).catch(() => {});

      setSaveState("ok");
      onSave(
        creative.id,
        tags,
        name.trim(),
        folderChanged ? selectedFolder?.id : undefined,
        folderChanged ? selectedFolder?.name : undefined,
      );
      onClose();
    } catch {
      setSaveError("Error de red");
      setSaveState("error");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/file/${creative.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Error al eliminar");
        setIsDeleting(false);
        setConfirmDelete(false);
        return;
      }
      onDelete(creative.id);
      onClose();
    } catch {
      setSaveError("Error de red al eliminar");
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={trapRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900">Editar archivo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Nombre en Drive
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveState("idle"); setSaveError(""); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-20"
                placeholder="Nombre del archivo"
              />
              {nameChanged && saveState === "idle" && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-medium">
                  sin guardar
                </span>
              )}
            </div>
          </div>

          {/* Mover a carpeta */}
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <span className="flex items-center gap-1"><FolderInput size={12} /> Carpeta de destino</span>
              </label>
              <select
                value={selectedFolderId}
                onChange={(e) => { setSelectedFolderId(e.target.value); setSaveState("idle"); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {folderChanged && (
                <p className="text-[10px] text-amber-500 mt-1 font-medium">
                  Se moverá de "{creative.folderName}" a "{selectedFolder?.name}"
                </p>
              )}
            </div>
          )}

          {/* Content Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Tipo de contenido
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button key={ct}
                  onClick={() => setTags((prev) => ({ ...prev, contentType: ct }))}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    tags.contentType === ct
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {ct.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Plataformas sugeridas
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.filter((p) => p !== "sin_sugerencia").map((p) => (
                <button key={p} onClick={() => togglePlatform(p)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    tags.platforms.includes(p)
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Estado
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setTags((prev) => ({ ...prev, status: s }))}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    tags.status === s
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Etiquetas personalizadas
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                placeholder="Añadir etiqueta…"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button onClick={addCustomTag}
                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.custom.map((tag) => (
                <span key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                  {tag}
                  <button onClick={() => removeCustomTag(tag)} className="hover:text-red-500">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Error */}
          {saveState === "error" && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
              <AlertCircle size={14} /> {saveError}
            </p>
          )}

          {/* Delete zone */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-dashed border-red-200"
            >
              <Trash2 size={14} />
              Eliminar de Drive
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">¿Eliminar "{creative.name}"?</p>
              <p className="text-xs text-red-500">Esta acción borra el archivo de Google Drive permanentemente.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {isDeleting ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saveState === "saving" && <Loader2 size={14} className="animate-spin" />}
            {saveState === "ok" && <CheckCircle size={14} />}
            {(nameChanged || folderChanged) ? "Guardar en Drive" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
