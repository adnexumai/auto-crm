import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crmSettings } from "@/db/schema";
import { buildDailyPlanKey, type DailyPlanTask } from "@/lib/prospecting";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function sanitizeTasks(value: unknown): DailyPlanTask[] {
  if (!Array.isArray(value)) return [];

  const tasks: DailyPlanTask[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";

    if (!title) continue;

    tasks.push({
      id:
        typeof row.id === "string" && row.id.trim()
          ? row.id
          : crypto.randomUUID(),
      title,
      type:
        row.type === "visita" ||
        row.type === "llamada" ||
        row.type === "seguimiento" ||
        row.type === "operativo"
          ? row.type
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
  const key = buildDailyPlanKey(date);

  const [row] = await db
    .select({ value: crmSettings.value })
    .from(crmSettings)
    .where(eq(crmSettings.key, key));

  let tasks: DailyPlanTask[] = [];

  if (row?.value) {
    try {
      tasks = sanitizeTasks(JSON.parse(row.value));
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

  const date =
    typeof body.date === "string" && body.date.trim()
      ? body.date
      : new Date().toISOString().slice(0, 10);
  const tasks = sanitizeTasks(body.tasks);
  const key = buildDailyPlanKey(date);
  const value = JSON.stringify(tasks);

  await db
    .insert(crmSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: crmSettings.key,
      set: { value },
    });

  return NextResponse.json({ date, tasks });
}
