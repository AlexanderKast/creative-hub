import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { saveCopyGeneration, getAnalysis } from "@/lib/db-queries";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiQuotaError } from "@/lib/gemini";
import { VideoAnalysis } from "@/types";

export const dynamic = "force-dynamic";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const PLATFORM_CONTEXT: Record<string, string> = {
  meta_ads:       "Meta Ads (Facebook/Instagram). Headline máx 40 chars. Primary text máx 125 chars recomendado. Incluye CTA directo.",
  tiktok_ads:     "TikTok Ads. Hook en primeros 3 segundos. Lenguaje joven, casual, directo. Hashtags relevantes.",
  instagram_reels:"Instagram Reels orgánico. Caption con hook, emojis moderados, 3-5 hashtags nicho.",
  instagram_feed: "Instagram Feed orgánico. Caption más elaborado, storytelling, CTA suave.",
  tiktok_organic: "TikTok orgánico. Texto corto en pantalla, hook visual, texto overlays, hashtags trending.",
  youtube_ads:    "YouTube Ads (in-stream). Los primeros 5 segundos son críticos. Mensaje claro y directo.",
  whatsapp:       "WhatsApp Business. Mensaje corto, conversacional, CTA con link o número.",
};

function buildAnalysisContext(a: VideoAnalysis): string {
  const lines: string[] = ["ANÁLISIS DEL CREATIVO (generado por IA):"];
  if (a.visual_summary) lines.push(`- Descripción visual: ${a.visual_summary}`);
  if (a.transcript)     lines.push(`- Transcripción: "${a.transcript.slice(0, 500)}${a.transcript.length > 500 ? "…" : ""}"`);
  if (a.key_messages?.length)  lines.push(`- Mensajes clave: ${a.key_messages.join(", ")}`);
  if (a.emotions?.length)      lines.push(`- Emociones: ${a.emotions.join(", ")}`);
  if (a.products_shown?.length) lines.push(`- Productos mostrados: ${a.products_shown.join(", ")}`);
  if (a.hook_strength)  lines.push(`- Fuerza del hook: ${a.hook_strength} (${a.hook_seconds ?? "?"}s)`);
  if (a.strengths?.length)     lines.push(`- Fortalezas: ${a.strengths.join(", ")}`);
  if (a.weaknesses?.length)    lines.push(`- Debilidades: ${a.weaknesses.join(", ")}`);
  if (a.copy_angles?.length)   lines.push(`- Ángulos de copy sugeridos: ${a.copy_angles.join(", ")}`);
  if (a.suggested_audience)    lines.push(`- Audiencia sugerida: ${a.suggested_audience}`);
  const fit = a.platform_fit?.[Object.keys(a.platform_fit ?? {})[0]];
  if (fit) {
    const fitLines = Object.entries(a.platform_fit ?? {})
      .map(([p, v]) => `  • ${p}: ${v.score}/10 — ${v.notes}`);
    lines.push("- Fit por plataforma:\n" + fitLines.join("\n"));
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { creativeId, fileName, folderName, fileType, tags, instructions, platformTarget } = await req.json();

  if (!creativeId || !instructions || !platformTarget) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const platformCtx = PLATFORM_CONTEXT[platformTarget] ?? platformTarget;

  // Cargar análisis almacenado en DB
  const storedAnalysis = await getAnalysis(creativeId).catch(() => null);
  const analysisCtx = storedAnalysis?.status === "done" && storedAnalysis.analysis
    ? buildAnalysisContext(storedAnalysis.analysis as VideoAnalysis)
    : null;

  // Thumbnail como fallback visual (si no hay análisis completo)
  let thumbnailPart: { inlineData: { data: string; mimeType: string } } | null = null;
  if (!analysisCtx) {
    try {
      const thumbRes = await fetch(
        `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/thumb/${creativeId}`,
        { headers: { Cookie: req.headers.get("cookie") ?? "" } }
      );
      if (thumbRes.ok) {
        const buffer = await thumbRes.arrayBuffer();
        thumbnailPart = {
          inlineData: {
            data: Buffer.from(buffer).toString("base64"),
            mimeType: thumbRes.headers.get("content-type") ?? "image/jpeg",
          },
        };
      }
    } catch {
      // Continúa sin imagen
    }
  }

  const prompt = `Eres un experto en copywriting para marketing digital latinoamericano.

CREATIVO:
- Nombre del archivo: ${fileName}
- Carpeta: ${folderName}
- Tipo: ${fileType}
- Tags actuales: ${JSON.stringify(tags)}

PLATAFORMA DESTINO: ${platformCtx}

INSTRUCCIONES DEL EQUIPO: ${instructions}

${analysisCtx ?? (thumbnailPart ? "Analiza la imagen del creativo y úsala para crear copy más relevante y específico." : "")}

Usa toda la información disponible para generar copy altamente específico y personalizado.
Responde SOLO con JSON válido:
{
  "hook": "primeras palabras/oración para captar atención (máx 10 palabras)",
  "headline": "titular principal del ad",
  "primary_text": "copy completo del anuncio",
  "cta": "llamada a la acción específica",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "overlay_text": "texto corto para poner sobre el video (máx 6 palabras)",
  "variations": [
    { "label": "Versión urgencia", "headline": "...", "primary_text": "..." },
    { "label": "Versión social proof", "headline": "...", "primary_text": "..." }
  ],
  "notes": "observaciones del creativo y sugerencias de uso"
}`;

  try {
    const parts = thumbnailPart && !analysisCtx
      ? [{ text: prompt }, thumbnailPart]
      : [{ text: prompt }];

    const result = await model.generateContent(parts);
    const text = result.response.text().trim()
      .replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();

    const output = JSON.parse(text);

    await saveCopyGeneration({
      creativeId,
      generatedBy: session.user?.email ?? "unknown",
      instructions,
      platformTarget,
      output,
      model: "gemini-2.0-flash",
    }).catch(() => {});

    return NextResponse.json({ output, platformTarget, usedAnalysis: !!analysisCtx });
  } catch (err) {
    if (isGeminiQuotaError(err)) {
      return NextResponse.json(
        { error: "Cuota de Gemini agotada. Activa el plan de pago en Google AI Studio (aistudio.google.com) para continuar." },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
