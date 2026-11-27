export type SymbolId = "ETH" | "BTC"

export type BacktestParams = {
  symbol: SymbolId
  fast: number
  slow: number
  trailPct: number
}

export type SampleBar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Trade = {
  side: "long"
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  pnlQuote: number
  pnlPct: number
  exitReason: "trail" | "cross"
}

export type OpenPosition = {
  entryTime: string
  entryPrice: number
}

export type BacktestStats = {
  tradeCount: number
  netReturn: number
  maxDrawdown: number
  sharpe: number
  startingEquity: number
  endingEquity: number
}

export type RunBody = {
  params?: BacktestParams
  stats: BacktestStats
  trades: Trade[]
  equity: number[]
  openPosition?: OpenPosition | null
  engine?: string
}

export type BacktestSuccess = {
  ok: true
  source: "sidecar" | "recorded"
  exact: boolean
  requested: BacktestParams
  params: BacktestParams
  engine: string
  note: string
  stats: BacktestStats
  trades: Trade[]
  equity: number[]
  openPosition: OpenPosition | null
}

export type BacktestFailure = {
  ok: false
  error: string
}

export type BacktestResponse = BacktestSuccess | BacktestFailure
