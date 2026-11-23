import {
  copyCampaign,
  isPlatform,
  rankCampaigns,
  SAMPLE_CAMPAIGNS,
  type Campaign,
  type Platform,
} from './campaigns.ts'
import { copyHookBank, type HookTemplate } from './hooks.ts'

export type JobRecord = {
  platform: Platform | ''
  account: string
  streamer: string
  width: number
  height: number
  contentPolicyReviewed: boolean
  ready: boolean
  postedOn: string
  day1Views: number | null
  day3Views: number | null
}

export type JobsState = {
  campaigns: Campaign[]
  selectedCampaignId: string
  hooks: HookTemplate[]
  records: Record<string, JobRecord>
}

export function blankJob(partial: Partial<JobRecord> = {}): JobRecord {
  return {
    platform: 'TikTok',
    account: 'sample.desk',
    streamer: '',
    width: 1080,
    height: 1920,
    contentPolicyReviewed: false,
    ready: false,
    postedOn: '2026-11-16',
    day1Views: null,
    day3Views: null,
    ...partial,
  }
}

export function createInitialJobs(): JobsState {
  const campaigns = SAMPLE_CAMPAIGNS.map(copyCampaign)
  return {
    campaigns,
    selectedCampaignId: rankCampaigns(campaigns)[0]?.id ?? '',
    hooks: copyHookBank(undefined),
    records: {
      'sample-harbor': blankJob({ account: 'sample.north', platform: 'TikTok', postedOn: '2026-11-16' }),
      'sample-chase': blankJob({ account: 'sample.south', platform: 'Shorts', postedOn: '2026-11-18' }),
    },
  }
}

export function selectedCampaign(jobs: JobsState): Campaign | null {
  return jobs.campaigns.find((campaign) => campaign.id === jobs.selectedCampaignId) ?? null
}

export function ensureJobRecords(jobs: JobsState, queueIds: readonly string[]): JobsState {
  const records = { ...jobs.records }
  let changed = false
  for (const id of queueIds) {
    if (!records[id]) {
      records[id] = blankJob()
      changed = true
    }
  }
  return changed ? { ...jobs, records } : jobs
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function coerceCampaign(value: unknown): Campaign | null {
  const item = asRecord(value)
  if (!item) return null
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return null
  if (typeof item.payPer1k !== 'number' || typeof item.budgetLeft !== 'number') return null
  if (typeof item.minimumViews !== 'number') return null
  if (typeof item.minLengthSec !== 'number' || typeof item.maxLengthSec !== 'number') return null
  const platforms = stringList(item.platforms).filter(isPlatform)
  return {
    id: item.id,
    name: item.name,
    payPer1k: item.payPer1k,
    budgetLeft: item.budgetLeft,
    minimumViews: item.minimumViews,
    platforms,
    streamers: stringList(item.streamers),
    requiredHashtags: stringList(item.requiredHashtags),
    requiredMentions: stringList(item.requiredMentions),
    minLengthSec: item.minLengthSec,
    maxLengthSec: item.maxLengthSec,
    bannedContent: stringList(item.bannedContent),
    origin: item.origin === 'pasted' ? 'pasted' : 'bundled',
    sample: true,
    label: 'Sample',
  }
}

function coerceHook(value: unknown): HookTemplate | null {
  const hook = asRecord(value)
  if (!hook) return null
  if (typeof hook.id !== 'string' || typeof hook.label !== 'string' || typeof hook.pattern !== 'string') return null
  if (!hook.id.trim() || !hook.pattern.trim()) return null
  return { id: hook.id, label: hook.label, pattern: hook.pattern }
}

function finiteOrNull(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, value)
}

function coerceRecord(value: unknown): JobRecord | null {
  const item = asRecord(value)
  if (!item) return null
  const platform =
    typeof item.platform === 'string' && (item.platform === '' || isPlatform(item.platform)) ? item.platform : 'TikTok'
  const postedOn =
    typeof item.postedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.postedOn) ? item.postedOn : '2026-11-16'
  return {
    platform,
    account: typeof item.account === 'string' ? item.account : 'sample.desk',
    streamer: typeof item.streamer === 'string' ? item.streamer : '',
    width: typeof item.width === 'number' && item.width > 0 ? item.width : 1080,
    height: typeof item.height === 'number' && item.height > 0 ? item.height : 1920,
    contentPolicyReviewed: item.contentPolicyReviewed === true,
    ready: item.ready === true,
    postedOn,
    day1Views: finiteOrNull(item.day1Views),
    day3Views: finiteOrNull(item.day3Views),
  }
}

export function coerceJobs(value: unknown, queueIds: readonly string[]): JobsState | null {
  const raw = asRecord(value)
  if (!raw) return null
  const campaigns = Array.isArray(raw.campaigns)
    ? raw.campaigns.flatMap((item) => {
        const campaign = coerceCampaign(item)
        return campaign ? [campaign] : []
      })
    : []
  const safeCampaigns = campaigns.length > 0 ? campaigns : SAMPLE_CAMPAIGNS.map(copyCampaign)
  const requested = typeof raw.selectedCampaignId === 'string' ? raw.selectedCampaignId : ''
  const selectedCampaignId = safeCampaigns.some((campaign) => campaign.id === requested)
    ? requested
    : (rankCampaigns(safeCampaigns)[0]?.id ?? '')
  const hooks = Array.isArray(raw.hooks) ? raw.hooks.flatMap((item) => {
    const hook = coerceHook(item)
    return hook ? [hook] : []
  }) : []
  const records: Record<string, JobRecord> = {}
  const rawRecords = asRecord(raw.records)
  if (rawRecords) {
    for (const [id, record] of Object.entries(rawRecords)) {
      const coerced = coerceRecord(record)
      if (coerced) records[id] = coerced
    }
  }
  const jobs = ensureJobRecords(
    {
      campaigns: safeCampaigns,
      selectedCampaignId,
      hooks: copyHookBank(hooks),
      records,
    },
    queueIds,
  )
  return jobs
}
