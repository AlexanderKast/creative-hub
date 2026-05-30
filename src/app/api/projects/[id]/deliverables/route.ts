import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, getDeliverables, createDeliverable } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const url = new URL(req.url);
  const assignedTo = url.searchParams.get("assignedTo") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const campaignId = url.searchParams.get("campaignId") ?? undefined;

  // Non-admins see only their own deliverables
  const filterAssigned =
    !["admin", "content_strategist"].includes(role)
      ? session.user.email
      : assignedTo;

  const deliverables = await getDeliverables(id, { assignedTo: filterAssigned, status, campaignId });
  return NextResponse.json({ deliverables });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role || !["admin", "content_strategist"].includes(role)) {
    return NextResponse.json({ error: "Sin permisos para crear entregables" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, assignedTo, memberRole, type, dueDate, notes, campaignId } = body;

  if (!title?.trim() || !type) {
    return NextResponse.json({ error: "Título y tipo son requeridos" }, { status: 400 });
  }

  const deliverable = await createDeliverable({
    projectId: id,
    campaignId,
    title: title.trim(),
    description,
    assignedTo,
    role: memberRole,
    type,
    dueDate,
    notes,
    createdBy: session.user.email,
  });

  return NextResponse.json({ deliverable }, { status: 201 });
}
