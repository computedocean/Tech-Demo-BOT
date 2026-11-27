export type DiffRow = {
  type: "context" | "add" | "del"
  text: string
}

/** Line diff for the short sandbox files. */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before.split("\n")
  const b = after.split("\n")
  const n = a.length
  const m = b.length
  const scores: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0),
  )

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      scores[i][j] =
        a[i] === b[j]
          ? scores[i + 1][j + 1] + 1
          : Math.max(scores[i + 1][j], scores[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "context", text: a[i] })
      i += 1
      j += 1
    } else if (scores[i + 1][j] >= scores[i][j + 1]) {
      rows.push({ type: "del", text: a[i] })
      i += 1
    } else {
      rows.push({ type: "add", text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    rows.push({ type: "del", text: a[i] })
    i += 1
  }
  while (j < m) {
    rows.push({ type: "add", text: b[j] })
    j += 1
  }
  return rows
}

export function diffCounts(rows: DiffRow[]): { added: number; removed: number } {
  return {
    added: rows.filter((row) => row.type === "add").length,
    removed: rows.filter((row) => row.type === "del").length,
  }
}
