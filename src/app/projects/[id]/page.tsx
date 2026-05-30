"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, Edit2, Trash2, Settings,
  Users, Megaphone, CheckSquare, LayoutGrid, Calendar,
} from "lucide-react";
import { Project, ProjectMember, Campaign, Deliverable, ProjectMemberRole } from "@/types";
import { AppShell } from "@/components/AppShell";
import { RoleBadge } from "@/components/projects/RoleBadge";
import { TeamPanel } from "@/components/projects/TeamPanel";
import { CampaignList } from "@/components/projects/CampaignList";
import { DeliverableBoard } from "@/components/projects/DeliverableBoard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import Link from "next/link";

type Tab = "overview" | "team" | "campaigns" | "deliverables";

const TYPE_LABELS: Record<string, string> = {
  paid_campaign:    "Campaña Paga",
  organic_campaign: "Campaña Orgánica",
  partner:          "Partner",
  ugc_campaign:     "Campaña UGC",
  branding:         "Branding",
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  draft:     { label: "Borrador",   color: "bg-gray-100 text-gray-600" },
  active:    { label: "Activo",     color: "bg-green-100 text-green-700" },
  paused:    { label: "Pausado",    color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completado", color: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archivado",  color: "bg-gray-100 text-gray-500" },
};

interface ProjectData {
  project: Project;
  members: ProjectMember[];
  campaigns: Campaign[];
  deliverables?: Deliverable[];
}

export default function ProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  const load = useCallback(async () => {
    const [projRes, delRes] = await Promise.all([
      fetch(`/api/projects/${id}`),
      fetch(`/api/projects/${id}/deliverables`),
    ]);
    if (!projRes.ok) { router.push("/projects"); return; }
    const projData = await projRes.json();
    const delData = delRes.ok ? await delRes.json() : { deliverables: [] };
    setData(projData);
    setDeliverables(delData.deliverables ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") load();
  }, [status, router, load]);

  const saveEdit = async (patch: Partial<Project>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    await load();
  };

  const deleteProject = async () => {
    if (!confirm("¿Eliminar este proyecto permanentemente?")) return;
    setDeleting(true);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projects");
  };

  if (status === "loading" || loading) {
    return <AppShell><div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-indigo-600" /></div></AppShell>;
  }

  if (!data) return null;

  const { project, members, campaigns } = data;
  const myRole = project.myRole as ProjectMemberRole;
  const isAdmin = myRole === "admin";
  const canEdit = ["admin", "content_strategist"].includes(myRole);
  const canEditCampaigns = ["admin", "content_strategist", "traffic"].includes(myRole);
  const statusCfg = STATUS_CFG[project.status] ?? STATUS_CFG.draft;
  const stats = project.deliverableStats;

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview",     label: "Resumen",      icon: <Settings size={14} /> },
    { id: "team",         label: "Equipo",       icon: <Users size={14} />,       count: members.length },
    { id: "campaigns",    label: "Campañas",     icon: <Megaphone size={14} />,   count: campaigns.length },
    { id: "deliverables", label: "Entregables",  icon: <CheckSquare size={14} />, count: deliverables.length },
  ];

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Back */}
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft size={14} /> Proyectos
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="h-2 w-full" style={{ background: project.coverColor }} />
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{TYPE_LABELS[project.type] ?? project.type}</span>
                  <RoleBadge role={myRole} size="xs" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{project.name}</h1>
                {project.clientName && <p className="text-sm text-gray-500">{project.clientName}</p>}
                {project.description && <p className="text-sm text-gray-600">{project.description}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setShowEdit(true)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200">
                    <Edit2 size={15} />
                  </button>
                  {isAdmin && (
                    <button onClick={deleteProject} disabled={deleting}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-gray-200">
                      {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
              {(project.startDate || project.endDate) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar size={13} className="text-gray-400" />
                  {project.startDate && new Date(project.startDate).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  {project.startDate && project.endDate && " — "}
                  {project.endDate && new Date(project.endDate).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Users size={13} className="text-gray-400" /> {members.length} miembro{members.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Megaphone size={13} className="text-gray-400" /> {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}
              </div>
              {stats && stats.total > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckSquare size={13} className="text-gray-400" />
                  {stats.done + stats.approved}/{stats.total} entregables
                  {stats.review > 0 && (
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-medium">
                      {stats.review} en revisión
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  tab === t.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">

          {tab === "overview" && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-900">Brief del proyecto</h3>
              {project.brief ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{project.brief}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin brief definido aún.{canEdit && " Edita el proyecto para agregar el brief."}</p>
              )}

              {/* Progress */}
              {stats && stats.total > 0 && (
                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Progreso general</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Pendientes",   value: stats.total - stats.done - stats.approved - stats.review, color: "text-gray-600" },
                      { label: "En revisión",  value: stats.review,   color: "text-orange-600" },
                      { label: "Aprobados",    value: stats.approved, color: "text-green-600" },
                    ].map((s) => (
                      <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                        <p className={`text-2xl font-bold ${s.color}`}>{Math.max(0, s.value)}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "team" && (
            <TeamPanel
              projectId={id}
              members={members}
              canManage={isAdmin}
              onUpdate={load}
            />
          )}

          {tab === "campaigns" && (
            <CampaignList
              projectId={id}
              campaigns={campaigns}
              canEdit={canEditCampaigns}
              onUpdate={load}
            />
          )}

          {tab === "deliverables" && session?.user?.email && (
            <DeliverableBoard
              projectId={id}
              deliverables={deliverables}
              myEmail={session.user.email}
              myRole={myRole}
              onUpdate={load}
            />
          )}
        </div>
      </div>

      {showEdit && (
        <ProjectForm
          initial={project}
          onSave={saveEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
    </AppShell>
  );
}
