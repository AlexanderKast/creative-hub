"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Creative } from "@/types";

interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  result?: Creative;
}

interface Props {
  onUploaded: (creative: Creative) => void;
}

export function UploadButton({ onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    const newItems: UploadItem[] = arr.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => uploadFile(item));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFile = async (item: UploadItem) => {
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, status: "uploading" } : i)
    );
    try {
      const form = new FormData();
      form.append("file", item.file);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => i.id === item.id
            ? { ...i, status: "error", error: data.error ?? "Error al subir" }
            : i)
        );
        return;
      }

      setItems((prev) =>
        prev.map((i) => i.id === item.id
          ? { ...i, status: "done", result: data }
          : i)
      );
      onUploaded(data as Creative);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red";
      setItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, status: "error", error: msg } : i)
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const doneCount = items.filter((i) => i.status === "done").length;
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const allDone = items.length > 0 && uploadingCount === 0 && items.every((i) => i.status !== "pending");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <Upload size={14} />
        Subir
        {uploadingCount > 0 && (
          <span className="ml-0.5 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" />
            {uploadingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-semibold text-gray-900">Subir archivos a Drive</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {allDone
                    ? `${doneCount} subidos${errorCount > 0 ? `, ${errorCount} errores` : ""}`
                    : "Imágenes y videos"}
                </p>
              </div>
              <button
                onClick={() => { setOpen(false); if (allDone) setItems([]); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-400 hover:bg-gray-50"
                }`}
              >
                <Upload size={28} className={`mx-auto mb-3 ${isDragging ? "text-indigo-500" : "text-gray-300"}`} />
                <p className="text-sm font-medium text-gray-600">
                  Arrastra archivos aquí
                </p>
                <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar</p>
                <p className="text-xs text-gray-300 mt-2">Imágenes y videos admitidos</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.file.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {(item.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                        {item.status === "error" && (
                          <p className="text-[10px] text-red-500 mt-0.5">{item.error}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {item.status === "uploading" && (
                          <Loader2 size={16} className="animate-spin text-indigo-500" />
                        )}
                        {item.status === "done" && (
                          <CheckCircle size={16} className="text-emerald-500" />
                        )}
                        {item.status === "error" && (
                          <AlertCircle size={16} className="text-red-500" />
                        )}
                        {item.status === "pending" && (
                          <div className="w-4 h-4 rounded-full bg-gray-200" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {allDone && (
              <div className="px-5 py-4 border-t bg-gray-50">
                <button
                  onClick={() => { setItems([]); setOpen(false); }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
