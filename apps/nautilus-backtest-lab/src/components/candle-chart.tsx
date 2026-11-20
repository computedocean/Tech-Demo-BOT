import { useEffect, useRef } from "react"
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts"
import type { OpenPosition, SampleBar, Trade } from "@/lib/types.ts"

type Marker = SeriesMarker<Time>

export function CandleChart({
  bars,
  trades,
  openPosition,
  showMarkers,
}: {
  bars: SampleBar[]
  trades: Trade[]
  openPosition: OpenPosition | null
  showMarkers: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    const chart = createChart(element, {
      width: element.clientWidth || 640,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#3f3f46",
        fontFamily: '"Geist Variable", sans-serif',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f4f4f5" },
        horzLines: { color: "#f4f4f5" },
      },
      rightPriceScale: { borderColor: "#e4e4e7" },
      timeScale: { borderColor: "#e4e4e7", rightOffset: 2 },
      crosshair: { vertLine: { color: "#a1a1aa" }, horzLine: { color: "#a1a1aa" } },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#15803d",
      downColor: "#b91c1c",
      wickUpColor: "#15803d",
      wickDownColor: "#b91c1c",
      borderVisible: false,
    })
    series.setData(
      bars.map((bar) => ({
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    )
    const markers = createSeriesMarkers(series, showMarkers ? buildMarkers(trades, openPosition) : [])
    chart.timeScale().fitContent()
    chartRef.current = chart
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: element.clientWidth })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      markers.detach()
      chart.remove()
      chartRef.current = null
    }
  }, [bars, openPosition, showMarkers, trades])

  return (
    <div
      ref={host}
      data-testid="candle-chart"
      className="h-[280px] w-full"
      role="img"
      aria-label="Candlestick chart of the sample series with entry and exit markers"
    />
  )
}

function buildMarkers(trades: Trade[], openPosition: OpenPosition | null): Marker[] {
  const markers: Marker[] = []
  for (const trade of trades) {
    markers.push({
      time: trade.entryTime as Time,
      position: "belowBar",
      color: "#15803d",
      shape: "arrowUp",
      text: "Entry",
    })
    markers.push({
      time: trade.exitTime as Time,
      position: "aboveBar",
      color: "#b91c1c",
      shape: "arrowDown",
      text: trade.exitReason === "trail" ? "Trail" : "Cross",
    })
  }
  if (openPosition) {
    markers.push({
      time: openPosition.entryTime as Time,
      position: "belowBar",
      color: "#15803d",
      shape: "arrowUp",
      text: "Open",
    })
  }
  return markers.sort((a, b) => String(a.time).localeCompare(String(b.time)))
}
