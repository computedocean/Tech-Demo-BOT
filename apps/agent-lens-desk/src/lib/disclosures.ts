import type { Packet } from "./types.ts"

export function disclosuresFor(packet: Packet, source: "sample" | "live"): string[] {
  const notes = [
    source === "sample"
      ? "Bundled SAMPLE series: original synthetic OHLCV, not an exchange recording. Figures are not performance or advice."
      : "Live public 1h candles from a no-key endpoint. Not a broker feed. Figures are not performance or advice.",
    "Each packet is the candle that just closed. Stepping ahead never rewrites earlier packets.",
    "Previous-day high, previous-day low, and VWAP use the UTC day of this single series.",
  ]
  if (packet.trend.htf_bias == null) {
    notes.push(
      "trend.htf_bias is null: fewer than 50 closed 4h bars can be aggregated here, so the higher-timeframe factor was left unscored.",
    )
  } else {
    notes.push(
      "trend.htf_bias is the last closed 4h bar aggregated from this 1h series (EMA 50). It is not a separate exchange feed.",
    )
  }
  if (packet.levels.prev_day_high == null || packet.levels.prev_day_low == null) {
    notes.push("A previous-day level is null: this series does not yet contain a completed prior UTC day.")
  }
  if (packet.volume.relative == null) {
    notes.push("volume.relative is null: the 20-bar average is unavailable, so the volume factor is 0.")
  }
  notes.push(
    "Scoring follows the published ai-agent-lens/v1 rules. This port is not the TradingView Pine runtime and does not claim tick parity.",
  )
  return notes
}
