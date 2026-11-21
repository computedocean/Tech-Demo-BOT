import { diffRuns } from "./diff.ts";
import { analyze } from "./engine.ts";
import { SNAPSHOTS, graphForSnapshot } from "./northglass.ts";

export const SCAN_HISTORY = diffRuns(
  SNAPSHOTS.map((snapshot) => {
    const analysis = analyze(graphForSnapshot(snapshot.id));
    return {
      snapshotId: snapshot.id,
      findings: analysis.findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
      })),
    };
  }),
);
