import type { Bar } from "../lib/types.ts"

export type PublicAsset = "BTC" | "ETH"

export type PublicCandles = {
  bars: Bar[]
  symbol: string
  ticker: string
  venue: string
}

const HOUR_MS = 60 * 60 * 1000

export async function fetchPublicHourly(asset: PublicAsset, fetcher: typeof fetch = fetch): Promise<PublicCandles> {
  const errors: string[] = []
  try {
    return await fetchBinance(asset, fetcher)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Binance request failed")
  }
  try {
    return await fetchKraken(asset, fetcher)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Kraken request failed")
  }
  throw new Error(`Public candles are unavailable (${errors.join("; ")}).`)
}

async function fetchBinance(asset: PublicAsset, fetcher: typeof fetch): Promise<PublicCandles> {
  const ticker = asset === "BTC" ? "BTCUSDT" : "ETHUSDT"
  const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1h&limit=400`
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`)
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error("Binance payload was not a list")
  const now = Date.now()
  const bars: Bar[] = []
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 7) continue
    const openMs = Number(row[0])
    const closeMs = Number(row[6])
    if (!Number.isFinite(openMs) || !Number.isFinite(closeMs) || closeMs > now) continue
    bars.push({
      time: Math.floor(openMs / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    })
  }
  assertClosedBars(bars)
  return {
    bars,
    symbol: `BINANCE:${ticker}`,
    ticker,
    venue: "Binance public klines (no key)",
  }
}

async function fetchKraken(asset: PublicAsset, fetcher: typeof fetch): Promise<PublicCandles> {
  const pair = asset === "BTC" ? "XBTUSD" : "ETHUSD"
  const ticker = asset === "BTC" ? "XBTUSD" : "ETHUSD"
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=60`
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`)
  const data: unknown = await response.json()
  if (!data || typeof data !== "object") throw new Error("Kraken payload was empty")
  const result = (data as { result?: unknown }).result
  if (!result || typeof result !== "object") throw new Error("Kraken payload had no result")
  const rows = Object.values(result).find((value) => Array.isArray(value))
  if (!Array.isArray(rows)) throw new Error("Kraken payload had no candles")
  const nowSec = Date.now() / 1000
  const bars: Bar[] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 7) continue
    const openSec = Number(row[0])
    if (!Number.isFinite(openSec) || openSec + 3600 > nowSec) continue
    bars.push({
      time: openSec,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[6]),
    })
  }
  assertClosedBars(bars)
  return {
    bars,
    symbol: `KRAKEN:${ticker}`,
    ticker,
    venue: "Kraken public OHLC (no key)",
  }
}

function assertClosedBars(bars: Bar[]): void {
  if (bars.length < 80) throw new Error("fewer than 80 closed candles")
  for (const bar of bars) {
    if (![bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value))) {
      throw new Error("a candle had a non-numeric price")
    }
    if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
      throw new Error("a candle had an impossible range")
    }
  }
  const last = bars[bars.length - 1]!
  if (last.time * 1000 + HOUR_MS > Date.now() + 2000) {
    throw new Error("the last candle is still open")
  }
}
