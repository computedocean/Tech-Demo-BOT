import { FACTOR_KEYS, type Decision, type FactorKey, type Factors, type Packet, type Verdict } from "./types.ts"

const FACTOR_LABEL: Record<FactorKey, string> = {
  trend: "trend",
  momentum: "momentum",
  strength: "strength",
  volume: "volume",
  htf: "higher timeframe",
}

/** Deterministic LONG / SHORT / WAIT from the packet. No model and no key. */
export function mockVerdict(packet: Packet): Verdict {
  const trade = packet.trade
  const open = trade.status === "ACTIVE" || trade.status === "TARGET_1_HIT"
  const decision: Decision = open && (trade.side === "LONG" || trade.side === "SHORT") ? trade.side : "WAIT"
  const failureRisk = failureNote(packet, decision)
  if (decision === "WAIT") {
    return {
      decision,
      entry: null,
      stop: null,
      target1: null,
      target2: null,
      failureRisk,
      source: "mock",
    }
  }
  return {
    decision,
    entry: trade.entry,
    stop: trade.stop,
    target1: trade.target_1,
    target2: trade.target_2,
    failureRisk,
    source: "mock",
  }
}

function failureNote(packet: Packet, decision: Decision): string {
  const { scores, regime, trend, levels, structure, volatility, trade } = packet
  if (decision === "WAIT") {
    if (regime === "HIGH_VOLATILITY") {
      return "Failure risk: ATR percentile is in the high-volatility band, so new setups are blocked. A stop placed on this candle is easy to tag."
    }
    if (trade.status === "STOPPED" || trade.status === "STOPPED_AFTER_T1" || trade.status === "TARGET_2_HIT") {
      const status = trade.status.toLowerCase().replaceAll("_", " ")
      return `Failure risk: the tracked ${trade.side.toLowerCase()} trade is ${status}. This closed candle did not open a new setup.`
    }
    const lead = scores.long >= scores.short ? "long" : "short"
    const leadScore = Math.max(scores.long, scores.short)
    const opposed =
      (lead === "long" && regime === "TREND_DOWN") || (lead === "short" && regime === "TREND_UP")
    if (leadScore >= scores.threshold && opposed) {
      return `Failure risk: ${lead} score ${leadScore} is through ${scores.threshold}, but regime ${regime} points the other way, so the setup stays off.`
    }
    return `Failure risk: nothing has crossed ${scores.threshold} on this closed candle (long ${scores.long}, short ${scores.short}). There is no entry, stop, or take-profit until a setup fires.`
  }

  const factors = decision === "LONG" ? scores.long_factors : scores.short_factors
  const parts = [`Failure risk: ${weakest(factors)} is the weakest of the five factors.`]
  if (decision === "LONG" && trend.htf_bias === "DOWN") {
    parts.push("Higher-timeframe bias is DOWN, so this long fights the slower trend.")
  }
  if (decision === "SHORT" && trend.htf_bias === "UP") {
    parts.push("Higher-timeframe bias is UP, so this short fights the slower trend.")
  }
  if (trend.htf_bias == null) {
    parts.push("Higher-timeframe bias is null, so that factor was not scored.")
  }
  if (
    decision === "LONG" &&
    levels.prev_day_high != null &&
    trade.entry != null &&
    trade.target_1 != null &&
    trade.entry < levels.prev_day_high &&
    levels.prev_day_high < trade.target_1
  ) {
    parts.push(`Previous day high ${levels.prev_day_high} sits between entry and take-profit 1.`)
  }
  if (
    decision === "SHORT" &&
    levels.prev_day_low != null &&
    trade.entry != null &&
    trade.target_1 != null &&
    trade.target_1 < levels.prev_day_low &&
    levels.prev_day_low < trade.entry
  ) {
    parts.push(`Previous day low ${levels.prev_day_low} sits between entry and take-profit 1.`)
  }
  if (volatility.atr_percentile != null && volatility.atr_percentile >= 75) {
    parts.push(`ATR percentile is ${volatility.atr_percentile}, so the 1.5×ATR stop is wide and one bar can still hit it.`)
  }
  if (structure.bias === "MIXED" && structure.event === "NONE") {
    parts.push("Structure is mixed and this candle did not break a swing.")
  }
  if (trade.status === "TARGET_1_HIT") {
    parts.push("Take-profit 1 is already hit. The original stop is still active until take-profit 2 or a stop-out.")
  }
  return parts.join(" ")
}

function weakest(factors: Factors): string {
  let name: FactorKey = FACTOR_KEYS[0]!
  let points = factors[name]
  for (const key of FACTOR_KEYS) {
    if (factors[key] < points) {
      points = factors[key]
      name = key
    }
  }
  return `${FACTOR_LABEL[name]} at ${points}/20`
}
