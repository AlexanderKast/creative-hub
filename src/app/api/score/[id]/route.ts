import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { scoreCreative, isGeminiQuotaError } from "@/lib/gemini";
import { saveCreativeScore, resolveAccessibleCreative, getAnalysis } from "@/lib/db-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
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

  try {
    const analysisRow = await getAnalysis(id);
    const { score, breakdown } = await scoreCreative(
      creative.name,
      creative.mimeType,
      analysisRow?.analysis ?? null,
    );

    await saveCreativeScore(id, score, breakdown);

    return NextResponse.json({ score, breakdown });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[score] Error calculando score:", id, msg);
    if (isGeminiQuotaError(err)) {
      return NextResponse.json({ error: "Cuota de Gemini agotada. Activa el plan de pago en aistudio.google.com" }, { status: 429 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
