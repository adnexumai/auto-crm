"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { withBasePath } from "@/lib/paths";
import {
  DAILY_PROSPECTING_GOAL,
  type DailyPlanTask,
} from "@/lib/prospecting";

interface SuggestedTask {
  id: string;
  prospectId: string;
  priority: "high" | "medium" | "low";
  kind: string;
  title: string;
  subtitle: string;
  dueLabel: string;
  estado: string;
  score: number;
  nextStep: string;
}

interface TaskStats {
  dailyGoal: number;
  newToday: number;
  scheduledToday: number;
  overdueFollowUps: number;
  hotLeads: number;
  activePipeline: number;
}

const EMPTY_TASK: DailyPlanTask = {
  id: "",
  title: "",
  type: "otro",
  completed: false,
  time: "",
  address: "",
  notes: "",
  prospectId: null,
};

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TareasDelDiaPanel() {
  const [date] = useState(todayKey);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedTask[]>([]);
  const [tasks, setTasks] = useState<DailyPlanTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestionsRes, planRes] = await Promise.all([
        fetch(withBasePath("/api/prospeccion/tareas")),
        fetch(withBasePath(`/api/prospeccion/plan-diario?date=${date}`)),
      ]);

      if (!suggestionsRes.ok || !planRes.ok) {
        throw new Error("No se pudo cargar el panel operativo");
      }

      const suggestionsData = await suggestionsRes.json();
      const planData = await planRes.json();

      setStats(suggestionsData.stats);
      setSuggestions(suggestionsData.suggestions || []);
      setTasks(planData.tasks || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el panel"
      );
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(() => {
    const newToday = stats?.newToday ?? 0;
    return Math.min(
      100,
      Math.round((newToday / (stats?.dailyGoal || DAILY_PROSPECTING_GOAL)) * 100)
    );
  }, [stats]);

  function updateTask(id: string, patch: Partial<DailyPlanTask>) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task))
    );
  }

  function addTask() {
    setTasks((prev) => [
      {
        ...EMPTY_TASK,
        id: crypto.randomUUID(),
      },
      ...prev,
    ]);
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  async function savePlan() {
    setSaving(true);
    try {
      const filtered = tasks.filter((task) => task.title.trim());
      const res = await fetch(withBasePath("/api/prospeccion/plan-diario"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, tasks: filtered }),
      });

      if (!res.ok) {
        throw new Error("No se pudo guardar el plan");
      }

      const data = await res.json();
      setTasks(data.tasks || []);
      toast.success("Plan del dia guardado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el plan"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Objetivo diario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold">{stats?.newToday ?? 0}</p>
                <p className="text-sm text-muted-foreground">
                  leads nuevos sobre {stats?.dailyGoal ?? DAILY_PROSPECTING_GOAL}
                </p>
              </div>
              <Badge variant="outline">{progress}% del objetivo</Badge>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Seguimientos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.overdueFollowUps ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pendientes para hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reuniones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.scheduledToday ?? 0}</p>
            <p className="text-xs text-muted-foreground">Agendadas hoy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Acciones sugeridas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                A quien tocar hoy y cual deberia ser el siguiente paso.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Actualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando sugerencias...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay sugerencias para hoy. Eso es buena señal.
              </p>
            ) : (
              suggestions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/70 bg-background p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={item.priority === "high" ? "destructive" : "secondary"}
                    >
                      {item.priority === "high" ? "alta" : "media"}
                    </Badge>
                    <Badge variant="outline">{item.dueLabel}</Badge>
                    <Badge variant="outline">score {item.score}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                  <p className="mt-3 text-sm">{item.nextStep}</p>
                  <div className="mt-3">
                    <a href={withBasePath(`/conversations?prospect=${item.prospectId}`)}>
                      <Button size="sm" variant="outline">
                        Abrir lead
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Plan del dia</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Guardado por fecha. Sirve para llamadas, visitas y operativa.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addTask}>
                Nueva tarea
              </Button>
              <Button size="sm" onClick={savePlan} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aun no cargaste tareas manuales para hoy.
              </p>
            )}

            {tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-border/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(event) =>
                        updateTask(task.id, { completed: event.target.checked })
                      }
                    />
                    Hecha
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="grid gap-3">
                  <Input
                    value={task.title}
                    onChange={(event) =>
                      updateTask(task.id, { title: event.target.value })
                    }
                    placeholder="Que vas a hacer"
                  />

                  <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                    <input
                      type="time"
                      value={task.time || ""}
                      onChange={(event) =>
                        updateTask(task.id, { time: event.target.value })
                      }
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    />
                    <Input
                      value={task.address || ""}
                      onChange={(event) =>
                        updateTask(task.id, { address: event.target.value })
                      }
                      placeholder="Direccion o lugar"
                    />
                  </div>

                  <select
                    value={task.type}
                    onChange={(event) =>
                      updateTask(task.id, {
                        type: event.target.value as DailyPlanTask["type"],
                      })
                    }
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="llamada">Llamada</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="visita">Visita</option>
                    <option value="operativo">Operativo</option>
                    <option value="otro">Otro</option>
                  </select>

                  <Textarea
                    value={task.notes || ""}
                    onChange={(event) =>
                      updateTask(task.id, { notes: event.target.value })
                    }
                    placeholder="Notas de la tarea"
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
