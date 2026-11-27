// Closed-candle scoring for AI Agent Lens packets.
// Rules follow docs/SPECIFICATION.md and field names follow docs/PACKET_SCHEMA.md
// from https://github.com/roan-maverick/tradingview-indicator-for-ai-agents
// Copyright (c) 2026 roan-maverick, MIT License.
// Independent TypeScript port for paper research. Not the Pine runtime.

import {
  atr,
  dmi,
  ema,
  macdHistogram,
  percentRank,
  pivotHighs,
  pivotLows,
  rsi,
  sma,
} from "./indicators.ts"
import { isoClose, roundTo, utcDay } from "./round.ts"
import {
  LENS_SCHEMA,
  type Bar,
  type CandleAnatomy,
  type Direction,
  type Factors,
  type HtfBias,
  type LensOptions,
  type Packet,
  type Pattern,
  type RecentCandle,
  type Regime,
  type Slope,
  type Stack,
  type StructureBias,
  type StructureEvent,
  type TradeSide,
  type TradeStatus,
} from "./types.ts"

const EMA_FAST = 20
const EMA_MID = 50
const EMA_SLOW = 200
const SLOPE_LOOKBACK = 5
const RSI_OB = 75
const RSI_OS = 25
const ADX_TREND = 20
const ATR_PCT_LEN = 100
const HIGH_VOL = 90
const SWING = 5
const STOP_ATR = 1.5
const TARGET_1_R = 1.5
const TARGET_2_R = 3
const HTF_BARS = 4
const HTF_EMA = 50

type Track = {
  side: 0 | 1 | -1
  sideStr: TradeSide
  status: TradeStatus
  entry: number | null
  stop: number | null
  t1: number | null
  t2: number | null
  entryBar: number | null
  lastSigBar: number | null
  lastSigSide: TradeSide
}

export function buildPackets(bars: Bar[], options: LensOptions): Packet[] {
  const timeframe = options.timeframe ?? "60"
  const htf = options.htf ?? "240"
  const threshold = options.threshold ?? 70
  const blockHighVol = options.blockHighVol ?? true
  const recentCount = options.recentCount ?? 5
  const barSeconds = options.barSeconds ?? 3600

  const closes = bars.map((bar) => bar.close)
  const highs = bars.map((bar) => bar.high)
  const lows = bars.map((bar) => bar.low)
  const volumes = bars.map((bar) => bar.volume ?? 0)
  const volumeKnown = bars.map((bar) => bar.volume != null)

  const emaFast = ema(closes, EMA_FAST)
  const emaMid = ema(closes, EMA_MID)
  const emaSlow = ema(closes, EMA_SLOW)
  const rsiValues = rsi(closes, 14)
  const macdHist = macdHistogram(closes)
  const directional = dmi(highs, lows, closes, 14)
  const atrValues = atr(highs, lows, closes, 14)
  const atrPercent = percentRank(atrValues, ATR_PCT_LEN)
  const volumeAvg = sma(volumes, 20)
  const swingHighs = pivotHighs(highs, SWING, SWING)
  const swingLows = pivotLows(lows, SWING, SWING)
  const htfBias = higherTimeframeBias(bars, barSeconds)

  const anatomy: CandleAnatomy[] = []
  const longScores: number[] = []
  const shortScores: number[] = []
  const packets: Packet[] = []

  const track: Track = {
    side: 0,
    sideStr: "NONE",
    status: "NONE",
    entry: null,
    stop: null,
    t1: null,
    t2: null,
    entryBar: null,
    lastSigBar: null,
    lastSigSide: "NONE",
  }

  let swingHigh: number | null = null
  let prevSwingHigh: number | null = null
  let swingLow: number | null = null
  let prevSwingLow: number | null = null

  let sessionDay = ""
  let sessionPv = 0
  let sessionVolume = 0
  let prevDayHigh: number | null = null
  let prevDayLow: number | null = null
  let dayHigh = Number.NEGATIVE_INFINITY
  let dayLow = Number.POSITIVE_INFINITY
  let haveDay = false

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!
    const day = utcDay(bar.time)
    if (day !== sessionDay) {
      if (haveDay) {
        prevDayHigh = dayHigh
        prevDayLow = dayLow
      }
      sessionDay = day
      sessionPv = 0
      sessionVolume = 0
      dayHigh = bar.high
      dayLow = bar.low
      haveDay = true
    } else {
      dayHigh = Math.max(dayHigh, bar.high)
      dayLow = Math.min(dayLow, bar.low)
    }

    const typical = (bar.high + bar.low + bar.close) / 3
    if (bar.volume != null) {
      sessionPv += typical * bar.volume
      sessionVolume += bar.volume
    }
    const vwap = sessionVolume > 0 ? sessionPv / sessionVolume : null

    if (swingHighs[i] != null) {
      prevSwingHigh = swingHigh
      swingHigh = swingHighs[i]!
    }
    if (swingLows[i] != null) {
      prevSwingLow = swingLow
      swingLow = swingLows[i]!
    }

    const fast = emaFast[i] ?? null
    const mid = emaMid[i] ?? null
    const slow = emaSlow[i] ?? null
    const slowPrev = i >= SLOPE_LOOKBACK ? (emaSlow[i - SLOPE_LOOKBACK] ?? null) : null
    const rsiValue = rsiValues[i] ?? null
    const hist = macdHist[i] ?? null
    const prevHist = i > 0 ? (macdHist[i - 1] ?? null) : null
    const adx = directional.adx[i] ?? null
    const diPlus = directional.diPlus[i] ?? null
    const diMinus = directional.diMinus[i] ?? null
    const atrValue = atrValues[i] ?? null
    const atrPct = atrPercent[i] ?? null
    const avgVol = volumeKnown[i] && volumeAvg[i] != null && volumeAvg[i]! > 0 ? volumeAvg[i]! : null
    const relVol = avgVol != null && bar.volume != null ? bar.volume / avgVol : null

    const regime = regimeOf(bar.close, slow, slowPrev, adx, atrPct)
    const longFactors = longFactorSet(bar, fast, mid, slow, rsiValue, hist, prevHist, diPlus, diMinus, adx, relVol, htfBias[i] ?? null)
    const shortFactors = shortFactorSet(bar, fast, mid, slow, rsiValue, hist, prevHist, diPlus, diMinus, adx, relVol, htfBias[i] ?? null)
    const longScore = sumFactors(longFactors)
    const shortScore = sumFactors(shortFactors)
    longScores.push(longScore)
    shortScores.push(shortScore)

    const prevLong = i > 0 ? longScores[i - 1]! : null
    const prevShort = i > 0 ? shortScores[i - 1]! : null
    const longCond =
      prevLong != null &&
      longScore >= threshold &&
      prevLong < threshold &&
      regime !== "TREND_DOWN" &&
      !(blockHighVol && regime === "HIGH_VOLATILITY")
    const shortCond =
      prevShort != null &&
      shortScore >= threshold &&
      prevShort < threshold &&
      regime !== "TREND_UP" &&
      !(blockHighVol && regime === "HIGH_VOLATILITY")
    const longSig = longCond && !shortCond && atrValue != null && atrValue > 0
    const shortSig = shortCond && !longCond && atrValue != null && atrValue > 0

    const statusBefore = track.status
    let openedLong = false
    let openedShort = false

    if (track.side !== 0 && track.entryBar != null && i > track.entryBar) {
      if (track.side === 1) {
        if (track.stop != null && bar.low <= track.stop) {
          track.status = track.status === "TARGET_1_HIT" ? "STOPPED_AFTER_T1" : "STOPPED"
          track.side = 0
        } else if (track.t2 != null && bar.high >= track.t2) {
          track.status = "TARGET_2_HIT"
          track.side = 0
        } else if (track.t1 != null && bar.high >= track.t1 && track.status === "ACTIVE") {
          track.status = "TARGET_1_HIT"
        }
      } else if (track.stop != null && bar.high >= track.stop) {
        track.status = track.status === "TARGET_1_HIT" ? "STOPPED_AFTER_T1" : "STOPPED"
        track.side = 0
      } else if (track.t2 != null && bar.low <= track.t2) {
        track.status = "TARGET_2_HIT"
        track.side = 0
      } else if (track.t1 != null && bar.low <= track.t1 && track.status === "ACTIVE") {
        track.status = "TARGET_1_HIT"
      }
    }

    if (longSig && track.side !== 1) {
      openedLong = true
      const risk = STOP_ATR * atrValue!
      track.side = 1
      track.sideStr = "LONG"
      track.entry = bar.close
      track.stop = bar.close - risk
      track.t1 = bar.close + TARGET_1_R * risk
      track.t2 = bar.close + TARGET_2_R * risk
      track.entryBar = i
      track.status = "ACTIVE"
      track.lastSigBar = i
      track.lastSigSide = "LONG"
    } else if (shortSig && track.side !== -1) {
      openedShort = true
      const risk = STOP_ATR * atrValue!
      track.side = -1
      track.sideStr = "SHORT"
      track.entry = bar.close
      track.stop = bar.close + risk
      track.t1 = bar.close - TARGET_1_R * risk
      track.t2 = bar.close - TARGET_2_R * risk
      track.entryBar = i
      track.status = "ACTIVE"
      track.lastSigBar = i
      track.lastSigSide = "SHORT"
    }

    const tradeUpdate = track.status !== statusBefore && !openedLong && !openedShort
    const event = openedLong ? "LONG_SETUP" : openedShort ? "SHORT_SETUP" : tradeUpdate ? "TRADE_UPDATE" : "BAR_CLOSE"

    const candle = candleAnatomy(bars, i, atrValue)
    anatomy.push(candle)

    const recent: RecentCandle[] = []
    const start = Math.max(0, i - (recentCount - 1))
    for (let j = start; j <= i; j++) {
      const past = j === i ? candle : anatomy[j]!
      recent.push({
        bars_ago: i - j,
        o: past.open,
        h: past.high,
        l: past.low,
        c: past.close,
        v: past.volume,
        dir: past.direction,
        body_pct: past.body_pct,
        range_atr: past.range_atr,
        pattern: past.pattern,
      })
    }

    const structureBias = structureBiasOf(swingHigh, prevSwingHigh, swingLow, prevSwingLow)
    const prevClose = i > 0 ? bars[i - 1]!.close : null
    const structureEvent = structureEventOf(bar.close, prevClose, swingHigh, swingLow)

    const packet: Packet = {
      schema: LENS_SCHEMA,
      event,
      symbol: options.symbol,
      timeframe,
      time: isoClose(bar.time, barSeconds),
      state_code: "",
      candle,
      recent_candles: recent,
      regime,
      trend: {
        ema_fast: roundTo(fast, 2),
        ema_mid: roundTo(mid, 2),
        ema_slow: roundTo(slow, 2),
        stack: stackOf(fast, mid, slow),
        slow_slope: slopeOf(slow, slowPrev),
        htf,
        htf_bias: htfBias[i] ?? null,
      },
      momentum: {
        rsi: roundTo(rsiValue, 2),
        macd_hist: roundTo(hist, 6),
        macd_hist_rising: hist != null && prevHist != null && hist > prevHist,
      },
      strength: {
        adx: roundTo(adx, 2),
        di_plus: roundTo(diPlus, 2),
        di_minus: roundTo(diMinus, 2),
      },
      volatility: {
        atr: roundTo(atrValue, 2),
        atr_percentile: roundTo(atrPct, 1),
      },
      volume: {
        relative: roundTo(relVol, 2),
      },
      structure: {
        bias: structureBias,
        event: structureEvent,
        last_swing_high: roundTo(swingHigh, 2),
        last_swing_low: roundTo(swingLow, 2),
      },
      levels: {
        prev_day_high: roundTo(prevDayHigh, 2),
        prev_day_low: roundTo(prevDayLow, 2),
        vwap: roundTo(vwap, 2),
      },
      scores: {
        long: longScore,
        short: shortScore,
        threshold,
        long_factors: longFactors,
        short_factors: shortFactors,
      },
      trade: {
        side: track.sideStr,
        status: track.status,
        entry: roundTo(track.entry, 2),
        stop: roundTo(track.stop, 2),
        target_1: roundTo(track.t1, 2),
        target_2: roundTo(track.t2, 2),
        bars_since_entry: track.entryBar == null ? null : i - track.entryBar,
      },
      last_setup: {
        side: track.lastSigSide,
        bars_ago: track.lastSigBar == null ? null : i - track.lastSigBar,
      },
    }
    packet.state_code = `LENS|${options.ticker}|${timeframe}|${regime}|L${longScore}|S${shortScore}|${track.sideStr}:${track.status}`
    packets.push(packet)
  }

  return packets
}

function regimeOf(
  close: number,
  slow: number | null,
  slowPrev: number | null,
  adx: number | null,
  atrPct: number | null,
): Regime {
  if (atrPct != null && atrPct >= HIGH_VOL) return "HIGH_VOLATILITY"
  const trending = adx != null && adx >= ADX_TREND && slow != null && slowPrev != null
  if (trending && close > slow! && slow! > slowPrev!) return "TREND_UP"
  if (trending && close < slow! && slow! < slowPrev!) return "TREND_DOWN"
  return "RANGE"
}

function longFactorSet(
  bar: Bar,
  fast: number | null,
  mid: number | null,
  slow: number | null,
  rsiValue: number | null,
  hist: number | null,
  prevHist: number | null,
  diPlus: number | null,
  diMinus: number | null,
  adx: number | null,
  relVol: number | null,
  bias: HtfBias | null,
): Factors {
  return {
    trend: (gt(fast, mid) ? 7 : 0) + (gt(mid, slow) ? 7 : 0) + (fast != null && bar.close > fast ? 6 : 0),
    momentum:
      (rsiValue != null && rsiValue > 50 ? (rsiValue >= RSI_OB ? 4 : 10) : 0) +
      (hist != null && hist > 0 ? 5 : 0) +
      (hist != null && prevHist != null && hist > prevHist ? 5 : 0),
    strength: (gt(diPlus, diMinus) ? 10 : 0) + (gt(diPlus, diMinus) && adx != null && adx >= ADX_TREND ? 10 : 0),
    volume: volumePoints(bar.close > bar.open, relVol),
    htf: htfPoints(bias, "long"),
  }
}

function shortFactorSet(
  bar: Bar,
  fast: number | null,
  mid: number | null,
  slow: number | null,
  rsiValue: number | null,
  hist: number | null,
  prevHist: number | null,
  diPlus: number | null,
  diMinus: number | null,
  adx: number | null,
  relVol: number | null,
  bias: HtfBias | null,
): Factors {
  return {
    trend: (lt(fast, mid) ? 7 : 0) + (lt(mid, slow) ? 7 : 0) + (fast != null && bar.close < fast ? 6 : 0),
    momentum:
      (rsiValue != null && rsiValue < 50 ? (rsiValue <= RSI_OS ? 4 : 10) : 0) +
      (hist != null && hist < 0 ? 5 : 0) +
      (hist != null && prevHist != null && hist < prevHist ? 5 : 0),
    strength: (gt(diMinus, diPlus) ? 10 : 0) + (gt(diMinus, diPlus) && adx != null && adx >= ADX_TREND ? 10 : 0),
    volume: volumePoints(bar.close < bar.open, relVol),
    htf: htfPoints(bias, "short"),
  }
}

function volumePoints(aligned: boolean, relVol: number | null): number {
  if (!aligned || relVol == null) return 0
  if (relVol >= 1.5) return 20
  if (relVol >= 1) return 12
  return 6
}

function htfPoints(bias: HtfBias | null, side: "long" | "short"): number {
  if (bias == null) return 0
  if (bias === "N/A" || bias === "FLAT") return 10
  if (side === "long") return bias === "UP" ? 20 : 0
  return bias === "DOWN" ? 20 : 0
}

function sumFactors(factors: Factors): number {
  return factors.trend + factors.momentum + factors.strength + factors.volume + factors.htf
}

function gt(left: number | null, right: number | null): boolean {
  return left != null && right != null && left > right
}

function lt(left: number | null, right: number | null): boolean {
  return left != null && right != null && left < right
}

function stackOf(fast: number | null, mid: number | null, slow: number | null): Stack {
  if (gt(fast, mid) && gt(mid, slow)) return "BULLISH"
  if (lt(fast, mid) && lt(mid, slow)) return "BEARISH"
  return "MIXED"
}

function slopeOf(slow: number | null, slowPrev: number | null): Slope {
  if (slow == null || slowPrev == null || slow === slowPrev) return "FLAT"
  return slow > slowPrev ? "RISING" : "FALLING"
}

function structureBiasOf(
  swingHigh: number | null,
  prevSwingHigh: number | null,
  swingLow: number | null,
  prevSwingLow: number | null,
): StructureBias {
  if (
    swingHigh != null &&
    prevSwingHigh != null &&
    swingLow != null &&
    prevSwingLow != null &&
    swingHigh > prevSwingHigh &&
    swingLow > prevSwingLow
  ) {
    return "BULLISH"
  }
  if (
    swingHigh != null &&
    prevSwingHigh != null &&
    swingLow != null &&
    prevSwingLow != null &&
    swingHigh < prevSwingHigh &&
    swingLow < prevSwingLow
  ) {
    return "BEARISH"
  }
  return "MIXED"
}

function structureEventOf(
  close: number,
  prevClose: number | null,
  swingHigh: number | null,
  swingLow: number | null,
): StructureEvent {
  if (swingHigh != null && prevClose != null && close > swingHigh && prevClose <= swingHigh) return "BREAK_UP"
  if (swingLow != null && prevClose != null && close < swingLow && prevClose >= swingLow) return "BREAK_DOWN"
  return "NONE"
}

function candleAnatomy(bars: Bar[], index: number, atrValue: number | null): CandleAnatomy {
  const bar = bars[index]!
  const prev = index > 0 ? bars[index - 1]! : null
  const range = bar.high - bar.low
  const body = Math.abs(bar.close - bar.open)
  const upper = bar.high - Math.max(bar.open, bar.close)
  const lower = Math.min(bar.open, bar.close) - bar.low
  const direction: Direction = bar.close > bar.open ? "bull" : bar.close < bar.open ? "bear" : "flat"
  return {
    open: roundTo(bar.open, 2)!,
    high: roundTo(bar.high, 2)!,
    low: roundTo(bar.low, 2)!,
    close: roundTo(bar.close, 2)!,
    volume: bar.volume == null ? null : roundTo(bar.volume, 4),
    direction,
    body_pct: roundTo(range > 0 ? (body / range) * 100 : 0, 1)!,
    upper_wick_pct: roundTo(range > 0 ? (upper / range) * 100 : 0, 1)!,
    lower_wick_pct: roundTo(range > 0 ? (lower / range) * 100 : 0, 1)!,
    range_atr: atrValue != null && atrValue > 0 ? roundTo(range / atrValue, 2) : null,
    close_position_pct: roundTo(range > 0 ? ((bar.close - bar.low) / range) * 100 : 50, 1)!,
    gap_pct: prev != null && prev.close > 0 ? roundTo(((bar.open - prev.close) / prev.close) * 100, 3) : null,
    closed_above_prev_high: prev != null && bar.close > prev.high,
    closed_below_prev_low: prev != null && bar.close < prev.low,
    pattern: patternOf(bars, index, atrValue),
  }
}

function patternOf(bars: Bar[], index: number, atrValue: number | null): Pattern {
  const bar = bars[index]!
  const prev = index > 0 ? bars[index - 1]! : null
  const range = bar.high - bar.low
  const body = Math.abs(bar.close - bar.open)
  const upper = bar.high - Math.max(bar.open, bar.close)
  const lower = Math.min(bar.open, bar.close) - bar.low
  if (range <= 0) return "FLAT"
  if (
    prev &&
    bar.close > bar.open &&
    prev.close < prev.open &&
    bar.close >= prev.open &&
    bar.open <= prev.close
  ) {
    return "BULLISH_ENGULFING"
  }
  if (
    prev &&
    bar.close < bar.open &&
    prev.close > prev.open &&
    bar.open >= prev.close &&
    bar.close <= prev.open
  ) {
    return "BEARISH_ENGULFING"
  }
  if (body / range <= 0.1) return "DOJI"
  if (lower >= 2 * body && upper <= 0.15 * range) return "HAMMER"
  if (upper >= 2 * body && lower <= 0.15 * range) return "SHOOTING_STAR"
  if (body / range >= 0.9) return bar.close > bar.open ? "BULLISH_MARUBOZU" : "BEARISH_MARUBOZU"
  if (prev && bar.high < prev.high && bar.low > prev.low) return "INSIDE_BAR"
  if (prev && bar.high > prev.high && bar.low < prev.low) return "OUTSIDE_BAR"
  if (atrValue != null && atrValue > 0 && range >= 1.8 * atrValue) {
    return bar.close > bar.open ? "WIDE_RANGE_BULL" : "WIDE_RANGE_BEAR"
  }
  return "NONE"
}

/**
 * Bias of the last fully closed 4× bar versus its EMA 50.
 * Null until 50 closed higher-timeframe bars exist. The forming bucket is excluded.
 */
function higherTimeframeBias(bars: Bar[], barSeconds: number): (HtfBias | null)[] {
  const htfSeconds = barSeconds * HTF_BARS
  const bias: (HtfBias | null)[] = Array.from({ length: bars.length }, () => null)
  const closes: number[] = []
  let bucketStart = Number.NaN
  let bucketClose = 0
  let carried: HtfBias | null = null

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!
    const start = Math.floor(bar.time / htfSeconds) * htfSeconds
    if (start !== bucketStart) {
      bucketStart = start
      bucketClose = bar.close
    } else {
      bucketClose = bar.close
    }
    if (bar.time + barSeconds >= start + htfSeconds) {
      closes.push(bucketClose)
      const smoothed = ema(closes, HTF_EMA)
      const emaValue = smoothed[smoothed.length - 1]
      const close = closes[closes.length - 1]!
      if (emaValue == null) carried = null
      else if (close > emaValue) carried = "UP"
      else if (close < emaValue) carried = "DOWN"
      else carried = "FLAT"
    }
    bias[i] = carried
  }
  return bias
}
