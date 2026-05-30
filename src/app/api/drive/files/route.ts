import { NextResponse } from "next/server";

// Reemplazada por /api/drive/stream (streaming NDJSON)
export async function GET() {
  return NextResponse.json({ error: "Usar /api/drive/stream" }, { status: 410 });
}
