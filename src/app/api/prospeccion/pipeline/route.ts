// Pipeline visual de prospectos por estado (Supabase)
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ESTADOS = [
  "enviado", "contactado", "respondio", "agendado",
  "seguimiento", "cerrado_positivo", "cerrado_negativo",
] as const;

const STATUS_LABELS: Record<string, string> = {
  enviado: "Enviado",
  contactado: "Contactado",
  respondio: "Respondio",
  agendado: "Agendado",
  seguimiento: "Seguimiento",
  cerrado_positivo: "Cerrado +",
  cerrado_negativo: "Cerrado -",
};

const STATUS_COLORS: Record<string, string> = {
  enviado: "#94a3b8",
  contactado: "#60a5fa",
  respondio: "#34d399",
  agendado: "#a78bfa",
  seguimiento: "#fbbf24",
  cerrado_positivo: "#22c55e",
  cerrado_negativo: "#ef4444",
};

export async function GET() {
  const supabase = getSupabase();

  const { data: rows } = await supabase
    .from("prospectos")
    .select("id, telefono, nombre_contacto, negocio, estado, respondio, oportunidad_score, notas, mensajes_enviados, ultimo_contacto")
    .order("ultimo_contacto", { ascending: false });

  const columns = ESTADOS.map((estado) => {
    const items = (rows || [])
      .filter((row) => row.estado === estado)
      .map((row) => ({
        ...row,
        displayName: row.negocio || row.nombre_contacto || row.telefono,
      }));

    return {
      id: estado,
      name: STATUS_LABELS[estado] || estado,
      color: STATUS_COLORS[estado] || "#94a3b8",
      count: items.length,
      prospects: items,
    };
  });

  return NextResponse.json({ columns });
}
