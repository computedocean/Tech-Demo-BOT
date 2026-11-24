export type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
}

export type Timeframe = "D"

type StrategyBase = {
  symbol: string
  timeframe: Timeframe
  title: string
  summary: string
}

export type Strategy =
  | (StrategyBase & {
      kind: "ma_cross"
      ma: "ema" | "sma"
      fast: number
      slow: number
      lengthsOrdered: boolean
    })
  | (StrategyBase & {
      kind: "rsi_threshold"
      length: number
      lower: number
      upper: number
    })
  | (StrategyBase & {
      kind: "breakout"
      length: number
    })

export type ParseSuccess = {
  ok: true
  strategy: Strategy
  pine: string
}

export type ParseFailure = {
  ok: false
  error: string
  suggestions: string[]
}

export type ParseResult = ParseSuccess | ParseFailure

export type Trade = {
  side: "long"
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  qty: number
  pnl: number
  returnPct: number
}

export type EquityPoint = {
  date: string
  equity: number
}

export type OpenPosition = {
  entryDate: string
  entryPrice: number
  qty: number
}

export type BacktestResult = {
  equity: EquityPoint[]
  trades: Trade[]
  sharpe: number
  maxDrawdown: number
  netReturn: number
  tradeCount: number
  initialCapital: number
  finalEquity: number
  openPosition: OpenPosition | null
  assumptions: string
}

export type SavedRun = {
  id: string
  name: string
  idea: string
  createdAt: string
  pine: string
  summary: string
  seriesId: string
  metrics: {
    sharpe: number
    maxDrawdown: number
    netReturn: number
    tradeCount: number
    finalEquity: number
  }
  equity: EquityPoint[]
  trades: Trade[]
}

export type LabSuccess = {
  ok: true
  idea: string
  strategy: Strategy
  pine: string
  summary: string
  seriesId: string
  seriesNote: string
  backtest: BacktestResult
}

export type LabResult = LabSuccess | ParseFailure
