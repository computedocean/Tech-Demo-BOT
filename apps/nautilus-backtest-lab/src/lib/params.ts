import type { BacktestParams, SymbolId } from "@/lib/types.ts"

export const DEFAULT_PARAMS: BacktestParams = {
  symbol: "ETH",
  fast: 12,
  slow: 26,
  trailPct: 5,
}

const SYMBOLS = new Set<SymbolId>(["ETH", "BTC"])

export function validateParams(
  input: unknown,
): { ok: true; params: BacktestParams } | { ok: false; error: string } {
  if (input === null || typeof input !== "object") {
    return { ok: false, error: "Enter a symbol and parameters." }
  }
  const body = input as Record<string, unknown>
  const symbol = String(body.symbol ?? "").trim().toUpperCase()
  if (!SYMBOLS.has(symbol as SymbolId)) {
    return { ok: false, error: "Choose the SAMPLE-ETH or SAMPLE-BTC series." }
  }
  const fastText = String(body.fast ?? "").trim()
  const slowText = String(body.slow ?? "").trim()
  const trailText = String(body.trailPct ?? "").trim()
  if (!fastText || !slowText || !trailText) {
    return { ok: false, error: "Fast EMA, slow EMA, and trail percent are required." }
  }
  if (!/^\d+$/.test(fastText) || !/^\d+$/.test(slowText)) {
    return { ok: false, error: "EMA periods must be whole numbers." }
  }
  if (!/^\d+(\.\d+)?$/.test(trailText)) {
    return { ok: false, error: "Trail percent must be a positive number." }
  }
  const fast = Number(fastText)
  const slow = Number(slowText)
  const trailPct = Number(trailText)
  if (fast < 2 || fast > 200) {
    return { ok: false, error: "Fast EMA must be between 2 and 200." }
  }
  if (slow < 3 || slow > 400) {
    return { ok: false, error: "Slow EMA must be between 3 and 400." }
  }
  if (fast >= slow) {
    return { ok: false, error: "Fast EMA must be shorter than slow EMA." }
  }
  if (!Number.isFinite(trailPct) || trailPct < 0.5 || trailPct > 30) {
    return { ok: false, error: "Trail percent must be between 0.5 and 30." }
  }
  return {
    ok: true,
    params: { symbol: symbol as SymbolId, fast, slow, trailPct },
  }
}
