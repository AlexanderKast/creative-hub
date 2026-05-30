import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { autoTagCreative, isGeminiQuotaError } from "@/lib/gemini";
import { updateCreativeTags } from "@/lib/db-queries";

export async function PATCH(req: NextRequest) {
  const session = await getAuth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { fileId, tags } = await req.json();
  if (!fileId || !tags) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    await updateCreativeTags(fileId, tags);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { fileId, fileName, mimeType, folderName } = await req.json();

  if (!fileName || !mimeType) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  try {
    const tags = await autoTagCreative(fileName, mimeType, folderName ?? "");

    // Persistir en DB si tenemos el fileId
    if (fileId) {
      await updateCreativeTags(fileId, tags).catch(() => {
        // No fallar si la DB aún no está sincronizada
      });
    }

    return NextResponse.json({ tags });
  } catch (err) {
    console.error("Gemini tag error:", err);
    if (isGeminiQuotaError(err)) {
      return NextResponse.json(
        { error: "Cuota de Gemini agotada. Activa el plan de pago en Google AI Studio (aistudio.google.com)." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Error al etiquetar con Gemini" }, { status: 500 });
  }
}
