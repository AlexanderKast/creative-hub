import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, getCampaign, updateCampaign, updateCampaignMetrics, deleteCampaign } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; cid: string }> };

const CAN_EDIT = ["admin", "content_strategist", "traffic"];

async function resolveCampaign(projectId: string, cid: string) {
  const campaign = await getCampaign(cid);
  if (!campaign || campaign.projectId !== projectId) return null;
  return campaign;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, cid } = await params;
  const [role, campaign] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveCampaign(id, cid),
  ]);
  if (!role || !CAN_EDIT.includes(role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const body = await req.json();
  await updateCampaign(cid, body);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, cid } = await params;
  const [role, campaign] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveCampaign(id, cid),
  ]);
  if (!role || !CAN_EDIT.includes(role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const metrics = await req.json();
  await updateCampaignMetrics(cid, metrics);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, cid } = await params;
  const [role, campaign] = await Promise.all([
    getUserProjectRole(session.user.email, id),
    resolveCampaign(id, cid),
  ]);
  if (!role || role !== "admin") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  await deleteCampaign(cid);
  return NextResponse.json({ ok: true });
}
