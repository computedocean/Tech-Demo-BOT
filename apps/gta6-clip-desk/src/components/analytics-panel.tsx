import { simulateAnalytics } from '../domain/analytics.ts'
import type { ClipDraft } from '../domain/desk.ts'
import type { QueueItem } from '../domain/queue.ts'
import { slotLabel } from '../domain/queue.ts'
import { Badge } from './ui/badge.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'

type AnalyticsPanelProps = {
  draft: ClipDraft
  queued: QueueItem | null
}

export function AnalyticsPanel({ draft, queued }: AnalyticsPanelProps) {
  const openCut = simulateAnalytics({
    title: draft.title,
    slot: 'open-cut',
    trimIn: draft.trimIn,
    trimOut: draft.trimOut,
  })
  const queuedStats = queued
    ? simulateAnalytics({
        title: queued.title,
        slot: queued.slot,
        trimIn: queued.trimIn,
        trimOut: queued.trimOut,
      })
    : null

  return (
    <Card data-testid="analytics-panel" data-simulated="true">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Analytics</CardTitle>
          <Badge data-testid="simulated-badge">Simulated</Badge>
        </div>
        <CardDescription>
          Simulated fixtures from a local dummy model. Not platform measurements, not a forecast, and not a payout.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <StatBlock label="Open cut" stats={openCut} />
        {queued && queuedStats ? (
          <StatBlock label={`Queue · ${slotLabel(queued.slot)} · ${queued.title}`} stats={queuedStats} />
        ) : null}
        <details className="text-xs leading-relaxed text-muted-foreground">
          <summary className="cursor-pointer">How the dummy model works</summary>
          <p className="mt-1">{openCut.model}</p>
        </details>
      </CardContent>
    </Card>
  )
}

function StatBlock({
  label,
  stats,
}: {
  label: string
  stats: { views: number; watchTimeSec: number; completionRate: number; label: 'Simulated' }
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        {label} · {stats.label}
      </p>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Views</dt>
          <dd className="font-medium tabular-nums">{stats.views.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Watch time</dt>
          <dd className="font-medium tabular-nums">{stats.watchTimeSec.toLocaleString()}s</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Completion</dt>
          <dd className="font-medium tabular-nums">{Math.round(stats.completionRate * 100)}%</dd>
        </div>
      </dl>
    </div>
  )
}
