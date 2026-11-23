import { Download, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  buildCampaign,
  parseBannedList,
  parseCampaignText,
  parseHashtagList,
  parseLooseNumber,
  parseMentionList,
  parseStreamerList,
  PLATFORMS,
  rankCampaigns,
  SAMPLE_PASTE,
  type Campaign,
  type CampaignDraft,
  type Platform,
} from '../domain/campaigns.ts'
import { evaluateChecklist, PLATFORM_SPECS } from '../domain/checklist.ts'
import type { DeskAction, DeskState } from '../domain/desk.ts'
import type { HookTemplate } from '../domain/hooks.ts'
import { blankJob, selectedCampaign } from '../domain/jobs-state.ts'
import { formatMoney, payoutForViews, payoutForWeek, payoutReasonLabel } from '../domain/payout.ts'
import { createId } from '../domain/queue.ts'
import type { QueueItem } from '../domain/queue.ts'
import {
  buildFridayTitles,
  buildNightlyReport,
  latestViews,
  trackerExportRows,
  trackerToCsv,
  trackerToJson,
  type TrackedClip,
} from '../domain/tracker.ts'
import { downloadText } from '../lib/download.ts'
import { Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Textarea } from './ui/textarea.tsx'

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const FRAME_PRESETS = [
  { width: 1080, height: 1920, label: '1080×1920 · 9:16' },
  { width: 720, height: 1280, label: '720×1280 · 9:16' },
  { width: 1920, height: 1080, label: '1920×1080 · 16:9' },
  { width: 1080, height: 1080, label: '1080×1080 · 1:1' },
] as const

type FormState = {
  name: string
  payPer1k: string
  budgetLeft: string
  minimumViews: string
  platforms: Platform[]
  streamers: string
  hashtags: string
  mentions: string
  minLengthSec: string
  maxLengthSec: string
  banned: string
}

type JobsSectionProps = {
  state: DeskState
  dispatch: (action: DeskAction) => void
}

function emptyForm(): FormState {
  return {
    name: '',
    payPer1k: '',
    budgetLeft: '',
    minimumViews: '',
    platforms: [],
    streamers: '',
    hashtags: '',
    mentions: '',
    minLengthSec: '3',
    maxLengthSec: '60',
    banned: '',
  }
}

function formFromDraft(draft: CampaignDraft): FormState {
  return {
    name: draft.name,
    payPer1k: String(draft.payPer1k),
    budgetLeft: String(draft.budgetLeft),
    minimumViews: String(draft.minimumViews),
    platforms: [...draft.platforms],
    streamers: draft.streamers.join(', '),
    hashtags: draft.requiredHashtags.join(' '),
    mentions: draft.requiredMentions.join(' '),
    minLengthSec: String(draft.minLengthSec),
    maxLengthSec: String(draft.maxLengthSec),
    banned: draft.bannedContent.join(', '),
  }
}

function fieldsToDraft(form: FormState): CampaignDraft {
  return {
    name: form.name,
    payPer1k: parseLooseNumber(form.payPer1k) ?? Number.NaN,
    budgetLeft: parseLooseNumber(form.budgetLeft) ?? 0,
    minimumViews: parseLooseNumber(form.minimumViews) ?? 0,
    platforms: form.platforms,
    streamers: parseStreamerList(form.streamers),
    requiredHashtags: parseHashtagList(form.hashtags),
    requiredMentions: parseMentionList(form.mentions),
    minLengthSec: parseLooseNumber(form.minLengthSec) ?? Number.NaN,
    maxLengthSec: parseLooseNumber(form.maxLengthSec) ?? Number.NaN,
    bannedContent: parseBannedList(form.banned),
  }
}

function trackedClip(item: QueueItem, state: DeskState): TrackedClip {
  const record = state.jobs.records[item.id] ?? blankJob()
  return {
    id: item.id,
    title: item.title,
    platform: record.platform,
    hook: item.hook,
    account: record.account,
    postedOn: record.postedOn,
    day1Views: record.day1Views,
    day3Views: record.day3Views,
  }
}

export function JobsSection({ state, dispatch }: JobsSectionProps) {
  const [paste, setPaste] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [parseError, setParseError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [calculatorViews, setCalculatorViews] = useState('2500')
  const [nightlyOn, setNightlyOn] = useState(false)
  const [fridayOn, setFridayOn] = useState(false)
  const [csvPreview, setCsvPreview] = useState<string | null>(null)
  const ranked = rankCampaigns(state.jobs.campaigns)
  const campaign = selectedCampaign(state.jobs)
  const item = state.queue.find((entry) => entry.id === state.selectedQueueId) ?? state.queue[0] ?? null
  const record = item ? (state.jobs.records[item.id] ?? blankJob()) : null
  const today = new Date().toISOString().slice(0, 10)
  const tracked = state.queue.map((entry) => trackedClip(entry, state))
  const rates = campaign
    ? { payPer1k: campaign.payPer1k, budgetLeft: campaign.budgetLeft, minimumViews: campaign.minimumViews }
    : null
  const week = rates
    ? payoutForWeek(
        tracked.flatMap((clip) => {
          const views = latestViews(clip)
          return views === null ? [] : [{ id: clip.id, views }]
        }),
        rates,
      )
    : null
  const paidById = new Map(week?.lines.map((line) => [line.id, line]) ?? [])
  const calculator = rates
    ? payoutForViews({
        views: parseLooseNumber(calculatorViews) ?? 0,
        ...rates,
      })
    : null
  const evaluation =
    item && record && campaign
      ? evaluateChecklist(
          {
            id: item.id,
            clipId: item.clipId,
            trimIn: item.trimIn,
            trimOut: item.trimOut,
            caption: item.caption,
            hook: item.hook,
            hashtags: item.hashtags,
            platform: record.platform,
            account: record.account,
            streamer: record.streamer,
            width: record.width,
            height: record.height,
            contentPolicyReviewed: record.contentPolicyReviewed,
          },
          campaign,
          state.queue.map((entry) => ({
            id: entry.id,
            clipId: entry.clipId,
            account: state.jobs.records[entry.id]?.account ?? '',
          })),
        )
      : null
  const nightly =
    nightlyOn && campaign && rates
      ? buildNightlyReport({
          reportDate: today,
          campaignName: campaign.name,
          clips: tracked,
          rates,
        })
      : null
  const friday = fridayOn
    ? buildFridayTitles({
        reportDate: today,
        clips: tracked.map((clip) => ({ title: clip.title, hook: clip.hook, views: latestViews(clip) })),
      })
    : null

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function togglePlatform(platform: Platform) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }))
  }

  function parsePaste() {
    const result = parseCampaignText(paste)
    if (!result.ok) {
      setParseError(result.error)
      setWarnings([])
      return
    }
    setParseError(null)
    setWarnings(result.warnings)
    setForm(formFromDraft(result.draft))
  }

  function addFromForm() {
    const built = buildCampaign(
      fieldsToDraft(form),
      state.jobs.campaigns.map((entry) => entry.id),
    )
    if (!built.ok) {
      setParseError(built.error)
      return
    }
    setParseError(null)
    dispatch({ type: 'addCampaign', campaign: built.campaign })
  }

  function exportTracker(kind: 'csv' | 'json') {
    if (!rates) return
    const rows = trackerExportRows(tracked, rates)
    if (kind === 'csv') {
      const csv = trackerToCsv(rows)
      setCsvPreview(csv)
      downloadText('clip-desk-views.csv', csv, 'text/csv')
      dispatch({ type: 'setNotice', notice: 'Downloaded simulated tracker CSV. Nothing was posted.' })
      return
    }
    downloadText('clip-desk-views.json', trackerToJson(rows), 'application/json')
    dispatch({ type: 'setNotice', notice: 'Downloaded simulated tracker JSON. Nothing was posted.' })
  }

  return (
    <section id="clipping-jobs" data-testid="jobs-section" className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Sample · Simulated</p>
        <h2 className="text-xl font-medium tracking-tight">Clipping jobs</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Pick a bundled sample campaign or paste rules into the form. Streamer names are invented. Pay, budgets,
          views, and earnings stay on this machine and are simulated. Nothing is posted and nothing is paid out.
        </p>
      </div>
      <div data-testid="jobs-top" className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card data-testid="campaign-scoreboard">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Campaign scoreboard</CardTitle>
                <Badge variant="secondary">Sample</Badge>
              </div>
              <CardDescription>
                Ranked by pay per 1K, then budget left. Allowed streamers are listed on every card.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {ranked.map((entry, index) => (
                <CampaignCard
                  key={entry.id}
                  campaign={entry}
                  rank={index + 1}
                  selected={entry.id === state.jobs.selectedCampaignId}
                  onSelect={() => dispatch({ type: 'selectCampaign', campaignId: entry.id })}
                />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Add sample rules</CardTitle>
              <CardDescription>
                Paste a loose template or fill the fields. Added campaigns stay labeled Sample.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label className="flex-col items-stretch gap-1.5">
                Pasted rules
                <Textarea
                  data-testid="campaign-paste"
                  value={paste}
                  rows={5}
                  placeholder="Campaign: Sample: Glasswater Run"
                  onChange={(event) => setPaste(event.target.value)}
                />
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" data-testid="load-sample-paste" onClick={() => setPaste(SAMPLE_PASTE)}>
                  Load sample paste
                </Button>
                <Button type="button" data-testid="parse-rules" onClick={parsePaste}>
                  Parse into the form
                </Button>
              </div>
              {parseError ? (
                <p data-testid="parse-error" className="text-sm text-destructive">
                  {parseError}
                </p>
              ) : null}
              {warnings.length > 0 ? (
                <ul data-testid="parse-warnings" className="list-disc pl-4 text-xs text-muted-foreground">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
                  Campaign name
                  <Input data-testid="campaign-name" value={form.name} onChange={(event) => patchForm({ name: event.target.value })} />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Pay per 1K
                  <Input data-testid="campaign-pay" value={form.payPer1k} inputMode="decimal" onChange={(event) => patchForm({ payPer1k: event.target.value })} />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Budget left
                  <Input data-testid="campaign-budget" value={form.budgetLeft} inputMode="decimal" onChange={(event) => patchForm({ budgetLeft: event.target.value })} />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Minimum views
                  <Input data-testid="campaign-min-views" value={form.minimumViews} inputMode="numeric" onChange={(event) => patchForm({ minimumViews: event.target.value })} />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Clip length min (s)
                  <Input data-testid="campaign-length-min" value={form.minLengthSec} inputMode="decimal" onChange={(event) => patchForm({ minLengthSec: event.target.value })} />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Clip length max (s)
                  <Input data-testid="campaign-length-max" value={form.maxLengthSec} inputMode="decimal" onChange={(event) => patchForm({ maxLengthSec: event.target.value })} />
                </Label>
              </div>
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-1 text-sm font-medium">Allowed platforms</legend>
                {PLATFORMS.map((platform) => (
                  <label key={platform} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      data-testid={`form-platform-${platform}`}
                      checked={form.platforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                    />
                    {platform}
                  </label>
                ))}
              </fieldset>
              <Label className="flex-col items-stretch gap-1.5">
                Allowed streamers
                <Input data-testid="campaign-streamers" value={form.streamers} onChange={(event) => patchForm({ streamers: event.target.value })} />
              </Label>
              <Label className="flex-col items-stretch gap-1.5">
                Required hashtags
                <Input data-testid="campaign-hashtags" value={form.hashtags} onChange={(event) => patchForm({ hashtags: event.target.value })} />
              </Label>
              <Label className="flex-col items-stretch gap-1.5">
                Required mentions
                <Input data-testid="campaign-mentions" value={form.mentions} onChange={(event) => patchForm({ mentions: event.target.value })} />
              </Label>
              <Label className="flex-col items-stretch gap-1.5">
                Banned content
                <Input data-testid="campaign-banned" value={form.banned} onChange={(event) => patchForm({ banned: event.target.value })} />
              </Label>
              <Button type="button" data-testid="add-campaign" onClick={addFromForm}>
                <Plus />
                Add sample campaign
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card data-testid="rule-checklist">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Rule checklist</CardTitle>
                <Badge variant={record?.ready ? 'default' : 'outline'} data-testid="ready-state">
                  {record?.ready ? 'Ready' : 'Not ready'}
                </Badge>
              </div>
              <CardDescription>
                {campaign
                  ? `${campaign.name} · ${campaign.minLengthSec}–${campaign.maxLengthSec}s · banned: ${campaign.bannedContent.join(', ') || 'none listed'}`
                  : 'Pick a sample campaign to score the queued clip.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {item && record && campaign && evaluation ? (
                <>
                  <Label className="flex-col items-stretch gap-1.5">
                    Queued clip
                    <select
                      className={selectClass}
                      data-testid="checklist-clip"
                      value={item.id}
                      onChange={(event) => dispatch({ type: 'selectQueueItem', itemId: event.target.value })}
                    >
                      {state.queue.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.title}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Label className="flex-col items-stretch gap-1.5">
                      Platform
                      <select
                        className={selectClass}
                        data-testid="job-platform"
                        value={record.platform}
                        onChange={(event) =>
                          dispatch({
                            type: 'setJob',
                            itemId: item.id,
                            patch: { platform: event.target.value as Platform | '' },
                          })
                        }
                      >
                        <option value="">Choose</option>
                        {PLATFORMS.map((platform) => (
                          <option key={platform} value={platform}>
                            {platform}
                            {campaign.platforms.includes(platform) ? '' : ' (not allowed)'}
                          </option>
                        ))}
                      </select>
                    </Label>
                    <Label className="flex-col items-stretch gap-1.5">
                      Frame
                      <select
                        className={selectClass}
                        data-testid="job-frame"
                        value={`${record.width}x${record.height}`}
                        onChange={(event) => {
                          const preset = FRAME_PRESETS.find((frame) => `${frame.width}x${frame.height}` === event.target.value)
                          if (!preset) return
                          dispatch({
                            type: 'setJob',
                            itemId: item.id,
                            patch: { width: preset.width, height: preset.height },
                          })
                        }}
                      >
                        {FRAME_PRESETS.map((frame) => (
                          <option key={frame.label} value={`${frame.width}x${frame.height}`}>
                            {frame.label}
                          </option>
                        ))}
                      </select>
                    </Label>
                    <Label className="flex-col items-stretch gap-1.5">
                      Account
                      <Input
                        data-testid="job-account"
                        value={record.account}
                        onChange={(event) =>
                          dispatch({ type: 'setJob', itemId: item.id, patch: { account: event.target.value } })
                        }
                      />
                    </Label>
                    <Label className="flex-col items-stretch gap-1.5">
                      Streamer
                      <select
                        className={selectClass}
                        data-testid="job-streamer"
                        value={record.streamer}
                        onChange={(event) =>
                          dispatch({ type: 'setJob', itemId: item.id, patch: { streamer: event.target.value } })
                        }
                      >
                        <option value="">Choose a streamer</option>
                        {campaign.streamers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                        {record.streamer &&
                        !campaign.streamers.some((name) => name.toLowerCase() === record.streamer.toLowerCase()) ? (
                          <option value={record.streamer}>{record.streamer}</option>
                        ) : null}
                      </select>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Platform specs: TikTok {PLATFORM_SPECS.TikTok.minSec}–{PLATFORM_SPECS.TikTok.maxSec}s, Reels{' '}
                    {PLATFORM_SPECS.Reels.minSec}–{PLATFORM_SPECS.Reels.maxSec}s, Shorts {PLATFORM_SPECS.Shorts.minSec}–
                    {PLATFORM_SPECS.Shorts.maxSec}s, X {PLATFORM_SPECS.X.minSec}–{PLATFORM_SPECS.X.maxSec}s. All 1080×1920.
                  </p>
                  <Label className="flex-col items-stretch gap-1.5">
                    Queued caption
                    <Textarea
                      data-testid="job-caption"
                      rows={3}
                      value={item.caption}
                      onChange={(event) =>
                        dispatch({ type: 'patchQueueItem', itemId: item.id, patch: { caption: event.target.value } })
                      }
                    />
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="add-missing-tags"
                      onClick={() => dispatch({ type: 'insertRequiredTags', itemId: item.id })}
                    >
                      Add missing tags
                    </Button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {evaluation.checks.map((check) => (
                      <li
                        key={check.id}
                        data-testid={`check-${check.id}`}
                        data-pass={check.pass ? 'true' : 'false'}
                        className="rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{check.label}</span>
                          <Badge variant={check.pass ? 'secondary' : 'destructive'}>{check.pass ? 'Pass' : 'Fail'}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4"
                      data-testid="policy-reviewed"
                      checked={record.contentPolicyReviewed}
                      onChange={(event) =>
                        dispatch({
                          type: 'setJob',
                          itemId: item.id,
                          patch: { contentPolicyReviewed: event.target.checked },
                        })
                      }
                    />
                    <span>Content policy reviewed. I checked this sample against the banned list myself.</span>
                  </label>
                  <Button
                    type="button"
                    data-testid="mark-ready"
                    disabled={!evaluation.readyAllowed || record.ready}
                    onClick={() => dispatch({ type: 'markReady', itemId: item.id })}
                  >
                    {record.ready ? 'Ready' : 'Mark clip ready'}
                  </Button>
                  {record.ready ? (
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="clear-ready"
                      onClick={() => dispatch({ type: 'clearReady', itemId: item.id })}
                    >
                      Clear ready
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Add a clip to the week, then pick a sample campaign.</p>
              )}
            </CardContent>
          </Card>
          <Card data-testid="payout-calculator">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Payout calculator</CardTitle>
                <Badge data-testid="payout-simulated">Simulated</Badge>
              </div>
              <CardDescription>
                Views times pay per 1K, blocked under the minimum, then capped by budget left. Not a payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Label className="flex-col items-stretch gap-1.5">
                Views on this clip
                <Input
                  data-testid="payout-views"
                  inputMode="numeric"
                  value={calculatorViews}
                  onChange={(event) => setCalculatorViews(event.target.value)}
                />
              </Label>
              {calculator && campaign ? (
                <div data-testid="payout-clip">
                  <p className="font-medium tabular-nums">
                    Simulated payout {formatMoney(calculator.paid)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rate {formatMoney(campaign.payPer1k)} per 1K · raw {formatMoney(calculator.raw)} ·{' '}
                    {payoutReasonLabel(calculator.reason, campaign.minimumViews)}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Pick a sample campaign to calculate.</p>
              )}
              <div data-testid="payout-week">
                <p className="font-medium tabular-nums">
                  Week total {formatMoney(week?.total ?? 0)} Simulated
                </p>
                <p className="text-xs text-muted-foreground">
                  {week && week.lines.length > 0
                    ? 'Shared sample budget, in queue order, using the latest day-1 or day-3 views.'
                    : 'No tracker views yet. Simulate or enter day-1 and day-3 views for a week total.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card data-testid="hook-bank">
        <CardHeader>
          <CardTitle>Hook bank</CardTitle>
          <CardDescription>
            These templates feed Generate mock captions. {'{title}'} is replaced with the clip title. No key required.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {state.jobs.hooks.map((hook) => (
            <div key={hook.id} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
              <Input
                aria-label={`${hook.label} name`}
                value={hook.label}
                onChange={(event) => updateHook(state.jobs.hooks, hook.id, { label: event.target.value }, dispatch)}
              />
              <Input
                data-testid={`hook-pattern-${hook.id}`}
                aria-label={`${hook.label} template`}
                value={hook.pattern}
                onChange={(event) => updateHook(state.jobs.hooks, hook.id, { pattern: event.target.value }, dispatch)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Remove ${hook.label}`}
                disabled={state.jobs.hooks.length <= 1}
                onClick={() =>
                  dispatch({ type: 'setHooks', hooks: state.jobs.hooks.filter((entry) => entry.id !== hook.id) })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            data-testid="add-hook"
            onClick={() =>
              dispatch({
                type: 'setHooks',
                hooks: [...state.jobs.hooks, { id: createId('hook'), label: 'Custom', pattern: 'Watch {title}.' }],
              })
            }
          >
            <Plus />
            Add hook
          </Button>
        </CardContent>
      </Card>
      <Card data-testid="view-tracker">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>View tracker</CardTitle>
            <Badge variant="secondary">Simulated</Badge>
          </div>
          <CardDescription>
            Day-1 and day-3 views per queued clip. Type them, or simulate with the local seeded model. Reports are
            templates. No model key.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">Clip</th>
                  <th className="py-1 pr-2 font-medium">Account</th>
                  <th className="py-1 pr-2 font-medium">Day 1</th>
                  <th className="py-1 pr-2 font-medium">Day 3</th>
                  <th className="py-1 pr-2 font-medium">Simulated paid</th>
                  <th className="py-1 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {state.queue.map((entry) => {
                  const job = state.jobs.records[entry.id] ?? blankJob()
                  const line = paidById.get(entry.id)
                  return (
                    <tr key={entry.id} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{entry.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {job.platform || 'No platform'} · {entry.hook}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          data-testid={`tracker-account-${entry.id}`}
                          value={job.account}
                          onChange={(event) =>
                            dispatch({ type: 'setJob', itemId: entry.id, patch: { account: event.target.value } })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          data-testid={`views-day1-${entry.id}`}
                          inputMode="numeric"
                          value={job.day1Views ?? ''}
                          onChange={(event) =>
                            dispatch({
                              type: 'setJob',
                              itemId: entry.id,
                              patch: { day1Views: event.target.value === '' ? null : Number(event.target.value) },
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          data-testid={`views-day3-${entry.id}`}
                          inputMode="numeric"
                          value={job.day3Views ?? ''}
                          onChange={(event) =>
                            dispatch({
                              type: 'setJob',
                              itemId: entry.id,
                              patch: { day3Views: event.target.value === '' ? null : Number(event.target.value) },
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 tabular-nums" data-testid={`tracker-paid-${entry.id}`}>
                        {line ? `${formatMoney(line.paid)} Simulated` : '—'}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`simulate-views-${entry.id}`}
                          onClick={() => dispatch({ type: 'simulateViews', itemId: entry.id })}
                        >
                          Simulate
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" data-testid="nightly-report-button" onClick={() => setNightlyOn(true)}>
              Nightly report
            </Button>
            <Button type="button" variant="outline" data-testid="friday-report-button" onClick={() => setFridayOn(true)}>
              Friday best titles
            </Button>
            <Button type="button" variant="secondary" data-testid="export-tracker-csv" onClick={() => exportTracker('csv')}>
              <Download />
              Export CSV
            </Button>
            <Button type="button" variant="secondary" data-testid="export-tracker-json" onClick={() => exportTracker('json')}>
              <Download />
              Export JSON
            </Button>
          </div>
          {nightly ? (
            <pre
              data-testid="nightly-report"
              className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap"
            >
              {nightly.text}
            </pre>
          ) : null}
          {friday ? (
            <pre
              data-testid="friday-report"
              className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap"
            >
              {friday.text}
            </pre>
          ) : null}
          {csvPreview ? (
            <pre
              data-testid="tracker-csv"
              className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap"
            >
              {csvPreview}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}

function CampaignCard({
  campaign,
  rank,
  selected,
  onSelect,
}: {
  campaign: Campaign
  rank: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-testid={`campaign-card-${campaign.id}`}
      data-selected={selected ? 'true' : 'false'}
      aria-pressed={selected}
      className={`rounded-lg border p-3 text-left ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
      onClick={onSelect}
    >
      <span className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="outline" data-testid={`campaign-rank-${campaign.id}`}>
          Rank {rank}
        </Badge>
        <Badge variant="secondary">Sample</Badge>
        <span className="text-sm font-medium">{campaign.name}</span>
      </span>
      <span className="block text-sm tabular-nums">
        {formatMoney(campaign.payPer1k)} per 1K · {formatMoney(campaign.budgetLeft)} budget left ·{' '}
        {campaign.minimumViews.toLocaleString()} minimum views
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">
        {campaign.platforms.join(', ') || 'No platforms'} · {campaign.minLengthSec}–{campaign.maxLengthSec}s ·{' '}
        {campaign.requiredHashtags.join(' ')} {campaign.requiredMentions.join(' ')}
      </span>
      <span className="mt-1 block text-sm" data-testid={`campaign-streamers-${campaign.id}`}>
        Allowed streamers: {campaign.streamers.join(', ') || 'none listed'}
      </span>
    </button>
  )
}

function updateHook(
  hooks: HookTemplate[],
  id: string,
  patch: Partial<HookTemplate>,
  dispatch: (action: DeskAction) => void,
) {
  dispatch({
    type: 'setHooks',
    hooks: hooks.map((hook) => (hook.id === id ? { ...hook, ...patch } : hook)),
  })
}
