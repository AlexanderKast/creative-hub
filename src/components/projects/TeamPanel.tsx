"use client";

import { useState } from "react";
import { UserPlus, Trash2, Loader2, Mail } from "lucide-react";
import { ProjectMember, ProjectMemberRole } from "@/types";
import { RoleBadge, ROLE_LABELS } from "./RoleBadge";

const ALL_ROLES: ProjectMemberRole[] = [
  "admin", "community_manager", "content_strategist", "traffic", "designer", "editor", "viewer",
];

interface Props {
  projectId: string;
  members: ProjectMember[];
  canManage: boolean;
  onUpdate: () => void;
}

export function TeamPanel({ projectId, members, canManage, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProjectMemberRole>("editor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const invite = async () => {
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), memberRole: role, name: name.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setEmail(""); setName(""); setShowForm(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al invitar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (memberEmail: string) => {
    setRemoving(memberEmail);
    try {
      await fetch(`/api/projects/${projectId}/members/${encodeURIComponent(memberEmail)}`, { method: "DELETE" });
      onUpdate();
    } finally {
      setRemoving(null);
    }
  };

  const changeRole = async (memberEmail: string, newRole: ProjectMemberRole) => {
    await fetch(`/api/projects/${projectId}/members/${encodeURIComponent(memberEmail)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberRole: newRole }),
    });
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{members.length} miembro{members.length !== 1 ? "s" : ""}</h3>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors">
            <UserPlus size={13} /> Invitar
          </button>
        )}
      </div>

      {/* Invite form */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@dominio.com"
              className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Nombre (opcional)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-white transition-colors">
              Cancelar
            </button>
            <button onClick={invite} disabled={saving || !email.trim()}
              className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No hay miembros en este proyecto</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
              {(m.name ?? m.email)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              {m.name && <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>}
              <p className="text-xs text-gray-500 truncate">{m.email}</p>
            </div>
            {canManage ? (
              <select
                value={m.role}
                onChange={(e) => changeRole(m.email, e.target.value as ProjectMemberRole)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            ) : (
              <RoleBadge role={m.role} size="xs" />
            )}
            {canManage && (
              <button onClick={() => remove(m.email)} disabled={removing === m.email}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50">
                {removing === m.email ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
