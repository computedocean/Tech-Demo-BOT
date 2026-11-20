/** Field names and enums from AI Agent Lens `docs/PACKET_SCHEMA.md` (`ai-agent-lens/v1`). */

export const LENS_SCHEMA = "ai-agent-lens/v1" as const

export type LensSchema = typeof LENS_SCHEMA

export type LensEvent = "BAR_CLOSE" | "LONG_SETUP" | "SHORT_SETUP" | "TRADE_UPDATE"

export type Regime = "TREND_UP" | "TREND_DOWN" | "RANGE" | "HIGH_VOLATILITY"

export type Direction = "bull" | "bear" | "flat"

export type Stack = "BULLISH" | "BEARISH" | "MIXED"

export type Slope = "RISING" | "FALLING" | "FLAT"

export type HtfBias = "UP" | "DOWN" | "FLAT" | "N/A"

export type StructureBias = "BULLISH" | "BEARISH" | "MIXED"

export type StructureEvent = "BREAK_UP" | "BREAK_DOWN" | "NONE"

export type TradeSide = "LONG" | "SHORT" | "NONE"

export type TradeStatus =
  | "ACTIVE"
  | "TARGET_1_HIT"
  | "TARGET_2_HIT"
  | "STOPPED"
  | "STOPPED_AFTER_T1"
  | "NONE"

export type Pattern =
  | "FLAT"
  | "BULLISH_ENGULFING"
  | "BEARISH_ENGULFING"
  | "DOJI"
  | "HAMMER"
  | "SHOOTING_STAR"
  | "BULLISH_MARUBOZU"
  | "BEARISH_MARUBOZU"
  | "INSIDE_BAR"
  | "OUTSIDE_BAR"
  | "WIDE_RANGE_BULL"
  | "WIDE_RANGE_BEAR"
  | "NONE"

export type FactorKey = "trend" | "momentum" | "strength" | "volume" | "htf"

export const FACTOR_KEYS: readonly FactorKey[] = [
  "trend",
  "momentum",
  "strength",
  "volume",
  "htf",
]

export type Factors = Record<FactorKey, number>

export type CandleAnatomy = {
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  direction: Direction
  body_pct: number
  upper_wick_pct: number
  lower_wick_pct: number
  range_atr: number | null
  close_position_pct: number
  gap_pct: number | null
  closed_above_prev_high: boolean
  closed_below_prev_low: boolean
  pattern: Pattern
}

export type RecentCandle = {
  bars_ago: number
  o: number
  h: number
  l: number
  c: number
  v: number | null
  dir: Direction
  body_pct: number
  range_atr: number | null
  pattern: Pattern
}

export type Packet = {
  schema: LensSchema
  event: LensEvent
  symbol: string
  timeframe: string
  time: string
  state_code: string
  candle: CandleAnatomy
  recent_candles: RecentCandle[]
  regime: Regime
  trend: {
    ema_fast: number | null
    ema_mid: number | null
    ema_slow: number | null
    stack: Stack
    slow_slope: Slope
    htf: string
    htf_bias: HtfBias | null
  }
  momentum: {
    rsi: number | null
    macd_hist: number | null
    macd_hist_rising: boolean
  }
  strength: {
    adx: number | null
    di_plus: number | null
    di_minus: number | null
  }
  volatility: {
    atr: number | null
    atr_percentile: number | null
  }
  volume: {
    relative: number | null
  }
  structure: {
    bias: StructureBias
    event: StructureEvent
    last_swing_high: number | null
    last_swing_low: number | null
  }
  levels: {
    prev_day_high: number | null
    prev_day_low: number | null
    vwap: number | null
  }
  scores: {
    long: number
    short: number
    threshold: number
    long_factors: Factors
    short_factors: Factors
  }
  trade: {
    side: TradeSide
    status: TradeStatus
    entry: number | null
    stop: number | null
    target_1: number | null
    target_2: number | null
    bars_since_entry: number | null
  }
  last_setup: {
    side: TradeSide
    bars_ago: number | null
  }
}

export type Bar = {
  /** Unix seconds of the bar open. The packet time is the close. */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export type LensOptions = {
  symbol: string
  ticker: string
  timeframe?: string
  /** Higher timeframe code stored on the packet. Aggregation uses 4× the chart bar. */
  htf?: string
  threshold?: number
  blockHighVol?: boolean
  recentCount?: number
  /** Chart bar length in seconds. Sample and live series are 1h. */
  barSeconds?: number
}

export type Decision = "LONG" | "SHORT" | "WAIT"

export type Verdict = {
  decision: Decision
  entry: number | null
  stop: number | null
  target1: number | null
  target2: number | null
  failureRisk: string
  source: "mock"
}
