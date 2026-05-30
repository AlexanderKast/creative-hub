"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, TrendingUp, DollarSign, Eye, MousePointerClick, Target } from "lucide-react";
import { Campaign, CampaignPlatform, CampaignType } from "@/types";

const PLATFORM_CFG: Record<CampaignPlatform, { label: string; color: string }> = {
  meta_ads:          { label: "Meta Ads",        color: "bg-blue-600" },
  tiktok_ads:        { label: "TikTok Ads",       color: "bg-black" },
  google_ads:        { label: "Google Ads",       color: "bg-red-500" },
  instagram_organic: { label: "Instagram",        color: "bg-pink-500" },
  tiktok_organic:    { label: "TikTok",           color: "bg-gray-900" },
  youtube_ads:       { label: "YouTube Ads",      color: "bg-red-600" },
  whatsapp:          { label: "WhatsApp",         color: "bg-green-600" },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  planning:   { label: "Planeando",    color: "text-gray-500 bg-gray-100" },
  production: { label: "Producción",  color: "text-yellow-700 bg-yellow-100" },
  review:     { label: "Revisión",     color: "text-orange-700 bg-orange-100" },
  active:     { label: "Activa",       color: "text-green-700 bg-green-100" },
  paused:     { label: "Pausada",      color: "text-yellow-700 bg-yellow-50" },
  ended:      { label: "Terminada",    color: "text-gray-500 bg-gray-100" },
};

const OBJECTIVES: Record<string, string> = {
  awareness:     "Alcance",
  consideration: "Consideración",
  conversion:    "Conversión",
  traffic:       "Tráfico",
  engagement:    "Engagement",
  leads:         "Leads",
};

const ALL_PLATFORMS: CampaignPlatform[] = ["meta_ads", "tiktok_ads", "google_ads", "instagram_organic", "tiktok_organic", "youtube_ads", "whatsapp"];
const ALL_STATUSES = ["planning", "production", "review", "active", "paused", "ended"];
const ALL_OBJECTIVES = ["awareness", "consideration", "conversion", "traffic", "engagement", "leads"];
const ALL_TYPES: { value: CampaignType; label: string }[] = [{ value: "paid", label: "Paga" }, { value: "organic", label: "Orgánica" }];

interface FormState {
  name: string;
  platform: CampaignPlatform;
  type: CampaignType;
  status: string;
  objective: string;
  budget: string;
  startDate: string;
  endDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "", platform: "meta_ads", type: "paid", status: "planning",
  objective: "", budget: "", startDate: "", endDate: "", notes: "",
};

interface Props {
  projectId: string;
  campaigns: Campaign[];
  canEdit: boolean;
  onUpdate: () => void;
}

function fmtNum(n: number) { return n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n); }
function fmtCur(n: number | null) { return n != null ? `$${n.toLocaleString("es-CO")}` : "—"; }

export function CampaignList({ projectId, campaigns, canEdit, onUpdate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMetrics, setShowMetrics] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ impressions: "", clicks: "", conversions: "", spent: "", roas: "", ctr: "", cpm: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setError(""); setShowForm(true); };
  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name, platform: c.platform, type: c.type, status: c.status,
      objective: c.objective ?? "", budget: c.budget ? String(c.budget) : "",
      startDate: c.startDate?.slice(0, 10) ?? "", endDate: c.endDate?.slice(0, 10) ?? "",
      notes: c.notes ?? "",
    });
    setEditId(c.id); setError(""); setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Nombre requerido"); return; }
    setSaving(true);
    setError("");
    try {
      if (editId) {
        const res = await fetch(`/api/projects/${projectId}/campaigns/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, budget: form.budget ? parseFloat(form.budget) : null }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      } else {
        const res = await fetch(`/api/projects/${projectId}/campaigns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, budget: form.budget ? parseFloat(form.budget) : null }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      }
      setShowForm(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects/${projectId}/campaigns/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    onUpdate();
  };

  const saveMetrics = async (id: string) => {
    const parsed: Record<string, number> = {};
    Object.entries(metrics).forEach(([k, v]) => { if (v) parsed[k] = parseFloat(v); });
    await fetch(`/api/projects/${projectId}/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    setShowMetrics(null);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}</h3>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors">
            <Plus size={13} /> Nueva campaña
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700">{editId ? "Editar campaña" : "Nueva campaña"}</h4>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nombre de la campaña *"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.platform} onChange={(e) => set("platform", e.target.value as CampaignPlatform)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_CFG[p].label}</option>)}
            </select>
            <select value={form.type} onChange={(e) => set("type", e.target.value as CampaignType)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ALL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
            </select>
            <select value={form.objective} onChange={(e) => set("objective", e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Sin objetivo</option>
              {ALL_OBJECTIVES.map((o) => <option key={o} value={o}>{OBJECTIVES[o]}</option>)}
            </select>
            <input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="Presupuesto ($)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} placeholder="Fecha fin"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Notas..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-1.5 border border-gray-300 text-xs rounded-lg hover:bg-white transition-colors">Cancelar</button>
            <button onClick={save} disabled={saving}
              className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
              {saving && <Loader2 size={12} className="animate-spin" />} Guardar
            </button>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {campaigns.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 text-center py-8">No hay campañas en este proyecto</p>
      )}
      <div className="space-y-3">
        {campaigns.map((c) => {
          const plat = PLATFORM_CFG[c.platform];
          const stat = STATUS_CFG[c.status] ?? STATUS_CFG.planning;
          const budgetPct = c.budget && c.spent ? Math.min(100, (c.spent / c.budget) * 100) : null;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold text-white ${plat.color}`}>{plat.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${stat.color}`}>{stat.label}</span>
                    {c.objective && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                        {OBJECTIVES[c.objective]}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setShowMetrics(showMetrics === c.id ? null : c.id); setMetrics({ impressions: "", clicks: "", conversions: "", spent: "", roas: "", ctr: "", cpm: "" }); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Actualizar métricas">
                        <TrendingUp size={13} />
                      </button>
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Eliminar campaña">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm font-semibold text-gray-900 mb-1">{c.name}</p>

                {/* Budget */}
                {c.budget && (
                  <div className="mb-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><DollarSign size={9} /> {fmtCur(c.spent)} gastado</span>
                      <span>{fmtCur(c.budget)} total</span>
                    </div>
                    {budgetPct !== null && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${budgetPct}%` }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Metrics row */}
                {(c.impressions > 0 || c.roas || c.ctr) && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {c.impressions > 0 && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><Eye size={9} /> Impres.</p>
                        <p className="text-xs font-semibold text-gray-800">{fmtNum(c.impressions)}</p>
                      </div>
                    )}
                    {c.clicks > 0 && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><MousePointerClick size={9} /> Clicks</p>
                        <p className="text-xs font-semibold text-gray-800">{fmtNum(c.clicks)}</p>
                      </div>
                    )}
                    {c.roas !== null && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">ROAS</p>
                        <p className="text-xs font-semibold text-green-700">{c.roas}x</p>
                      </div>
                    )}
                    {c.conversions > 0 && (
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5"><Target size={9} /> Conv.</p>
                        <p className="text-xs font-semibold text-gray-800">{c.conversions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm delete */}
              {confirmDeleteId === c.id && (
                <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-red-700 font-medium">¿Eliminar "{c.name}"?</p>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-white transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => remove(c.id)}
                      className="px-3 py-1 text-xs bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors">
                      Eliminar
                    </button>
                  </div>
                </div>
              )}

              {/* Metrics form */}
              {showMetrics === c.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Actualizar métricas</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["impressions", "clicks", "conversions", "spent", "roas", "ctr", "cpm"].map((k) => (
                      <input key={k} type="number" step="any" placeholder={k}
                        value={metrics[k as keyof typeof metrics]}
                        onChange={(e) => setMetrics((m) => ({ ...m, [k]: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    ))}
                  </div>
                  <button onClick={() => saveMetrics(c.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors">
                    Guardar métricas
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
