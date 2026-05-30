"use client";

import { useMemo } from "react";
import { Search, X, ArrowUpDown, Loader2, Star } from "lucide-react";
import { FilterState, FilterSort, DriveFolder, ContentType, Platform, CreativeStatus, FunnelStage, EmotionalAngle } from "@/types";

interface Props {
  filters: FilterState;
  folders: DriveFolder[];
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  total?: number | null;
  isLoading?: boolean;
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const FILE_TYPES = [
  { value: "all",   label: "Todos los archivos" },
  { value: "video", label: "Solo videos" },
  { value: "image", label: "Solo imágenes" },
];

const CONTENT_TYPES: { value: ContentType | "all"; label: string }[] = [
  { value: "all",              label: "Todos los tipos" },
  { value: "UGC",              label: "UGC" },
  { value: "testimonio",       label: "Testimonio" },
  { value: "demo",             label: "Demo" },
  { value: "educativo",        label: "Educativo" },
  { value: "producto",         label: "Producto" },
  { value: "behind_the_scenes",label: "Behind the scenes" },
  { value: "sin_clasificar",   label: "Sin clasificar" },
];

const FUNNEL_STAGES: { value: FunnelStage | "all"; label: string }[] = [
  { value: "all",  label: "Todo el embudo" },
  { value: "TOFU", label: "TOFU — Awareness" },
  { value: "MOFU", label: "MOFU — Consideración" },
  { value: "BOFU", label: "BOFU — Conversión" },
];

const EMOTIONAL_ANGLES: { value: EmotionalAngle | "all"; label: string }[] = [
  { value: "all",          label: "Todos los ángulos" },
  { value: "dolor",        label: "Dolor" },
  { value: "beneficio",    label: "Beneficio" },
  { value: "curiosidad",   label: "Curiosidad" },
  { value: "social_proof", label: "Social proof" },
  { value: "transformacion",label: "Transformación" },
];

const PLATFORMS: { value: Platform | "all"; label: string }[] = [
  { value: "all",       label: "Todas las plataformas" },
  { value: "Meta",      label: "Meta" },
  { value: "TikTok",    label: "TikTok" },
  { value: "YouTube",   label: "YouTube" },
  { value: "Instagram", label: "Instagram" },
];

const STATUSES: { value: CreativeStatus | "all"; label: string }[] = [
  { value: "all",               label: "Todos los estados" },
  { value: "listo_para_pautar", label: "Listo para pautar" },
  { value: "revisar",           label: "Revisar" },
  { value: "descartar",         label: "Descartar" },
  { value: "sin_estado",        label: "Sin estado" },
];

const SORT_OPTIONS: { value: FilterSort; label: string }[] = [
  { value: "recent",        label: "Más reciente" },
  { value: "oldest",        label: "Más antiguo" },
  { value: "name_az",       label: "Nombre A→Z" },
  { value: "name_za",       label: "Nombre Z→A" },
  { value: "size_desc",     label: "Mayor tamaño" },
  { value: "duration_desc", label: "Más largo" },
  { value: "duration_asc",  label: "Más corto" },
  { value: "score_desc",    label: "★ Mayor score" },
];

// ─── Label helpers ────────────────────────────────────────────────────────────

const statusLabel: Record<CreativeStatus, string> = {
  listo_para_pautar: "Listo para pautar",
  revisar:           "Revisar",
  descartar:         "Descartar",
  sin_estado:        "Sin estado",
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDuration(secs: number): string {
  if (isNaN(secs)) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterChip({
  label,
  color,
  onRemove,
}: {
  label: string;
  color: "blue" | "indigo" | "purple" | "emerald" | "amber" | "gray" | "pink";
  onRemove: () => void;
}) {
  const cls = {
    blue:    "bg-blue-50    border-blue-100    text-blue-700",
    indigo:  "bg-indigo-50  border-indigo-100  text-indigo-700",
    purple:  "bg-purple-50  border-purple-100  text-purple-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amber:   "bg-amber-50   border-amber-100   text-amber-700",
    gray:    "bg-gray-100   border-gray-200    text-gray-600",
    pink:    "bg-pink-50    border-pink-100    text-pink-700",
  }[color];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${cls} shrink-0`}>
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:opacity-60 transition-opacity"
        aria-label={`Eliminar filtro ${label}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

function SelectFilter({
  value,
  defaultValue,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const isActive = value !== defaultValue;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
        isActive
          ? "border-indigo-300 text-indigo-700 font-medium bg-indigo-50/60"
          : "border-gray-200 text-gray-700 hover:border-gray-300"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterBar({ filters, folders, onChange, onReset, total, isLoading }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onChange({ ...filters, [key]: value });

  // Smart search: "#tag" prefix routes to customTag, otherwise searches name
  const searchDisplayValue = filters.customTag ? `#${filters.customTag}` : filters.search;
  const handleSearchChange = (value: string) => {
    if (value.startsWith("#")) {
      onChange({ ...filters, search: "", customTag: value.slice(1) });
    } else {
      onChange({ ...filters, search: value, customTag: "" });
    }
  };
  const clearSearch = () => onChange({ ...filters, search: "", customTag: "" });

  type ChipColor = "blue" | "indigo" | "purple" | "emerald" | "amber" | "gray" | "pink";

  // Build active chip list
  const chips = useMemo(() => {
    const c: Array<{ key: string; label: string; color: ChipColor; onRemove: () => void }> = [];

    if (filters.search)
      c.push({ key: "search", label: `"${filters.search}"`, color: "blue", onRemove: () => set("search", "") });
    if (filters.customTag)
      c.push({ key: "tag", label: `#${filters.customTag}`, color: "pink", onRemove: () => set("customTag", "") });
    if (filters.fileType !== "all")
      c.push({ key: "fileType", label: filters.fileType === "video" ? "Videos" : "Imágenes", color: "indigo", onRemove: () => set("fileType", "all") });
    if (filters.folderId) {
      const folder = folders.find((f) => f.id === filters.folderId);
      c.push({ key: "folder", label: `📁 ${folder?.name ?? "Carpeta"}`, color: "gray", onRemove: () => set("folderId", "") });
    }
    if (filters.contentType !== "all")
      c.push({ key: "contentType", label: filters.contentType, color: "purple", onRemove: () => set("contentType", "all") });
    if (filters.platform !== "all")
      c.push({ key: "platform", label: filters.platform, color: "indigo", onRemove: () => set("platform", "all") });
    if (filters.status !== "all")
      c.push({ key: "status", label: statusLabel[filters.status as CreativeStatus], color: "emerald", onRemove: () => set("status", "all") });
    if (filters.dateFrom)
      c.push({ key: "from", label: `Desde ${fmtDate(filters.dateFrom)}`, color: "amber", onRemove: () => set("dateFrom", "") });
    if (filters.dateTo)
      c.push({ key: "to", label: `Hasta ${fmtDate(filters.dateTo)}`, color: "amber", onRemove: () => set("dateTo", "") });
    if (filters.minSizeMB)
      c.push({ key: "minSize", label: `≥ ${filters.minSizeMB} MB`, color: "gray", onRemove: () => set("minSizeMB", "") });
    if (filters.maxSizeMB)
      c.push({ key: "maxSize", label: `≤ ${filters.maxSizeMB} MB`, color: "gray", onRemove: () => set("maxSizeMB", "") });
    if (filters.minDurSecs)
      c.push({ key: "minDur", label: `≥ ${fmtDuration(parseInt(filters.minDurSecs))}`, color: "purple", onRemove: () => set("minDurSecs", "") });
    if (filters.maxDurSecs)
      c.push({ key: "maxDur", label: `≤ ${fmtDuration(parseInt(filters.maxDurSecs))}`, color: "purple", onRemove: () => set("maxDurSecs", "") });
    if (filters.funnelStage && filters.funnelStage !== "all") {
      const label = FUNNEL_STAGES.find((o) => o.value === filters.funnelStage)?.label ?? filters.funnelStage;
      c.push({ key: "funnel", label, color: "emerald", onRemove: () => set("funnelStage", "all") });
    }
    if (filters.emotionalAngle && filters.emotionalAngle !== "all") {
      const label = EMOTIONAL_ANGLES.find((o) => o.value === filters.emotionalAngle)?.label ?? filters.emotionalAngle;
      c.push({ key: "emotional", label, color: "pink", onRemove: () => set("emotionalAngle", "all") });
    }
    if (filters.minScore)
      c.push({ key: "minScore", label: `Score ≥ ${filters.minScore}`, color: "amber", onRemove: () => set("minScore", "") });
    if (filters.maxScore)
      c.push({ key: "maxScore", label: `Score ≤ ${filters.maxScore}`, color: "amber", onRemove: () => set("maxScore", "") });
    if (filters.sort !== "recent") {
      const sortOpt = SORT_OPTIONS.find((o) => o.value === filters.sort);
      c.push({ key: "sort", label: sortOpt?.label ?? filters.sort, color: "gray", onRemove: () => set("sort", "recent") });
    }

    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, folders]);

  const folderOptions = useMemo(() => [
    { value: "", label: "Todas las carpetas" },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
  ], [folders]);

  const hasActiveFilters = chips.length > 0;
  const activeCount = chips.length;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

      {/* Row 1: Search + Sort */}
      <div className="p-4 pb-3 flex gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchDisplayValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre o #etiqueta…"
            aria-label="Buscar"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors placeholder:text-gray-300"
          />
          {searchDisplayValue && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
          {isLoading && !searchDisplayValue && (
            <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown size={13} className="text-gray-400 shrink-0" />
          <select
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as FilterSort)}
            aria-label="Ordenar por"
            className={`px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              filters.sort !== "recent"
                ? "border-indigo-300 text-indigo-700 font-medium"
                : "border-gray-200 text-gray-700"
            }`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Active filter count badge */}
        {activeCount > 0 && (
          <span className="self-center shrink-0 px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold tabular-nums">
            {activeCount}
          </span>
        )}
      </div>

      {/* Row 2: Filter selects */}
      <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectFilter
          value={filters.fileType}
          defaultValue="all"
          options={FILE_TYPES}
          onChange={(v) => set("fileType", v as FilterState["fileType"])}
          ariaLabel="Tipo de archivo"
        />
        <SelectFilter
          value={filters.folderId}
          defaultValue=""
          options={folderOptions}
          onChange={(v) => set("folderId", v)}
          ariaLabel="Carpeta"
        />
        <SelectFilter
          value={filters.contentType}
          defaultValue="all"
          options={CONTENT_TYPES as { value: string; label: string }[]}
          onChange={(v) => set("contentType", v as ContentType | "all")}
          ariaLabel="Tipo de contenido"
        />
        <SelectFilter
          value={filters.platform}
          defaultValue="all"
          options={PLATFORMS as { value: string; label: string }[]}
          onChange={(v) => set("platform", v as Platform | "all")}
          ariaLabel="Plataforma"
        />
        <SelectFilter
          value={filters.status}
          defaultValue="all"
          options={STATUSES as { value: string; label: string }[]}
          onChange={(v) => set("status", v as CreativeStatus | "all")}
          ariaLabel="Estado"
        />
      </div>

      {/* Row 2b: Smart Folder filters (Feature 7 + Feature 2) */}
      <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SelectFilter
          value={filters.funnelStage ?? "all"}
          defaultValue="all"
          options={FUNNEL_STAGES as { value: string; label: string }[]}
          onChange={(v) => set("funnelStage", v as FunnelStage | "all")}
          ariaLabel="Etapa del embudo"
        />
        <SelectFilter
          value={filters.emotionalAngle ?? "all"}
          defaultValue="all"
          options={EMOTIONAL_ANGLES as { value: string; label: string }[]}
          onChange={(v) => set("emotionalAngle", v as EmotionalAngle | "all")}
          ariaLabel="Ángulo emocional"
        />
        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-2">
          <Star size={12} className="text-amber-400 shrink-0" aria-hidden="true" />
          <span className="text-xs text-gray-400 shrink-0">Score</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={filters.minScore ?? ""}
            onChange={(e) => set("minScore", e.target.value)}
            placeholder="Min"
            aria-label="Score mínimo"
            className={`w-16 px-2 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
              filters.minScore ? "border-amber-300 text-amber-700" : "border-gray-200 text-gray-600"
            }`}
          />
          <span className="text-gray-300 text-xs select-none">—</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={filters.maxScore ?? ""}
            onChange={(e) => set("maxScore", e.target.value)}
            placeholder="Max"
            aria-label="Score máximo"
            className={`w-16 px-2 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors ${
              filters.maxScore ? "border-amber-300 text-amber-700" : "border-gray-200 text-gray-600"
            }`}
          />
        </div>
      </div>

      {/* Row 3: Date + Size + Duration */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2">

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">Fecha</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            aria-label="Desde"
            className={`px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              filters.dateFrom ? "border-amber-300 text-amber-700" : "border-gray-200 text-gray-600"
            }`}
          />
          <span className="text-gray-300 text-xs select-none">—</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            aria-label="Hasta"
            className={`px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              filters.dateTo ? "border-amber-300 text-amber-700" : "border-gray-200 text-gray-600"
            }`}
          />
        </div>

        {/* Size range (MB) */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">Tamaño</span>
          <input
            type="number"
            min="0"
            step="1"
            value={filters.minSizeMB}
            onChange={(e) => set("minSizeMB", e.target.value)}
            placeholder="Min MB"
            aria-label="Tamaño mínimo MB"
            className={`w-20 px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              filters.minSizeMB ? "border-gray-400 text-gray-700" : "border-gray-200 text-gray-600"
            }`}
          />
          <span className="text-gray-300 text-xs select-none">—</span>
          <input
            type="number"
            min="0"
            step="1"
            value={filters.maxSizeMB}
            onChange={(e) => set("maxSizeMB", e.target.value)}
            placeholder="Max MB"
            aria-label="Tamaño máximo MB"
            className={`w-20 px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              filters.maxSizeMB ? "border-gray-400 text-gray-700" : "border-gray-200 text-gray-600"
            }`}
          />
        </div>

        {/* Duration range (seconds) */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">Duración</span>
          <input
            type="number"
            min="0"
            step="5"
            value={filters.minDurSecs}
            onChange={(e) => set("minDurSecs", e.target.value)}
            placeholder="Min seg"
            aria-label="Duración mínima en segundos"
            className={`w-20 px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors ${
              filters.minDurSecs ? "border-purple-300 text-purple-700" : "border-gray-200 text-gray-600"
            }`}
          />
          <span className="text-gray-300 text-xs select-none">—</span>
          <input
            type="number"
            min="0"
            step="5"
            value={filters.maxDurSecs}
            onChange={(e) => set("maxDurSecs", e.target.value)}
            placeholder="Max seg"
            aria-label="Duración máxima en segundos"
            className={`w-20 px-2.5 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors ${
              filters.maxDurSecs ? "border-purple-300 text-purple-700" : "border-gray-200 text-gray-600"
            }`}
          />
        </div>

        {/* Result count hint */}
        {total != null && (
          <span className="ml-auto text-xs text-gray-400 tabular-nums">
            {isLoading
              ? <span className="flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Buscando…</span>
              : `${total.toLocaleString()} resultado${total !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* Row 4: Active filter chips */}
      {hasActiveFilters && (
        <div className="px-4 py-2.5 border-t border-indigo-100 bg-indigo-50/50 flex flex-wrap gap-2 items-center">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              color={chip.color}
              onRemove={chip.onRemove}
            />
          ))}
          <button
            onClick={onReset}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 hover:border-red-200 shrink-0"
          >
            <X size={11} /> Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
