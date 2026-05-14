// GET mensajes de un prospecto (Supabase)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: prospect } = await supabase
    .from("prospectos")
    .select("telefono")
    .eq("id", Number(id))
    .maybeSingle();

  if (!prospect) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { data: mensajes, error } = await supabase
    .from("prospectos_mensajes")
    .select("id, telefono, direccion, tipo, contenido, nombre_contacto, timestamp, wamid")
    .eq("telefono", prospect.telefono)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: mensajes || [] });
}
