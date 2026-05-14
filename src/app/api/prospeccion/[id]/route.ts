// GET/PATCH/DELETE individual prospect (Supabase)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("prospectos")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const allowed = [
    "negocio", "nombre_contacto", "estado", "notas",
    "respondio", "siguiente_paso", "oportunidad_score",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("prospectos")
    .update(patch)
    .eq("id", Number(id))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  // Get phone first to delete related messages
  const { data: row } = await supabase
    .from("prospectos")
    .select("telefono")
    .eq("id", Number(id))
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await supabase.from("prospectos_mensajes").delete().eq("telefono", row.telefono);
  await supabase.from("prospectos").delete().eq("id", Number(id));

  return NextResponse.json({ success: true });
}
