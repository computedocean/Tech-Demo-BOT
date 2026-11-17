import sampleFile from "@/data/sample-bars.json" with { type: "json" }
import recordedFile from "@/data/recorded-runs.json" with { type: "json" }
import type {
  BacktestParams,
  BacktestStats,
  OpenPosition,
  RunBody,
  SampleBar,
  SymbolId,
  Trade,
} from "@/lib/types.ts"

type SeriesFile = {
  license: string
  source: string
  series: Record<SymbolId, { label: string; note: string; bars: SampleBar[] }>
}

type RecordedFile = {
  license: string
  engine: string
  nautilusLicense: string
  nautilusRepo: string
  source: string
  assumptions: string
  runs: Record<string, RunBody>
}

const samples = sampleFile as SeriesFile
const recorded = recordedFile as RecordedFile

export const DATA_LICENSE = samples.license
export const DATA_SOURCE = samples.source
export const RECORDED_ENGINE = recorded.engine
export const RECORDED_SOURCE = recorded.source
export const RECORDED_ASSUMPTIONS = recorded.assumptions
export const NAUTILUS_LICENSE = recorded.nautilusLicense

export function seriesFor(symbol: SymbolId): {
  label: string
  note: string
  bars: SampleBar[]
} {
  return samples.series[symbol]
}

export function runKey(params: BacktestParams): string {
  const trail = Number.isInteger(params.trailPct)
    ? String(params.trailPct)
    : String(params.trailPct)
  return `${params.symbol}|${params.fast}|${params.slow}|${trail}`
}

export function isFiniteRun(value: unknown): value is RunBody {
  if (value === null || typeof value !== "object") return false
  const run = value as RunBody
  if (!Array.isArray(run.equity) || run.equity.length < 2) return false
  if (!run.equity.every((point) => typeof point === "number" && Number.isFinite(point))) {
    return false
  }
  if (!Array.isArray(run.trades)) return false
  const stats = run.stats
  if (!stats || typeof stats !== "object") return false
  const numbers = [stats.tradeCount, stats.netReturn, stats.maxDrawdown, stats.sharpe]
  if (!numbers.every((item) => typeof item === "number" && Number.isFinite(item))) return false
  return run.trades.every((trade) => isTrade(trade))
}

function isTrade(value: unknown): value is Trade {
  if (value === null || typeof value !== "object") return false
  const trade = value as Trade
  return (
    trade.side === "long" &&
    typeof trade.entryTime === "string" &&
    typeof trade.exitTime === "string" &&
    Number.isFinite(trade.entryPrice) &&
    Number.isFinite(trade.exitPrice) &&
    Number.isFinite(trade.pnlPct) &&
    (trade.exitReason === "trail" || trade.exitReason === "cross")
  )
}

export function lookupRecorded(params: BacktestParams): {
  exact: boolean
  params: BacktestParams
  stats: BacktestStats
  trades: Trade[]
  equity: number[]
  openPosition: OpenPosition | null
} {
  const exact = recorded.runs[runKey(params)]
  if (exact && isFiniteRun(exact)) {
    return {
      exact: true,
      params: exact.params ?? params,
      stats: exact.stats,
      trades: exact.trades,
      equity: exact.equity,
      openPosition: exact.openPosition ?? null,
    }
  }
  let bestKey = ""
  let bestDistance = Number.POSITIVE_INFINITY
  for (const [key, run] of Object.entries(recorded.runs)) {
    if (!key.startsWith(`${params.symbol}|`) || !isFiniteRun(run) || !run.params) continue
    const distance =
      Math.abs(run.params.fast - params.fast) +
      Math.abs(run.params.slow - params.slow) / 2 +
      Math.abs(run.params.trailPct - params.trailPct) * 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestKey = key
    }
  }
  const nearest = recorded.runs[bestKey]
  if (!nearest || !isFiniteRun(nearest) || !nearest.params) {
    throw new Error("No recorded sample is available for this series.")
  }
  return {
    exact: false,
    params: nearest.params,
    stats: nearest.stats,
    trades: nearest.trades,
    equity: nearest.equity,
    openPosition: nearest.openPosition ?? null,
  }
}
