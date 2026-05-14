// [FUSION] Promoción de prospect a Deal del CRM (Supabase + CRM bridge)
// NOTE: CRM tables (contacts, deals, pipeline_stages) still in SQLite.
// This route reads prospect from Supabase but needs Turso for CRM operations.
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { postN8n } from "@/lib/prospeccion/ycloud";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: prospect, error } = await supabase
    .from("prospectos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !prospect) {
    return NextResponse.json({ error: "Prospect no encontrado" }, { status: 404 });
  }

  // CRM tables (contacts, deals, pipeline) are not yet in Supabase.
  // For now, update prospect estado and notify n8n.
  await supabase
    .from("prospectos")
    .update({ estado: "seguimiento" })
    .eq("id", id);

  // Fire-and-forget n8n notification
  postN8n("/webhook/prospect-promoted", {
    prospectId: prospect.id,
    phone: prospect.telefono,
    name: prospect.nombre_contacto || prospect.negocio || "",
    score: prospect.oportunidad_score,
  });

  return NextResponse.json({
    success: true,
    message: "Prospect marcado como seguimiento. CRM deal creation pendiente de migración.",
    prospectId: prospect.id,
  });
}
