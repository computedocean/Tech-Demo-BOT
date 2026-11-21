import { DeskFooter } from "@/components/desk-footer.tsx";
import { FindingsPanel } from "@/components/findings-panel.tsx";
import { FixPanel } from "@/components/fix-panel.tsx";
import { ImportBar } from "@/components/import-bar.tsx";
import { PathGraph } from "@/components/path-graph.tsx";
import { Timeline } from "@/components/timeline.tsx";
import { cn } from "@/lib/utils";
import { useDesk } from "@/state/use-desk.ts";

export default function App() {
  const desk = useDesk();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">Path desk</h1>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
              Simulated · not official
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {desk.imported
              ? "Simulation on the file you provided. Not a live collection."
              : "Northglass Analytical · invented synthetic AD and Entra directory."}
          </p>
          <p
            data-testid="residual"
            className={cn(
              "text-xs font-medium",
              desk.active.accountsWithPath === 0 ? "text-emerald-700" : "text-foreground",
            )}
          >
            {desk.active.accountsWithPath} of {desk.baseline.nonTierZeroAccounts} non-Tier Zero accounts still reach
            Tier Zero · {desk.active.paths.length} open paths
          </p>
        </div>
        <ImportBar
          importName={desk.importName}
          error={desk.importError}
          onFile={(file) => void desk.importFile(file)}
          onSample={() => void desk.loadSample()}
          onClear={desk.clearImport}
        />
      </header>
      <Timeline
        snapshots={desk.snapshots}
        selectedId={desk.snapshotId}
        disabled={desk.imported}
        items={desk.diffItems}
        counts={desk.counts}
        onSelect={desk.setSnapshotId}
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <FindingsPanel
          findings={desk.baseline.findings}
          totalAccounts={desk.baseline.nonTierZeroAccounts}
          selectedId={desk.selected?.id ?? null}
          closedIds={desk.closedFindingIds}
          onSelect={desk.selectFinding}
        />
        <PathGraph
          graph={desk.graph}
          removed={desk.removed}
          baselinePaths={desk.baseline.paths}
          activePaths={desk.active.paths}
          highlighted={desk.selected?.path ?? null}
          highlightClosed={desk.highlightClosed}
        />
        <FixPanel
          fixes={desk.baseline.fixes}
          removed={desk.removed}
          onToggle={desk.toggleFix}
          onApplyAll={desk.applyAll}
          onClear={desk.clearFixes}
        />
      </main>
      <DeskFooter imported={desk.imported} />
    </div>
  );
}
