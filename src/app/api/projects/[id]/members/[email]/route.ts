import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, removeProjectMember, updateProjectMemberRole } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; email: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, email } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const { memberRole } = await req.json();
  await updateProjectMemberRole(id, decodeURIComponent(email), memberRole);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, email } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  await removeProjectMember(id, decodeURIComponent(email));
  return NextResponse.json({ ok: true });
}
