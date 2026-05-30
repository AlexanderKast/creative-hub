import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import {
  getProject, updateProject, deleteProject,
  getUserProjectRole, getProjectMembers, getCampaigns,
  getDeliverableStats, getProjectFolders,
} from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const [project, members, campaigns, stats, folders] = await Promise.all([
    getProject(id),
    getProjectMembers(id),
    getCampaigns(id),
    getDeliverableStats(id),
    getProjectFolders(id),
  ]);

  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  return NextResponse.json({ project: { ...project, myRole: role, deliverableStats: stats }, members, campaigns, folders });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role || !["admin", "content_strategist"].includes(role)) {
    return NextResponse.json({ error: "Sin permisos para editar" }, { status: 403 });
  }

  const body = await req.json();
  await updateProject(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores pueden eliminar proyectos" }, { status: 403 });

  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
