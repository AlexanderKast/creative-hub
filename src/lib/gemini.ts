import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { CreativeTags, ContentType, Platform, CreativeStatus, VideoAnalysis } from "@/types";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada en .env.local");
  return key;
}

function getModel(modelName = "gemini-2.0-flash") {
  return new GoogleGenerativeAI(getApiKey()).getGenerativeModel({ model: modelName });
}

export function isGeminiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit");
}

// ─── AUTO TAGGING ─────────────────────────────────────────────────────────────

export async function autoTagCreative(
  fileName: string,
  mimeType: string,
  folderName: string,
): Promise<CreativeTags> {
  const model = getModel();

  const prompt = `Analiza este archivo creativo y devuelve un JSON con etiquetas.

Nombre del archivo: "${fileName}"
Tipo MIME: "${mimeType}"
Carpeta: "${folderName}"

contentType (elige UNO): "UGC" | "testimonio" | "demo" | "educativo" | "producto" | "sin_clasificar"
platforms (puede ser MÚLTIPLE): "Meta" | "TikTok" | "YouTube" | "Instagram" | "sin_sugerencia"
status (elige UNO): "listo_para_pautar" | "revisar" | "descartar" | "sin_estado"

Responde SOLO con JSON válido, sin markdown:
{"contentType": "...", "platforms": ["..."], "status": "..."}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const clean = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return {
      contentType: (parsed.contentType as ContentType) ?? "sin_clasificar",
      platforms: (parsed.platforms as Platform[]) ?? [],
      status: (parsed.status as CreativeStatus) ?? "sin_estado",
      custom: [],
    };
  } catch {
    return { contentType: "sin_clasificar", platforms: [], status: "sin_estado", custom: [] };
  }
}

// ─── VIDEO / IMAGE ANALYSIS ──────────────────────────────────────────────────

const ANALYSIS_PROMPT = `Eres un experto en marketing digital y producción audiovisual latinoamericana.
Analiza este video/imagen de forma exhaustiva para un equipo de marketing.

Responde SOLO con JSON válido (sin markdown):
{
  "transcript": "transcripción completa del audio/diálogo (string vacío si no hay voz)",
  "language": "es",
  "duration_seconds": 0,
  "visual_summary": "descripción detallada de lo que se ve visualmente",
  "scenes": [{ "start": 0, "end": 5, "description": "qué pasa", "type": "hook/producto/cta/transicion" }],
  "key_messages": ["mensaje principal"],
  "emotions": ["energético"],
  "products_shown": ["producto mostrado"],
  "hook_strength": "alta",
  "hook_seconds": 3,
  "best_clip": { "start": 0, "end": 6 },
  "content_type": "UGC",
  "suggested_audience": "descripción de audiencia ideal",
  "platform_fit": {
    "meta_ads":        { "score": 8, "notes": "justificación" },
    "tiktok_ads":      { "score": 7, "notes": "justificación" },
    "instagram_reels": { "score": 9, "notes": "justificación" },
    "youtube_ads":     { "score": 5, "notes": "justificación" }
  },
  "strengths": ["fortaleza 1"],
  "weaknesses": ["debilidad 1"],
  "copy_angles": ["urgencia", "social proof"]
}`;

function parseGeminiJson(raw: string): VideoAnalysis {
  const text = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  if (!text) throw new Error("Gemini devolvió una respuesta vacía — reintenta.");
  try {
    return JSON.parse(text) as VideoAnalysis;
  } catch {
    // Gemini sometimes returns truncated JSON — salvage what we can
    throw new Error(`Gemini devolvió JSON inválido. Respuesta: "${text.slice(0, 120)}…"`);
  }
}

export async function analyzeCreativeWithGemini(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<VideoAnalysis> {
  const key = getApiKey();
  const isVideo = mimeType.startsWith("video/");
  const model = getModel();

  if (isVideo) {
    // Videos: GoogleAIFileManager maneja el protocolo de upload correctamente
    const fileManager = new GoogleAIFileManager(key);
    const tmpPath = path.join(os.tmpdir(), `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    let uploadedFileName: string | null = null;

    try {
      await fs.writeFile(tmpPath, buffer);

      const uploadResult = await fileManager.uploadFile(tmpPath, {
        mimeType,
        displayName: fileName,
      });

      uploadedFileName = uploadResult.file.name;

      // Esperar a que el archivo esté listo
      let file = uploadResult.file;
      const deadline = Date.now() + 120_000;
      while (file.state === "PROCESSING") {
        if (Date.now() > deadline) throw new Error("Gemini File API: timeout esperando procesamiento");
        await new Promise((r) => setTimeout(r, 3000));
        file = await fileManager.getFile(file.name);
      }
      if (file.state === "FAILED") throw new Error("Gemini File API: procesamiento del archivo falló");

      const result = await model.generateContent([
        { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        { text: ANALYSIS_PROMPT },
      ]);

      let raw = "";
      try {
        raw = result.response.text();
      } catch {
        const candidate = result.response.candidates?.[0] as { finishReason?: string } | undefined;
        throw new Error(`Gemini bloqueó la respuesta (${candidate?.finishReason ?? "desconocido"}). Intenta con otro video.`);
      }

      return parseGeminiJson(raw);
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
      if (uploadedFileName) {
        await fileManager.deleteFile(uploadedFileName).catch(() => {});
      }
    }
  } else {
    // Imágenes: inline base64
    const result = await model.generateContent([
      { inlineData: { data: buffer.toString("base64"), mimeType } },
      { text: ANALYSIS_PROMPT },
    ]);

    let raw = "";
    try {
      raw = result.response.text();
    } catch {
      const candidate = result.response.candidates?.[0] as { finishReason?: string } | undefined;
      throw new Error(`Gemini bloqueó la respuesta (${candidate?.finishReason ?? "desconocido"})`);
    }

    return parseGeminiJson(raw);
  }
}
