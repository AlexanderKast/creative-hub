"use client";

import { useState, useCallback, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { X, Copy, CheckCheck, Sparkles, Loader2, ChevronDown, ChevronUp, Brain, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Creative, VideoAnalysis } from "@/types";

interface CopyOutput {
  hook: string;
  headline: string;
  primary_text: string;
  cta: string;
  hashtags: string[];
  overlay_text: string;
  variations: Array<{ label: string; headline: string; primary_text: string }>;
  notes: string;
}

interface Props {
  creative: Creative;
  onClose: () => void;
}

const PLATFORMS = [
  { value: "meta_ads",        label: "Meta Ads",           emoji: "📘" },
  { value: "tiktok_ads",      label: "TikTok Ads",         emoji: "🎵" },
  { value: "instagram_reels", label: "Instagram Reels",    emoji: "📱" },
  { value: "instagram_feed",  label: "Instagram Feed",     emoji: "🖼️" },
  { value: "tiktok_organic",  label: "TikTok Orgánico",    emoji: "🎬" },
  { value: "youtube_ads",     label: "YouTube Ads",        emoji: "▶️" },
  { value: "whatsapp",        label: "WhatsApp Business",  emoji: "💬" },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <button onClick={copy}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
          {copied ? <CheckCheck size={11} className="text-emerald-500" /> : <Copy size={11} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {value}
      </div>
    </div>
  );
}

export function CopyGeneratorModal({ creative, onClose }: Props) {
  const [platform, setPlatform] = useState("meta_ads");
  const [instructions, setInstructions] = useState("");
  const [output, setOutput] = useState<CopyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVariations, setShowVariations] = useState(false);
  const [usedAnalysis, setUsedAnalysis] = useState(false);

  // Analysis state
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(creative.analysis ?? null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(creative.analysisStatus ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [showAnalysisDetail, setShowAnalysisDetail] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();

  // Load existing analysis on open
  useEffect(() => {
    if (analysis) return;
    const controller = new AbortController();
    fetch(`/api/analyze/${creative.id}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.analysis && d.status === "done") {
          setAnalysis(d.analysis);
          setAnalysisStatus("done");
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [creative.id, analysis]);

  const runAnalysis = useCallback(async (force = false) => {
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await fetch(`/api/analyze/${creative.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType: creative.mimeType, fileName: creative.name, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.error ?? "Error al analizar");
        return;
      }
      setAnalysis(data.analysis);
      setAnalysisStatus("done");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setIsAnalyzing(false);
    }
  }, [creative.id, creative.mimeType, creative.name]);

  const generate = useCallback(async () => {
    if (!instructions.trim()) return;
    setLoading(true);
    setError("");
    setOutput(null);
    try {
      const res = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creativeId: creative.id,
          fileName: creative.name,
          folderName: creative.folderName,
          fileType: creative.fileType,
          tags: creative.tags,
          instructions,
          platformTarget: platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al generar copy"); return; }
      setOutput(data.output);
      setUsedAnalysis(data.usedAnalysis ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [creative, platform, instructions]);

  const copyAll = () => {
    if (!output) return;
    const text = [
      `🎯 HOOK: ${output.hook}`,
      `📢 HEADLINE: ${output.headline}`,
      `📝 COPY PRINCIPAL:\n${output.primary_text}`,
      `🔗 CTA: ${output.cta}`,
      output.hashtags.length > 0 ? `#️⃣ HASHTAGS: ${output.hashtags.join(" ")}` : "",
      output.overlay_text ? `🎬 OVERLAY: ${output.overlay_text}` : "",
    ].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
  };

  const platformFit = analysis?.platform_fit?.[platform];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={trapRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Generar Copy con IA</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs" title={creative.name}>{creative.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Análisis de IA ──────────────────────────────────────── */}
          <div className={`rounded-xl border p-3 ${
            analysisStatus === "done"
              ? "bg-emerald-50 border-emerald-200"
              : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain size={15} className={analysisStatus === "done" ? "text-emerald-600" : "text-gray-400"} />
                <span className="text-sm font-medium text-gray-700">
                  {analysisStatus === "done" ? "Video analizado por Gemini" : "Análisis de video con IA"}
                </span>
                {analysisStatus === "done" && <CheckCircle2 size={13} className="text-emerald-500" />}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {analysisStatus === "done" && (
                  <button onClick={() => setShowAnalysisDetail(!showAnalysisDetail)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5">
                    {showAnalysisDetail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showAnalysisDetail ? "Ocultar" : "Ver"}
                  </button>
                )}
                {analysisStatus === "done" && (
                  <button onClick={() => runAnalysis(true)} disabled={isAnalyzing}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50" title="Re-analizar">
                    <RefreshCw size={12} className={isAnalyzing ? "animate-spin" : ""} />
                  </button>
                )}
                {analysisStatus !== "done" && (
                  <button onClick={() => runAnalysis(false)} disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                    {isAnalyzing ? <Loader2 size={11} className="animate-spin" /> : <Brain size={11} />}
                    {isAnalyzing ? "Analizando…" : "Analizar video"}
                  </button>
                )}
              </div>
            </div>

            {isAnalyzing && (
              <p className="text-xs text-indigo-600 mt-2">
                Gemini está leyendo el video completo. Puede tardar 1-2 minutos para videos largos…
              </p>
            )}

            {analysisError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
                <AlertCircle size={11} /> {analysisError}
              </p>
            )}

            {/* Resumen rápido siempre visible */}
            {analysisStatus === "done" && analysis && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.hook_strength && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    analysis.hook_strength === "alta" ? "bg-emerald-100 text-emerald-700" :
                    analysis.hook_strength === "media" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    Hook {analysis.hook_strength}
                  </span>
                )}
                {platformFit && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    platformFit.score >= 7 ? "bg-emerald-100 text-emerald-700" :
                    platformFit.score >= 5 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    Fit plataforma: {platformFit.score}/10
                  </span>
                )}
                {analysis.emotions?.slice(0, 2).map((e) => (
                  <span key={e} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px]">{e}</span>
                ))}
              </div>
            )}

            {/* Detalle expandible */}
            {showAnalysisDetail && analysis && (
              <div className="mt-3 space-y-2 text-xs text-gray-700 border-t border-emerald-200 pt-3">
                {analysis.visual_summary && (
                  <p><span className="font-semibold">Visual:</span> {analysis.visual_summary}</p>
                )}
                {analysis.transcript && (
                  <p><span className="font-semibold">Transcripción:</span> "{analysis.transcript.slice(0, 200)}{analysis.transcript.length > 200 ? "…" : ""}"</p>
                )}
                {analysis.key_messages?.length && (
                  <p><span className="font-semibold">Mensajes clave:</span> {analysis.key_messages.join(" · ")}</p>
                )}
                {analysis.copy_angles?.length && (
                  <p><span className="font-semibold">Ángulos de copy:</span> {analysis.copy_angles.join(", ")}</p>
                )}
                {analysis.weaknesses?.length && (
                  <p><span className="font-semibold">A mejorar:</span> {analysis.weaknesses.join(", ")}</p>
                )}
                {platformFit?.notes && (
                  <p><span className="font-semibold">Nota para esta plataforma:</span> {platformFit.notes}</p>
                )}
              </div>
            )}
          </div>

          {/* Platform selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Plataforma destino
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const fit = analysis?.platform_fit?.[p.value];
                return (
                  <button key={p.value} onClick={() => setPlatform(p.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-left transition-all ${
                      platform === p.value
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-100"
                    }`}>
                    <span>{p.emoji}</span>
                    <span className="flex-1 truncate">{p.label}</span>
                    {fit && (
                      <span className={`text-[10px] font-bold shrink-0 ${
                        platform === p.value ? "text-indigo-200" :
                        fit.score >= 7 ? "text-emerald-600" :
                        fit.score >= 5 ? "text-amber-500" : "text-red-400"
                      }`}>{fit.score}/10</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Instrucciones del equipo
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ej: Vender proteína whey. Audiencia: hombres 25-35 activos. Objetivo: compra directa. Tono: energético y motivador. Precio: $89.000."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none placeholder:text-gray-300"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Output */}
          {output && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Copy generado</span>
                  {usedAnalysis && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold">
                      <Brain size={10} /> Con análisis de video
                    </span>
                  )}
                </div>
                <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Copy size={12} /> Copiar todo
                </button>
              </div>

              <CopyField label="Hook (primeras palabras)" value={output.hook} />
              <CopyField label="Headline" value={output.headline} />
              <CopyField label="Copy principal" value={output.primary_text} />
              <CopyField label="Call to Action" value={output.cta} />
              {output.hashtags.length > 0 && (
                <CopyField label="Hashtags" value={output.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")} />
              )}
              {output.overlay_text && (
                <CopyField label="Overlay (texto en video)" value={output.overlay_text} />
              )}
              {output.notes && (
                <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Observaciones</p>
                  <p className="text-xs text-amber-800 leading-relaxed">{output.notes}</p>
                </div>
              )}

              {output.variations.length > 0 && (
                <div>
                  <button onClick={() => setShowVariations(!showVariations)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors w-full">
                    {showVariations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showVariations ? "Ocultar variaciones" : `Ver ${output.variations.length} variaciones`}
                  </button>
                  {showVariations && (
                    <div className="mt-3 space-y-4">
                      {output.variations.map((v, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-3">
                          <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">{v.label}</span>
                          <CopyField label="Headline" value={v.headline} />
                          <CopyField label="Copy" value={v.primary_text} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 shrink-0">
          <button onClick={generate} disabled={loading || !instructions.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Generando con Gemini…</>
              : <><Sparkles size={15} /> {output ? "Regenerar" : "Generar Copy"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
