interface DiffOp {
  kind: "same" | "add" | "del";
  line: string;
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function diffOps(before: string[], after: string[]): DiffOp[] {
  const n = before.length;
  const m = after.length;
  const scores: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0),
  );

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const nextRow = scores[i + 1] ?? [];
      const row = scores[i] ?? [];
      if (before[i] === after[j]) {
        row[j] = (nextRow[j + 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: "same", line: before[i] ?? "" });
      i += 1;
      j += 1;
      continue;
    }
    const down = scores[i + 1]?.[j] ?? 0;
    const right = scores[i]?.[j + 1] ?? 0;
    if (down >= right) {
      ops.push({ kind: "del", line: before[i] ?? "" });
      i += 1;
    } else {
      ops.push({ kind: "add", line: after[j] ?? "" });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ kind: "del", line: before[i] ?? "" });
    i += 1;
  }
  while (j < m) {
    ops.push({ kind: "add", line: after[j] ?? "" });
    j += 1;
  }
  return ops;
}

export function unifiedDiff(path: string, before: string, after: string): string {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  const body = diffOps(oldLines, newLines).map((op) => {
    if (op.kind === "add") return `+${op.line}`;
    if (op.kind === "del") return `-${op.line}`;
    return ` ${op.line}`;
  });
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    ...body,
  ].join("\n");
}
