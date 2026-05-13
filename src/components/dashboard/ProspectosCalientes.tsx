import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { extractNextStepFromSummary } from "@/lib/prospecting";
import { withBasePath } from "@/lib/paths";

interface Prospecto {
  telefono: string;
  negocio: string | null;
  nombreContacto: string | null;
  oportunidadScore: number | null;
  resumenIa: string | null;
}

function scoreBg(score: number) {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-yellow-500";
  return "bg-orange-400";
}

export function ProspectosCalientes({ prospectos }: { prospectos: Prospecto[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-orange-500" />
          Leads calientes
          {prospectos.length > 0 ? (
            <Badge variant="outline" className="ml-auto text-xs">
              Top {prospectos.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {prospectos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aun no hay analisis IA suficientes para destacar leads.
          </p>
        ) : (
          <>
            {prospectos.map((prospect) => {
              const score = prospect.oportunidadScore ?? 0;
              const nextStep = extractNextStepFromSummary(prospect.resumenIa);
              const title =
                prospect.negocio || prospect.nombreContacto || prospect.telefono;

              return (
                <Link
                  key={prospect.telefono}
                  href={withBasePath("/prospeccion")}
                  className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-1 shrink-0">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${scoreBg(score)}`}
                    >
                      <span className="text-[10px] font-bold text-white">{score}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    {nextStep ? (
                      <p className="truncate text-xs text-muted-foreground">{nextStep}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{prospect.telefono}</p>
                    )}
                  </div>
                </Link>
              );
            })}
            <Link
              href={withBasePath("/prospeccion")}
              className="block py-1.5 text-center text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              Ver todos los prospectos
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
