import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, getProjectMembers, addProjectMember } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const members = await getProjectMembers(id);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores pueden invitar miembros" }, { status: 403 });

  const { email, memberRole, name } = await req.json();
  if (!email?.trim() || !memberRole) {
    return NextResponse.json({ error: "Email y rol son requeridos" }, { status: 400 });
  }

  await addProjectMember(id, email.trim().toLowerCase(), memberRole, session.user.email, name);
  return NextResponse.json({ ok: true }, { status: 201 });
}
