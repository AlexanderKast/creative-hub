import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { Creative } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { files }: { files: Creative[] } = await req.json();

  const headers = [
    "ID",
    "Nombre",
    "Tipo",
    "Carpeta",
    "Tamaño",
    "Creado",
    "Modificado",
    "Tipo de contenido",
    "Plataformas",
    "Estado",
    "Etiquetas personalizadas",
    "Enlace",
  ];

  const rows = files.map((f) => [
    f.id,
    f.name,
    f.fileType,
    f.folderName,
    f.size ?? "",
    new Date(f.createdTime).toLocaleDateString("es-CO"),
    new Date(f.modifiedTime).toLocaleDateString("es-CO"),
    f.tags.contentType,
    f.tags.platforms.join(";"),
    f.tags.status,
    f.tags.custom.join(";"),
    f.webViewLink ?? "",
  ]);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csv =
    headers.map(escape).join(",") +
    "\n" +
    rows.map((row) => row.map(escape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creative-hub-${Date.now()}.csv"`,
    },
  });
}
