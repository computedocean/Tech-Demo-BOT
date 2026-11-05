import { CandlestickSeries, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { Bar } from '@/lib/candles'

const toData = (b: Bar[]) => b.map((x) => ({ ...x, time: x.time as UTCTimestamp }))

export function Chart({ history, predicted, hidden }: { history: Bar[]; predicted: Bar[]; hidden: Bar[] }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const s = useRef<Record<string, ISeriesApi<'Candlestick'>>>({})

  useEffect(() => {
    const c = createChart(el.current!, { autoSize: true, layout: { textColor: '#525252', background: { color: 'transparent' } }, grid: { vertLines: { visible: false }, horzLines: { color: '#f0f0f0' } } })
    s.current.real = c.addSeries(CandlestickSeries, { upColor: '#16a34a', downColor: '#dc2626', borderVisible: false, wickUpColor: '#16a34a', wickDownColor: '#dc2626' })
    s.current.hidden = c.addSeries(CandlestickSeries, { upColor: 'rgba(115,115,115,0.35)', downColor: 'rgba(115,115,115,0.35)', borderVisible: false, wickUpColor: '#a3a3a3', wickDownColor: '#a3a3a3' })
    s.current.pred = c.addSeries(CandlestickSeries, { upColor: 'rgba(0,0,0,0)', downColor: 'rgba(124,58,237,0.85)', borderUpColor: '#7c3aed', borderDownColor: '#7c3aed', wickUpColor: '#7c3aed', wickDownColor: '#7c3aed' })
    chart.current = c
    return () => c.remove()
  }, [])

  useEffect(() => {
    s.current.real?.setData(toData(history))
    s.current.hidden?.setData(toData(hidden))
    s.current.pred?.setData(toData(predicted))
    const n = history.length + Math.max(hidden.length, predicted.length)
    if (n) chart.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 160), to: n + 3 })
  }, [history, predicted, hidden])

  return <div ref={el} className="h-[460px] w-full" data-testid="chart" />
}
