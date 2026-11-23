import type { Platform } from './campaigns.ts'
import { isPlatform } from './campaigns.ts'

export const PLATFORM_SPECS: Record<Platform, { width: number; height: number; minSec: number; maxSec: number }> = {
  TikTok: { width: 1080, height: 1920, minSec: 3, maxSec: 60 },
  Reels: { width: 1080, height: 1920, minSec: 3, maxSec: 90 },
  Shorts: { width: 1080, height: 1920, minSec: 1, maxSec: 60 },
  X: { width: 1080, height: 1920, minSec: 2, maxSec: 140 },
}

export const CHECK_IDS = ['length', 'aspect', 'platform', 'caption', 'streamer', 'duplicate', 'policy'] as const

export type CheckId = (typeof CHECK_IDS)[number]

export type CheckResult = {
  id: CheckId
  label: string
  pass: boolean
  detail: string
}

export type ChecklistCampaign = {
  platforms: readonly Platform[]
  streamers: readonly string[]
  requiredHashtags: readonly string[]
  requiredMentions: readonly string[]
  minLengthSec: number
  maxLengthSec: number
  bannedContent: readonly string[]
}

export type ChecklistSubject = {
  id: string
  clipId: string
  trimIn: number
  trimOut: number
  caption: string
  hook: string
  hashtags: readonly string[]
  platform: Platform | ''
  account: string
  streamer: string
  width: number
  height: number
  contentPolicyReviewed: boolean
}

export type ChecklistPeer = {
  id: string
  clipId: string
  account: string
}

export function clipLengthSec(trimIn: number, trimOut: number): number {
  if (!Number.isFinite(trimIn) || !Number.isFinite(trimOut)) return 0
  return Math.round(Math.max(0, trimOut - trimIn) * 100) / 100
}

export function isNineSixteen(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false
  return Math.abs(width * 16 - height * 9) <= 1
}

function within(value: number, min: number, max: number): boolean {
  return value + 1e-6 >= min && value - 1e-6 <= max
}

function hasToken(text: string, token: string): boolean {
  const needle = token.trim().toLowerCase()
  if (!needle) return false
  const haystack = text.toLowerCase()
  let from = 0
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from)
    if (index < 0) return false
    const after = haystack[index + needle.length] ?? ''
    if (!/[a-z0-9_]/i.test(after)) return true
    from = index + needle.length
  }
  return false
}

function postingText(subject: Pick<ChecklistSubject, 'hook' | 'caption' | 'hashtags'>): string {
  return `${subject.hook}\n${subject.caption}\n${subject.hashtags.join(' ')}`
}

function uniqueTokens(values: string[]): string[] {
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

export function duplicateClipOnAccount(subject: ChecklistPeer, peers: readonly ChecklistPeer[]): boolean {
  const account = subject.account.trim().toLowerCase()
  if (!account || !subject.clipId) return false
  return peers.some(
    (peer) =>
      peer.id !== subject.id &&
      peer.clipId === subject.clipId &&
      peer.account.trim().toLowerCase() === account,
  )
}

function checkLength(subject: ChecklistSubject, campaign: ChecklistCampaign): CheckResult {
  const length = clipLengthSec(subject.trimIn, subject.trimOut)
  const pass = within(length, campaign.minLengthSec, campaign.maxLengthSec)
  return {
    id: 'length',
    label: 'Clip length',
    pass,
    detail: pass
      ? `${length}s is inside ${campaign.minLengthSec}–${campaign.maxLengthSec}s.`
      : `${length}s is outside ${campaign.minLengthSec}–${campaign.maxLengthSec}s.`,
  }
}

function checkAspect(subject: ChecklistSubject): CheckResult {
  const pass = isNineSixteen(subject.width, subject.height)
  return {
    id: 'aspect',
    label: '9:16 aspect',
    pass,
    detail: pass
      ? `${subject.width}×${subject.height} is 9:16.`
      : `${subject.width}×${subject.height} is not 9:16.`,
  }
}

function checkPlatform(subject: ChecklistSubject, campaign: ChecklistCampaign): CheckResult {
  const length = clipLengthSec(subject.trimIn, subject.trimOut)
  if (!subject.platform || !isPlatform(subject.platform)) {
    return {
      id: 'platform',
      label: 'Platform specs',
      pass: false,
      detail: 'Pick TikTok, Reels, Shorts, or X. Each sample spec is 1080×1920.',
    }
  }
  const spec = PLATFORM_SPECS[subject.platform]
  const problems: string[] = []
  if (!campaign.platforms.includes(subject.platform)) {
    problems.push(`${subject.platform} is not on this campaign's allowed list.`)
  }
  if (subject.width !== spec.width || subject.height !== spec.height) {
    problems.push(`Needs ${spec.width}×${spec.height}, not ${subject.width}×${subject.height}.`)
  }
  if (!within(length, spec.minSec, spec.maxSec)) {
    problems.push(`${length}s is outside the ${subject.platform} window of ${spec.minSec}–${spec.maxSec}s.`)
  }
  return {
    id: 'platform',
    label: 'Platform specs',
    pass: problems.length === 0,
    detail:
      problems.length === 0
        ? `${subject.platform} matches 1080×1920 and ${spec.minSec}–${spec.maxSec}s.`
        : problems.join(' '),
  }
}

function checkCaption(subject: ChecklistSubject, campaign: ChecklistCampaign): CheckResult {
  const text = postingText(subject)
  const missingTags = campaign.requiredHashtags.filter((tag) => {
    const inList = subject.hashtags.some((item) => item.toLowerCase() === tag.toLowerCase())
    return !inList && !hasToken(text, tag)
  })
  const missingMentions = campaign.requiredMentions.filter((mention) => !hasToken(text, mention))
  const missing = [...missingTags, ...missingMentions]
  return {
    id: 'caption',
    label: 'Hashtags and mentions',
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? 'Required hashtags and mentions are in the caption or hashtag field.'
        : `Missing from the caption: ${missing.join(', ')}.`,
  }
}

function checkStreamer(subject: ChecklistSubject, campaign: ChecklistCampaign): CheckResult {
  const name = subject.streamer.trim()
  const allowed = campaign.streamers.some((streamer) => streamer.toLowerCase() === name.toLowerCase())
  return {
    id: 'streamer',
    label: 'Allowed streamer',
    pass: Boolean(name) && allowed,
    detail: !name
      ? 'Choose a streamer from the allowed list.'
      : allowed
        ? `${name} is on the allowed list.`
        : `${name} is not on the allowed list.`,
  }
}

function checkDuplicate(subject: ChecklistSubject, peers: readonly ChecklistPeer[]): CheckResult {
  const account = subject.account.trim()
  if (!account) {
    return {
      id: 'duplicate',
      label: 'Duplicate clip',
      pass: false,
      detail: 'Add an account so the same clip is not queued twice on one account.',
    }
  }
  const duplicate = duplicateClipOnAccount(subject, peers)
  return {
    id: 'duplicate',
    label: 'Duplicate clip',
    pass: !duplicate,
    detail: duplicate
      ? `This clip is already queued on ${account}.`
      : `This clip is only queued once on ${account}.`,
  }
}

function checkPolicy(subject: ChecklistSubject, campaign: ChecklistCampaign): CheckResult {
  const banned = campaign.bannedContent.length > 0 ? campaign.bannedContent.join(', ') : 'none listed'
  return {
    id: 'policy',
    label: 'Content policy reviewed',
    pass: subject.contentPolicyReviewed,
    detail: subject.contentPolicyReviewed
      ? 'Marked reviewed for this sample.'
      : `Tick this after you review banned content (${banned}).`,
  }
}

export function evaluateChecklist(
  subject: ChecklistSubject,
  campaign: ChecklistCampaign,
  peers: readonly ChecklistPeer[],
): { checks: CheckResult[]; readyAllowed: boolean } {
  const checks = [
    checkLength(subject, campaign),
    checkAspect(subject),
    checkPlatform(subject, campaign),
    checkCaption(subject, campaign),
    checkStreamer(subject, campaign),
    checkDuplicate(subject, peers),
    checkPolicy(subject, campaign),
  ]
  return { checks, readyAllowed: checks.every((check) => check.pass) }
}

export function withRequiredTokens<T extends { caption: string; hashtags: string[] }>(
  item: T,
  campaign: { requiredHashtags: readonly string[]; requiredMentions: readonly string[] },
): { item: T; added: string[] } {
  const text = `${item.caption}\n${item.hashtags.join(' ')}`
  const missingTags = campaign.requiredHashtags.filter((tag) => {
    const inList = item.hashtags.some((entry) => entry.toLowerCase() === tag.toLowerCase())
    return !inList && !hasToken(text, tag)
  })
  const missingMentions = campaign.requiredMentions.filter((mention) => !hasToken(item.caption, mention) && !hasToken(item.hashtags.join(' '), mention))
  const added = [...missingTags, ...missingMentions]
  if (added.length === 0) return { item, added }
  return {
    added,
    item: {
      ...item,
      caption: `${item.caption.trim()} ${added.join(' ')}`.trim(),
      hashtags: uniqueTokens([...item.hashtags, ...missingTags]),
    },
  }
}
