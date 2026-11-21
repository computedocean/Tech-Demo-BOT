import type { Finding } from "@/domain/types.ts";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "./status-badge.tsx";

interface FindingsPanelProps {
  findings: Finding[];
  totalAccounts: number;
  selectedId: string | null;
  closedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

export function FindingsPanel({
  findings,
  totalAccounts,
  selectedId,
  closedIds,
  onSelect,
}: FindingsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col border-r" data-testid="findings" aria-label="Ranked findings">
      <header className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Ranked findings</h2>
        <p className="text-[11px] text-muted-foreground">Most exposed first. Select one to draw its path.</p>
      </header>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        {findings.map((finding) => {
          const selected = finding.id === selectedId;
          const closed = closedIds.has(finding.id);
          return (
            <button
              key={finding.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(finding.id)}
              className={cn(
                "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                selected ? "border-orange-600 bg-orange-50" : "border-transparent bg-muted/40 hover:bg-muted",
                closed && "opacity-60",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <SeverityBadge severity={finding.severity} />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {finding.exposure}/{totalAccounts}
                  {closed ? " · Closed" : ""}
                </span>
              </div>
              <div className="text-xs leading-snug font-medium">{finding.title}</div>
              {finding.directControl ? (
                <div className="mt-1 text-[10px] text-orange-800">Direct Tier Zero control</div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
