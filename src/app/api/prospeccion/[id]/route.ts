// GET/PATCH/DELETE individual prospect (Supabase)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Map of allowed fields with both camelCase and snake_case keys → DB column name
const FIELD_MAP: Record<string, string> = {
  negocio: "negocio",
  nombre_contacto: "nombre_contacto",
  nombreContacto: "nombre_contacto",
  estado: "estado",
  notas: "notas",
  respondio: "respondio",
  siguiente_paso: "siguiente_paso",
  siguientePaso: "siguiente_paso",
  oportunidad_score: "oportunidad_score",
  oportunidadScore: "oportunidad_score",
  destacado: "destacado",
  requiere_humano: "requiere_humano",
  requiereHumano: "requiere_humano",
  temperatura: "temperatura",
  fecha_agendado: "fecha_agendado",
  fechaAgendado: "fecha_agendado",
  chatwoot_conversation_id: "chatwoot_conversation_id",
  chatwootConversationId: "chatwoot_conversation_id",
};

// Fields that, when changed, should trigger a Chatwoot label resync via n8n
const SYNC_TRIGGER_FIELDS = new Set([
  "estado",
  "temperatura",
  "destacado",
  "requiere_humano",
]);

async function notifyPipelineLabelsSync(args: {
  prospectId: string;
  phone: string;
  estado: string;
  chatwootConversationId: string | null;
}) {
  const base = process.env.N8N_WEBHOOK_BASE?.trim();
  if (!base) return;
  const url = `${base.replace(/\/+$/, "")}/webhook/crm-estado-sync`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: args.prospectId,
        phone: args.phone,
        nuevoEstado: args.estado,
        chatwootConversationId: args.chatwootConversationId ?? null,
      }),
    });
  } catch (err) {
    console.error("[crm-estado-sync] failed:", err);
  }
}

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

  // Build patch with both camelCase and snake_case support
  const patch: Record<string, unknown> = {};
  const fieldsChanged = new Set<string>();
  for (const [key, value] of Object.entries(body)) {
    const dbCol = FIELD_MAP[key];
    if (dbCol && !(dbCol in patch)) {
      patch[dbCol] = value;
      fieldsChanged.add(dbCol);
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin campos validos" }, { status: 400 });
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

  // Trigger Chatwoot label sync if any relevant field changed
  const shouldSync = [...fieldsChanged].some((f) => SYNC_TRIGGER_FIELDS.has(f));
  if (shouldSync && data) {
    notifyPipelineLabelsSync({
      prospectId: String(data.id),
      phone: data.telefono,
      estado: data.estado,
      chatwootConversationId: data.chatwoot_conversation_id ?? null,
    });
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
