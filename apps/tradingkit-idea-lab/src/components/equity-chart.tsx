export type ChartPoint = { date: string; value: number }

export type ChartSeries = {
  id: string
  name: string
  color: string
  dash: string
  points: ChartPoint[]
}

const WIDTH = 720
const HEIGHT = 248
const PAD = { left: 56, right: 12, top: 16, bottom: 28 }

export function EquityChart({
  series,
  label,
  formatValue,
  formatTick = formatValue,
}: {
  series: ChartSeries[]
  label: string
  formatValue: (value: number) => string
  formatTick?: (value: number) => string
}) {
  const points = series.flatMap((item) => item.points)
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No equity points to draw.</p>
  }
  const dates = Array.from(new Set(points.map((point) => point.date))).sort()
  let min = Math.min(...points.map((point) => point.value))
  let max = Math.max(...points.map((point) => point.value))
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return <p className="text-sm text-muted-foreground">The equity curve is not finite.</p>
  }
  if (min === max) {
    min -= 1
    max += 1
  }
  const span = max - min
  min -= span * 0.08
  max += span * 0.08
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const xAt = (date: string) => {
    const index = Math.max(0, dates.indexOf(date))
    const denom = Math.max(1, dates.length - 1)
    return PAD.left + (index / denom) * innerW
  }
  const yAt = (value: number) => PAD.top + ((max - value) / (max - min)) * innerH
  const last = series[0]?.points[series[0].points.length - 1]
  const caption = last
    ? `${label}. Latest ${series[0]?.name ?? "series"} ${formatValue(last.value)}.`
    : label

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={caption}
      >
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
        />
        <line
          x1={PAD.left}
          y1={HEIGHT - PAD.bottom}
          x2={WIDTH - PAD.right}
          y2={HEIGHT - PAD.bottom}
          stroke="var(--border)"
        />
        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">
          {formatTick(max)}
        </text>
        <text
          x={PAD.left - 8}
          y={HEIGHT - PAD.bottom}
          textAnchor="end"
          fill="var(--muted-foreground)"
          fontSize="11"
        >
          {formatTick(min)}
        </text>
        <text x={PAD.left} y={HEIGHT - 8} fill="var(--muted-foreground)" fontSize="11">
          {dates[0]}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">
          {dates[dates.length - 1]}
        </text>
        {series.map((item) => {
          const commands = item.points
            .map((point, index) => {
              const x = xAt(point.date).toFixed(2)
              const y = yAt(point.value).toFixed(2)
              return `${index === 0 ? "M" : "L"}${x} ${y}`
            })
            .join(" ")
          return (
            <path
              key={item.id}
              d={commands}
              fill="none"
              stroke={item.color}
              strokeWidth="1.75"
              strokeDasharray={item.dash || undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <figcaption className="sr-only">{caption}</figcaption>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {series.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <svg width="28" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  stroke={item.color}
                  strokeWidth="2"
                  strokeDasharray={item.dash || undefined}
                />
              </svg>
              {item.name}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  )
}
