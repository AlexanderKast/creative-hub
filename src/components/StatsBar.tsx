"use client";

import { Creative } from "@/types";
import { FileVideo, Image, Tag, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  all: Creative[];
  filtered: Creative[];
  total: number | null;
  isLoading: boolean;
  hasActiveFilter: boolean;
}

export function StatsBar({ all, filtered, total, isLoading, hasActiveFilter }: Props) {
  const videos = filtered.filter((f) => f.fileType === "video").length;
  const images = filtered.filter((f) => f.fileType === "image").length;
  const tagged = filtered.filter((f) => f.tags.contentType !== "sin_clasificar").length;
  const ready = filtered.filter((f) => f.tags.status === "listo_para_pautar").length;

  let statusLine: React.ReactNode;
  if (isLoading && hasActiveFilter) {
    statusLine = (
      <span className="flex items-center gap-1.5 text-indigo-500">
        <Loader2 size={12} className="animate-spin" />
        Buscando en {total != null ? total.toLocaleString() : "todos los"} archivos de Supabase…
      </span>
    );
  } else if (hasActiveFilter && total != null) {
    statusLine = (
      <span>
        <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> resultados en Supabase
        {all.length > 0 && ` · ${all.length.toLocaleString()} cargados`}
      </span>
    );
  } else {
    statusLine = (
      <span>
        <span className="font-semibold text-gray-700">{(total ?? all.length).toLocaleString()}</span> creativos indexados en Supabase
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard icon={<FileVideo size={18} className="text-indigo-500" />} label="Videos" value={videos} />
      <StatCard icon={<Image size={18} className="text-pink-500" />} label="Imágenes" value={images} />
      <StatCard icon={<Tag size={18} className="text-amber-500" />} label="Etiquetados" value={tagged} />
      <StatCard icon={<CheckCircle size={18} className="text-emerald-500" />} label="Listos" value={ready} />
      <p className="col-span-full text-xs text-gray-400 text-right">{statusLine}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
