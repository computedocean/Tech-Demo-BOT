import { useEffect, useRef } from "react"
import {
  ColorType,
  LineSeries,
  createChart,
  type Time,
} from "lightweight-charts"
import type { SampleBar } from "@/lib/types.ts"

export function EquityChart({ bars, equity }: { bars: SampleBar[]; equity: number[] }) {
  const host = useRef<HTMLDivElement>(null)
  const length = Math.min(bars.length, equity.length)

  useEffect(() => {
    const element = host.current
    if (!element || length < 2) return
    const chart = createChart(element, {
      width: element.clientWidth || 640,
      height: 168,
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
    const series = chart.addSeries(LineSeries, {
      color: "#18181b",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    })
    series.setData(
      bars.slice(0, length).map((bar, index) => ({
        time: bar.time as Time,
        value: equity[index] ?? 0,
      })),
    )
    chart.timeScale().fitContent()
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: element.clientWidth })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [bars, equity, length])

  return (
    <div
      ref={host}
      data-testid="equity-chart"
      className="h-[168px] w-full"
      role="img"
      aria-label="Equity curve for the sample backtest"
    />
  )
}
