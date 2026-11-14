import { SUPPORTED_PATTERNS } from "./constants.ts"
import { emitPine } from "./pine.ts"
import type { ParseFailure, ParseResult, Strategy } from "./types.ts"

const UNSUPPORTED_TIMEFRAME =
  /\b(\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|w|wk|wks|week|weeks)|hourly|weekly|intraday)\b/i

function fail(error: string): ParseFailure {
  return { ok: false, error, suggestions: [...SUPPORTED_PATTERNS] }
}

function readSymbol(text: string): string {
  const onMatch = text.match(/\bon\s+([A-Za-z][A-Za-z0-9.-]{0,15})\b/i)
  if (onMatch?.[1]) {
    const raw = onMatch[1].toUpperCase()
    if (raw !== "DAILY" && raw !== "DAY" && raw !== "THE") {
      return raw.replace(/^SAMPLE-/, "")
    }
  }
  if (/\bQQQ\b/i.test(text)) return "QQQ"
  if (/\bSPY\b/i.test(text)) return "SPY"
  return "SPY"
}

function integerPair(text: string): [number, number] | null {
  const match = text.match(/(\d+)\s*[/-]\s*(\d+)/) ?? text.match(/(\d+)\s+and\s+(\d+)/i)
  if (!match?.[1] || !match[2]) return null
  return [Number(match[1]), Number(match[2])]
}

function validLength(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max
}

function parseMa(text: string): ParseResult {
  const hasEma = /\bema\b/i.test(text)
  const hasSma = /\bsma\b/i.test(text)
  if (hasEma && hasSma) {
    return fail("Name either EMA or SMA, not both. Example: EMA 8/55 crossover on SPY daily.")
  }
  const pair = integerPair(text)
  if (!pair) {
    return fail("A crossover needs two lengths, such as EMA 8/55 crossover on SPY daily.")
  }
  let [fast, slow] = pair
  if (!validLength(fast, 2, 400) || !validLength(slow, 2, 400)) {
    return fail("Moving-average lengths must be whole numbers from 2 to 400.")
  }
  if (fast === slow) {
    return fail("The two moving-average lengths must be different.")
  }
  const lengthsOrdered = fast > slow
  if (fast > slow) {
    const swap = fast
    fast = slow
    slow = swap
  }
  const ma = hasSma ? "sma" : "ema"
  const symbol = readSymbol(text)
  const label = ma.toUpperCase()
  const title = `${label} ${fast}/${slow} crossover`
  const orderNote = lengthsOrdered
    ? "The lengths were ordered so the fast average is the shorter one. "
    : ""
  const strategy: Strategy = {
    kind: "ma_cross",
    ma,
    fast,
    slow,
    lengthsOrdered,
    symbol,
    timeframe: "D",
    title,
    summary: `${orderNote}Long-only ${label} ${fast}/${slow} crossover on ${symbol}, daily. Enter when the fast average crosses above the slow average. Exit when it crosses back below.`,
  }
  return { ok: true, strategy, pine: emitPine(strategy) }
}

function parseRsi(text: string): ParseResult {
  const lengthMatch = text.match(/\brsi\s*\(?\s*(\d+)/i)
  const length = lengthMatch?.[1] ? Number(lengthMatch[1]) : 14
  const lowerMatch = text.match(/\b(?:below|under|oversold)\s+(\d+(?:\.\d+)?)/i)
  const upperMatch = text.match(/\b(?:above|over|overbought)\s+(\d+(?:\.\d+)?)/i)
  if (!lowerMatch?.[1] || !upperMatch?.[1]) {
    return fail(
      "RSI ideas need both a lower and an upper threshold. Example: RSI 14 below 30 above 70 on SPY daily.",
    )
  }
  const lower = Number(lowerMatch[1])
  const upper = Number(upperMatch[1])
  if (!validLength(length, 2, 100)) {
    return fail("The RSI length must be a whole number from 2 to 100.")
  }
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower < 0 || upper > 100 || lower >= upper) {
    return fail("RSI thresholds must sit between 0 and 100, with the lower threshold under the upper one.")
  }
  const symbol = readSymbol(text)
  const title = `RSI ${length} below ${lower} above ${upper}`
  const strategy: Strategy = {
    kind: "rsi_threshold",
    length,
    lower,
    upper,
    symbol,
    timeframe: "D",
    title,
    summary: `Long-only RSI ${length} on ${symbol}, daily. Enter when RSI crosses below ${lower}. Exit when RSI crosses above ${upper}.`,
  }
  return { ok: true, strategy, pine: emitPine(strategy) }
}

function parseBreakout(text: string): ParseResult {
  const day = text.match(/\b(\d+)\s*-?\s*days?\b/i)
  const donchian = text.match(/\bdonchian\s+(\d+)\b/i)
  const of = text.match(/\bbreakout\s+(?:of\s+)?(\d+)\b/i)
  const raw = day?.[1] ?? donchian?.[1] ?? of?.[1]
  if (!raw) {
    return fail("A breakout needs a lookback in days. Example: 20-day breakout on SPY daily.")
  }
  const length = Number(raw)
  if (!validLength(length, 2, 200)) {
    return fail("The breakout lookback must be a whole number of days from 2 to 200.")
  }
  const symbol = readSymbol(text)
  const title = `${length}-day breakout`
  const strategy: Strategy = {
    kind: "breakout",
    length,
    symbol,
    timeframe: "D",
    title,
    summary: `Long-only ${length}-day breakout on ${symbol}, daily. Enter when the close crosses above the prior ${length}-bar high. Exit when the close crosses below the prior ${length}-bar low.`,
  }
  return { ok: true, strategy, pine: emitPine(strategy) }
}

export function parseIdea(raw: string): ParseResult {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) {
    return fail("Enter an idea first. Try one of the supported patterns.")
  }
  if (text.length > 500) {
    return fail("Keep the idea to one short sentence this parser can read.")
  }
  if (UNSUPPORTED_TIMEFRAME.test(text)) {
    return fail(
      "This lab only has bundled daily sample candles. Rewrite the idea on a daily bar, for example: EMA 8/55 crossover on SPY daily.",
    )
  }

  const wantsMa = /\b(ema|sma)\b/i.test(text) && /\b(?:crossover|cross(?:es|ing)?)\b/i.test(text)
  const wantsRsi = /\brsi\b/i.test(text)
  const wantsBreakout = /\b(?:breakout|donchian)\b/i.test(text)
  const matches = [wantsMa, wantsRsi, wantsBreakout].filter(Boolean).length
  if (matches > 1) {
    return fail(
      "This idea mixes more than one template. Use a single pattern: a moving-average crossover, an RSI threshold pair, or a breakout.",
    )
  }
  if (matches === 0) {
    return fail(
      "Could not map this idea to an offline template. This parser does not recognize it and will not invent a strategy.",
    )
  }
  if (wantsMa) return parseMa(text)
  if (wantsRsi) return parseRsi(text)
  return parseBreakout(text)
}
