"use client";

import Link from "next/link";
import { Calendar, Users, Megaphone, CheckSquare, ArrowRight } from "lucide-react";
import { Project } from "@/types";
import { RoleBadge } from "./RoleBadge";

const TYPE_LABELS: Record<string, string> = {
  paid_campaign:    "Campaña Paga",
  organic_campaign: "Campaña Orgánica",
  partner:          "Partner",
  ugc_campaign:     "Campaña UGC",
  branding:         "Branding",
};

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  draft:     { label: "Borrador",    dot: "bg-gray-400" },
  active:    { label: "Activo",      dot: "bg-green-500" },
  paused:    { label: "Pausado",     dot: "bg-yellow-500" },
  completed: { label: "Completado",  dot: "bg-blue-500" },
  archived:  { label: "Archivado",   dot: "bg-gray-300" },
};

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;
  const stats = project.deliverableStats;
  const progress = stats && stats.total > 0
    ? Math.round(((stats.done + stats.approved) / stats.total) * 100)
    : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ background: project.coverColor }} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
              <span className="text-[10px] text-gray-500 font-medium">{statusCfg.label}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1 group-hover:text-indigo-700 transition-colors">
              {project.name}
            </h3>
            {project.clientName && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{project.clientName}</p>
            )}
          </div>
          <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />
        </div>

        {/* Type badge + role */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
            {TYPE_LABELS[project.type] ?? project.type}
          </span>
          {project.myRole && <RoleBadge role={project.myRole} size="xs" />}
        </div>

        {/* Progress bar */}
        {progress !== null && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">Entregables</span>
              <span className="text-[10px] font-semibold text-gray-700">{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: project.coverColor }}
              />
            </div>
            {stats && stats.review > 0 && (
              <p className="text-[10px] text-yellow-600 font-medium">{stats.review} en revisión</p>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          {project.memberCount !== undefined && (
            <span className="flex items-center gap-1"><Users size={10} /> {project.memberCount}</span>
          )}
          {project.campaignCount !== undefined && (
            <span className="flex items-center gap-1"><Megaphone size={10} /> {project.campaignCount}</span>
          )}
          {(project.startDate || project.endDate) && (
            <span className="flex items-center gap-1 ml-auto">
              <Calendar size={10} />
              {project.startDate ? new Date(project.startDate).toLocaleDateString("es-CO", { month: "short", day: "numeric" }) : ""}
              {project.startDate && project.endDate ? " — " : ""}
              {project.endDate ? new Date(project.endDate).toLocaleDateString("es-CO", { month: "short", day: "numeric" }) : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
