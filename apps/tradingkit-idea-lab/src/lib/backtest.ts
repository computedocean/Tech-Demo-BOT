import { BACKTEST_ASSUMPTIONS, COMMISSION_RATE, INITIAL_CAPITAL, SLIPPAGE_RATE } from "./constants.ts"
import { ema, priorHighest, priorLowest, rsi, sma } from "./indicators.ts"
import type { BacktestResult, Candle, EquityPoint, Strategy, Trade } from "./types.ts"

type Signal = { enter: boolean; exit: boolean }

function finitePair(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right)
}

function signalsFor(strategy: Strategy, candles: Candle[]): Signal[] {
  const closes = candles.map((candle) => candle.close)
  const signals: Signal[] = candles.map(() => ({ enter: false, exit: false }))

  if (strategy.kind === "ma_cross") {
    const fast = strategy.ma === "ema" ? ema(closes, strategy.fast) : sma(closes, strategy.fast)
    const slow = strategy.ma === "ema" ? ema(closes, strategy.slow) : sma(closes, strategy.slow)
    for (let i = 1; i < candles.length; i++) {
      const fastNow = fast[i] ?? Number.NaN
      const slowNow = slow[i] ?? Number.NaN
      const fastPrev = fast[i - 1] ?? Number.NaN
      const slowPrev = slow[i - 1] ?? Number.NaN
      if (!finitePair(fastNow, slowNow) || !finitePair(fastPrev, slowPrev)) continue
      signals[i] = {
        enter: fastPrev <= slowPrev && fastNow > slowNow,
        exit: fastPrev >= slowPrev && fastNow < slowNow,
      }
    }
    return signals
  }

  if (strategy.kind === "rsi_threshold") {
    const value = rsi(closes, strategy.length)
    for (let i = 1; i < candles.length; i++) {
      const now = value[i] ?? Number.NaN
      const prev = value[i - 1] ?? Number.NaN
      if (!finitePair(now, prev)) continue
      signals[i] = {
        enter: prev >= strategy.lower && now < strategy.lower,
        exit: prev <= strategy.upper && now > strategy.upper,
      }
    }
    return signals
  }

  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)
  const priorHigh = priorHighest(highs, strategy.length)
  const priorLow = priorLowest(lows, strategy.length)
  for (let i = 1; i < candles.length; i++) {
    const highNow = priorHigh[i] ?? Number.NaN
    const highPrev = priorHigh[i - 1] ?? Number.NaN
    const lowNow = priorLow[i] ?? Number.NaN
    const lowPrev = priorLow[i - 1] ?? Number.NaN
    const closeNow = closes[i] ?? Number.NaN
    const closePrev = closes[i - 1] ?? Number.NaN
    if (!finitePair(highNow, highPrev) || !finitePair(lowNow, lowPrev) || !finitePair(closeNow, closePrev)) {
      continue
    }
    signals[i] = {
      enter: closeNow > highNow && closePrev <= highPrev,
      exit: closeNow < lowNow && closePrev >= lowPrev,
    }
  }
  return signals
}

function sharpeRatio(equity: number[]): number {
  if (equity.length < 3) return 0
  const returns: number[] = []
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1] ?? 0
    const next = equity[i] ?? 0
    returns.push(prev === 0 ? 0 : next / prev - 1)
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
  const std = Math.sqrt(variance)
  if (!Number.isFinite(std) || std < 1e-12) return 0
  const value = (mean / std) * Math.sqrt(252)
  return Number.isFinite(value) ? value : 0
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0
  let worst = 0
  for (const value of equity) {
    if (value > peak) peak = value
    if (peak > 0) {
      const drawdown = (peak - value) / peak
      if (drawdown > worst) worst = drawdown
    }
  }
  return Number.isFinite(worst) ? worst : 0
}

export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  if (candles.length === 0) {
    throw new Error("The backtest needs at least one candle.")
  }
  const signals = signalsFor(strategy, candles)
  let cash = INITIAL_CAPITAL
  let qty = 0
  let entryPrice = 0
  let entryDate = ""
  let entryFee = 0
  const trades: Trade[] = []
  const equity: EquityPoint[] = []

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    if (!candle) continue
    if (i > 0) {
      const signal = signals[i - 1] ?? { enter: false, exit: false }
      const open = candle.open
      if (Number.isFinite(open) && open > 0) {
        if (qty > 0 && signal.exit) {
          const fill = open * (1 - SLIPPAGE_RATE)
          const notional = qty * fill
          const fee = notional * COMMISSION_RATE
          const pnl = (fill - entryPrice) * qty - fee - entryFee
          const basis = entryPrice * qty
          trades.push({
            side: "long",
            entryDate,
            exitDate: candle.date,
            entryPrice,
            exitPrice: fill,
            qty,
            pnl,
            returnPct: basis === 0 ? 0 : pnl / basis,
          })
          cash += notional - fee
          qty = 0
          entryPrice = 0
          entryDate = ""
          entryFee = 0
        } else if (qty === 0 && signal.enter && !signal.exit) {
          const fill = open * (1 + SLIPPAGE_RATE)
          const affordable = Math.floor(cash / (fill * (1 + COMMISSION_RATE)))
          if (affordable >= 1) {
            const notional = affordable * fill
            const fee = notional * COMMISSION_RATE
            cash -= notional + fee
            qty = affordable
            entryPrice = fill
            entryDate = candle.date
            entryFee = fee
          }
        }
      }
    }
    const marked = cash + qty * candle.close
    equity.push({
      date: candle.date,
      equity: Number.isFinite(marked) ? marked : cash,
    })
  }

  const curve = equity.map((point) => point.equity)
  const finalEquity = curve[curve.length - 1] ?? INITIAL_CAPITAL
  const netReturn = finalEquity / INITIAL_CAPITAL - 1
  return {
    equity,
    trades,
    sharpe: sharpeRatio(curve),
    maxDrawdown: maxDrawdown(curve),
    netReturn: Number.isFinite(netReturn) ? netReturn : 0,
    tradeCount: trades.length,
    initialCapital: INITIAL_CAPITAL,
    finalEquity: Number.isFinite(finalEquity) ? finalEquity : 0,
    openPosition:
      qty > 0
        ? {
            entryDate,
            entryPrice,
            qty,
          }
        : null,
    assumptions: BACKTEST_ASSUMPTIONS,
  }
}
