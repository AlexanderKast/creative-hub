import Anthropic from "@anthropic-ai/sdk";
import { CreativeTags, ContentType, Platform, CreativeStatus } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function autoTagCreative(
  fileName: string,
  mimeType: string,
  folderName: string
): Promise<CreativeTags> {
  const prompt = `Analiza este archivo creativo y devuelve un JSON con etiquetas.

Nombre del archivo: "${fileName}"
Tipo MIME: "${mimeType}"
Carpeta: "${folderName}"

Clasifica según estas opciones:

contentType (elige UNO):
- "UGC" — contenido generado por usuarios, estilo orgánico, testimonios informales
- "testimonio" — review o recomendación directa de cliente/usuario
- "demo" — demostración de producto o funcionalidad
- "educativo" — tutorial, how-to, tips, información
- "producto" — showcasing de producto, unboxing, foto/video de producto
- "sin_clasificar" — no hay suficiente info

platforms (puede ser MÚLTIPLE, elige los más relevantes):
- "Meta" — Facebook Ads / Instagram Ads
- "TikTok" — TikTok Ads o TikTok orgánico
- "YouTube" — YouTube Ads o contenido YouTube
- "Instagram" — Instagram orgánico (Reels, Stories, Feed)
- "sin_sugerencia" — si no hay suficiente info

status (elige UNO):
- "listo_para_pautar" — parece contenido terminado y listo para campañas
- "revisar" — necesita revisión antes de usar
- "descartar" — nombre sugiere draft, test, borrador, o rechazo
- "sin_estado" — no hay suficiente info

Responde SOLO con JSON válido, sin markdown ni explicación:
{"contentType": "...", "platforms": ["..."], "status": "..."}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const parsed = JSON.parse(text.trim());
    return {
      contentType: (parsed.contentType as ContentType) ?? "sin_clasificar",
      platforms: (parsed.platforms as Platform[]) ?? [],
      status: (parsed.status as CreativeStatus) ?? "sin_estado",
      custom: [],
    };
  } catch {
    return {
      contentType: "sin_clasificar",
      platforms: [],
      status: "sin_estado",
      custom: [],
    };
  }
}
