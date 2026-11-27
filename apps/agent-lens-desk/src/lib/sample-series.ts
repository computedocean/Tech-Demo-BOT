import type { Bar } from "./types.ts"

/** Original synthetic OHLCV. Not a market recording and not a performance series. */

const HOUR = 3600
const START = Date.UTC(2026, 0, 5) / 1000

export type SampleId = "btc" | "eth"

export type SampleSeries = {
  id: SampleId
  symbol: string
  ticker: string
  label: string
  detail: string
  bars: Bar[]
}

export function sampleSeries(id: SampleId): SampleSeries {
  if (id === "eth") {
    return {
      id,
      symbol: "SAMPLE:ETHUSD",
      ticker: "ETHUSD",
      label: "SAMPLE ETH",
      detail: "Synthetic 1h ETH-like path. Not exchange data.",
      bars: buildSample(2280, 0.075, 20261120),
    }
  }
  return {
    id: "btc",
    symbol: "SAMPLE:BTCUSD",
    ticker: "BTCUSD",
    label: "SAMPLE BTC",
    detail: "Synthetic 1h BTC-like path. Not exchange data.",
    bars: buildSample(42800, 1, 20261119),
  }
}

export function sampleBtc(): Bar[] {
  return sampleSeries("btc").bars
}

function buildSample(startPrice: number, scale: number, seed: number): Bar[] {
  const rand = mulberry32(seed)
  const count = 480
  const bars: Bar[] = []
  let price = startPrice
  for (let i = 0; i < count; i++) {
    const open = price
    const noise = (rand() - 0.5) * 6 * scale
    let drift = 12 * scale
    let wick = 30 * scale
    let volume = 1000
    if (i < 220) {
      drift = 10 * scale + noise
      wick = 72 * scale
      volume = 980
      if (i % 23 === 0) {
        drift = -16 * scale
        volume = 760
      }
    } else if (i < 236) {
      drift = -22 * scale + noise
      wick = 64 * scale
      volume = 900
    } else if (i === 236) {
      drift = 90 * scale
      wick = 48 * scale
      volume = 2800
    } else if (i < 270) {
      drift = 8 * scale + noise
      wick = 60 * scale
      volume = 1100
    } else if (i < 340) {
      drift = -24 * scale + noise * 0.4
      wick = 68 * scale
      volume = 1250
    } else if (i < 348) {
      drift = 34 * scale
      wick = 52 * scale
      volume = 800
    } else if (i === 348) {
      drift = -96 * scale
      wick = 50 * scale
      volume = 3100
    } else if (i < 400) {
      drift = -14 * scale + noise * 0.3
      wick = 58 * scale
      volume = 1200
    } else if (i < 424) {
      drift = noise
      wick = 48 * scale
      volume = 700
    } else {
      const sign = i % 2 === 0 ? 1 : -1
      drift = sign * 280 * scale
      wick = 120 * scale
      volume = 2200
    }
    const close = open + drift
    const high = Math.max(open, close) + wick
    const low = Math.min(open, close) - wick * 0.7
    const openR = round2(open)
    const closeR = round2(close)
    const highR = round2(Math.max(high, openR, closeR))
    const lowR = round2(Math.max(0.01, Math.min(low, openR, closeR)))
    bars.push({
      time: START + i * HOUR,
      open: openR,
      high: highR,
      low: lowR,
      close: closeR,
      volume: Math.round(volume * 10) / 10,
    })
    price = closeR
  }
  return bars
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
