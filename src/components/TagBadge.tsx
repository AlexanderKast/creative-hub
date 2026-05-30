"use client";

import { ContentType, CreativeStatus, Platform } from "@/types";

const contentTypeColors: Record<ContentType, string> = {
  UGC:               "bg-purple-100 text-purple-700",
  testimonio:        "bg-blue-100 text-blue-700",
  demo:              "bg-yellow-100 text-yellow-700",
  educativo:         "bg-green-100 text-green-700",
  producto:          "bg-orange-100 text-orange-700",
  behind_the_scenes: "bg-teal-100 text-teal-700",
  sin_clasificar:    "bg-gray-100 text-gray-500",
};

const statusColors: Record<CreativeStatus, string> = {
  listo_para_pautar: "bg-emerald-100 text-emerald-700",
  revisar: "bg-amber-100 text-amber-700",
  descartar: "bg-red-100 text-red-700",
  sin_estado: "bg-gray-100 text-gray-400",
};

const platformColors: Record<Platform, string> = {
  Meta: "bg-blue-500 text-white",
  TikTok: "bg-black text-white",
  YouTube: "bg-red-500 text-white",
  Instagram: "bg-pink-500 text-white",
  sin_sugerencia: "bg-gray-200 text-gray-500",
};

const statusLabels: Record<CreativeStatus, { icon: string; text: string }> = {
  listo_para_pautar: { icon: "✓", text: "Listo" },
  revisar:           { icon: "⚠", text: "Revisar" },
  descartar:         { icon: "✕", text: "Descartar" },
  sin_estado:        { icon: "—", text: "Sin estado" },
};

export function ContentTypeBadge({ type }: { type: ContentType }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${contentTypeColors[type]}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

export function StatusBadge({ status }: { status: CreativeStatus }) {
  const { icon, text } = statusLabels[status];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
      <span aria-hidden="true">{icon} </span>{text}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === "sin_sugerencia") return null;
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${platformColors[platform]}`}>
      {platform}
    </span>
  );
}
