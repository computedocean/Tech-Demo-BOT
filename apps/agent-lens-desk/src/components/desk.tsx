import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { CandleChart, type ChartMarker, type PriceLevel } from "@/components/candle-chart.tsx"
import { PacketPanel } from "@/components/packet-panel.tsx"
import { VerdictPanel } from "@/components/verdict-panel.tsx"
import { WebhookPanel } from "@/components/webhook-panel.tsx"
import { disclosuresFor } from "@/lib/disclosures.ts"
import { buildPackets } from "@/lib/lens.ts"
import { sampleSeries, type SampleId } from "@/lib/sample-series.ts"
import type { Bar, Packet, Verdict } from "@/lib/types.ts"
import { mockVerdict } from "@/lib/verdict.ts"

type Feed =
  | { kind: "sample"; id: SampleId }
  | { kind: "live"; asset: "BTC" | "ETH"; symbol: string; ticker: string; venue: string; bars: Bar[] }

export function Desk() {
  const [feed, setFeed] = useState<Feed>({ kind: "sample", id: "btc" })
  const [liveOn, setLiveOn] = useState(false)
  const [liveAsset, setLiveAsset] = useState<"BTC" | "ETH">("BTC")
  const [liveError, setLiveError] = useState<string | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [index, setIndex] = useState(() =>
    startIndex(buildPackets(sampleSeries("btc").bars, { symbol: "SAMPLE:BTCUSD", ticker: "BTCUSD" })),
  )
  const [playing, setPlaying] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(false)
  const [rewrite, setRewrite] = useState(false)
  const [verdictOverride, setVerdictOverride] = useState<{ time: string; verdict: Verdict; note: string } | null>(null)

  const model = useMemo(() => {
    if (feed.kind === "live") {
      return {
        bars: feed.bars,
        symbol: feed.symbol,
        ticker: feed.ticker,
        label: `LIVE ${feed.asset}`,
        detail: feed.venue,
        source: "live" as const,
      }
    }
    const series = sampleSeries(feed.id)
    return {
      bars: series.bars,
      symbol: series.symbol,
      ticker: series.ticker,
      label: series.label,
      detail: series.detail,
      source: "sample" as const,
    }
  }, [feed])

  const packets = useMemo(
    () => buildPackets(model.bars, { symbol: model.symbol, ticker: model.ticker }),
    [model],
  )

  useEffect(() => {
    let cancelled = false
    fetch("/api/llm-status")
      .then((response) => response.json())
      .then((body: { enabled?: boolean }) => {
        if (!cancelled) setLlmAvailable(body.enabled === true)
      })
      .catch(() => {
        if (!cancelled) setLlmAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cursor = Math.min(index, Math.max(0, packets.length - 1))
  const packet = packets[cursor]
  const mock = packet ? mockVerdict(packet) : null

  useEffect(() => {
    if (!packet || !rewrite || !llmAvailable) return
    const current = mockVerdict(packet)
    const controller = new AbortController()
    fetch("/api/verdict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(packet),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body: { verdict?: Verdict; llm?: boolean; note?: string }) => {
        if (body.verdict && body.llm === true && body.verdict.decision === current.decision) {
          setVerdictOverride({
            time: packet.time,
            verdict: { ...current, failureRisk: body.verdict.failureRisk, source: "mock" },
            note: body.note ?? "Server rewrite replaced the failure-risk note only.",
          })
        } else {
          setVerdictOverride({
            time: packet.time,
            verdict: current,
            note: body.note ?? "Mock rules. No model is required.",
          })
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setVerdictOverride({
          time: packet.time,
          verdict: current,
          note: "Mock rules. The server rewrite did not respond.",
        })
      })
    return () => controller.abort()
  }, [packet, rewrite, llmAvailable])

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => {
      if (cursor >= packets.length - 1) {
        setPlaying(false)
        return
      }
      setIndex((value) => Math.min(packets.length - 1, value + 1))
    }, 380)
    return () => window.clearTimeout(timer)
  }, [playing, cursor, packets.length])

  if (!packet || !mock) return null
  const override = rewrite && llmAvailable && verdictOverride?.time === packet.time ? verdictOverride : null
  const verdict = override?.verdict ?? mock
  const shownNote = override?.note ?? "Mock rules. No model is required."
  const shownBars = model.bars.slice(0, cursor + 1)
  const markers = markersUntil(packets, model.bars, cursor)
  const levels = priceLevels(verdict)

  function showSample(id: SampleId) {
    const series = sampleSeries(id)
    setPlaying(false)
    setLiveOn(false)
    setIndex(startIndex(buildPackets(series.bars, { symbol: series.symbol, ticker: series.ticker })))
    setFeed({ kind: "sample", id })
  }

  async function enableLive(asset: "BTC" | "ETH", on: boolean) {
    setLiveAsset(asset)
    setLiveError(null)
    if (!on) {
      showSample(asset === "ETH" ? "eth" : "btc")
      return
    }
    setLiveLoading(true)
    try {
      const response = await fetch(`/api/public-candles?asset=${asset}`)
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        bars?: Bar[]
        symbol?: string
        ticker?: string
        venue?: string
      }
      if (!response.ok || !body.ok || !body.bars || !body.symbol || !body.ticker || !body.venue) {
        throw new Error(body.message ?? "Public candles are unavailable. Staying on the bundled sample.")
      }
      setPlaying(false)
      setLiveOn(true)
      setIndex(startIndex(buildPackets(body.bars, { symbol: body.symbol, ticker: body.ticker })))
      setFeed({
        kind: "live",
        asset,
        symbol: body.symbol,
        ticker: body.ticker,
        venue: body.venue,
        bars: body.bars,
      })
    } catch (error) {
      showSample(asset === "ETH" ? "eth" : "btc")
      setLiveError(error instanceof Error ? error.message : "Public candles are unavailable. Staying on the bundled sample.")
    } finally {
      setLiveLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-medium tracking-tight">Agent Lens desk</h1>
            <p className="text-xs text-muted-foreground">
              Closed candle to ai-agent-lens/v1 packet to a LONG, SHORT, or WAIT verdict. Paper research only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" data-testid="source-label">
              {model.label}
            </Badge>
            <Badge variant="secondary">1h</Badge>
            <Badge variant="secondary">No orders</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={feed.kind === "sample" && feed.id === "btc" ? "default" : "outline"} onClick={() => showSample("btc")}>
            SAMPLE BTC
          </Button>
          <Button type="button" size="sm" variant={feed.kind === "sample" && feed.id === "eth" ? "default" : "outline"} onClick={() => showSample("eth")}>
            SAMPLE ETH
          </Button>
          <span className="mx-1 hidden h-5 w-px bg-border sm:inline" />
          <Button type="button" size="icon" variant="outline" aria-label="Previous candle" onClick={() => { setPlaying(false); setIndex((value) => Math.max(0, value - 1)) }}>
            <ChevronLeft />
          </Button>
          <Button type="button" size="sm" variant="outline" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button type="button" size="icon" variant="outline" aria-label="Next candle" onClick={() => { setPlaying(false); setIndex((value) => Math.min(packets.length - 1, value + 1)) }}>
            <ChevronRight />
          </Button>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Closed candle</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, packets.length - 1)}
              value={cursor}
              aria-label="Closed candle"
              onChange={(event) => {
                setPlaying(false)
                setIndex(Number(event.target.value))
              }}
              className="w-full accent-foreground"
            />
          </label>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="bar-label">
            Closed bar {cursor + 1} / {packets.length} · {packet.time}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Jump label="Long setup" index={eventIndex(packets, "LONG_SETUP")} onJump={(value) => { setPlaying(false); setIndex(value) }} />
          <Jump label="Short setup" index={eventIndex(packets, "SHORT_SETUP")} onJump={(value) => { setPlaying(false); setIndex(value) }} />
          <Jump label="High volatility" index={lastHighVol(packets)} lead={0} onJump={(value) => { setPlaying(false); setIndex(value) }} />
          <span className="mx-1 hidden h-5 w-px bg-border sm:inline" />
          <label className="flex items-center gap-2 text-xs">
            <Switch
              checked={liveOn}
              disabled={liveLoading}
              onCheckedChange={(checked) => void enableLive(liveAsset, checked === true)}
              aria-label="Live public candles"
            />
            Live public 1h
          </label>
          <Button type="button" size="sm" variant={liveAsset === "BTC" ? "secondary" : "ghost"} disabled={!liveOn && !liveLoading} onClick={() => void enableLive("BTC", true)}>
            BTC
          </Button>
          <Button type="button" size="sm" variant={liveAsset === "ETH" ? "secondary" : "ghost"} disabled={!liveOn && !liveLoading} onClick={() => void enableLive("ETH", true)}>
            ETH
          </Button>
          {llmAvailable ? (
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={rewrite} onCheckedChange={(checked) => setRewrite(checked === true)} aria-label="Server rewrite" />
              Server rewrite
            </label>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground" data-testid="feed-detail">
          {model.detail}
          {liveLoading ? " Loading public candles…" : ""}
          {liveError ? ` ${liveError}` : ""}
        </p>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <Card>
            <CardHeader>
              <CardTitle>
                {model.symbol} · {packet.timeframe}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Candles up to the selected close. Later bars stay hidden so the packet cannot repaint.
              </p>
            </CardHeader>
            <CardContent>
              <CandleChart key={model.symbol} bars={shownBars} markers={markers} levels={levels} />
            </CardContent>
          </Card>
          <VerdictPanel packet={packet} verdict={verdict} note={shownNote} />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]">
          <PacketPanel packet={packet} disclosures={disclosuresFor(packet, model.source)} />
          <WebhookPanel />
        </div>
      </main>

      <footer className="border-t">
        <p className="mx-auto max-w-[1440px] px-4 py-4 text-xs leading-relaxed text-muted-foreground">
          Independent paper-research demo. Not financial advice. No orders are placed. Not affiliated with the
          upstream project or TradingView. Scoring and the sample alert follow AI Agent Lens /
          tradingview-indicator-for-ai-agents, MIT.{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/roan-maverick/tradingview-indicator-for-ai-agents"
          >
            github.com/roan-maverick/tradingview-indicator-for-ai-agents
          </a>
          . Figures are not performance. Candles are drawn with{" "}
          <a className="underline underline-offset-2" href="https://www.tradingview.com/">
            TradingView Lightweight Charts
          </a>{" "}
          (TradingView, Inc.).
        </p>
      </footer>
    </div>
  )
}

function Jump({
  label,
  index,
  lead = 3,
  onJump,
}: {
  label: string
  index: number
  lead?: number
  onJump: (index: number) => void
}) {
  return (
    <Button type="button" size="sm" variant="outline" disabled={index < 0} onClick={() => onJump(Math.max(0, index - lead))}>
      {label}
    </Button>
  )
}

function startIndex(packets: Packet[]): number {
  const setup = packets.findIndex((packet) => packet.event === "LONG_SETUP")
  if (setup < 0) return Math.max(0, packets.length - 1)
  return Math.max(0, setup - 4)
}

function eventIndex(packets: Packet[], event: Packet["event"]): number {
  return packets.findIndex((packet) => packet.event === event)
}

function lastHighVol(packets: Packet[]): number {
  let last = -1
  for (let i = 0; i < packets.length; i++) {
    if (packets[i]?.regime === "HIGH_VOLATILITY") last = i
  }
  if (last < 0) return -1
  let start = last
  while (start > 0 && packets[start - 1]?.regime === "HIGH_VOLATILITY") start -= 1
  return start
}

function markersUntil(packets: Packet[], bars: Bar[], cursor: number): ChartMarker[] {
  const markers: ChartMarker[] = []
  for (let i = 0; i <= cursor; i++) {
    const packet = packets[i]
    const bar = bars[i]
    if (!packet || !bar) continue
    if (packet.event === "LONG_SETUP") {
      markers.push({ time: bar.time, position: "belowBar", shape: "arrowUp", color: "#1f7a45", text: "LONG" })
    } else if (packet.event === "SHORT_SETUP") {
      markers.push({ time: bar.time, position: "aboveBar", shape: "arrowDown", color: "#b42318", text: "SHORT" })
    }
  }
  return markers
}

function priceLevels(verdict: Verdict): PriceLevel[] {
  if (verdict.decision === "WAIT") return []
  const levels: PriceLevel[] = []
  if (verdict.entry != null) levels.push({ price: verdict.entry, title: "Entry", color: "#18181b" })
  if (verdict.stop != null) levels.push({ price: verdict.stop, title: "Stop", color: "#b42318" })
  if (verdict.target1 != null) levels.push({ price: verdict.target1, title: "TP1", color: "#1f7a45", dashed: true })
  if (verdict.target2 != null) levels.push({ price: verdict.target2, title: "TP2", color: "#1f7a45" })
  return levels
}
