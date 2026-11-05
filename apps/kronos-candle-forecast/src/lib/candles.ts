export type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number }

/** Parse CSV with header containing timestamps|date|time, open, high, low, close, [volume]. */
export function parseCsv(text: string): Bar[] {
  const lines = text.trim().split(/\r?\n/)
  const head = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const ti = head.findIndex((h) => ['timestamps', 'timestamp', 'date', 'time', 'datetime'].includes(h))
  const idx = (k: string) => head.indexOf(k)
  const [o, h, l, c, v] = ['open', 'high', 'low', 'close', 'volume'].map(idx)
  if (ti < 0 || [o, h, l, c].some((i) => i < 0)) throw new Error('CSV needs timestamps/date, open, high, low, close columns')
  const bars = lines.slice(1).map((line) => {
    const f = line.split(',')
    const raw = f[ti].trim()
    const t = /^\d+$/.test(raw) ? Number(raw) / (raw.length > 11 ? 1000 : 1) : Date.parse(raw.includes('T') || raw.includes(' ') ? raw : raw + 'T00:00:00Z') / 1000
    return { time: Math.floor(t), open: +f[o], high: +f[h], low: +f[l], close: +f[c], volume: v >= 0 ? +f[v] || 0 : 0 }
  }).filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close))
  bars.sort((a, b) => a.time - b.time)
  return bars
}

export const mae = (pred: number[], actual: number[]) =>
  pred.reduce((s, p, i) => s + Math.abs(p - actual[i]), 0) / pred.length

/** Naive "tomorrow = today": every hidden bar's close = last visible close. */
export const naiveCloses = (lastClose: number, n: number) => Array.from({ length: n }, () => lastClose)

export async function forecast(bars: Bar[], horizon: number): Promise<{ bars: Bar[]; seconds: number }> {
  const res = await fetch('/api/forecast', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bars, horizon }),
  })
  if (!res.ok) throw new Error(`Kronos helper error ${res.status}: ${await res.text()}`)
  return res.json()
}
