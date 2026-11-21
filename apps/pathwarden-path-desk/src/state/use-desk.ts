import { useMemo, useState } from "react";
import { analyze } from "@/domain/engine.ts";
import { SCAN_HISTORY } from "@/domain/history.ts";
import { parseCollectionBytes, parseCollectionText } from "@/domain/import.ts";
import { CURRENT_SNAPSHOT_ID, SNAPSHOTS, graphForSnapshot } from "@/domain/northglass.ts";
import type { Graph } from "@/domain/types.ts";

export function useDesk() {
  const [snapshotId, setSnapshotId] = useState(CURRENT_SNAPSHOT_ID);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imported, setImported] = useState<Graph | null>(null);
  const [importGeneration, setImportGeneration] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importName, setImportName] = useState<string | null>(null);

  const graphKey = imported ? `import:${importGeneration}` : snapshotId;
  const [viewKey, setViewKey] = useState(graphKey);
  if (viewKey !== graphKey) {
    setViewKey(graphKey);
    setRemoved(new Set());
    setSelectedId(null);
  }

  const graph = useMemo(
    () => imported ?? graphForSnapshot(snapshotId),
    [imported, snapshotId],
  );
  const baseline = useMemo(() => analyze(graph), [graph]);
  const active = useMemo(() => analyze(graph, removed), [graph, removed]);

  const selected =
    baseline.findings.find((finding) => finding.id === selectedId) ?? baseline.findings[0] ?? null;
  const highlightClosed = selected ? selected.path.edgeIds.some((id) => removed.has(id)) : false;
  const closedFindingIds = new Set(
    baseline.findings
      .filter((finding) => !active.findings.some((open) => open.id === finding.id))
      .map((finding) => finding.id),
  );

  const diffForSnapshot =
    SCAN_HISTORY.find((run) => run.snapshotId === snapshotId)?.items ?? [];

  const counts = useMemo(() => {
    const map = new Map<string, { New: number; Fixed: number; Regressed: number }>();
    for (const run of SCAN_HISTORY) {
      const tally = { New: 0, Fixed: 0, Regressed: 0 };
      for (const item of run.items) {
        if (item.badge === "New" || item.badge === "Fixed" || item.badge === "Regressed") {
          tally[item.badge] += 1;
        }
      }
      map.set(run.snapshotId, tally);
    }
    return map;
  }, []);

  function toggleFix(edgeId: string, applied: boolean) {
    setRemoved((current) => {
      const next = new Set(current);
      if (applied) next.add(edgeId);
      else next.delete(edgeId);
      return next;
    });
  }

  function applyResult(result: ReturnType<typeof parseCollectionText>, name: string) {
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    setImportName(name);
    setImportGeneration((current) => current + 1);
    setImported(result.graph);
  }

  async function importFile(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      applyResult(parseCollectionBytes(bytes), file.name);
    } catch {
      setImportError("Could not read that file. The bundled graph is unchanged.");
    }
  }

  async function loadSample() {
    try {
      const response = await fetch("/samples/valid-collection.json");
      if (!response.ok) {
        setImportError("The bundled sample could not be read. The current graph is unchanged.");
        return;
      }
      applyResult(parseCollectionText(await response.text()), "valid-collection.json");
    } catch {
      setImportError("The bundled sample could not be read. The current graph is unchanged.");
    }
  }

  function clearImport() {
    setImported(null);
    setImportName(null);
    setImportError(null);
  }

  return {
    snapshots: SNAPSHOTS,
    snapshotId,
    setSnapshotId,
    graph,
    baseline,
    active,
    removed,
    selected,
    highlightClosed,
    closedFindingIds,
    diffItems: diffForSnapshot,
    counts,
    imported: imported !== null,
    importName,
    importError,
    toggleFix,
    applyAll: () => setRemoved(new Set(baseline.fixes.map((fix) => fix.edgeId))),
    clearFixes: () => setRemoved(new Set()),
    selectFinding: setSelectedId,
    importFile,
    loadSample,
    clearImport,
  };
}
