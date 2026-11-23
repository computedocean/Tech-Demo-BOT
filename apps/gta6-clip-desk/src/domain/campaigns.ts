export const PLATFORMS = ['TikTok', 'Reels', 'Shorts', 'X'] as const

export type Platform = (typeof PLATFORMS)[number]

export type CampaignOrigin = 'bundled' | 'pasted'

export type Campaign = {
  id: string
  name: string
  payPer1k: number
  budgetLeft: number
  minimumViews: number
  platforms: Platform[]
  streamers: string[]
  requiredHashtags: string[]
  requiredMentions: string[]
  minLengthSec: number
  maxLengthSec: number
  bannedContent: string[]
  origin: CampaignOrigin
  sample: true
  label: 'Sample'
}

export type CampaignDraft = {
  name: string
  payPer1k: number
  budgetLeft: number
  minimumViews: number
  platforms: Platform[]
  streamers: string[]
  requiredHashtags: string[]
  requiredMentions: string[]
  minLengthSec: number
  maxLengthSec: number
  bannedContent: string[]
}

export type ParseResult =
  | { ok: true; draft: CampaignDraft; warnings: string[] }
  | { ok: false; error: string }

type Field = 'name' | 'pay' | 'budget' | 'minViews' | 'platforms' | 'streamers' | 'hashtags' | 'mentions' | 'both' | 'length' | 'banned'

const LABEL_FIELDS: Record<string, Field> = {
  campaign: 'name',
  'campaign name': 'name',
  name: 'name',
  title: 'name',
  pay: 'pay',
  rate: 'pay',
  payout: 'pay',
  'pay per 1k': 'pay',
  'pay per 1k views': 'pay',
  'pay per 1000': 'pay',
  'pay per 1000 views': 'pay',
  'payout per 1k': 'pay',
  'rate per 1k': 'pay',
  'pay/1k': 'pay',
  '/1k': 'pay',
  'budget left': 'budget',
  budget: 'budget',
  'remaining budget': 'budget',
  'minimum views': 'minViews',
  'min views': 'minViews',
  'minimum view': 'minViews',
  minimum: 'minViews',
  'view floor': 'minViews',
  'allowed platforms': 'platforms',
  platforms: 'platforms',
  platform: 'platforms',
  'allowed streamers': 'streamers',
  streamers: 'streamers',
  streamer: 'streamers',
  creators: 'streamers',
  'allowed creators': 'streamers',
  'required hashtags': 'hashtags',
  hashtags: 'hashtags',
  hashtag: 'hashtags',
  'required tags': 'hashtags',
  'required mentions': 'mentions',
  mentions: 'mentions',
  mention: 'mentions',
  'required hashtags/mentions': 'both',
  'hashtags/mentions': 'both',
  'clip length': 'length',
  'clip length range': 'length',
  'length range': 'length',
  length: 'length',
  duration: 'length',
  'banned content': 'banned',
  banned: 'banned',
  avoid: 'banned',
  'do not post': 'banned',
}

const LIST_FIELDS = new Set<Field>(['platforms', 'streamers', 'hashtags', 'mentions', 'both', 'banned'])

export const SAMPLE_CAMPAIGNS: readonly Campaign[] = [
  {
    id: 'sample-lantern',
    name: 'Sample: Lantern Route',
    payPer1k: 8,
    budgetLeft: 420,
    minimumViews: 2000,
    platforms: ['TikTok', 'Shorts'],
    streamers: ['Nia Calder', 'Ellis Voss'],
    requiredHashtags: ['#LanternRoute', '#OpenWorld'],
    requiredMentions: ['@lanterndesk'],
    minLengthSec: 4,
    maxLengthSec: 30,
    bannedContent: ['real brand logos', 'copyrighted music'],
    origin: 'bundled',
    sample: true,
    label: 'Sample',
  },
  {
    id: 'sample-paper',
    name: 'Sample: Paper City Sprint',
    payPer1k: 8,
    budgetLeft: 150,
    minimumViews: 500,
    platforms: ['Reels', 'X'],
    streamers: ['Jonah Pike', 'Mira Quell'],
    requiredHashtags: ['#PaperCity'],
    requiredMentions: ['@papersprint'],
    minLengthSec: 3,
    maxLengthSec: 20,
    bannedContent: ['unlicensed audio'],
    origin: 'bundled',
    sample: true,
    label: 'Sample',
  },
  {
    id: 'sample-quiet',
    name: 'Sample: Quiet Block',
    payPer1k: 3.25,
    budgetLeft: 900,
    minimumViews: 800,
    platforms: ['TikTok', 'Reels', 'Shorts', 'X'],
    streamers: ['Sable Quinn', 'Remy Holt', 'Ivo Lane'],
    requiredHashtags: ['#ClipDesk'],
    requiredMentions: ['@quietblock'],
    minLengthSec: 2,
    maxLengthSec: 60,
    bannedContent: ['gambling pitches'],
    origin: 'bundled',
    sample: true,
    label: 'Sample',
  },
]

export const SAMPLE_PASTE = `Campaign: Sample: Glasswater Run
Pay per 1K views: $5.75
Budget left: 1,260
Minimum views: 1200
Allowed platforms: tiktok / youtube shorts / x
Allowed streamers: Ivo Lane and Sable Quinn
Required hashtags: #Glasswater, #NightCut
Required mentions: @glassdesk
Clip length range: 3 to 30 seconds
Banned content: real brand logos; copyrighted music
`

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value)
}

export function copyCampaign(campaign: Campaign): Campaign {
  return {
    ...campaign,
    platforms: [...campaign.platforms],
    streamers: [...campaign.streamers],
    requiredHashtags: [...campaign.requiredHashtags],
    requiredMentions: [...campaign.requiredMentions],
    bannedContent: [...campaign.bannedContent],
  }
}

export function rankCampaigns<T extends { payPer1k: number; budgetLeft: number; name: string }>(
  campaigns: readonly T[],
): T[] {
  return [...campaigns].sort((a, b) => {
    if (b.payPer1k !== a.payPer1k) return b.payPer1k - a.payPer1k
    if (b.budgetLeft !== a.budgetLeft) return b.budgetLeft - a.budgetLeft
    return a.name.localeCompare(b.name)
  })
}

export function parseLooseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').replace(/(\d)\s+(?=\d)/g, '$1')
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

function splitList(value: string): string[] {
  return value
    .split(/\s*(?:,|;|\||\/|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

function dedupeKeepCase(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

export function normalizeHashtag(token: string): string {
  const core = token.trim().replace(/^#+/, '').replace(/[.,;:!?]+$/g, '')
  return core ? `#${core}` : ''
}

export function normalizeMention(token: string): string {
  const core = token.trim().replace(/^@+/, '').replace(/[.,;:!?]+$/g, '')
  return core ? `@${core}` : ''
}

export function parseStreamerList(value: string): string[] {
  return dedupeKeepCase(
    splitList(value)
      .map((name) => name.replace(/^[-*•]\s*/, '').replace(/\s+/g, ' ').trim())
      .filter((name) => name.length > 0 && !/^[-*•]$/.test(name)),
  )
}

export function parseHashtagList(value: string): string[] {
  const tokens = splitList(value).flatMap((part) => part.split(/\s+/))
  return dedupeKeepCase(tokens.map(normalizeHashtag).filter(Boolean))
}

export function parseMentionList(value: string): string[] {
  const tokens = splitList(value).flatMap((part) => part.split(/\s+/))
  return dedupeKeepCase(tokens.map(normalizeMention).filter(Boolean))
}

export function parseBannedList(value: string): string[] {
  return dedupeKeepCase(splitList(value).map((item) => item.replace(/\s+/g, ' ').trim()))
}

export function parsePlatformList(value: string): { platforms: Platform[]; unknown: string[] } {
  const platforms: Platform[] = []
  const unknown: string[] = []
  const seen = new Set<string>()
  for (const part of splitList(value)) {
    const platform = platformFromToken(part)
    if (!platform) {
      unknown.push(part)
      continue
    }
    if (seen.has(platform)) continue
    seen.add(platform)
    platforms.push(platform)
  }
  return { platforms, unknown }
}

function platformFromToken(value: string): Platform | null {
  const key = value.toLowerCase().replace(/[^a-z]/g, '')
  if (!key) return null
  if (key.includes('tiktok') || key === 'tt') return 'TikTok'
  if (key.includes('reel')) return 'Reels'
  if (key.includes('short')) return 'Shorts'
  if (key === 'x' || key.includes('twitter')) return 'X'
  return null
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&/g, '/')
    .replace(/[^a-z0-9/+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fieldFor(label: string): Field | null {
  const normalized = normalizeLabel(label)
  return LABEL_FIELDS[normalized] ?? LABEL_FIELDS[normalized.replace(/\//g, ' ').replace(/\s+/g, ' ').trim()] ?? null
}

function splitLabel(line: string): { label: string; value: string } | null {
  const trimmed = line.replace(/^[-*•]\s*/, '').trim()
  const colon = trimmed.indexOf(':')
  const eq = trimmed.indexOf('=')
  let index = -1
  let separatorLength = 1
  if (colon >= 0 && (eq < 0 || colon < eq)) index = colon
  else if (eq >= 0) index = eq
  const dash = trimmed.indexOf(' - ')
  if (dash >= 0 && (index < 0 || dash < index)) {
    index = dash
    separatorLength = 3
  }
  if (index <= 0) return null
  const label = trimmed.slice(0, index).trim()
  const value = trimmed.slice(index + separatorLength).trim()
  if (!label) return null
  return { label, value }
}

function parseLength(value: string): { min: number; max: number } | null {
  const match = value
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)?\s*(?:-|–|—|\bto\b|\bthrough\b)\s*(\d+(?:\.\d+)?)/i)
  if (!match) return null
  return { min: Number(match[1]), max: Number(match[2]) }
}

export function parseCampaignText(text: string): ParseResult {
  const found = new Set<Field>()
  const warnings: string[] = []
  const draft: CampaignDraft = {
    name: '',
    payPer1k: Number.NaN,
    budgetLeft: 0,
    minimumViews: 0,
    platforms: [],
    streamers: [],
    requiredHashtags: [],
    requiredMentions: [],
    minLengthSec: 3,
    maxLengthSec: 60,
    bannedContent: [],
  }
  let lengthSet = false
  let current: Field | null = null

  const addWarning = (warning: string) => {
    if (!warnings.includes(warning)) warnings.push(warning)
  }

  const assign = (field: Field, value: string) => {
    if (!value.trim()) return
    found.add(field)
    if (field === 'name') draft.name = value.trim()
    if (field === 'pay') {
      const pay = parseLooseNumber(value)
      if (pay === null) addWarning('Pay per 1K was not a number.')
      else draft.payPer1k = pay
    }
    if (field === 'budget') {
      const budget = parseLooseNumber(value)
      if (budget === null) addWarning('Budget left was not a number.')
      else draft.budgetLeft = budget
    }
    if (field === 'minViews') {
      const minimum = parseLooseNumber(value)
      if (minimum === null) addWarning('Minimum views was not a number.')
      else draft.minimumViews = minimum
    }
    if (field === 'platforms') {
      const parsed = parsePlatformList(value)
      draft.platforms = dedupePlatforms([...draft.platforms, ...parsed.platforms])
      if (parsed.unknown.length > 0) addWarning(`Ignored unknown platforms: ${parsed.unknown.join(', ')}.`)
    }
    if (field === 'streamers') draft.streamers = parseStreamerList([...draft.streamers, value].join(', '))
    if (field === 'hashtags') {
      draft.requiredHashtags = parseHashtagList([...draft.requiredHashtags, value].join(' '))
    }
    if (field === 'mentions') {
      draft.requiredMentions = parseMentionList([...draft.requiredMentions, value].join(' '))
    }
    if (field === 'both') {
      const tokens = splitList(value).flatMap((part) => part.split(/\s+/))
      const tags: string[] = []
      const mentions: string[] = []
      for (const token of tokens) {
        if (token.startsWith('@')) mentions.push(token)
        else tags.push(token)
      }
      draft.requiredHashtags = parseHashtagList([...draft.requiredHashtags, ...tags].join(' '))
      draft.requiredMentions = parseMentionList([...draft.requiredMentions, ...mentions].join(' '))
    }
    if (field === 'length') {
      const range = parseLength(value)
      if (!range) {
        addWarning('Clip length needs a range such as 3-30.')
        return
      }
      lengthSet = true
      draft.minLengthSec = range.min
      draft.maxLengthSec = range.max
      if (range.min > range.max) {
        draft.minLengthSec = range.max
        draft.maxLengthSec = range.min
        addWarning('Swapped the clip length range so the minimum comes first.')
      }
    }
    if (field === 'banned') draft.bannedContent = parseBannedList([...draft.bannedContent, value].join(', '))
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue
    const split = splitLabel(line)
    const field = split ? fieldFor(split.label) : null
    if (split && field) {
      current = field
      assign(field, split.value)
      continue
    }
    if (current && LIST_FIELDS.has(current) && /^[-*•]/.test(line)) {
      assign(current, line.replace(/^[-*•]\s*/, ''))
    }
  }

  if (!draft.name.trim()) return { ok: false, error: 'Add a campaign name. Example: Campaign: Sample: Glasswater Run' }
  if (!Number.isFinite(draft.payPer1k)) {
    return { ok: false, error: 'Add pay per 1K. Example: Pay per 1K views: $5.75' }
  }
  if (!found.has('budget')) addWarning('Budget left was missing, so it is 0 until you edit the form.')
  if (!found.has('minViews')) addWarning('Minimum views was missing, so it is 0 until you edit the form.')
  if (!found.has('platforms')) addWarning('Allowed platforms were missing. Pick them in the form.')
  if (!lengthSet) addWarning('Clip length was missing, so the form uses 3–60 seconds.')
  if (draft.minLengthSec === draft.maxLengthSec) addWarning('Clip length minimum and maximum match. Widen the range before adding.')

  return { ok: true, draft, warnings }
}

function dedupePlatforms(platforms: Platform[]): Platform[] {
  const seen = new Set<Platform>()
  const result: Platform[] = []
  for (const platform of platforms) {
    if (seen.has(platform)) continue
    seen.add(platform)
    result.push(platform)
  }
  return result
}

function slugId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/^sample:\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `sample-${slug || 'campaign'}`
}

export function buildCampaign(
  draft: CampaignDraft,
  existingIds: readonly string[],
): { ok: true; campaign: Campaign } | { ok: false; error: string } {
  const name = draft.name.trim()
  if (!name) return { ok: false, error: 'Campaign name is required.' }
  if (!Number.isFinite(draft.payPer1k) || draft.payPer1k < 0) {
    return { ok: false, error: 'Pay per 1K must be zero or more.' }
  }
  if (!Number.isFinite(draft.budgetLeft) || draft.budgetLeft < 0) {
    return { ok: false, error: 'Budget left must be zero or more.' }
  }
  if (!Number.isFinite(draft.minimumViews) || draft.minimumViews < 0) {
    return { ok: false, error: 'Minimum views must be zero or more.' }
  }
  if (
    !Number.isFinite(draft.minLengthSec) ||
    !Number.isFinite(draft.maxLengthSec) ||
    draft.minLengthSec < 0 ||
    draft.maxLengthSec <= draft.minLengthSec
  ) {
    return { ok: false, error: 'Clip length needs a minimum below the maximum.' }
  }
  const base = slugId(name)
  let id = base
  let suffix = 2
  const taken = new Set(existingIds)
  while (taken.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return {
    ok: true,
    campaign: {
      id,
      name,
      payPer1k: Math.round(draft.payPer1k * 100) / 100,
      budgetLeft: Math.round(draft.budgetLeft * 100) / 100,
      minimumViews: Math.round(draft.minimumViews),
      platforms: dedupePlatforms(draft.platforms.filter(isPlatform)),
      streamers: dedupeKeepCase(draft.streamers.map((name) => name.trim()).filter(Boolean)),
      requiredHashtags: dedupeKeepCase(draft.requiredHashtags.map(normalizeHashtag).filter(Boolean)),
      requiredMentions: dedupeKeepCase(draft.requiredMentions.map(normalizeMention).filter(Boolean)),
      minLengthSec: draft.minLengthSec,
      maxLengthSec: draft.maxLengthSec,
      bannedContent: draft.bannedContent.map((item) => item.trim()).filter(Boolean),
      origin: 'pasted',
      sample: true,
      label: 'Sample',
    },
  }
}
