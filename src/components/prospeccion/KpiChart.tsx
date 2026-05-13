// [FUSION] Chart de últimos 14 días con recharts (reemplaza el chart Tailwind del Tracker)
"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Kpis } from "./constants";

export function KpiChart({ serie }: { serie: Kpis["serie"] }) {
  const data = serie.map((d) => ({
    dia: d.dia.slice(5), // MM-DD
    Contactos: d.contactos,
    Respuestas: d.respuestas,
  }));

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Últimos 14 días
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="dia" fontSize={10} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Contactos" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Respuestas" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
