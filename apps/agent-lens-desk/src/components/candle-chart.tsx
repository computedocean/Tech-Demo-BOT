import { useEffect, useRef } from "react"
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts"
import type { Bar } from "@/lib/types.ts"

export type ChartMarker = {
  time: number
  position: "aboveBar" | "belowBar"
  shape: "arrowUp" | "arrowDown"
  color: string
  text: string
}

export type PriceLevel = {
  price: number
  title: string
  color: string
  dashed?: boolean
}

type CandleChartProps = {
  bars: Bar[]
  markers: ChartMarker[]
  levels: PriceLevel[]
}

export function CandleChart({ bars, markers, levels }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const linesRef = useRef<IPriceLine[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#3f3f46",
        fontFamily: "Geist Variable, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f4f4f5" },
        horzLines: { color: "#f4f4f5" },
      },
      rightPriceScale: { borderColor: "#e4e4e7" },
      timeScale: { borderColor: "#e4e4e7", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#d4d4d8" }, horzLine: { color: "#d4d4d8" } },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#1f7a45",
      downColor: "#b42318",
      borderUpColor: "#1f7a45",
      borderDownColor: "#b42318",
      wickUpColor: "#1f7a45",
      wickDownColor: "#b42318",
    })
    chartRef.current = chart
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      markersRef.current = null
      linesRef.current = []
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series || bars.length === 0) return
    series.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    )
    const markerData: SeriesMarker<Time>[] = markers.map((marker) => ({
      time: marker.time as UTCTimestamp,
      position: marker.position,
      shape: marker.shape,
      color: marker.color,
      text: marker.text,
    }))
    markersRef.current?.setMarkers(markerData)
    for (const line of linesRef.current) series.removePriceLine(line)
    linesRef.current = levels.map((level) =>
      series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: level.dashed ? 2 : 0,
        axisLabelVisible: true,
        title: level.title,
      }),
    )
    const last = bars.length - 1
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, last - 48),
      to: last + 3,
    })
  }, [bars, markers, levels])

  return <div ref={containerRef} className="h-[360px] w-full" data-testid="candle-chart" />
}
