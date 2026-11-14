import type { EquityPoint, LabSuccess, SavedRun } from "./types.ts"

export type CompareCurve = {
  id: string
  name: string
  points: { date: string; value: number }[]
}

export type CompareTableRow = {
  id: string
  name: string
  sharpe: number
  maxDrawdown: number
  netReturn: number
  tradeCount: number
  finalEquity: number
}

export type CompareResult = {
  table: CompareTableRow[]
  curves: CompareCurve[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isEquityPoint(value: unknown): value is EquityPoint {
  if (!isRecord(value)) return false
  return typeof value.date === "string" && typeof value.equity === "number" && Number.isFinite(value.equity)
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (!isRecord(value)) return false
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.idea !== "string") {
    return false
  }
  if (!isRecord(value.metrics)) return false
  if (!Number.isFinite(value.metrics.sharpe) || !Number.isFinite(value.metrics.maxDrawdown)) return false
  if (!Array.isArray(value.equity) || !value.equity.every(isEquityPoint)) return false
  return true
}

export function parseStoredRuns(raw: string | null): SavedRun[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedRun)
  } catch {
    return []
  }
}

export function toSavedRun(run: LabSuccess, name: string, id: string, createdAt: string): SavedRun {
  const trimmed = name.trim() || run.strategy.title
  return {
    id,
    name: trimmed,
    idea: run.idea,
    createdAt,
    pine: run.pine,
    summary: run.summary,
    seriesId: run.seriesId,
    metrics: {
      sharpe: run.backtest.sharpe,
      maxDrawdown: run.backtest.maxDrawdown,
      netReturn: run.backtest.netReturn,
      tradeCount: run.backtest.tradeCount,
      finalEquity: run.backtest.finalEquity,
    },
    equity: run.backtest.equity,
    trades: run.backtest.trades,
  }
}

function normalize(equity: EquityPoint[]): { date: string; value: number }[] {
  const base = equity[0]?.equity ?? 1
  const divisor = base === 0 ? 1 : base
  return equity.map((point) => ({
    date: point.date,
    value: (point.equity / divisor) * 100,
  }))
}

export function compareRuns(runs: SavedRun[]): CompareResult {
  if (runs.length < 2) {
    throw new Error("Select at least two saved runs to compare.")
  }
  return {
    table: runs.map((run) => ({
      id: run.id,
      name: run.name,
      sharpe: run.metrics.sharpe,
      maxDrawdown: run.metrics.maxDrawdown,
      netReturn: run.metrics.netReturn,
      tradeCount: run.metrics.tradeCount,
      finalEquity: run.metrics.finalEquity,
    })),
    curves: runs.map((run) => ({
      id: run.id,
      name: run.name,
      points: normalize(run.equity),
    })),
  }
}
