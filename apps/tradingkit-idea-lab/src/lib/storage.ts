import { parseStoredRuns } from "./compare.ts"
import type { SavedRun } from "./types.ts"

export const RUNS_STORAGE_KEY = "tradingkit-idea-lab.runs.v1"

export function loadStoredRuns(): SavedRun[] {
  if (typeof localStorage === "undefined") return []
  return parseStoredRuns(localStorage.getItem(RUNS_STORAGE_KEY))
}

export function writeStoredRuns(runs: SavedRun[]): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs))
}
