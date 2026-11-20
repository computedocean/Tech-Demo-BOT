import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { CandleChart } from "@/components/candle-chart.tsx"
import { EquityChart } from "@/components/equity-chart.tsx"
import {
  DATA_LICENSE,
  DATA_SOURCE,
  RECORDED_ASSUMPTIONS,
  seriesFor,
} from "@/lib/catalog.ts"
import { DEFAULT_PARAMS, validateParams } from "@/lib/params.ts"
import { resolveBacktest } from "@/lib/resolve-backtest.ts"
import type { BacktestSuccess, SymbolId, Trade } from "@/lib/types.ts"

type Fields = {
  symbol: SymbolId
  fast: string
  slow: string
  trailPct: string
}

const INITIAL_FIELDS: Fields = {
  symbol: DEFAULT_PARAMS.symbol,
  fast: String(DEFAULT_PARAMS.fast),
  slow: String(DEFAULT_PARAMS.slow),
  trailPct: String(DEFAULT_PARAMS.trailPct),
}

export function Lab() {
  const [fields, setFields] = useState<Fields>(INITIAL_FIELDS)
  const [result, setResult] = useState<BacktestSuccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const series = seriesFor(fields.symbol)
  const showing = result !== null && result.params.symbol === fields.symbol

  async function run(next: Fields) {
    const validated = validateParams(next)
    if (!validated.ok) {
      setError(validated.error)
      return
    }
    setError(null)
    setRunning(true)
    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validated.params),
      })
      const payload: unknown = await response.json()
      if (isSuccess(payload)) {
        setResult(payload)
        return
      }
      const message =
        payload !== null &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "The backtest request failed."
      if (!response.ok && response.status < 500) {
        setError(message)
        return
      }
      setResult(await resolveBacktest(validated.params, async () => null))
    } catch {
      setResult(await resolveBacktest(validated.params, async () => null))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    void run(INITIAL_FIELDS)
  }, [])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 md:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Paper research
            </p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight">Nautilus backtest lab</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              EMA cross with a trailing stop on bundled synthetic ETH and BTC bars.
            </p>
          </div>
          <Badge variant="outline">No orders · no exchange</Badge>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Sample run</CardTitle>
              <CardDescription>
                Fast 8, 12, or 20 · slow 26 or 50 · trail 3, 5, or 8 have saved results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(fields)
                }}
              >
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Series</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={fields.symbol === "ETH" ? "default" : "outline"}
                      aria-pressed={fields.symbol === "ETH"}
                      data-testid="symbol-eth"
                      onClick={() => setFields((current) => ({ ...current, symbol: "ETH" }))}
                    >
                      SAMPLE-ETH
                    </Button>
                    <Button
                      type="button"
                      variant={fields.symbol === "BTC" ? "default" : "outline"}
                      aria-pressed={fields.symbol === "BTC"}
                      data-testid="symbol-btc"
                      onClick={() => setFields((current) => ({ ...current, symbol: "BTC" }))}
                    >
                      SAMPLE-BTC
                    </Button>
                  </div>
                </fieldset>
                <Field
                  id="fast-ema"
                  testId="fast-input"
                  label="Fast EMA"
                  value={fields.fast}
                  onChange={(fast) => setFields((current) => ({ ...current, fast }))}
                />
                <Field
                  id="slow-ema"
                  testId="slow-input"
                  label="Slow EMA"
                  value={fields.slow}
                  onChange={(slow) => setFields((current) => ({ ...current, slow }))}
                />
                <Field
                  id="trail-pct"
                  testId="trail-input"
                  label="Trail %"
                  value={fields.trailPct}
                  onChange={(trailPct) => setFields((current) => ({ ...current, trailPct }))}
                />
                <Button type="submit" data-testid="run-button" disabled={running}>
                  {running ? "Running…" : "Run backtest"}
                </Button>
                {error ? (
                  <p role="alert" className="text-sm text-destructive" data-testid="form-error">
                    {error}
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{series.label} candles</CardTitle>
                    <CardDescription>
                      {series.bars[0]?.time} to {series.bars.at(-1)?.time}. {series.note}
                    </CardDescription>
                  </div>
                  <SourceBadge result={showing ? result : null} running={running} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <CandleChart
                  bars={series.bars}
                  trades={showing && result ? result.trades : []}
                  openPosition={showing && result ? result.openPosition : null}
                  showMarkers={showing}
                />
                {showing && result ? <RunNote result={result} /> : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Equity curve</CardTitle>
                  <CardDescription>
                    Mark-to-market sample equity, starting at 10,000 quote units.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {showing && result ? (
                    <EquityChart bars={series.bars} equity={result.equity} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Run a backtest to plot equity.</p>
                  )}
                </CardContent>
              </Card>
              <StatsCard result={showing ? result : null} />
            </div>

            <TradeList trades={showing && result ? result.trades : []} />
          </div>
        </div>

        <footer className="border-t pt-4 text-xs leading-5 text-muted-foreground">
          <p>
            Independent paper-research demo. Not an official Nautech Systems or NautilusTrader
            product. Not financial advice. This lab does not place orders.
          </p>
          <p className="mt-2">
            NautilusTrader is used as an imported library under the LGPL-3.0 license.{" "}
            <a
              className="underline underline-offset-2"
              href="https://github.com/nautechsystems/nautilus_trader"
            >
              github.com/nautechsystems/nautilus_trader
            </a>
            {" · "}
            <a className="underline underline-offset-2" href="https://nautilustrader.io">
              nautilustrader.io
            </a>
          </p>
          <p className="mt-2">
            Sample bars and recorded results are original synthetic data ({DATA_LICENSE}).{" "}
            {DATA_SOURCE}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer">Sample backtest assumptions</summary>
            <p className="mt-1">{RECORDED_ASSUMPTIONS}</p>
          </details>
        </footer>
      </div>
    </div>
  )
}

function Field({
  id,
  testId,
  label,
  value,
  onChange,
}: {
  id: string
  testId: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        data-testid={testId}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function SourceBadge({
  result,
  running,
}: {
  result: BacktestSuccess | null
  running: boolean
}) {
  if (running && result === null) {
    return <Badge variant="secondary">Running</Badge>
  }
  if (result === null) return null
  const label =
    result.source === "sidecar"
      ? "Nautilus sidecar"
      : result.exact
        ? "Recorded fallback"
        : "Recorded fallback · nearest"
  return (
    <Badge variant={result.source === "sidecar" ? "default" : "secondary"} data-testid="source-badge">
      {label}
    </Badge>
  )
}

function RunNote({ result }: { result: BacktestSuccess }) {
  const used = `${result.params.symbol} ${result.params.fast}/${result.params.slow} trail ${result.params.trailPct}%`
  const mode =
    result.source === "sidecar"
      ? "Live Nautilus sidecar. No exchange connection and no orders sent."
      : "Recorded fallback: replaying a saved NautilusTrader JSON run. The sidecar did not run, and this page does not reimplement the Rust engine."
  return (
    <p className="text-sm text-muted-foreground" data-testid="run-note">
      {mode} {result.engine}. Parameters shown: {used}.
      {result.exact
        ? ""
        : ` Requested ${result.requested.fast}/${result.requested.slow} trail ${result.requested.trailPct}%.`}
    </p>
  )
}

function StatsCard({ result }: { result: BacktestSuccess | null }) {
  const stats = result?.stats
  return (
    <Card size="sm" data-testid="stats-card">
      <CardHeader>
        <CardTitle>Stats</CardTitle>
        <CardDescription>Sample figures. Not live performance.</CardDescription>
      </CardHeader>
      <CardContent>
        {stats ? (
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Trades" value={String(stats.tradeCount)} />
            <Stat label="Net return" value={formatPercent(stats.netReturn)} tone={stats.netReturn} />
            <Stat label="Max drawdown" value={formatPercent(Math.abs(stats.maxDrawdown), false)} />
            <Stat label="Sharpe" value={stats.sharpe.toFixed(2)} tone={stats.sharpe} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Stats appear after a run.</p>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const color =
    tone === undefined ? "text-foreground" : tone > 0 ? "text-emerald-700" : tone < 0 ? "text-red-700" : "text-foreground"
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-lg font-medium tabular-nums ${color}`}>{value}</dd>
    </div>
  )
}

function TradeList({ trades }: { trades: Trade[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Closed trades</CardTitle>
        <CardDescription>Long-only sample fills. Trail exits and EMA cross exits.</CardDescription>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed trades in this sample run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Entry</th>
                  <th className="py-1 pr-3 font-medium">Exit</th>
                  <th className="py-1 pr-3 font-medium">Reason</th>
                  <th className="py-1 font-medium">Return</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={`${trade.entryTime}-${trade.exitTime}`} className="border-t">
                    <td className="py-1.5 pr-3 tabular-nums">
                      {trade.entryTime} · {trade.entryPrice.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {trade.exitTime} · {trade.exitPrice.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-3">{trade.exitReason === "trail" ? "Trail" : "Cross"}</td>
                    <td className="py-1.5 tabular-nums">{formatPercent(trade.pnlPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatPercent(value: number, signed = true): string {
  const percent = value * 100
  const body = `${Math.abs(percent).toFixed(1)}%`
  if (!signed) return body
  if (percent > 0) return `+${body}`
  if (percent < 0) return `-${body}`
  return body
}

function isSuccess(value: unknown): value is BacktestSuccess {
  return (
    value !== null &&
    typeof value === "object" &&
    "ok" in value &&
    value.ok === true &&
    "source" in value &&
    (value.source === "sidecar" || value.source === "recorded") &&
    "stats" in value
  )
}
