import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/admin/bootstrap
// Registra al usuario actual como admin SI la tabla team_members está vacía.
// Solo funciona una vez — después de tener un admin, este endpoint queda bloqueado.
export async function GET() {
  const session = await getAuth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const email = session.user.email;

  // Verificar si ya hay miembros
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Ya existe al menos un admin. Usa el panel de Supabase para agregar más miembros." },
      { status: 403 }
    );
  }

  // Insertar primer admin
  const { error } = await supabase
    .from("team_members")
    .insert({ email, role: "admin", invited_by: email });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `${email} registrado como admin. Recarga la página.`,
  });
}
