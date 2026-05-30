"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { RefreshCw, Download, Sparkles, LogOut, Loader2, Database, AlertTriangle } from "lucide-react";
import { signOut } from "next-auth/react";
import { Creative, DriveFolder, FilterState, CreativeTags } from "@/types";
import { CreativeCard } from "./CreativeCard";
import { FilterBar } from "./FilterBar";
import { StatsBar } from "./StatsBar";
import { TagEditorModal } from "./TagEditorModal";
import { MediaPreviewModal } from "./MediaPreviewModal";
import { UploadButton } from "./UploadButton";

const DEFAULT_FILTERS: FilterState = {
  fileType: "all", folderId: "", dateFrom: "", dateTo: "",
  contentType: "all", platform: "all", status: "all",
  search: "", customTag: "", sort: "recent",
  minSizeMB: "", maxSizeMB: "", minDurSecs: "", maxDurSecs: "",
};

interface SyncState {
  status: string;
  total_indexed: number;
  last_full_scan: string | null;
}

function parseSizeBytes(size: string | null): number {
  if (!size) return 0;
  const m = size.match(/([\d.]+)\s*(KB|MB|GB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  return u === "KB" ? n * 1024 : u === "MB" ? n * 1024 * 1024 : n * 1024 * 1024 * 1024;
}

interface InitialData {
  files: Creative[];
  folders: DriveFolder[];
  total: number;
  nextOffset: number | null;
  syncState: SyncState | null;
}

export function Dashboard({ initialData }: { initialData?: InitialData }) {
  const [files, setFiles] = useState<Creative[]>(initialData?.files ?? []);
  const [folders, setFolders] = useState<DriveFolder[]>(initialData?.folders ?? []);
  const [cursor, setCursor] = useState<number | string | null | "done">(
    initialData ? (initialData.nextOffset ?? "done") : null
  );
  const [source, setSource] = useState<"db" | "drive" | null>(initialData ? "db" : null);
  const [syncState, setSyncState] = useState<SyncState | null>(initialData?.syncState ?? null);
  const [total, setTotal] = useState<number | null>(initialData?.total ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null);
  const [previewCreative, setPreviewCreative] = useState<Creative | null>(null);
  const [isTaggingAll, setIsTaggingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncError, setSyncError] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files; // sync update — always current

  // filtersRef is updated synchronously each render so loadPage (stable) always reads latest filters
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Generation counter: incremented on every filter reset so stale in-flight responses are discarded
  const loadGenRef = useRef(0);

  const loadPage = useCallback(async (
    c: number | string | null,
    opts?: { tagMap?: Map<string, CreativeTags>; reset?: boolean }
  ) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    // Capture generation at start; reset increments it so stale responses self-discard
    const gen = loadGenRef.current;
    setIsLoading(true);
    try {
      const f = filtersRef.current;
      const params = new URLSearchParams();
      if (typeof c === "number") params.set("offset", String(c));
      else if (typeof c === "string") params.set("c", c);

      // Pass all active filters to the API (server-side filtering)
      if (f.search)                      params.set("search", f.search);
      if (f.customTag)                   params.set("customTag", f.customTag);
      if (f.folderId)                    params.set("folderId", f.folderId);
      if (f.fileType !== "all")          params.set("fileType", f.fileType);
      if (f.contentType !== "all")       params.set("contentType", f.contentType);
      if (f.platform !== "all")          params.set("platform", f.platform);
      if (f.status !== "all")            params.set("status", f.status);
      if (f.dateFrom)                    params.set("dateFrom", f.dateFrom);
      if (f.dateTo)                      params.set("dateTo", f.dateTo);
      if (f.sort && f.sort !== "recent") params.set("sort", f.sort);
      if (f.minSizeMB)                   params.set("minSizeMB", f.minSizeMB);
      if (f.maxSizeMB)                   params.set("maxSizeMB", f.maxSizeMB);
      if (f.minDurSecs)                  params.set("minDurSecs", f.minDurSecs);
      if (f.maxDurSecs)                  params.set("maxDurSecs", f.maxDurSecs);

      const url = `/api/drive/page${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);

      // If a newer request already superseded this one, discard silently
      if (gen !== loadGenRef.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("Drive page error:", res.status, body);
        return;
      }
      const data = await res.json();

      // Final stale-check after await
      if (gen !== loadGenRef.current) return;

      if (data.source) setSource(data.source);
      if (data.syncState) setSyncState(data.syncState);
      // Only update folders when they're actually returned (page 1 only); never clear with []
      if (Array.isArray(data.folders) && data.folders.length > 0) setFolders(data.folders);
      if (typeof data.total === "number") setTotal(data.total);

      const newFiles = (data.files as Creative[]).map((file) => ({
        ...file,
        tags: opts?.tagMap?.get(file.id) ?? file.tags,
      }));

      setFiles((prev) => {
        if (opts?.reset) return newFiles;
        const seen = new Set(prev.map((f) => f.id));
        return [...prev, ...newFiles.filter((f) => !seen.has(f.id))];
      });

      const next = data.nextOffset ?? data.nextCursor ?? null;
      setCursor(next !== null ? next : "done");
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []); // Stable — reads filters from filtersRef

  // Single effect: handles initial load + all filter changes with debounce
  const filterInitRef = useRef(false);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!filterInitRef.current) {
      filterInitRef.current = true;
      // Skip initial fetch if server already provided data
      if (!initialData) loadPage(null);
      return;
    }
    // Filter changed — debounce text/number inputs to avoid hammering the API
    const isTextChange = !!(filters.search || filters.customTag || filters.minSizeMB || filters.maxSizeMB || filters.minDurSecs || filters.maxDurSecs);
    clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      loadGenRef.current += 1; // invalidate any in-flight page loads from previous filter
      loadingRef.current = false; // allow the reset load to run even if one was in progress
      setTotal(null);
      setCursor(null);
      loadPage(null, { reset: true });
    }, isTextChange ? 350 : 0);

    return () => clearTimeout(filterDebounceRef.current);
  }, [filters, loadPage]);

  // Live Drive sync — reflects deletes/updates in real-time after 10s
  useEffect(() => {
    let es: EventSource | null = null;
    const timer = setTimeout(() => {
      es = new EventSource("/api/sync/live");
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string);
          if (data.type !== "delta") return;
          const deleted: string[] = data.deleted ?? [];
          const updated: Creative[] = data.updated ?? [];
          if (deleted.length > 0) {
            const deletedSet = new Set(deleted);
            setFiles((prev) => prev.filter((f) => !deletedSet.has(f.id)));
          }
          if (updated.length > 0) {
            const updatedMap = new Map(updated.map((c) => [c.id, c]));
            setFiles((prev) => {
              const existing = new Set(prev.map((f) => f.id));
              const merged = prev.map((f) => {
                const u = updatedMap.get(f.id);
                return u ? { ...u, tags: f.tags } : f;
              });
              const fresh = updated.filter((c) => !existing.has(c.id));
              return fresh.length > 0 ? [...fresh, ...merged] : merged;
            });
          }
        } catch { /* ignore parse errors */ }
      };
    }, 10_000);
    return () => { clearTimeout(timer); es?.close(); };
  }, []);

  // Infinite scroll — load next page when near bottom (only on actual scroll)
  useEffect(() => {
    if (cursor === "done") return;
    const handleScroll = () => {
      if (loadingRef.current || cursor === "done") return;
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distanceFromBottom < 600) loadPage(cursor as number | string | null);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [cursor, loadPage]);

  const refresh = useCallback(async () => {
    const tagMap = new Map(filesRef.current.map((f) => [f.id, f.tags]));
    loadGenRef.current += 1;
    loadingRef.current = false;
    setFiles([]);
    setFolders([]);
    setTotal(null);
    setCursor(null);
    await loadPage(null, { tagMap, reset: true });
  }, [loadPage]);

  const startFullSync = () => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncError("");
    const evtSource = new EventSource("/api/sync/full");
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "progress") {
          setSyncProgress(data.indexed ?? 0);
        } else if (data.type === "done") {
          evtSource.close();
          setIsSyncing(false);
          setSyncProgress(data.total ?? 0);
          loadGenRef.current += 1;
          loadingRef.current = false;
          setFiles([]); setFolders([]); setTotal(null); setCursor(null);
          loadPage(null, { reset: true });
        } else if (data.type === "error") {
          evtSource.close();
          setIsSyncing(false);
          setSyncError(data.message ?? "Error en sincronización");
        }
      } catch { /* ignore */ }
    };
    evtSource.onerror = () => {
      evtSource.close();
      setIsSyncing(false);
      setSyncError("Conexión interrumpida. Intenta de nuevo.");
    };
  };

  // filtered = client-side instant feedback on already-loaded files
  // Server will confirm authoritative results when reload completes
  const filtered = useMemo(() => {
    let result = files.filter((f) => {
      if (filters.fileType !== "all" && f.fileType !== filters.fileType) return false;
      if (filters.folderId && f.folderId !== filters.folderId) return false;
      if (filters.contentType !== "all" && f.tags.contentType !== filters.contentType) return false;
      if (filters.platform !== "all" && !f.tags.platforms.includes(filters.platform as never)) return false;
      if (filters.status !== "all" && f.tags.status !== filters.status) return false;
      if (filters.search && !f.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.customTag && !f.tags.custom.some((t) => t.toLowerCase().includes(filters.customTag.toLowerCase()))) return false;
      if (filters.dateFrom && new Date(f.createdTime) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59);
        if (new Date(f.createdTime) > to) return false;
      }
      if (filters.minSizeMB) {
        const minBytes = parseFloat(filters.minSizeMB) * 1_048_576;
        if ((f.sizeBytes ?? parseSizeBytes(f.size)) < minBytes) return false;
      }
      if (filters.maxSizeMB) {
        const maxBytes = parseFloat(filters.maxSizeMB) * 1_048_576;
        if ((f.sizeBytes ?? parseSizeBytes(f.size)) > maxBytes) return false;
      }
      if (filters.minDurSecs && (f.durationSeconds ?? 0) < parseInt(filters.minDurSecs)) return false;
      if (filters.maxDurSecs && (f.durationSeconds ?? Infinity) > parseInt(filters.maxDurSecs)) return false;
      return true;
    });

    // Client-side sort for immediate feedback (server returns canonical sorted results)
    switch (filters.sort) {
      case "oldest":
        result = [...result].sort((a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
        break;
      case "name_az":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_za":
        result = [...result].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "size_desc":
        result = [...result].sort((a, b) => (b.sizeBytes ?? parseSizeBytes(b.size)) - (a.sizeBytes ?? parseSizeBytes(a.size)));
        break;
      case "duration_desc":
        result = [...result].sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0));
        break;
      case "duration_asc":
        result = [...result].sort((a, b) => (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0));
        break;
    }
    return result;
  }, [files, filters]);

  const tagOne = useCallback(async (id: string) => {
    const creative = filesRef.current.find((f) => f.id === id);
    if (!creative) return;
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, isTagging: true } : f));
    try {
      const res = await fetch("/api/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id, fileName: creative.name, mimeType: creative.mimeType, folderName: creative.folderName }),
      });
      if (res.ok) {
        const { tags } = await res.json();
        setFiles((prev) => prev.map((f) => f.id === id ? { ...f, tags: { ...tags, custom: f.tags.custom }, isTagging: false } : f));
      }
    } catch {
      setFiles((prev) => prev.map((f) => f.id === id ? { ...f, isTagging: false } : f));
    }
  }, []);

  const tagAll = async () => {
    setIsTaggingAll(true);
    const untagged = filtered.filter((f) => f.tags.contentType === "sin_clasificar");
    for (const f of untagged) {
      await tagOne(f.id);
      await new Promise((r) => setTimeout(r, 300));
    }
    setIsTaggingAll(false);
  };

  const saveManualTags = useCallback((
    id: string,
    tags: CreativeTags,
    newName: string,
    newFolderId?: string,
    newFolderName?: string,
  ) => {
    setFiles((prev) => prev.map((f) => f.id === id ? {
      ...f, tags, name: newName,
      ...(newFolderId ? { folderId: newFolderId, folderName: newFolderName ?? f.folderName } : {}),
    } : f));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleUploaded = useCallback((creative: Creative) => {
    setFiles((prev) => [creative, ...prev]);
  }, []);

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filtered }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `creative-hub-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const untaggedCount = filtered.filter((f) => f.tags.contentType === "sin_clasificar").length;
  const hasMore = cursor !== "done";
  const dbEmpty = source === "drive" && !isSyncing;

  // What to show in the header subtitle
  const headerSubtitle = (() => {
    if (isSyncing) return `Sincronizando… ${syncProgress.toLocaleString()} indexados`;
    if (isLoading && files.length === 0) return "Conectando con Drive…";
    if (total !== null && total > files.length)
      return `${files.length.toLocaleString()} de ${total.toLocaleString()} cargados${hasMore ? " · scroll para más" : ""}${source === "db" ? " · DB" : ""}`;
    if (total !== null)
      return `${total.toLocaleString()} archivos${source === "db" ? " · DB" : ""}`;
    if (files.length > 0)
      return `${filtered.length.toLocaleString()} de ${files.length.toLocaleString()} archivos${hasMore ? " · cargando más…" : ""}`;
    return "Sin archivos";
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">Creative Hub</h1>
              <p className="text-xs text-gray-400 mt-0.5">{headerSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <UploadButton onUploaded={handleUploaded} />
            {untaggedCount > 0 && (
              <button onClick={tagAll} disabled={isTaggingAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors">
                <Sparkles size={14} />
                {isTaggingAll ? "Etiquetando…" : `Etiquetar ${untaggedCount}`}
              </button>
            )}
            <button onClick={exportCSV} disabled={isExporting || filtered.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              <Download size={14} />
              {isExporting ? "Exportando…" : `CSV (${filtered.length})`}
            </button>
            <button onClick={startFullSync} disabled={isSyncing || isLoading}
              title="Resincronizar todo Drive con la DB"
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <Database size={14} className={isSyncing ? "animate-pulse text-indigo-500" : ""} />
              {isSyncing ? "Sincronizando…" : "Sync Drive"}
            </button>
            <button onClick={refresh} disabled={isLoading || isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button onClick={() => signOut()}
              className="p-2 border border-gray-200 text-gray-400 rounded-xl hover:bg-gray-50 hover:text-gray-600 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* DB empty banner */}
        {dbEmpty && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="flex items-start gap-3">
              <Database size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Base de datos vacía</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Sincroniza Drive con la DB para habilitar filtros rápidos, búsqueda y persistencia de etiquetas.
                </p>
              </div>
            </div>
            <button onClick={startFullSync}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
              <Database size={14} /> Sincronizar ahora
            </button>
          </div>
        )}

        {/* Sync progress */}
        {isSyncing && (
          <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
            <Loader2 size={18} className="animate-spin text-indigo-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-800">Sincronizando Google Drive…</p>
              <p className="text-xs text-indigo-600 mt-0.5">{syncProgress.toLocaleString()} archivos indexados</p>
            </div>
          </div>
        )}

        {/* Sync error */}
        {syncError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{syncError}</p>
            <button onClick={() => setSyncError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {files.length > 0 && <StatsBar all={files} filtered={filtered} />}
        <FilterBar
          filters={filters}
          folders={folders}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          total={total}
          isLoading={isLoading}
        />

        {/* Initial spinner */}
        {isLoading && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <Loader2 size={32} className="animate-spin text-indigo-500" />
            <p className="text-sm">Conectando con Google Drive…</p>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div ref={gridRef} className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {filtered.map((creative) => (
              <CreativeCard
                key={creative.id}
                creative={creative}
                onTag={tagOne}
                onEdit={setEditingCreative}
                onPreview={setPreviewCreative}
              />
            ))}
          </div>
        )}

        {/* Empty state — show when no results after a load has completed */}
        {!isLoading && filtered.length === 0 && total === 0 && source !== null && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium">Sin resultados</p>
            <p className="text-sm mt-1">Prueba cambiando los filtros o buscando otra cosa</p>
          </div>
        )}

        <div className="h-4" />

        {isLoading && files.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            Cargando más archivos…
          </div>
        )}
      </main>

      {previewCreative && (
        <MediaPreviewModal
          creative={previewCreative}
          onClose={() => setPreviewCreative(null)}
          onTag={tagOne}
          onEdit={(c) => { setPreviewCreative(null); setEditingCreative(c); }}
          onDelete={(id) => { handleDelete(id); setPreviewCreative(null); }}
          onBunnySynced={(id, bunnyVideoId) =>
            setFiles((prev) => prev.map((f) => f.id === id ? { ...f, bunnyVideoId } : f))
          }
        />
      )}

      {editingCreative && (
        <TagEditorModal
          creative={editingCreative}
          folders={folders}
          onSave={saveManualTags}
          onDelete={handleDelete}
          onClose={() => setEditingCreative(null)}
        />
      )}
    </div>
  );
}
