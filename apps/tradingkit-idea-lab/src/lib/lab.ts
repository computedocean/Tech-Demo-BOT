import { runBacktest } from "./backtest.ts"
import { parseIdea } from "./parse-idea.ts"
import { seriesForSymbol } from "./sample-data.ts"
import type { LabResult } from "./types.ts"

export function buildLabRun(idea: string): LabResult {
  const parsed = parseIdea(idea)
  if (!parsed.ok) return parsed
  const series = seriesForSymbol(parsed.strategy.symbol)
  const backtest = runBacktest(parsed.strategy, series.candles)
  return {
    ok: true,
    idea: idea.trim().replace(/\s+/g, " "),
    strategy: parsed.strategy,
    pine: parsed.pine,
    summary: parsed.strategy.summary,
    seriesId: series.seriesId,
    seriesNote: series.note,
    backtest,
  }
}
