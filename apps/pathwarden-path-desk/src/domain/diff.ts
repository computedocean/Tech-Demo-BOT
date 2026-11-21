import type { DiffItem, FindingBadge, RunSummary } from "./types.ts";

const BADGE_RANK: Record<FindingBadge, number> = {
  New: 0,
  Regressed: 1,
  Fixed: 2,
  Open: 3,
};

/**
 * Compare each run with the one before it.
 * Regressed is Pathwarden's Back: present now, absent in the previous run,
 * and present in an earlier run.
 */
export function diffRuns(runs: readonly RunSummary[]): Array<{
  snapshotId: string;
  items: DiffItem[];
}> {
  const seenBefore = new Set<string>();
  let previous = new Map<string, RunSummary["findings"][number]>();
  const result: Array<{ snapshotId: string; items: DiffItem[] }> = [];

  for (const run of runs) {
    const current = new Map(run.findings.map((finding) => [finding.id, finding]));
    const items: DiffItem[] = [];

    for (const finding of current.values()) {
      let badge: FindingBadge;
      if (previous.has(finding.id)) badge = "Open";
      else if (seenBefore.has(finding.id)) badge = "Regressed";
      else badge = "New";
      items.push({
        findingId: finding.id,
        title: finding.title,
        badge,
        severity: finding.severity,
      });
    }

    for (const finding of previous.values()) {
      if (current.has(finding.id)) continue;
      items.push({
        findingId: finding.id,
        title: finding.title,
        badge: "Fixed",
        severity: finding.severity,
      });
    }

    items.sort((a, b) => {
      const byBadge = BADGE_RANK[a.badge] - BADGE_RANK[b.badge];
      if (byBadge !== 0) return byBadge;
      return a.findingId.localeCompare(b.findingId);
    });

    result.push({ snapshotId: run.snapshotId, items });

    for (const id of previous.keys()) seenBefore.add(id);
    previous = current;
  }

  return result;
}
