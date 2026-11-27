import type { Fix } from "@/domain/types.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";

interface FixPanelProps {
  fixes: Fix[];
  removed: ReadonlySet<string>;
  onToggle: (edgeId: string, applied: boolean) => void;
  onApplyAll: () => void;
  onClear: () => void;
}

export function FixPanel({ fixes, removed, onToggle, onApplyAll, onClear }: FixPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col border-l" data-testid="fixes" aria-label="Minimum fix set">
      <header className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Minimum fix set</h2>
        <p className="text-[11px] text-muted-foreground">
          Smallest set of relationship removals that disconnects every non-Tier Zero account. Most effective first.
        </p>
        <div className="mt-2 flex gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onApplyAll}>
            Apply full set
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        {fixes.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No remaining paths to Tier Zero.</p>
        ) : (
          fixes.map((fix, index) => (
            <div key={fix.edgeId} className="rounded-lg bg-muted/40 px-2.5 py-2">
              <div className="flex items-start gap-2">
                <Switch
                  size="sm"
                  className="mt-0.5"
                  checked={removed.has(fix.edgeId)}
                  onCheckedChange={(checked) => onToggle(fix.edgeId, checked)}
                  aria-label={fix.title}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Fix {index + 1} · {fix.pathsClosed} paths · {fix.accountsTouched} accounts
                  </div>
                  <div className="text-xs leading-snug font-medium">{fix.title}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
