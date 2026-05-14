// Plan diario de prospección (Supabase — uses notas_prospectos table)
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface DailyPlanTask {
  id: string;
  title: string;
  type: string;
  completed: boolean;
  time: string | null;
  address: string | null;
  notes: string | null;
  prospectId: string | null;
}

function sanitizeTasks(value: unknown): DailyPlanTask[] {
  if (!Array.isArray(value)) return [];
  const tasks: DailyPlanTask[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!title) continue;
    tasks.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id : crypto.randomUUID(),
      title,
      type: ["visita", "llamada", "seguimiento", "operativo"].includes(row.type as string)
        ? (row.type as string)
        : "otro",
      completed: Boolean(row.completed),
      time: typeof row.time === "string" ? row.time : null,
      address: typeof row.address === "string" ? row.address : null,
      notes: typeof row.notes === "string" ? row.notes : null,
      prospectId: typeof row.prospectId === "string" ? row.prospectId : null,
    });
  }
  return tasks;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const key = `plan_diario_${date}`;
  const supabase = getSupabase();

  // Use notas_prospectos with nombre_archivo as key
  const { data } = await supabase
    .from("notas_prospectos")
    .select("contenido_md")
    .eq("nombre_archivo", key)
    .single();

  let tasks: DailyPlanTask[] = [];
  if (data?.contenido_md) {
    try {
      tasks = sanitizeTasks(JSON.parse(data.contenido_md));
    } catch {
      tasks = [];
    }
  }

  return NextResponse.json({ date, tasks });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const date = typeof body.date === "string" && body.date.trim()
    ? body.date
    : new Date().toISOString().slice(0, 10);
  const tasks = sanitizeTasks(body.tasks);
  const key = `plan_diario_${date}`;
  const value = JSON.stringify(tasks);
  const supabase = getSupabase();

  // Check if exists
  const { data: existing } = await supabase
    .from("notas_prospectos")
    .select("id")
    .eq("nombre_archivo", key)
    .single();

  if (existing) {
    await supabase
      .from("notas_prospectos")
      .update({ contenido_md: value })
      .eq("nombre_archivo", key);
  } else {
    await supabase
      .from("notas_prospectos")
      .insert({
        telefono: "system",
        negocio: "Plan Diario",
        nombre_archivo: key,
        contenido_md: value,
        score: 0,
      });
  }

  return NextResponse.json({ date, tasks });
}
