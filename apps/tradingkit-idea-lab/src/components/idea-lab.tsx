import { useEffect, useState } from "react"
import { defaultAdapterConfig, sendToTradingKit, TRADINGKIT_INSTALL_URL } from "../lib/adapter.ts"
import { compareRuns, toSavedRun, type CompareResult } from "../lib/compare.ts"
import { PRESETS } from "../lib/constants.ts"
import { formatAxisMoney, formatMoney, formatNumber, formatPct, formatPrice } from "../lib/format.ts"
import { buildLabRun } from "../lib/lab.ts"
import { loadStoredRuns, writeStoredRuns } from "../lib/storage.ts"
import type { LabSuccess, SavedRun } from "../lib/types.ts"
import { Badge } from "./ui/badge.tsx"
import { Button } from "./ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card.tsx"
import { Input } from "./ui/input.tsx"
import { Label } from "./ui/label.tsx"
import { Switch } from "./ui/switch.tsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx"
import { Textarea } from "./ui/textarea.tsx"
import { EquityChart } from "./equity-chart.tsx"

const CURVE_STYLES = [
  { color: "var(--foreground)", dash: "" },
  { color: "var(--chart-3)", dash: "6 4" },
  { color: "var(--chart-5)", dash: "2 3" },
  { color: "var(--muted-foreground)", dash: "8 3 2 3" },
]

function firstRun(): LabSuccess | null {
  const result = buildLabRun(PRESETS[0])
  return result.ok ? result : null
}

export function IdeaLab() {
  const [idea, setIdea] = useState<string>(PRESETS[0])
  const [run, setRun] = useState<LabSuccess | null>(firstRun)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [name, setName] = useState(firstRun()?.strategy.title ?? "")
  const [runs, setRuns] = useState<SavedRun[]>(() => loadStoredRuns())
  const [selected, setSelected] = useState<string[]>([])
  const [comparison, setComparison] = useState<CompareResult | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [adapterEnabled, setAdapterEnabled] = useState(defaultAdapterConfig.enabled)
  const [rewrite, setRewrite] = useState<{ idea: string; pine: string; note: string } | null>(null)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (!run) return
    const ideaText = run.idea
    const controller = new AbortController()
    void fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idea: ideaText }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data: unknown = await response.json()
        if (!data || typeof data !== "object") return
        const record = data as { ok?: unknown; usedLlm?: unknown; pine?: unknown; note?: unknown }
        if (record.ok === true && record.usedLlm === true && typeof record.pine === "string") {
          setRewrite({
            idea: ideaText,
            pine: record.pine,
            note: typeof record.note === "string" ? record.note : "Server rewrite applied.",
          })
        }
      })
      .catch(() => {
        // Offline template remains the result the lab shows.
      })
    return () => controller.abort()
  }, [run])

  function applyIdea(nextIdea: string) {
    const result = buildLabRun(nextIdea)
    setRewrite(null)
    setCopied(false)
    if (!result.ok) {
      setRun(null)
      setError(result.error)
      setSuggestions(result.suggestions)
      setStatus(null)
      return
    }
    setError(null)
    setSuggestions([])
    setRun(result)
    setName(result.strategy.title)
    setStatus(null)
  }

  function toggleSelected(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function saveCurrent() {
    if (!run) return
    const saved = toSavedRun(run, name, crypto.randomUUID(), new Date().toISOString())
    const next = [saved, ...runs]
    setRuns(next)
    writeStoredRuns(next)
    setStatus(`Saved "${saved.name}".`)
  }

  function removeRun(id: string) {
    const next = runs.filter((item) => item.id !== id)
    setRuns(next)
    writeStoredRuns(next)
    setSelected((current) => current.filter((item) => item !== id))
    setComparison((current) => (current?.table.some((row) => row.id === id) ? null : current))
  }

  function compareSelected() {
    const chosen = runs.filter((item) => selected.includes(item.id))
    if (chosen.length < 2) {
      setStatus("Select at least two saved runs to compare.")
      return
    }
    setComparison(compareRuns(chosen))
    setStatus(null)
  }

  const adapter = sendToTradingKit({
    enabled: adapterEnabled,
    oauthConnected: false,
  })

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Paper research</Badge>
            <Badge variant="secondary">Offline</Badge>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Idea lab</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Type a plain-English strategy. The lab writes Pine Script v6 and runs a local backtest on bundled sample candles.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="lg:sticky lg:top-4">
            <Card>
              <CardHeader>
                <h2 className="font-heading text-base font-medium">Strategy idea</h2>
                <CardDescription>Presets fill the field. Run uses the offline parser.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    applyIdea(idea)
                  }}
                >
                  <Label htmlFor="idea">Plain English</Label>
                  <Textarea
                    id="idea"
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    className="min-h-32"
                    spellCheck={false}
                  />
                  <div className="flex flex-col gap-2">
                    {PRESETS.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={idea === preset ? "secondary" : "outline"}
                        className="h-auto justify-start py-2 text-left whitespace-normal"
                        onClick={() => setIdea(preset)}
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                  <Button type="submit" className="w-full">
                    Run idea
                  </Button>
                </form>
                {error ? (
                  <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p>{error}</p>
                    {suggestions.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                        {suggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <section id="results" className="space-y-6" aria-live="polite">
            {run ? (
              <>
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h2 className="font-heading text-base font-medium">Pine Script v6</h2>
                          <CardDescription>{run.strategy.title}</CardDescription>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void copyPine(run.pine, setCopied, setStatus)}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 overflow-auto rounded-lg border bg-muted/40">
                        <pre className="w-max min-w-full p-3 font-mono text-[11px] leading-5">{run.pine}</pre>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Offline template. An optional server rewrite runs only when a private key is present in the server environment. The browser does not receive that key.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-base font-medium">Local backtest</h2>
                        <Badge variant="outline">{run.seriesId}</Badge>
                      </div>
                      <CardDescription>{run.summary}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
<div className="grid grid-cols-2 gap-3">
                      <Metric label="Sharpe" value={formatNumber(run.backtest.sharpe)} />
                      <Metric label="Max drawdown" value={formatPct(run.backtest.maxDrawdown)} />
                      <Metric label="Net return" value={formatPct(run.backtest.netReturn, true)} />
                      <Metric label="Trades" value={String(run.backtest.tradeCount)} />
                    </div>
                      <p className="text-xs text-muted-foreground">
                        Final equity {formatMoney(run.backtest.finalEquity)} from {formatMoney(run.backtest.initialCapital)}.{" "}
                        {run.seriesNote}
                      </p>
                      {run.backtest.openPosition ? (
                        <p className="text-xs text-muted-foreground">
                          One long is still open from {run.backtest.openPosition.entryDate} and is marked on the curve, not in the closed-trade list.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                {rewrite && rewrite.idea === run.idea ? (
                  <Card>
                    <CardHeader>
                      <h2 className="font-heading text-base font-medium">Server rewrite</h2>
                      <CardDescription>{rewrite.note}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-5">{rewrite.pine}</pre>
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <h2 className="font-heading text-base font-medium">Equity curve</h2>
                    <CardDescription>Mark-to-market equity on the bundled sample, starting at {formatMoney(run.backtest.initialCapital)}.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EquityChart
                      label={`Equity curve for ${run.strategy.title}`}
                      formatValue={formatMoney}
                      formatTick={formatAxisMoney}
                      series={[
                        {
                          id: "equity",
                          name: run.seriesId,
                          color: "var(--foreground)",
                          dash: "",
                          points: run.backtest.equity.map((point) => ({ date: point.date, value: point.equity })),
                        },
                      ]}
                    />
                    <p className="mt-3 text-xs text-muted-foreground">{run.backtest.assumptions}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h2 className="font-heading text-base font-medium">Trades</h2>
                    <CardDescription>Closed long trades only. Entry and exit are next-bar opens.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {run.backtest.trades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No closed trades on this sample.</p>
                    ) : (
                      <div className="max-h-80 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Entry</TableHead>
                              <TableHead>Exit</TableHead>
                              <TableHead>Side</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Entry px</TableHead>
                              <TableHead className="text-right">Exit px</TableHead>
                              <TableHead className="text-right">PnL</TableHead>
                              <TableHead className="text-right">Return</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {run.backtest.trades.map((trade) => (
                              <TableRow key={`${trade.entryDate}-${trade.exitDate}-${trade.qty}`}>
                                <TableCell>{trade.entryDate}</TableCell>
                                <TableCell>{trade.exitDate}</TableCell>
                                <TableCell>Long</TableCell>
                                <TableCell className="text-right tabular-nums">{trade.qty}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPrice(trade.entryPrice)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPrice(trade.exitPrice)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatMoney(trade.pnl)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPct(trade.returnPct, true)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h2 className="font-heading text-base font-medium">Save and compare</h2>
                    <CardDescription>Saved runs stay in this browser. Compare needs two or more.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Label htmlFor="run-name" className="sr-only">
                        Run name
                      </Label>
                      <Input
                        id="run-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                      <Button type="button" onClick={saveCurrent}>
                        Save run
                      </Button>
                    </div>
                    {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
                    {runs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No saved runs yet.</p>
                    ) : (
                      <ul className="divide-y">
                        {runs.map((saved) => (
                          <li key={saved.id} className="flex items-start gap-3 py-3">
                            <input
                              type="checkbox"
                              className="mt-1 size-4"
                              checked={selected.includes(saved.id)}
                              onChange={() => toggleSelected(saved.id)}
                              aria-label={`Include ${saved.name} in compare`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{saved.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {saved.seriesId} · Sharpe {formatNumber(saved.metrics.sharpe)} · Max drawdown{" "}
                                {formatPct(saved.metrics.maxDrawdown)} · {saved.metrics.tradeCount} trades
                              </p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeRun(saved.id)}>
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button type="button" variant="outline" disabled={selected.length < 2} onClick={compareSelected}>
                      Compare selected
                    </Button>
                    {comparison ? (
                      <div className="space-y-4 border-t pt-4">
                        <h3 className="text-sm font-medium">Comparison</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Run</TableHead>
                              <TableHead className="text-right">Sharpe</TableHead>
                              <TableHead className="text-right">Max drawdown</TableHead>
                              <TableHead className="text-right">Net return</TableHead>
                              <TableHead className="text-right">Trades</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comparison.table.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>{row.name}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatNumber(row.sharpe)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPct(row.maxDrawdown)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPct(row.netReturn, true)}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.tradeCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <EquityChart
                          label="Compared equity, each run indexed to 100 at the first bar"
                          formatValue={(value) => formatNumber(value, 0)}
                          series={comparison.curves.map((curve, index) => {
                            const style = CURVE_STYLES[index % CURVE_STYLES.length] ?? CURVE_STYLES[0]
                            return {
                              id: curve.id,
                              name: curve.name,
                              color: style?.color ?? "var(--foreground)",
                              dash: style?.dash ?? "",
                              points: curve.points,
                            }
                          })}
                        />
                        <p className="text-xs text-muted-foreground">Each curve is rebased to 100 at its first sample bar.</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <h2 className="font-heading text-base font-medium">No result yet</h2>
                  <CardDescription>Run a supported idea to see Pine beside a sample backtest.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </section>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-heading text-base font-medium">Send to TradingKit</h2>
                <CardDescription>Off by default. Your own OAuth only. This lab never places orders.</CardDescription>
              </div>
              <Switch
                id="tradingkit-adapter"
                checked={adapterEnabled}
                onCheckedChange={(checked) => setAdapterEnabled(checked)}
                aria-label="Send to TradingKit"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{adapter.message}</p>
            <p>
              <a className="underline underline-offset-4" href="https://tradingkit.com">
                tradingkit.com
              </a>
              {" · "}
              <a className="underline underline-offset-4" href={TRADINGKIT_INSTALL_URL}>
                app.tradingkit.com/install
              </a>
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-muted-foreground">
          <p>
            Independent paper-research demo. Not an official TradingKit product. Not financial advice. This lab does not place orders.
          </p>
          <p>
            <a className="underline underline-offset-4" href="https://tradingkit.com">
              https://tradingkit.com
            </a>
            {" · "}
            <a className="underline underline-offset-4" href="https://kb.tradingkit.com/backtests/pine-script/">
              https://kb.tradingkit.com/backtests/pine-script/
            </a>
          </p>
          <p>
            TradingKit is commercial software. This page does not copy its product UI or marketing figures. Sample candles are original synthetic data (CC0), not a live feed.
          </p>
        </div>
      </footer>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}

async function copyPine(
  pine: string,
  setCopied: (value: boolean) => void,
  setStatus: (value: string | null) => void,
) {
  try {
    await navigator.clipboard.writeText(pine)
    setCopied(true)
  } catch {
    setCopied(false)
    setStatus("Select the script and copy it manually. This browser blocked clipboard access.")
  }
}
