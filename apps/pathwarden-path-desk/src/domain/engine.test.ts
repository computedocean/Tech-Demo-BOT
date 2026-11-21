import { describe, expect, test } from "bun:test";
import { diffRuns } from "./diff.ts";
import { analyze } from "./engine.ts";
import { CURRENT_SNAPSHOT_ID, SNAPSHOTS, graphForSnapshot } from "./northglass.ts";
import { severityBand } from "./severity.ts";
import type { FindingBadge } from "./types.ts";

const CURRENT = graphForSnapshot(CURRENT_SNAPSHOT_ID);

describe("severity bands", () => {
  test("uses 95, 80, and 40 percent thresholds", () => {
    expect(severityBand(0.95, false)).toBe("critical");
    expect(severityBand(0.949, false)).toBe("high");
    expect(severityBand(0.8, false)).toBe("high");
    expect(severityBand(0.799, false)).toBe("medium");
    expect(severityBand(0.4, false)).toBe("medium");
    expect(severityBand(0.399, false)).toBe("low");
  });

  test("direct control of Tier Zero is at least High", () => {
    expect(severityBand(0.1, true)).toBe("high");
    expect(severityBand(0.4, true)).toBe("high");
    expect(severityBand(0.8, true)).toBe("high");
    expect(severityBand(1, true)).toBe("critical");
  });
});

describe("bundled Northglass ranking", () => {
  const analysis = analyze(CURRENT);

  test("counts every non-Tier Zero account that can reach Tier Zero", () => {
    expect(analysis.nonTierZeroAccounts).toBe(21);
    expect(analysis.accountsWithPath).toBe(21);
  });

  test("orders findings by severity and exposure", () => {
    expect(
      analysis.findings.map((finding) => [finding.id, finding.severity, finding.exposure, finding.directControl]),
    ).toEqual([
      ["finding:session-file", "critical", 20, false],
      ["finding:ace-remote-dc", "high", 17, true],
      ["finding:ace-it-dcsync", "high", 4, true],
      ["finding:ace-entra-ga", "high", 2, true],
      ["finding:session-jump", "low", 4, false],
      ["finding:session-legacy", "low", 2, false],
    ]);
    expect(analysis.findings[0]?.share).toBeGreaterThanOrEqual(0.95);
    expect(analysis.findings[1]?.share).toBeGreaterThanOrEqual(0.8);
    expect(analysis.findings[1]?.share).toBeLessThan(0.95);
  });
});

describe("minimum fix set", () => {
  const baseline = analyze(CURRENT);

  test("lists the smallest sufficient set, most effective first", () => {
    expect(baseline.fixes.map((fix) => [fix.edgeId, fix.pathsClosed])).toEqual([
      ["fix-staff-file", 20],
      ["ace-remote-dc", 17],
      ["ace-it-dcsync", 4],
      ["fix-hd-jump", 4],
      ["ace-entra-ga", 2],
      ["fix-fin-legacy", 2],
    ]);
    const applied = analyze(
      CURRENT,
      baseline.fixes.map((fix) => fix.edgeId),
    );
    expect(applied.paths).toHaveLength(0);
    expect(applied.accountsWithPath).toBe(0);
  });

  test("omitting a recommended fix leaves a path that fix was meant to close", () => {
    for (const fix of baseline.fixes) {
      const others = baseline.fixes.map((item) => item.edgeId).filter((id) => id !== fix.edgeId);
      const residual = analyze(CURRENT, others);
      expect(residual.paths.some((path) => path.edgeIds.includes(fix.edgeId))).toBe(true);
    }
  });

  test("a single toggle closes exactly the paths that use that edge", () => {
    for (const fix of baseline.fixes) {
      const active = analyze(CURRENT, [fix.edgeId]);
      const closed = baseline.paths
        .filter((path) => !active.paths.some((kept) => kept.id === path.id))
        .map((path) => path.id)
        .sort();
      const expected = baseline.paths
        .filter((path) => path.edgeIds.includes(fix.edgeId))
        .map((path) => path.id)
        .sort();
      expect(closed).toEqual(expected);
      expect(closed.length).toBe(fix.pathsClosed);
    }
  });
});

describe("scan diff badges", () => {
  const answerKey: Record<string, Record<string, FindingBadge>> = {
    "2026-09-07": {
      "finding:session-file": "New",
      "finding:ace-it-dcsync": "New",
      "finding:session-fin": "New",
      "finding:ace-entra-ga": "New",
      "finding:session-legacy": "New",
    },
    "2026-10-05": {
      "finding:session-file": "Open",
      "finding:ace-remote-dc": "New",
      "finding:session-fin": "Open",
      "finding:ace-entra-ga": "Open",
      "finding:ace-it-dcsync": "Fixed",
      "finding:session-legacy": "Fixed",
    },
    "2026-11-02": {
      "finding:session-file": "Open",
      "finding:ace-remote-dc": "Open",
      "finding:ace-entra-ga": "Open",
      "finding:session-legacy": "Regressed",
      "finding:session-fin": "Fixed",
    },
    "2026-11-16": {
      "finding:session-file": "Open",
      "finding:ace-remote-dc": "Open",
      "finding:ace-it-dcsync": "Regressed",
      "finding:ace-entra-ga": "Open",
      "finding:session-jump": "New",
      "finding:session-legacy": "Open",
    },
  };

  test("New, Fixed, and Regressed match the fixture answer key", () => {
    const runs = SNAPSHOTS.map((snapshot) => {
      const analysis = analyze(graphForSnapshot(snapshot.id));
      return {
        snapshotId: snapshot.id,
        findings: analysis.findings.map((finding) => ({
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
        })),
      };
    });
    const diffs = diffRuns(runs);
    expect(diffs.map((run) => run.snapshotId)).toEqual(SNAPSHOTS.map((snapshot) => snapshot.id));
    for (const run of diffs) {
      const actual: Record<string, FindingBadge> = {};
      for (const item of run.items) actual[item.findingId] = item.badge;
      expect(actual).toEqual(answerKey[run.snapshotId]);
    }
  });
});
