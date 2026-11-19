import { Badge } from "@/components/ui/badge.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx"
import { FACTOR_KEYS, type Packet, type Verdict } from "@/lib/types.ts"

type VerdictPanelProps = {
  packet: Packet
  verdict: Verdict
  note: string
}

export function VerdictPanel({ packet, verdict, note }: VerdictPanelProps) {
  const tone =
    verdict.decision === "LONG"
      ? "bg-emerald-700 text-white"
      : verdict.decision === "SHORT"
        ? "bg-red-700 text-white"
        : "bg-muted text-foreground"
  const factors = verdict.decision === "SHORT" ? packet.scores.short_factors : packet.scores.long_factors

  return (
    <Card data-testid="verdict-panel" className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Verdict</CardTitle>
          <Badge variant="outline">Mock rules</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className={`rounded-lg px-3 py-4 text-center text-4xl font-medium tracking-tight ${tone}`} data-testid="verdict-decision">
          {verdict.decision}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Long" value={String(packet.scores.long)} testId="score-long" />
          <Stat label="Short" value={String(packet.scores.short)} testId="score-short" />
          <Stat label="Threshold" value={String(packet.scores.threshold)} />
        </dl>
        <div className="grid grid-cols-5 gap-1">
          {FACTOR_KEYS.map((key) => (
            <div key={key} className="rounded-md bg-muted px-1 py-1.5 text-center">
              <div className="text-[10px] tracking-wide text-muted-foreground uppercase">{key}</div>
              <div className="text-sm font-medium">{factors[key]}</div>
            </div>
          ))}
        </div>
        <dl className="grid gap-2 text-sm">
          <Level label="Entry" value={verdict.entry} testId="verdict-entry" />
          <Level label="Stop" value={verdict.stop} testId="verdict-stop" />
          <Level label="Take-profit 1 · 1.5R" value={verdict.target1} testId="verdict-tp1" />
          <Level label="Take-profit 2 · 3R" value={verdict.target2} testId="verdict-tp2" />
        </dl>
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm leading-relaxed" data-testid="verdict-risk">
          {verdict.failureRisk}
        </p>
        <p className="text-xs text-muted-foreground">
          {packet.regime.replaceAll("_", " ")} · {packet.event.replaceAll("_", " ")} · {packet.trade.side}:
          {packet.trade.status}
        </p>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-md border px-2 py-1.5" data-testid={testId}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function Level({ label, value, testId }: { label: string; value: number | null; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b pb-1" data-testid={testId}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value == null ? "—" : formatPrice(value)}</dd>
    </div>
  )
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
