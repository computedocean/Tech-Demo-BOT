import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defaultAdapterConfig, sendToTradingKit } from "../src/lib/adapter.ts"
import { runBacktest } from "../src/lib/backtest.ts"
import { compareRuns, parseStoredRuns, toSavedRun } from "../src/lib/compare.ts"
import { PRESETS } from "../src/lib/constants.ts"
import { buildLabRun } from "../src/lib/lab.ts"
import { parseIdea } from "../src/lib/parse-idea.ts"
import { getSeries } from "../src/lib/sample-data.ts"
import { assertPineSubset, findSubsetViolations } from "../src/lib/subset.ts"
import type { Candle, LabSuccess } from "../src/lib/types.ts"
import { acceptRewrite, llmKeyPresent, maybeRewritePine } from "../server/llm.ts"
import { generateFromIdea } from "../server/generate.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function requireRun(idea: string): LabSuccess {
  const result = buildLabRun(idea)
  if (!result.ok) throw new Error(result.error)
  return result
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const info = statSync(full)
    if (info.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

describe("offline parser", () => {
  test("parses the EMA 8/55 SPY daily preset", () => {
    const parsed = parseIdea("EMA 8/55 crossover on SPY daily")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.pine.startsWith("//@version=6")).toBe(true)
    expect(parsed.pine).toContain("strategy(")
    expect(parsed.pine).toContain("ta.ema")
    expect(parsed.strategy.kind).toBe("ma_cross")
    if (parsed.strategy.kind !== "ma_cross") return
    expect(parsed.strategy.ma).toBe("ema")
    expect(parsed.strategy.fast).toBe(8)
    expect(parsed.strategy.slow).toBe(55)
    expect(parsed.strategy.symbol).toBe("SPY")
    expect(parsed.strategy.timeframe).toBe("D")
    assertPineSubset(parsed.pine)
  })

  test("parses SMA and RSI presets", () => {
    const sma = parseIdea("SMA 20/50 crossover on QQQ daily")
    expect(sma.ok).toBe(true)
    if (!sma.ok || sma.strategy.kind !== "ma_cross") throw new Error("sma")
    expect(sma.strategy.ma).toBe("sma")
    expect(sma.strategy.fast).toBe(20)
    expect(sma.strategy.slow).toBe(50)
    expect(sma.strategy.symbol).toBe("QQQ")
    expect(sma.pine).toContain("ta.sma")
    expect(sma.pine).not.toContain("ta.ema")

    const rsi = parseIdea("RSI 14 below 30 above 70 on SPY daily")
    expect(rsi.ok).toBe(true)
    if (!rsi.ok || rsi.strategy.kind !== "rsi_threshold") throw new Error("rsi")
    expect(rsi.strategy.length).toBe(14)
    expect(rsi.strategy.lower).toBe(30)
    expect(rsi.strategy.upper).toBe(70)
    expect(rsi.pine).toContain("ta.rsi")
    assertPineSubset(rsi.pine)
  })

  test("parses a breakout and orders a reversed crossover explicitly", () => {
    const breakout = parseIdea("20-day breakout on SPY daily")
    expect(breakout.ok).toBe(true)
    if (!breakout.ok || breakout.strategy.kind !== "breakout") throw new Error("breakout")
    expect(breakout.strategy.length).toBe(20)

    const reversed = parseIdea("EMA 55/8 crossover on SPY daily")
    expect(reversed.ok).toBe(true)
    if (!reversed.ok || reversed.strategy.kind !== "ma_cross") throw new Error("reversed")
    expect(reversed.strategy.fast).toBe(8)
    expect(reversed.strategy.slow).toBe(55)
    expect(reversed.strategy.summary.toLowerCase()).toContain("ordered")
  })

  test("fails clearly on unrecognized input", () => {
    const failed = parseIdea("mean-revert bitcoin with a kalman filter")
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.error.toLowerCase()).toContain("does not recognize")
    expect(failed.suggestions).toContain(PRESETS[0])
    expect("pine" in failed).toBe(false)
  })

  test("fails clearly on an unsupported timeframe and on a blank idea", () => {
    const hourly = parseIdea("EMA 8/55 crossover on SPY hourly")
    expect(hourly.ok).toBe(false)
    if (!hourly.ok) expect(hourly.error.toLowerCase()).toContain("daily")

    const blank = parseIdea("   ")
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.toLowerCase()).toContain("enter an idea")
  })
})

describe("pine subset", () => {
  test("every preset stays inside the documented subset", () => {
    for (const preset of PRESETS) {
      const parsed = parseIdea(preset)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) continue
      expect(findSubsetViolations(parsed.pine)).toEqual([])
      expect(parsed.pine).not.toMatch(/request\.security/)
      expect(parsed.pine).not.toMatch(/\barray\s*\./)
      expect(parsed.pine).not.toMatch(/\bmap\s*\./)
      expect(parsed.pine).not.toMatch(/\bmatrix\s*\./)
      expect(parsed.pine).not.toMatch(/strategy\.order/)
      expect(parsed.pine).not.toMatch(/strategy\.cancel/)
    }
  })

  test("rejects forbidden constructs", () => {
    expect(findSubsetViolations('//@version=6\nstrategy("x")\nrequest.security(syminfo.tickerid, "D", close)\n')).toContain(
      "request.security",
    )
    expect(findSubsetViolations('//@version=6\nstrategy("x")\nstrategy.order("L", strategy.long)\n')).toContain(
      "strategy.order",
    )
    expect(findSubsetViolations('//@version=6\nstrategy("x")\nstrategy.cancel("L")\n')).toContain("order cancels")
    expect(findSubsetViolations('//@version=6\nstrategy("x")\narray.new_float(0)\n')).toContain("arrays")
    expect(findSubsetViolations('//@version=6\nstrategy("x")\nmap.new<string, float>()\n')).toContain("maps")
    expect(findSubsetViolations('//@version=6\nstrategy("x")\nmatrix.new<float>(1, 1, 0.0)\n')).toContain("matrices")
    expect(() => assertPineSubset("indicator('nope')")).toThrow()
  })
})

describe("local backtest", () => {
  test("preset backtests on bundled candles are finite and trade", () => {
    for (const preset of PRESETS) {
      const run = requireRun(preset)
      const candles = getSeries(run.seriesId === "SAMPLE-QQQ" ? "SAMPLE-QQQ" : "SAMPLE-SPY")
      expect(run.backtest.equity.length).toBe(candles.length)
      expect(run.backtest.tradeCount).toBeGreaterThan(0)
      expect(Number.isFinite(run.backtest.sharpe)).toBe(true)
      expect(Number.isFinite(run.backtest.maxDrawdown)).toBe(true)
      expect(run.backtest.maxDrawdown).toBeGreaterThanOrEqual(0)
      expect(run.backtest.maxDrawdown).toBeLessThanOrEqual(1)
      expect(Number.isFinite(run.backtest.netReturn)).toBe(true)
      expect(Number.isFinite(run.backtest.finalEquity)).toBe(true)
      for (const point of run.backtest.equity) {
        expect(Number.isFinite(point.equity)).toBe(true)
      }
      for (const trade of run.backtest.trades) {
        expect(trade.side).toBe("long")
        expect(Number.isFinite(trade.pnl)).toBe(true)
        expect(Number.isFinite(trade.returnPct)).toBe(true)
      }
      expect(run.seriesNote.toLowerCase()).toContain("synthetic")
      expect(run.backtest.assumptions.toLowerCase()).toContain("not tradingview")
    }
  })

  test("a flat series still returns finite metrics", () => {
    const parsed = parseIdea("EMA 8/55 crossover on SPY daily")
    if (!parsed.ok) throw new Error(parsed.error)
    const candles: Candle[] = [
      { date: "2024-01-02", open: 100, high: 101, low: 99, close: 100 },
      { date: "2024-01-03", open: 100, high: 101, low: 99, close: 100 },
      { date: "2024-01-04", open: 100, high: 102, low: 99, close: 100 },
    ]
    const result = runBacktest(parsed.strategy, candles)
    expect(Number.isFinite(result.sharpe)).toBe(true)
    expect(Number.isFinite(result.maxDrawdown)).toBe(true)
    expect(result.tradeCount).toBe(0)
    expect(result.equity).toHaveLength(3)
  })
})

describe("save and compare", () => {
  test("two saved runs compare, and one run does not", () => {
    const ema = requireRun(PRESETS[0])
    const breakout = requireRun(PRESETS[3])
    const saved = [
      toSavedRun(ema, "EMA preset", "ema", "2026-11-14T00:00:00.000Z"),
      toSavedRun(breakout, "Breakout preset", "breakout", "2026-11-14T00:01:00.000Z"),
    ]
    const raw = JSON.stringify(saved)
    const restored = parseStoredRuns(raw)
    expect(restored).toHaveLength(2)
    const comparison = compareRuns(restored)
    expect(comparison.table.map((row) => row.name)).toEqual(["EMA preset", "Breakout preset"])
    expect(comparison.curves[0]?.points[0]?.value).toBeCloseTo(100)
    expect(comparison.curves[1]?.points[0]?.value).toBeCloseTo(100)
    expect(comparison.table[0]?.sharpe).toBe(ema.backtest.sharpe)
    expect(() => compareRuns([saved[0]!])).toThrow(/at least two/)
    expect(parseStoredRuns("not json")).toEqual([])
    expect(parseStoredRuns("{\"ok\":true}")).toEqual([])
  })
})

describe("secrets and adapter", () => {
  test("adapter is off by default and does not send", () => {
    expect(defaultAdapterConfig.enabled).toBe(false)
    expect(defaultAdapterConfig.oauthConnected).toBe(false)
    const disabled = sendToTradingKit(defaultAdapterConfig)
    expect(disabled.sent).toBe(false)
    expect(disabled.reason).toBe("disabled")
    const armed = sendToTradingKit({ enabled: true, oauthConnected: false })
    expect(armed.sent).toBe(false)
    expect(armed.reason).toBe("needs_oauth")
    const connected = sendToTradingKit({ enabled: true, oauthConnected: true })
    expect(connected.sent).toBe(false)
    expect(connected.reason).toBe("not_forwarded")
    const adapterSource = readFileSync(join(root, "src/lib/adapter.ts"), "utf8")
    expect(adapterSource).toContain("enabled: false")
    expect(adapterSource).not.toContain("fetch(")
    const uiSource = readFileSync(join(root, "src/components/idea-lab.tsx"), "utf8")
    expect(uiSource).toContain("defaultAdapterConfig.enabled")
  })

  test("client sources and default responses contain no keys", () => {
    const banned = [
      /OPENAI_API_KEY/,
      /TRADINGKIT_IDEA_LAB_LLM_KEY/,
      /VITE_/,
      /sk-[A-Za-z0-9]{8,}/,
      /api\.openai\.com/,
      /Bearer\s+/,
    ]
    const files = [...walk(join(root, "src")), join(root, "index.html")]
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      for (const pattern of banned) {
        expect(text).not.toMatch(pattern)
      }
    }
    const run = requireRun(PRESETS[0])
    const blob = JSON.stringify(run)
    expect(blob).not.toMatch(/OPENAI_API_KEY|TRADINGKIT_IDEA_LAB_LLM_KEY|sk-[A-Za-z0-9]{8,}|Bearer\s+|api\.openai\.com|api_key/i)
  })

  test("server rewrite stays idle without a key and rejects a bad rewrite", async () => {
    const previousOpenAi = process.env.OPENAI_API_KEY
    const previousLab = process.env.TRADINGKIT_IDEA_LAB_LLM_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.TRADINGKIT_IDEA_LAB_LLM_KEY
    try {
      expect(llmKeyPresent()).toBe(false)
      const idle = await maybeRewritePine("EMA 8/55 crossover on SPY daily", "//@version=6\nstrategy(\"x\")\n")
      expect(idle.usedLlm).toBe(false)
      expect(JSON.stringify(idle)).not.toMatch(/sk-|Bearer/)
      const generated = await generateFromIdea("EMA 8/55 crossover on SPY daily")
      expect(generated.ok).toBe(true)
      if (generated.ok) expect(generated.usedLlm).toBe(false)
      const unrecognized = await generateFromIdea("kalman filter on bitcoin")
      expect(unrecognized.ok).toBe(false)
      const bad = acceptRewrite(
        "//@version=6\nstrategy(\"x\")\nstrategy.order(\"L\", strategy.long)\n",
        "//@version=6\nstrategy(\"kept\")\n",
      )
      expect(bad.usedLlm).toBe(false)
      expect(bad.pine).toContain("kept")
    } finally {
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousOpenAi
      if (previousLab === undefined) delete process.env.TRADINGKIT_IDEA_LAB_LLM_KEY
      else process.env.TRADINGKIT_IDEA_LAB_LLM_KEY = previousLab
    }
  })

  test("the production client bundle does not contain server keys", () => {
    const built = spawnSync("bun", ["run", "build"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, OPENAI_API_KEY: "", TRADINGKIT_IDEA_LAB_LLM_KEY: "" },
    })
    if (built.status !== 0) {
      throw new Error(`${built.stdout}\n${built.stderr}`)
    }
    const assets = readdirSync(join(root, "dist/assets")).filter((file) => file.endsWith(".js"))
    expect(assets.length).toBeGreaterThan(0)
    const blob = assets.map((file) => readFileSync(join(root, "dist/assets", file), "utf8")).join("\n")
    expect(blob).not.toContain("OPENAI_API_KEY")
    expect(blob).not.toContain("TRADINGKIT_IDEA_LAB_LLM_KEY")
    expect(blob).not.toContain("api.openai.com")
    expect(blob).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
  }, 120_000)
})
