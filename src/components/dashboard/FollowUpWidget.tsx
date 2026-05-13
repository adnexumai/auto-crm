import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, Calendar } from "lucide-react";

interface FollowUp {
  id: string;
  type: string;
  description: string;
  contactName: string | null;
  contactCompany: string | null;
  scheduledAt: number | Date | null;
  contactId: string | null;
}

interface Props {
  overdue: FollowUp[];
  today: FollowUp[];
}

function formatRelative(ts: number | Date | null) {
  if (!ts) return null;
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return date.toLocaleString("es-AR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function FollowUpRow({ item, variant }: { item: FollowUp; variant: "overdue" | "today" }) {
  return (
    <Link
      href={item.contactId ? `/contacts/${item.contactId}` : "/activities"}
      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className={`mt-0.5 shrink-0 ${variant === "overdue" ? "text-destructive" : "text-primary"}`}>
        {variant === "overdue" ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {item.contactName || "Sin contacto"}
          {item.contactCompany && (
            <span className="text-muted-foreground font-normal"> · {item.contactCompany}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        {item.scheduledAt && (
          <p className={`text-xs mt-0.5 ${variant === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
            {formatRelative(item.scheduledAt)}
          </p>
        )}
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
        {item.type}
      </Badge>
    </Link>
  );
}

export function FollowUpWidget({ overdue, today }: Props) {
  const total = overdue.length + today.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Seguimientos
          {total > 0 && (
            <Badge
              variant={overdue.length > 0 ? "destructive" : "default"}
              className="ml-auto text-xs"
            >
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin seguimientos pendientes
          </p>
        ) : (
          <>
            {overdue.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-destructive px-2.5 mb-1">
                  Vencidos ({overdue.length})
                </p>
                {overdue.slice(0, 3).map((f) => (
                  <FollowUpRow key={f.id} item={f} variant="overdue" />
                ))}
              </div>
            )}
            {today.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary px-2.5 mb-1">
                  Hoy ({today.length})
                </p>
                {today.slice(0, 3).map((f) => (
                  <FollowUpRow key={f.id} item={f} variant="today" />
                ))}
              </div>
            )}
            {total > 6 && (
              <Link
                href="/activities"
                className="block text-xs text-center text-muted-foreground hover:text-primary py-1.5 transition-colors"
              >
                Ver todos ({total})
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}