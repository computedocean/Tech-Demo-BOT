import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { FACTOR_KEYS, LENS_SCHEMA, type FactorKey } from "../src/lib/types.ts"
import { buildPackets } from "../src/lib/lens.ts"
import { sampleSeries } from "../src/lib/sample-series.ts"
import { mockVerdict } from "../src/lib/verdict.ts"
import { llmEnabled, publicLlmStatus, resolveVerdict } from "../src/server/llm.ts"
import { acceptWebhookBody, loadBundledSample, replayBundledSample } from "../src/server/webhook.ts"

const TOP_LEVEL = [
  "schema",
  "event",
  "symbol",
  "timeframe",
  "time",
  "state_code",
  "candle",
  "recent_candles",
  "regime",
  "trend",
  "momentum",
  "strength",
  "volatility",
  "volume",
  "structure",
  "levels",
  "scores",
  "trade",
  "last_setup",
] as const

const EVENTS = new Set(["BAR_CLOSE", "LONG_SETUP", "SHORT_SETUP", "TRADE_UPDATE"])
const REGIMES = new Set(["TREND_UP", "TREND_DOWN", "RANGE", "HIGH_VOLATILITY"])
const DECISIONS = new Set(["LONG", "SHORT", "WAIT"])

describe("ai-agent-lens/v1 packets", () => {
  const series = sampleSeries("btc")
  const packets = buildPackets(series.bars, { symbol: series.symbol, ticker: series.ticker })

  test("bundled candles emit schema packets with the documented fields", () => {
    expect(packets.length).toBe(series.bars.length)
    expect(packets.some((packet) => packet.event === "LONG_SETUP")).toBe(true)
    expect(packets.some((packet) => packet.event === "SHORT_SETUP")).toBe(true)
    for (const packet of packets) {
      expect(packet.schema).toBe(LENS_SCHEMA)
      for (const key of TOP_LEVEL) expect(packet).toHaveProperty(key)
      expect(EVENTS.has(packet.event)).toBe(true)
      expect(REGIMES.has(packet.regime)).toBe(true)
      expect(packet.state_code.startsWith(`LENS|${series.ticker}|60|`)).toBe(true)
      expect(packet.recent_candles.at(-1)?.bars_ago).toBe(0)
      expect(packet.recent_candles.at(-1)?.c).toBe(packet.candle.close)
    }
  })

  test("scores stay in 0-100 and factor keys match the documented set", () => {
    for (const packet of packets) {
      expect(packet.scores.long).toBeGreaterThanOrEqual(0)
      expect(packet.scores.long).toBeLessThanOrEqual(100)
      expect(packet.scores.short).toBeGreaterThanOrEqual(0)
      expect(packet.scores.short).toBeLessThanOrEqual(100)
      expect(packet.scores.threshold).toBe(70)
      expect(Object.keys(packet.scores.long_factors).sort()).toEqual([...FACTOR_KEYS].sort())
      expect(Object.keys(packet.scores.short_factors).sort()).toEqual([...FACTOR_KEYS].sort())
      expect(sumFactors(packet.scores.long_factors)).toBe(packet.scores.long)
      expect(sumFactors(packet.scores.short_factors)).toBe(packet.scores.short)
      for (const key of FACTOR_KEYS) {
        expect(packet.scores.long_factors[key]).toBeGreaterThanOrEqual(0)
        expect(packet.scores.long_factors[key]).toBeLessThanOrEqual(20)
        expect(packet.scores.short_factors[key]).toBeGreaterThanOrEqual(0)
        expect(packet.scores.short_factors[key]).toBeLessThanOrEqual(20)
      }
    }
  })

  test("earlier packets do not change when later candles change", () => {
    const cursor = 240
    const mutated = series.bars.map((bar, index) =>
      index <= cursor
        ? bar
        : { ...bar, close: bar.close * 1.25, high: bar.high * 1.25, low: bar.low * 0.95 },
    )
    const after = buildPackets(mutated, { symbol: series.symbol, ticker: series.ticker })
    expect(JSON.stringify(after[cursor])).toBe(JSON.stringify(packets[cursor]))
  })
})

describe("webhook", () => {
  test("accepts the bundled upstream sample and rejects a wrong schema", () => {
    const sample = loadBundledSample()
    expect(sample.schema).toBe(LENS_SCHEMA)
    expect(sample.symbol).toBe("BINANCE:HYPEUSDT.P")
    const accepted = acceptWebhookBody(JSON.stringify(sample))
    expect(accepted.status).toBe(200)
    expect(accepted.body.ok).toBe(true)
    expect(accepted.body.packet?.schema).toBe(LENS_SCHEMA)
    expect(accepted.body.message.toLowerCase()).toContain("no order")

    const replay = replayBundledSample()
    expect(replay.status).toBe(200)
    expect(replay.body.packet?.event).toBe("LONG_SETUP")
    expect(replay.body.message.toLowerCase()).toContain("mit")

    const wrong = acceptWebhookBody(JSON.stringify({ schema: "trading-kit/v9", event: "LONG_SETUP" }))
    expect(wrong.status).toBe(400)
    expect(wrong.body.ok).toBe(false)
    expect(wrong.body.packet).toBeUndefined()
    expect(wrong.body.message).toContain(LENS_SCHEMA)
    expect(wrong.body.message).toContain("trading-kit/v9")

    const missing = acceptWebhookBody(JSON.stringify({ event: "BAR_CLOSE" }))
    expect(missing.status).toBe(400)
    expect(missing.body.message).toContain(LENS_SCHEMA)

    const junk = acceptWebhookBody("not json")
    expect(junk.status).toBe(400)
    expect(junk.body.message.toLowerCase()).toContain("json")
  })
})

describe("mock verdict", () => {
  const series = sampleSeries("btc")
  const packets = buildPackets(series.bars, { symbol: series.symbol, ticker: series.ticker })

  test("returns LONG, SHORT, or WAIT with levels or a clear wait, and a failure-risk note", () => {
    const longPacket = packets.find((packet) => packet.event === "LONG_SETUP" && packet.trade.status === "ACTIVE")
    const shortPacket = packets.find((packet) => packet.event === "SHORT_SETUP" && packet.trade.status === "ACTIVE")
    const waitPacket = packets.find((packet) => packet.trade.status === "NONE")
    expect(longPacket).toBeTruthy()
    expect(shortPacket).toBeTruthy()
    expect(waitPacket).toBeTruthy()

    const long = mockVerdict(longPacket!)
    expect(long.decision).toBe("LONG")
    expect(long.source).toBe("mock")
    expect(long.entry).toBe(longPacket!.trade.entry)
    expect(long.stop).toBe(longPacket!.trade.stop)
    expect(long.target1).toBe(longPacket!.trade.target_1)
    expect(long.target2).toBe(longPacket!.trade.target_2)
    expect(long.failureRisk.toLowerCase()).toContain("failure risk")

    const short = mockVerdict(shortPacket!)
    expect(short.decision).toBe("SHORT")
    expect(short.entry).not.toBeNull()
    expect(short.stop).not.toBeNull()
    expect(short.target1).not.toBeNull()
    expect(short.target2).not.toBeNull()
    expect(short.failureRisk.length).toBeGreaterThan(20)

    const wait = mockVerdict(waitPacket!)
    expect(wait.decision).toBe("WAIT")
    expect(wait.entry).toBeNull()
    expect(wait.stop).toBeNull()
    expect(wait.target1).toBeNull()
    expect(wait.target2).toBeNull()
    expect(wait.failureRisk.toLowerCase()).toContain("failure risk")

    for (const verdict of [long, short, wait]) expect(DECISIONS.has(verdict.decision)).toBe(true)
  })

  test("does not call a model when no key is set", async () => {
    let called = false
    const fetcher: typeof fetch = () => {
      called = true
      return Promise.reject(new Error("fetch should not run"))
    }
    const packet = packets[0]!
    const result = await resolveVerdict(packet, {}, fetcher)
    expect(called).toBe(false)
    expect(result.llm).toBe(false)
    expect(result.verdict.decision).toBe(mockVerdict(packet).decision)
    expect(JSON.stringify(result)).not.toContain("AGENT_LENS_LLM_KEY")
  })
})

describe("secrets", () => {
  test("the optional LLM path is off by default and status payloads omit the key", async () => {
    expect(llmEnabled({})).toBe(false)
    expect(publicLlmStatus({}).enabled).toBe(false)
    const secret = "sk-test-secret-value"
    const status = publicLlmStatus({ AGENT_LENS_LLM_KEY: secret })
    expect(status.enabled).toBe(true)
    expect(JSON.stringify(status)).not.toContain(secret)

    const series = sampleSeries("eth")
    const packet = buildPackets(series.bars, { symbol: series.symbol, ticker: series.ticker })[220]!
    const mock = mockVerdict(packet)
    const leaked = await resolveVerdict(packet, { AGENT_LENS_LLM_KEY: secret }, async () => {
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ failureRisk: `Echo ${secret} in the note.` }) } }],
      })
    })
    expect(leaked.llm).toBe(false)
    expect(JSON.stringify(leaked)).not.toContain(secret)
    expect(leaked.verdict.decision).toBe(mock.decision)

    const rewritten = await resolveVerdict(packet, { AGENT_LENS_LLM_KEY: secret }, async () => {
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                failureRisk: "A close back through the broken level would fail this paper setup.",
              }),
            },
          },
        ],
      })
    })
    expect(rewritten.llm).toBe(true)
    expect(rewritten.verdict.decision).toBe(mock.decision)
    expect(rewritten.verdict.entry).toBe(mock.entry)
    expect(rewritten.verdict.stop).toBe(mock.stop)
    expect(rewritten.verdict.target1).toBe(mock.target1)
    expect(rewritten.verdict.failureRisk).toContain("broken level")
    expect(JSON.stringify(rewritten)).not.toContain(secret)
  })

  test("client sources do not name the server key or a VITE secret", () => {
    const root = join(import.meta.dir, "..")
    const files = [
      ...walk(join(root, "src/components")),
      ...walk(join(root, "src/lib")),
      join(root, "src/App.tsx"),
      join(root, "src/main.tsx"),
      join(root, "index.html"),
    ]
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      if (text.includes("AGENT_LENS_LLM_KEY") || text.includes("VITE_") || /sk-[A-Za-z0-9]{8,}/.test(text)) {
        throw new Error(`client source mentions a secret: ${file}`)
      }
    }
  })
})

function sumFactors(factors: Record<FactorKey, number>): number {
  return FACTOR_KEYS.reduce((total, key) => total + factors[key], 0)
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (/\.(tsx?|css|html)$/.test(entry)) files.push(path)
  }
  return files
}
