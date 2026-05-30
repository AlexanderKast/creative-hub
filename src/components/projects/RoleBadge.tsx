"use client";

import { ProjectMemberRole } from "@/types";

const ROLE_CONFIG: Record<ProjectMemberRole, { label: string; color: string }> = {
  admin:               { label: "Admin",        color: "bg-purple-100 text-purple-800" },
  community_manager:   { label: "Community",    color: "bg-pink-100 text-pink-800" },
  content_strategist:  { label: "Estratega",    color: "bg-blue-100 text-blue-800" },
  traffic:             { label: "Tráfico",       color: "bg-orange-100 text-orange-800" },
  designer:            { label: "Diseñador",    color: "bg-emerald-100 text-emerald-800" },
  editor:              { label: "Editor",        color: "bg-yellow-100 text-yellow-800" },
  viewer:              { label: "Viewer",        color: "bg-gray-100 text-gray-600" },
};

export const ROLE_LABELS: Record<ProjectMemberRole, string> = Object.fromEntries(
  Object.entries(ROLE_CONFIG).map(([k, v]) => [k, v.label])
) as Record<ProjectMemberRole, string>;

export function RoleBadge({ role, size = "sm" }: { role: ProjectMemberRole; size?: "xs" | "sm" }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${cfg.color} ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
      {cfg.label}
    </span>
  );
}
