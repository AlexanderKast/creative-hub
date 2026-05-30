import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { analyzeCreativeWithGemini, isGeminiQuotaError } from "@/lib/gemini";
import { getAnalysis, saveAnalysis, markAnalysisProcessing, resolveAccessibleCreative } from "@/lib/db-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_SIZE_BYTES = 150 * 1024 * 1024; // 150 MB — límite práctico para análisis

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const creative = await resolveAccessibleCreative(session.user.email, id);
  if (!creative) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const existing = await getAnalysis(id);
  if (existing) return NextResponse.json({ analysis: existing.analysis, transcript: existing.transcript, status: existing.status, analyzed_at: existing.analyzed_at });
  return NextResponse.json({ analysis: null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const creative = await resolveAccessibleCreative(session.user.email, id);
  if (!creative) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { mimeType, fileName, force } = await req.json() as {
    mimeType: string;
    fileName: string;
    force?: boolean;
  };

  // Devolver análisis existente si ya está hecho (a menos que force=true)
  if (!force) {
    const existing = await getAnalysis(id);
    if (existing?.status === "done") {
      return NextResponse.json({ analysis: existing.analysis, transcript: existing.transcript, cached: true });
    }
  }

  await markAnalysisProcessing(id);

  try {
    // Descargar archivo de Drive vía proxy interno
    const fileRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/file/${id}`,
      { headers: { Cookie: req.headers.get("cookie") ?? "" } }
    );

    if (!fileRes.ok) {
      throw new Error(`No se pudo descargar el archivo: ${fileRes.status}`);
    }

    // Verificar tamaño antes de bufferizar
    const contentLength = fileRes.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
      throw new Error(`El archivo es demasiado grande para análisis (máx ${MAX_SIZE_BYTES / 1024 / 1024} MB)`);
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());

    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error(`El archivo es demasiado grande para análisis (${(buffer.length / 1024 / 1024).toFixed(0)} MB, máx 150 MB)`);
    }

    // Analizar con Gemini
    const analysis = await analyzeCreativeWithGemini(buffer, mimeType, fileName);

    // Guardar en DB
    await saveAnalysis(id, analysis, analysis.transcript, "gemini-2.0-flash");

    return NextResponse.json({ analysis, transcript: analysis.transcript, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze] Error analizando creativo:", id, msg);
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("creative_analyses").upsert({
      creative_id: id,
      status: "error",
      error_message: msg,
      analyzed_at: new Date().toISOString(),
      analysis: {},
    }, { onConflict: "creative_id" });

    if (isGeminiQuotaError(err)) {
      return NextResponse.json(
        { error: "Cuota de Gemini agotada. Activa el plan de pago en Google AI Studio (aistudio.google.com) para continuar." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
