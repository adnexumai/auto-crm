import {
  AlertTriangle,
  Flame,
  MessageCircle,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Kpis } from "./constants";

type KpiCard = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  helper?: string;
};

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const items: KpiCard[] = [
    {
      label: "Contactados hoy",
      value: kpis.contactosHoy,
      icon: MessageCircle,
      color: "text-emerald-600 dark:text-emerald-300",
      helper: "salidas del dia",
    },
    {
      label: "Respuestas hoy",
      value: kpis.respuestasHoy,
      icon: TrendingUp,
      color: "text-sky-600 dark:text-sky-300",
      helper: "inbound medido",
    },
    {
      label: "Tasa respuesta",
      value: `${kpis.tasa}%`,
      icon: TrendingUp,
      color:
        kpis.tasa >= 20
          ? "text-emerald-600 dark:text-emerald-300"
          : "text-amber-700 dark:text-amber-300",
      helper: "hoy",
    },
    {
      label: "Calientes",
      value: kpis.calientes,
      icon: Flame,
      color: "text-orange-600 dark:text-orange-300",
      helper: "prioridad comercial",
    },
    {
      label: "Requieren humano",
      value: kpis.requiereHumano,
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-300",
      helper: "no delegar",
    },
    {
      label: "Destacados",
      value: kpis.destacados,
      icon: Star,
      color: "text-amber-600 dark:text-amber-300",
      helper: "marcados a mano",
    },
    {
      label: "Pipeline abierto",
      value: kpis.oportunidadesAbiertas,
      icon: Users,
      color: "text-cyan-700 dark:text-cyan-300",
      helper: "sin cerrar",
    },
    {
      label: "Total historico",
      value: kpis.total,
      icon: Users,
      color: "text-muted-foreground",
      helper: "base completa",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((card) => (
        <Card
          key={card.label}
          className="overflow-hidden border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/55"
        >
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {card.label}
              </span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className={`text-3xl font-black tracking-tight ${card.color}`}>
              {card.value}
            </p>
            {card.helper ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{card.helper}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
