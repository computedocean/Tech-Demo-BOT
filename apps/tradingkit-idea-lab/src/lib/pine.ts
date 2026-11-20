import { INITIAL_CAPITAL } from "./constants.ts"
import { assertPineSubset } from "./subset.ts"
import type { Strategy } from "./types.ts"

function quote(value: string): string {
  return JSON.stringify(value)
}

function header(strategy: Strategy, overlay: boolean): string {
  return [
    "//@version=6",
    `strategy(${quote(strategy.title)}, overlay=${overlay ? "true" : "false"}, initial_capital=${INITIAL_CAPITAL}, default_qty_type=strategy.percent_of_equity, default_qty_value=100, pyramiding=0, process_orders_on_close=false)`,
    "",
    "// Paper-research template. Long only. Signals use the closed candle.",
    `// Idea symbol: ${strategy.symbol}. The chart symbol supplies candles. This script does not load another symbol or timeframe.`,
    "// A separate local engine runs the same rules on bundled sample candles.",
    "",
  ].join("\n")
}

function orders(): string {
  return [
    "if longSignal",
    '    strategy.entry("Long", strategy.long)',
    "if flatSignal",
    '    strategy.close("Long")',
    "",
  ].join("\n")
}

export function emitPine(strategy: Strategy): string {
  let body = ""
  if (strategy.kind === "ma_cross") {
    const fn = strategy.ma === "ema" ? "ta.ema" : "ta.sma"
    body = [
      `fastLen = ${strategy.fast}`,
      `slowLen = ${strategy.slow}`,
      `fast = ${fn}(close, fastLen)`,
      `slow = ${fn}(close, slowLen)`,
      "longSignal = ta.crossover(fast, slow)",
      "flatSignal = ta.crossunder(fast, slow)",
      "",
      orders(),
      'plot(fast, title="Fast")',
      'plot(slow, title="Slow")',
      "",
    ].join("\n")
  } else if (strategy.kind === "rsi_threshold") {
    body = [
      `length = ${strategy.length}`,
      `lower = ${strategy.lower}`,
      `upper = ${strategy.upper}`,
      "value = ta.rsi(close, length)",
      "longSignal = ta.crossunder(value, lower)",
      "flatSignal = ta.crossover(value, upper)",
      "",
      orders(),
      'plot(value, title="RSI")',
      "hline(lower)",
      "hline(upper)",
      "",
    ].join("\n")
  } else {
    body = [
      `length = ${strategy.length}`,
      "priorHigh = ta.highest(high[1], length)",
      "priorLow = ta.lowest(low[1], length)",
      "longSignal = close > priorHigh and close[1] <= priorHigh[1]",
      "flatSignal = close < priorLow and close[1] >= priorLow[1]",
      "",
      orders(),
      'plot(priorHigh, title="Prior high")',
      'plot(priorLow, title="Prior low")',
      "",
    ].join("\n")
  }
  const source = `${header(strategy, strategy.kind !== "rsi_threshold")}${body}`
  assertPineSubset(source)
  return source
}
