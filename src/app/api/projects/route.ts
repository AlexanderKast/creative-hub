import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getProjectsForUser, createProject, getGlobalRole, isTeamMember } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = await isTeamMember(session.user.email);
  if (!allowed) {
    // Check project_members directly via getProjectsForUser
  }

  const projects = await getProjectsForUser(session.user.email);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const role = await getGlobalRole(session.user.email);
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores pueden crear proyectos" }, { status: 403 });

  const body = await req.json();
  const { name, description, type, status, clientName, brief, coverColor, startDate, endDate } = body;

  if (!name?.trim() || !type) {
    return NextResponse.json({ error: "Nombre y tipo son requeridos" }, { status: 400 });
  }

  const project = await createProject({
    name: name.trim(),
    description,
    type,
    status,
    clientName,
    brief,
    coverColor,
    startDate,
    endDate,
    createdBy: session.user.email,
  });

  return NextResponse.json({ project }, { status: 201 });
}
