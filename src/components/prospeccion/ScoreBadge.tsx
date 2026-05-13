// [FUSION] Portado desde adnexum-os - Badge visual para score de oportunidad 1-10
import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (!score) return <span className="text-xs text-muted-foreground">—</span>;

  const colorClass =
    score >= 7
      ? "bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400"
      : score >= 4
        ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400"
        : "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold",
        colorClass
      )}
    >
      {score}/10
    </span>
  );
}
