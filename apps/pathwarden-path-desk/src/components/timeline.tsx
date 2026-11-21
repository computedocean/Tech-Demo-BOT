import type { DiffItem } from "@/domain/types.ts";
import type { Snapshot } from "@/domain/northglass.ts";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge.tsx";

interface TimelineProps {
  snapshots: Snapshot[];
  selectedId: string;
  disabled: boolean;
  items: DiffItem[];
  counts: Map<string, { New: number; Fixed: number; Regressed: number }>;
  onSelect: (id: string) => void;
}

export function Timeline({ snapshots, selectedId, disabled, items, counts, onSelect }: TimelineProps) {
  return (
    <div className="border-b px-3 py-2" data-testid="timeline">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Scan history</h2>
        {disabled ? (
          <p className="text-[11px] text-muted-foreground">Timeline is the bundled history. Clear the import to step it.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">Fixture snapshots, not a live rescan. Regressed means a fixed finding returned.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {snapshots.map((snapshot) => {
          const count = counts.get(snapshot.id);
          const selected = snapshot.id === selectedId && !disabled;
          return (
            <button
              key={snapshot.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(snapshot.id)}
              className={cn(
                "rounded-lg border px-2 py-1 text-left",
                selected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <div className="text-[11px] font-medium">{snapshot.label}</div>
              <div className={cn("text-[10px]", selected ? "text-background/80" : "text-muted-foreground")}>
                {snapshot.takenAt}
                {count?.New ? ` · New ${count.New}` : ""}
                {count?.Fixed ? ` · Fixed ${count.Fixed}` : ""}
                {count?.Regressed ? ` · Regressed ${count.Regressed}` : ""}
              </div>
            </button>
          );
        })}
      </div>
      {!disabled ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {items
            .filter((item) => item.badge !== "Open")
            .map((item) => (
              <span key={`${item.badge}-${item.findingId}`} className="inline-flex items-center gap-1 text-[11px]">
                <StatusBadge badge={item.badge} />
                <span className="max-w-[280px] truncate text-muted-foreground">{item.title}</span>
              </span>
            ))}
          <span className="inline-flex items-center gap-1 text-[11px]">
            <StatusBadge badge="Open" />
            <span className="text-muted-foreground">
              {items.filter((item) => item.badge === "Open").length} still open
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
