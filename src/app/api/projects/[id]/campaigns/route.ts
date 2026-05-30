import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getUserProjectRole, getCampaigns, createCampaign } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const CAN_CREATE_CAMPAIGNS = ["admin", "content_strategist", "traffic"];

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const campaigns = await getCampaigns(id);
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getAuth();
  if (!session?.user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const role = await getUserProjectRole(session.user.email, id);
  if (!role || !CAN_CREATE_CAMPAIGNS.includes(role)) {
    return NextResponse.json({ error: "Sin permisos para crear campañas" }, { status: 403 });
  }

  const body = await req.json();
  const { name, platform, type, objective, budget, startDate, endDate, notes } = body;

  if (!name?.trim() || !platform || !type) {
    return NextResponse.json({ error: "Nombre, plataforma y tipo son requeridos" }, { status: 400 });
  }

  const campaign = await createCampaign({
    projectId: id,
    name: name.trim(),
    platform,
    type,
    objective,
    budget: budget ? parseFloat(budget) : undefined,
    startDate,
    endDate,
    notes,
    createdBy: session.user.email,
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
