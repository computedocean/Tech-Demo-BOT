export const INITIAL_CAPITAL = 10_000

/** 5 basis points per side. */
export const COMMISSION_RATE = 0.0005

/** 1 basis point of adverse fill. */
export const SLIPPAGE_RATE = 0.0001

export const BACKTEST_ASSUMPTIONS =
  "Signals are read on the closed candle and filled on the next bar's open. The book is long-only, uses all available cash, and buys whole shares. Commission is 5 bps per side and slippage is 1 bp against the fill. Sharpe uses daily mark-to-market returns, a 0% risk-free rate, the sample standard deviation, and sqrt(252). A position still open at the last bar is marked at that close and is left out of the closed-trade list. Pine sizes with percent of equity; this engine uses whole shares. These figures are not TradingView or TradingKit engine parity, not a live feed, and not performance or advice."

export const PRESETS = [
  "EMA 8/55 crossover on SPY daily",
  "SMA 20/50 crossover on QQQ daily",
  "RSI 14 below 30 above 70 on SPY daily",
  "20-day breakout on SPY daily",
] as const

export const SUPPORTED_PATTERNS = [
  "EMA 8/55 crossover on SPY daily",
  "SMA 20/50 crossover on QQQ daily",
  "RSI 14 below 30 above 70 on SPY daily",
  "20-day breakout on SPY daily",
] as const
