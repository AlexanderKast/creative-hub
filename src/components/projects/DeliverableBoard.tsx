"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Loader2, Calendar, User, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Deliverable, DeliverableType, DeliverableStatus, ProjectMemberRole } from "@/types";
import { RoleBadge, ROLE_LABELS } from "./RoleBadge";

const TYPE_LABELS: Record<DeliverableType, string> = {
  creative_upload: "Subir creativo",
  copy:            "Copy / Texto",
  strategy_doc:    "Doc. estrategia",
  campaign_setup:  "Setup campaña",
  design:          "Diseño",
  video_edit:      "Edición video",
  other:           "Otro",
};

const TYPE_COLORS: Record<DeliverableType, string> = {
  creative_upload: "bg-purple-100 text-purple-700",
  copy:            "bg-blue-100 text-blue-700",
  strategy_doc:    "bg-indigo-100 text-indigo-700",
  campaign_setup:  "bg-orange-100 text-orange-700",
  design:          "bg-pink-100 text-pink-700",
  video_edit:      "bg-emerald-100 text-emerald-700",
  other:           "bg-gray-100 text-gray-600",
};

const COLUMNS: { status: DeliverableStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: "pending",     label: "Pendiente",    color: "bg-gray-50 border-gray-200",    icon: <Clock size={13} className="text-gray-400" /> },
  { status: "in_progress", label: "En progreso",  color: "bg-yellow-50 border-yellow-200",icon: <Loader2 size={13} className="text-yellow-500" /> },
  { status: "review",      label: "En revisión",  color: "bg-orange-50 border-orange-200",icon: <AlertCircle size={13} className="text-orange-500" /> },
  { status: "approved",    label: "Aprobado",     color: "bg-green-50 border-green-200",  icon: <CheckCircle2 size={13} className="text-green-500" /> },
  { status: "rejected",    label: "Rechazado",    color: "bg-red-50 border-red-200",      icon: <XCircle size={13} className="text-red-500" /> },
  { status: "done",        label: "Completado",   color: "bg-blue-50 border-blue-200",    icon: <CheckCircle2 size={13} className="text-blue-500" /> },
];

const ALL_TYPES: DeliverableType[] = ["creative_upload", "copy", "strategy_doc", "campaign_setup", "design", "video_edit", "other"];
const ALL_ROLES: ProjectMemberRole[] = ["admin", "community_manager", "content_strategist", "traffic", "designer", "editor", "viewer"];
const NEXT_STATUS: Partial<Record<DeliverableStatus, DeliverableStatus>> = {
  pending: "in_progress",
  in_progress: "review",
  rejected: "in_progress",
};

interface FormState { title: string; description: string; assignedTo: string; memberRole: ProjectMemberRole | ""; type: DeliverableType; dueDate: string; notes: string; }
const EMPTY_FORM: FormState = { title: "", description: "", assignedTo: "", memberRole: "", type: "creative_upload", dueDate: "", notes: "" };

interface Props {
  projectId: string;
  deliverables: Deliverable[];
  myEmail: string;
  myRole: ProjectMemberRole;
  onUpdate: () => void;
}

export function DeliverableBoard({ projectId, deliverables, myEmail, myRole, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);

  const canManage = ["admin", "content_strategist"].includes(myRole);
  const canApprove = ["admin", "content_strategist"].includes(myRole);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    if (!form.title.trim()) { setError("Título requerido"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, memberRole: form.memberRole || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setForm(EMPTY_FORM); setShowForm(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: DeliverableStatus, notes?: string) => {
    setReviewing(id);
    await fetch(`/api/projects/${projectId}/deliverables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewerNotes: notes }),
    });
    setReviewing(null);
    setExpandedId(null);
    setReviewNotes("");
    onUpdate();
  };

  const byStatus = (status: DeliverableStatus) => deliverables.filter((d) => d.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{deliverables.length} entregable{deliverables.length !== 1 ? "s" : ""}</h3>
        {canManage && (
          <button onClick={() => { setForm(EMPTY_FORM); setError(""); setShowForm(!showForm); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors">
            <Plus size={13} /> Nuevo entregable
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Título del entregable *"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={(e) => set("type", e.target.value as DeliverableType)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ALL_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <select value={form.memberRole} onChange={(e) => set("memberRole", e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin rol asignado</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <input value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder="Email del responsable"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2}
            placeholder="Descripción de lo que se necesita..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-1.5 border border-gray-300 text-xs rounded-lg hover:bg-white transition-colors">Cancelar</button>
            <button onClick={create} disabled={saving}
              className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
              {saving && <Loader2 size={12} className="animate-spin" />} Crear
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const items = byStatus(col.status);
          return (
            <div key={col.status} className={`rounded-xl border p-3 space-y-2 ${col.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {col.icon}
                  <span className="text-xs font-semibold text-gray-700">{col.label}</span>
                </div>
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-600 shadow-sm">
                  {items.length}
                </span>
              </div>

              {items.length === 0 && (
                <p className="text-[10px] text-gray-400 text-center py-2">Vacío</p>
              )}

              {items.map((d) => {
                const isExpanded = expandedId === d.id;
                const isMine = d.assignedTo === myEmail;
                const nextSt = NEXT_STATUS[d.status];
                return (
                  <div key={d.id} className="bg-white rounded-lg p-2.5 shadow-sm space-y-1.5 border border-white/80">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-800 leading-tight flex-1">{d.title}</p>
                      <button onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        className="p-0.5 text-gray-300 hover:text-gray-600 shrink-0">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${TYPE_COLORS[d.type]}`}>
                        {TYPE_LABELS[d.type]}
                      </span>
                      {d.role && <RoleBadge role={d.role} size="xs" />}
                    </div>

                    {(d.assignedTo || d.dueDate) && (
                      <div className="flex items-center gap-2 text-[9px] text-gray-400">
                        {d.assignedTo && (
                          <span className="flex items-center gap-0.5 truncate"><User size={8} /> {d.assignedTo.split("@")[0]}</span>
                        )}
                        {d.dueDate && (
                          <span className="flex items-center gap-0.5 shrink-0"><Calendar size={8} /> {new Date(d.dueDate).toLocaleDateString("es-CO", { month: "short", day: "numeric" })}</span>
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="pt-1 space-y-1.5 border-t border-gray-100">
                        {d.description && <p className="text-[10px] text-gray-500">{d.description}</p>}
                        {d.reviewerNotes && (
                          <p className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">
                            Feedback: {d.reviewerNotes}
                          </p>
                        )}

                        {/* Self-advance (assignee) */}
                        {isMine && nextSt && (
                          <button onClick={() => changeStatus(d.id, nextSt)} disabled={reviewing === d.id}
                            className="w-full px-2 py-1 bg-indigo-600 text-white text-[10px] font-medium rounded hover:bg-indigo-500 transition-colors disabled:opacity-60">
                            Marcar como {COLUMNS.find((c) => c.status === nextSt)?.label}
                          </button>
                        )}

                        {/* Approve / Reject (admin/strategist) */}
                        {canApprove && d.status === "review" && (
                          <div className="space-y-1.5">
                            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
                              placeholder="Notas de revisión (opcional)..."
                              className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none" />
                            <div className="flex gap-1.5">
                              <button onClick={() => changeStatus(d.id, "approved", reviewNotes)} disabled={reviewing === d.id}
                                className="flex-1 px-2 py-1 bg-green-600 text-white text-[10px] font-medium rounded hover:bg-green-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                                <CheckCircle2 size={9} /> Aprobar
                              </button>
                              <button onClick={() => changeStatus(d.id, "rejected", reviewNotes)} disabled={reviewing === d.id}
                                className="flex-1 px-2 py-1 bg-red-600 text-white text-[10px] font-medium rounded hover:bg-red-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                                <XCircle size={9} /> Rechazar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Mark done (admin) */}
                        {canApprove && d.status === "approved" && (
                          <button onClick={() => changeStatus(d.id, "done")} disabled={reviewing === d.id}
                            className="w-full px-2 py-1 bg-blue-600 text-white text-[10px] font-medium rounded hover:bg-blue-500 transition-colors disabled:opacity-60">
                            Marcar como Completado
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
