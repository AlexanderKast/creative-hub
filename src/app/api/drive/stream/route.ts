import { NextResponse } from "next/server";

// Reemplazada por /api/drive/page (paginación por cursor)
export async function GET() {
  return NextResponse.json({ error: "Usar /api/drive/page" }, { status: 410 });
}
