import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, getDeliverable, updateDeliverable, updateDeliverableStatus, deleteDeliverable } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; did: string }> };

const CAN_APPROVE = ["admin", "content_strategist"];

async function resolveDeliverable(projectId: string, did: string) {
  const deliverable = await getDeliverable(did);
  if (!deliverable || deliverable.projectId !== projectId) return null;
  return deliverable;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, did } = await params;
  const [role, deliverable] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveDeliverable(id, did),
  ]);
  if (!role || !["admin", "content_strategist"].includes(role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (!deliverable) return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });

  const body = await req.json();
  await updateDeliverable(did, body);
  return NextResponse.json({ ok: true });
}

// PATCH: change status (assignee advances their own, admin/strategist approve/reject)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, did } = await params;
  const [role, deliverable] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveDeliverable(id, did),
  ]);
  if (!role) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  if (!deliverable) return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });

  const { status, reviewerNotes } = await req.json();

  // Approve/reject only for admin/strategist
  if (["approved", "rejected"].includes(status) && !CAN_APPROVE.includes(role)) {
    return NextResponse.json({ error: "Solo administradores o estrategas pueden aprobar/rechazar" }, { status: 403 });
  }

  // Self-advance: non-privileged users can only move their own deliverables forward
  const selfAdvance = ["pending", "in_progress", "review", "rejected"].includes(deliverable.status);
  if (!CAN_APPROVE.includes(role) && (deliverable.assignedTo !== session.user.email || !selfAdvance)) {
    return NextResponse.json({ error: "Solo puedes avanzar tus propios entregables" }, { status: 403 });
  }

  await updateDeliverableStatus(did, status, reviewerNotes);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, did } = await params;
  const [role, deliverable] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveDeliverable(id, did),
  ]);
  if (!role || role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  if (!deliverable) return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });

  await deleteDeliverable(did);
  return NextResponse.json({ ok: true });
}
