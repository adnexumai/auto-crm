// Prospección — GET lista paginada + POST crear prospecto (Supabase)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const estado = searchParams.get("estado")?.trim() || "";
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
  );

  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("prospectos")
    .select("*", { count: "exact" })
    .order("ultimo_contacto", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `telefono.ilike.%${search}%,negocio.ilike.%${search}%,nombre_contacto.ilike.%${search}%`
    );
  }
  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data: items, count, error } = await query;

  if (error) {
    console.error("[prospeccion GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch latest message for each prospect
  const phones = (items || []).map((i) => i.telefono);
  const latestByPhone = new Map<string, string>();

  if (phones.length > 0) {
    const { data: messages } = await supabase
      .from("prospectos_mensajes")
      .select("telefono, contenido")
      .in("telefono", phones)
      .order("timestamp", { ascending: false })
      .limit(phones.length * 3);

    for (const msg of messages || []) {
      if (!latestByPhone.has(msg.telefono)) {
        latestByPhone.set(msg.telefono, msg.contenido || "");
      }
    }
  }

  // Get total count without filters
  const { count: totalGlobal } = await supabase
    .from("prospectos")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    items: (items || []).map((item) => ({
      ...item,
      // Normalize field names for frontend compatibility
      nombreContacto: item.nombre_contacto,
      primerContacto: item.primer_contacto,
      ultimoContacto: item.ultimo_contacto,
      mensajesEnviados: item.mensajes_enviados,
      oportunidadScore: item.oportunidad_score,
      resumenIa: item.resumen_ia,
      ultimoAnalisis: item.ultimo_analisis,
      siguientePaso: item.siguiente_paso,
      ultimoMensaje: latestByPhone.get(item.telefono) || "",
    })),
    total: count ?? 0,
    totalGlobal: totalGlobal ?? 0,
    page,
    pageSize,
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const telefono = String(body.telefono ?? "").trim();
  if (!telefono) {
    return NextResponse.json({ error: "El telefono es obligatorio" }, { status: 400 });
  }

  const negocio = typeof body.negocio === "string" ? body.negocio.trim() : "";
  const nombreContacto = typeof body.nombreContacto === "string" ? body.nombreContacto.trim() : "";
  const notas = typeof body.notas === "string" ? body.notas.trim() : "";

  // Check if exists
  const { data: existing } = await supabase
    .from("prospectos")
    .select("id, negocio, nombre_contacto")
    .eq("telefono", telefono)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (negocio && !existing.negocio) patch.negocio = negocio;
    if (nombreContacto && !existing.nombre_contacto) patch.nombre_contacto = nombreContacto;
    if (notas) patch.notas = notas;

    if (Object.keys(patch).length > 0) {
      await supabase.from("prospectos").update(patch).eq("id", existing.id);
    }

    const { data: updated } = await supabase
      .from("prospectos")
      .select("*")
      .eq("id", existing.id)
      .single();

    return NextResponse.json({ item: updated, duplicated: true });
  }

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("prospectos")
    .insert({
      telefono,
      nombre_contacto: nombreContacto,
      negocio: negocio || "",
      estado: "enviado",
      respondio: false,
      notas,
      mensajes_enviados: 0,
      primer_contacto: now,
      ultimo_contacto: now,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: created, duplicated: false }, { status: 201 });
}
