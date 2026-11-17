import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { lookupRecorded, seriesFor } from "../src/lib/catalog.ts"
import { DEFAULT_PARAMS, validateParams } from "../src/lib/params.ts"
import { resolveBacktest } from "../src/lib/resolve-backtest.ts"
import type { BacktestParams, RunBody } from "../src/lib/types.ts"

const edited: BacktestParams = { symbol: "ETH", fast: 8, slow: 26, trailPct: 5 }

describe("recorded fixtures", () => {
  test("default EMA cross and trailing stop is a finite sample result", () => {
    const run = lookupRecorded(DEFAULT_PARAMS)
    const bars = seriesFor("ETH").bars
    expect(run.exact).toBe(true)
    expect(run.stats.tradeCount).toBeGreaterThan(0)
    expect(run.trades.length).toBe(run.stats.tradeCount)
    expect(run.equity.length).toBe(bars.length)
    expect(Number.isFinite(run.stats.netReturn)).toBe(true)
    expect(Number.isFinite(run.stats.maxDrawdown)).toBe(true)
    expect(Number.isFinite(run.stats.sharpe)).toBe(true)
    expect(run.stats.maxDrawdown).toBeLessThanOrEqual(0)
    expect(run.equity.every((point) => Number.isFinite(point))).toBe(true)
  })

  test("an edited parameter set still resolves to a recorded sample", () => {
    const run = lookupRecorded(edited)
    expect(run.exact).toBe(true)
    expect(run.params.fast).toBe(8)
    expect(run.stats.tradeCount).toBeGreaterThan(0)
    expect(run.equity.length).toBe(seriesFor("ETH").bars.length)
  })

  test("a value off the recorded grid uses the nearest saved sample", () => {
    const run = lookupRecorded({ symbol: "BTC", fast: 13, slow: 27, trailPct: 4 })
    expect(run.exact).toBe(false)
    expect(run.params.symbol).toBe("BTC")
    expect(Number.isFinite(run.stats.sharpe)).toBe(true)
  })
})

describe("parameter validation", () => {
  test("accepts the default form payload", () => {
    const result = validateParams(DEFAULT_PARAMS)
    expect(result.ok).toBe(true)
  })

  test("rejects empty and invalid parameters", () => {
    expect(validateParams({ symbol: "ETH", fast: "", slow: "26", trailPct: "5" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "12", slow: "", trailPct: "5" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "12", slow: "26", trailPct: "" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "0", slow: "26", trailPct: "5" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "26", slow: "12", trailPct: "5" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "12", slow: "26", trailPct: "0" }).ok).toBe(false)
    expect(validateParams({ symbol: "ETH", fast: "fast", slow: "26", trailPct: "5" }).ok).toBe(false)
    expect(validateParams({ symbol: "SOL", fast: "12", slow: "26", trailPct: "5" }).ok).toBe(false)
    expect(validateParams(null).ok).toBe(false)
  })
})

describe("sidecar versus recorded fallback", () => {
  test("a successful sidecar payload is labeled as a live sidecar run", async () => {
    const sidecar: RunBody = {
      engine: "nautilus_trader test",
      params: edited,
      stats: {
        tradeCount: 1,
        netReturn: 0.01,
        maxDrawdown: -0.02,
        sharpe: 0.4,
        startingEquity: 10000,
        endingEquity: 10100,
      },
      trades: [
        {
          side: "long",
          entryTime: "2024-02-01",
          exitTime: "2024-02-10",
          entryPrice: 100,
          exitPrice: 101,
          pnlQuote: 10,
          pnlPct: 0.01,
          exitReason: "trail",
        },
      ],
      equity: [10000, 10100],
      openPosition: null,
    }
    const result = await resolveBacktest(edited, async () => sidecar)
    expect(result.source).toBe("sidecar")
    expect(result.exact).toBe(true)
    expect(result.engine).toBe("nautilus_trader test")
    expect(result.stats.tradeCount).toBe(1)
  })

  test("a missing, throwing, or invalid sidecar falls back to the recording", async () => {
    const missing = await resolveBacktest(DEFAULT_PARAMS, async () => null)
    const thrown = await resolveBacktest(DEFAULT_PARAMS, async () => {
      throw new Error("sidecar down")
    })
    const invalid = await resolveBacktest(DEFAULT_PARAMS, async () => ({ ok: false }))
    for (const result of [missing, thrown, invalid]) {
      expect(result.source).toBe("recorded")
      expect(result.exact).toBe(true)
      expect(result.stats.tradeCount).toBeGreaterThan(0)
      expect(result.note.toLowerCase()).toContain("recorded")
    }
  })

  test("edited params still render through the fallback when no sidecar is present", async () => {
    const result = await resolveBacktest(edited, async () => null)
    expect(result.source).toBe("recorded")
    expect(result.params.fast).toBe(8)
    expect(result.equity.length).toBeGreaterThan(10)
  })
})

describe("sidecar process", () => {
  test("python without a usable nautilus run returns a JSON failure", () => {
    const previous = process.env.NAUTILUS_LAB_PYTHON
    delete process.env.NAUTILUS_LAB_PYTHON
    const proc = spawnSync("python3", ["sidecar/backtest.py"], {
      input: "{}",
      encoding: "utf8",
      cwd: new URL("..", import.meta.url).pathname,
    })
    if (previous === undefined) delete process.env.NAUTILUS_LAB_PYTHON
    else process.env.NAUTILUS_LAB_PYTHON = previous
    const payload = JSON.parse(proc.stdout) as { ok: boolean }
    expect(payload.ok).toBe(false)
    expect(proc.status).not.toBe(0)
  })
})
