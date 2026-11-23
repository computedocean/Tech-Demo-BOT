import { hashString } from './analytics.ts'
import { formatMoney, payoutForWeek, type PayoutRates } from './payout.ts'

export const TRACKER_CSV_COLUMNS = ['date', 'clip', 'platform', 'hook', 'views', 'paid'] as const

export const VIEW_MODEL =
  'Deterministic local model: day1 = 400 + hash(clip|account|platform|hook) % 8600; day3 = round(day1 * (1.15 + ((hash >>> 8) % 80) / 100)). Simulated sample counts. Not a measurement and not a forecast.'

export type TrackedClip = {
  id: string
  title: string
  platform: string
  hook: string
  account: string
  postedOn: string
  day1Views: number | null
  day3Views: number | null
}

export type TrackerCsvRow = {
  date: string
  clip: string
  platform: string
  hook: string
  views: number
  paid: number
}

export type NightlyReport = {
  simulated: true
  label: 'Simulated'
  reportDate: string
  campaignName: string
  clipsPosted: number
  top3: { clip: string; hook: string; views: number }[]
  totalViews: number
  simulatedEarnings: number
  whatToChange: string[]
  text: string
}

export type FridayReport = {
  simulated: true
  label: 'Simulated'
  reportDate: string
  isFriday: boolean
  titles: { title: string; hook: string; views: number }[]
  text: string
}

export function viewSeed(input: { clipId: string; account: string; platform: string; hook: string }): string {
  return [input.clipId, input.account.trim().toLowerCase(), input.platform, input.hook].join('|')
}

export function simulateCheckpointViews(seed: string): {
  day1: number
  day3: number
  simulated: true
  label: 'Simulated'
  model: string
} {
  const hash = hashString(seed)
  const day1 = 400 + (hash % 8600)
  const growth = 1.15 + ((hash >>> 8) % 80) / 100
  const day3 = Math.round(day1 * growth)
  return { day1, day3, simulated: true, label: 'Simulated', model: VIEW_MODEL }
}

export function latestViews(clip: { day1Views: number | null; day3Views: number | null }): number | null {
  if (clip.day3Views !== null && Number.isFinite(clip.day3Views)) return Math.max(0, clip.day3Views)
  if (clip.day1Views !== null && Number.isFinite(clip.day1Views)) return Math.max(0, clip.day1Views)
  return null
}

export function addIsoDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isFridayDate(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.getUTCDay() === 5
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function trackerExportRows(clips: readonly TrackedClip[], rates: PayoutRates): TrackerCsvRow[] {
  const tracked = clips.flatMap((clip) => {
    const views = latestViews(clip)
    return views === null ? [] : [{ id: clip.id, views }]
  })
  const week = payoutForWeek(tracked, rates)
  const paidById = new Map(week.lines.map((line) => [line.id, line.paid]))
  const rows: TrackerCsvRow[] = []
  for (const clip of clips) {
    const latestCheckpoint = clip.day3Views !== null ? '3d' : clip.day1Views !== null ? '1d' : null
    const paid = paidById.get(clip.id) ?? 0
    if (clip.day1Views !== null && Number.isFinite(clip.day1Views)) {
      rows.push({
        date: addIsoDays(clip.postedOn, 1),
        clip: clip.title,
        platform: clip.platform || 'unset',
        hook: clip.hook,
        views: Math.max(0, clip.day1Views),
        paid: latestCheckpoint === '1d' ? paid : 0,
      })
    }
    if (clip.day3Views !== null && Number.isFinite(clip.day3Views)) {
      rows.push({
        date: addIsoDays(clip.postedOn, 3),
        clip: clip.title,
        platform: clip.platform || 'unset',
        hook: clip.hook,
        views: Math.max(0, clip.day3Views),
        paid: latestCheckpoint === '3d' ? paid : 0,
      })
    }
  }
  return rows
}

export function trackerToCsv(rows: readonly TrackerCsvRow[]): string {
  const header = TRACKER_CSV_COLUMNS.join(',')
  const lines = rows.map((row) =>
    [csvCell(row.date), csvCell(row.clip), csvCell(row.platform), csvCell(row.hook), csvCell(row.views), csvCell(row.paid)].join(
      ',',
    ),
  )
  return [header, ...lines].join('\n') + '\n'
}

export function trackerToJson(rows: readonly TrackerCsvRow[]): string {
  const payload = rows.map((row) => ({
    date: row.date,
    clip: row.clip,
    platform: row.platform,
    hook: row.hook,
    views: row.views,
    paid: row.paid,
  }))
  return `${JSON.stringify(payload, null, 2)}\n`
}

function rankedClips(clips: readonly TrackedClip[]): { clip: TrackedClip; views: number }[] {
  return clips
    .flatMap((clip) => {
      const views = latestViews(clip)
      return views === null ? [] : [{ clip, views }]
    })
    .sort((a, b) => b.views - a.views || a.clip.title.localeCompare(b.clip.title))
}

export function buildNightlyReport(input: {
  reportDate: string
  campaignName: string
  clips: readonly TrackedClip[]
  rates: PayoutRates
}): NightlyReport {
  const ranked = rankedClips(input.clips)
  const top3 = ranked.slice(0, 3).map((entry) => ({
    clip: entry.clip.title,
    hook: entry.clip.hook,
    views: entry.views,
  }))
  const totalViews = ranked.reduce((sum, entry) => sum + entry.views, 0)
  const week = payoutForWeek(
    ranked.map((entry) => ({ id: entry.clip.id, views: entry.views })),
    input.rates,
  )
  const whatToChange: string[] = []
  for (const entry of ranked) {
    if (entry.views < input.rates.minimumViews) {
      whatToChange.push(
        `Swap the hook on "${entry.clip.title}" before the next sample post. Its tracked views are under the ${Math.round(input.rates.minimumViews)} minimum.`,
      )
    }
  }
  if (top3[0]) {
    whatToChange.push(`Keep the hook "${top3[0].hook}" in the bank. It leads this simulated tracker.`)
  }
  const totals = new Map<string, { views: number; count: number }>()
  for (const entry of ranked) {
    const platform = entry.clip.platform || 'unset'
    const current = totals.get(platform) ?? { views: 0, count: 0 }
    current.views += entry.views
    current.count += 1
    totals.set(platform, current)
  }
  if (totals.size >= 2) {
    const worst = [...totals.entries()].sort((a, b) => a[1].views / a[1].count - b[1].views / b[1].count)[0]
    if (worst) {
      whatToChange.push(`Move one planned slot off ${worst[0]}. Its simulated average trails the other platforms.`)
    }
  }
  const untracked = input.clips.filter((clip) => latestViews(clip) === null)
  if (untracked.length > 0) {
    const names = untracked.map((clip) => `"${clip.title}"`).join(', ')
    whatToChange.push(`Enter or simulate day-1 and day-3 views for ${names} so the next nightly report can rank them.`)
  }
  if (whatToChange.length === 0) {
    whatToChange.push('Hold the slate. The simulated tracker has no clip under the view minimum.')
  }
  whatToChange.push(
    'These notes come from tracker templates. No model key is used, nothing was posted, and the earnings figure is simulated.',
  )
  const topLines =
    top3.length > 0
      ? top3.map((entry, index) => `${index + 1}. ${entry.clip} — ${entry.views} views — ${entry.hook}`).join('\n')
      : 'None yet. Simulate or enter day-1 and day-3 views.'
  const text = [
    'Nightly report (Simulated)',
    `Date: ${input.reportDate}`,
    `Campaign: ${input.campaignName} (Sample)`,
    `Clips posted: ${ranked.length}`,
    'Top 3 clips:',
    topLines,
    `Total views: ${totalViews}`,
    `Simulated earnings: ${formatMoney(week.total)}`,
    'What to change:',
    ...whatToChange.map((note) => `- ${note}`),
  ].join('\n')
  return {
    simulated: true,
    label: 'Simulated',
    reportDate: input.reportDate,
    campaignName: input.campaignName,
    clipsPosted: ranked.length,
    top3,
    totalViews,
    simulatedEarnings: week.total,
    whatToChange,
    text,
  }
}

export function buildFridayTitles(input: {
  reportDate: string
  clips: readonly { title: string; hook: string; views: number | null }[]
}): FridayReport {
  const friday = isFridayDate(input.reportDate)
  const titles = input.clips
    .flatMap((clip) => (clip.views === null || !Number.isFinite(clip.views) ? [] : [{ title: clip.title, hook: clip.hook, views: Math.max(0, clip.views) }]))
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title))
    .slice(0, 5)
  const heading = friday ? 'Friday best titles (Simulated)' : 'Friday best titles preview (Simulated)'
  const intro = friday
    ? 'Ranked from tracker views for this Friday. Titles are sample copy, not a reach promise.'
    : 'This summary is meant for Friday. It still ranks the current tracker. Simulated only.'
  const lines =
    titles.length > 0
      ? titles.map((entry, index) => `${index + 1}. ${entry.title} — ${entry.hook} — ${entry.views} views`).join('\n')
      : 'No tracked titles yet. Simulate or enter views before reading the Friday list.'
  const text = [heading, `Date: ${input.reportDate}`, intro, lines, 'Simulated. Nothing was posted.'].join('\n')
  return { simulated: true, label: 'Simulated', reportDate: input.reportDate, isFriday: friday, titles, text }
}
