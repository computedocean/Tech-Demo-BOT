import { cn } from "@/lib/utils";
import type { FindingBadge, Severity } from "@/domain/types.ts";

const severityClass: Record<Severity, string> = {
  critical: "bg-red-700 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-amber-200 text-amber-950",
  low: "bg-slate-200 text-slate-700",
};

const badgeClass: Record<FindingBadge, string> = {
  New: "bg-sky-700 text-white",
  Open: "bg-secondary text-secondary-foreground",
  Fixed: "bg-emerald-700 text-white",
  Regressed: "bg-amber-500 text-amber-950",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold tracking-wide uppercase",
        severityClass[severity],
      )}
    >
      {severity}
    </span>
  );
}

export function StatusBadge({ badge }: { badge: FindingBadge }) {
  return (
    <span
      data-badge={badge}
      title={badge === "Regressed" ? "Pathwarden calls this Back" : undefined}
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold tracking-wide",
        badgeClass[badge],
      )}
    >
      {badge}
    </span>
  );
}
