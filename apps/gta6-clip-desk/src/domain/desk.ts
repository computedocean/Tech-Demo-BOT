import type { Campaign } from './campaigns.ts'
import { generateCaptionVariants } from './captions.ts'
import { evaluateChecklist, withRequiredTokens, type ChecklistSubject } from './checklist.ts'
import { BUNDLED_CLIPS, toggleTag, type ClipRecord } from './clips.ts'
import type { HookTemplate } from './hooks.ts'
import {
  blankJob,
  coerceJobs,
  createInitialJobs,
  ensureJobRecords,
  selectedCampaign,
  type JobRecord,
  type JobsState,
} from './jobs-state.ts'
import type { QueueItem, SlotId } from './queue.ts'
import { createId, nextOpenSlot, rescheduleItem } from './queue.ts'
import { simulateCheckpointViews, viewSeed } from './tracker.ts'
import { validateTrim } from './trim.ts'

export type ClipDraft = {
  title: string
  tags: string[]
  trimIn: number
  trimOut: number
  variantId: string
  hook: string
  caption: string
  hashtags: string[]
}

export type PersistedPlan = {
  version: 1
  selectedId: string
  tagFilter: string
  drafts: Record<string, ClipDraft>
  queue: QueueItem[]
  selectedQueueId: string | null
  jobs?: unknown
}

export type JobPatch = {
  platform?: JobRecord['platform']
  account?: string
  streamer?: string
  width?: number
  height?: number
  contentPolicyReviewed?: boolean
  postedOn?: string
  day1Views?: number | null
  day3Views?: number | null
}

export type DeskState = {
  clips: ClipRecord[]
  selectedId: string
  tagFilter: string
  drafts: Record<string, ClipDraft>
  queue: QueueItem[]
  selectedQueueId: string | null
  notice: string | null
  jobs: JobsState
}

export type DeskAction =
  | { type: 'selectClip'; clipId: string }
  | { type: 'setFilter'; tag: string }
  | { type: 'setTitle'; title: string }
  | { type: 'toggleTag'; tag: string }
  | { type: 'setTrim'; trimIn: number; trimOut: number }
  | { type: 'applyVariant'; variantId: string }
  | { type: 'regenerate' }
  | { type: 'setHook'; hook: string }
  | { type: 'setCaption'; caption: string }
  | { type: 'setHashtags'; hashtags: string[] }
  | { type: 'applyServerCopy'; hook: string; caption: string; hashtags: string[] }
  | { type: 'addClip'; clip: ClipRecord }
  | { type: 'removeClip'; clipId: string }
  | { type: 'enqueue' }
  | { type: 'reschedule'; itemId: string; slot: SlotId }
  | { type: 'removeQueueItem'; itemId: string }
  | { type: 'restoreExample' }
  | { type: 'selectQueueItem'; itemId: string | null }
  | { type: 'setNotice'; notice: string | null }
  | { type: 'hydrate'; clips: ClipRecord[]; plan: PersistedPlan | null }
  | { type: 'selectCampaign'; campaignId: string }
  | { type: 'addCampaign'; campaign: Campaign }
  | { type: 'setHooks'; hooks: HookTemplate[] }
  | { type: 'setJob'; itemId: string; patch: JobPatch }
  | { type: 'markReady'; itemId: string }
  | { type: 'clearReady'; itemId: string }
  | { type: 'simulateViews'; itemId: string }
  | { type: 'patchQueueItem'; itemId: string; patch: { caption?: string; hook?: string; hashtags?: string[] } }
  | { type: 'insertRequiredTags'; itemId: string }

export function draftForClip(clip: ClipRecord, hooks?: readonly HookTemplate[]): ClipDraft {
  const variant = generateCaptionVariants({ title: clip.title, tags: clip.tags, hooks })[0]
  return {
    title: clip.title,
    tags: [...clip.tags],
    trimIn: 0,
    trimOut: clip.durationSec,
    variantId: variant.id,
    hook: variant.hook,
    caption: variant.caption,
    hashtags: [...variant.hashtags],
  }
}

function queueItemFromDraft(clip: ClipRecord, draft: ClipDraft, items: QueueItem[]): QueueItem {
  return {
    id: createId('q'),
    clipId: clip.id,
    title: draft.title.trim() || clip.title,
    tags: [...draft.tags],
    trimIn: draft.trimIn,
    trimOut: draft.trimOut,
    caption: draft.caption,
    hook: draft.hook,
    hashtags: [...draft.hashtags],
    slot: nextOpenSlot(items),
  }
}

export function createInitialDeskState(): DeskState {
  const clips = BUNDLED_CLIPS.map((clip) => ({ ...clip, tags: [...clip.tags] }))
  const drafts: Record<string, ClipDraft> = {}
  for (const clip of clips) drafts[clip.id] = draftForClip(clip)
  const harbor = clips[0]
  const chase = clips[2]
  const harborDraft = drafts[harbor.id]
  const chaseDraft = drafts[chase.id]
  const queue: QueueItem[] = [
    {
      id: 'sample-harbor',
      clipId: harbor.id,
      title: harborDraft.title,
      tags: [...harborDraft.tags],
      trimIn: 0.4,
      trimOut: 5.2,
      caption: harborDraft.caption,
      hook: harborDraft.hook,
      hashtags: [...harborDraft.hashtags],
      slot: 'mon-morning',
    },
    {
      id: 'sample-chase',
      clipId: chase.id,
      title: chaseDraft.title,
      tags: [...chaseDraft.tags],
      trimIn: 0,
      trimOut: 4.5,
      caption: chaseDraft.caption,
      hook: chaseDraft.hook,
      hashtags: [...chaseDraft.hashtags],
      slot: 'wed-evening',
    },
  ]
  return {
    clips,
    selectedId: harbor.id,
    tagFilter: 'all',
    drafts,
    queue,
    selectedQueueId: queue[0].id,
    notice: null,
    jobs: createInitialJobs(),
  }
}

export function selectedClip(state: DeskState): ClipRecord {
  return state.clips.find((clip) => clip.id === state.selectedId) ?? state.clips[0]
}

export function selectedDraft(state: DeskState): ClipDraft {
  const clip = selectedClip(state)
  return state.drafts[clip.id] ?? draftForClip(clip)
}

function withDraft(state: DeskState, draft: ClipDraft, notice: string | null = null): DeskState {
  const clip = selectedClip(state)
  return {
    ...state,
    notice,
    drafts: { ...state.drafts, [clip.id]: draft },
  }
}

export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case 'selectClip': {
      if (!state.clips.some((clip) => clip.id === action.clipId)) return state
      return { ...state, selectedId: action.clipId, notice: null }
    }
    case 'setFilter':
      return { ...state, tagFilter: action.tag }
    case 'setTitle':
      return withDraft(state, { ...selectedDraft(state), title: action.title })
    case 'toggleTag': {
      const draft = selectedDraft(state)
      return withDraft(state, { ...draft, tags: toggleTag(draft.tags, action.tag) })
    }
    case 'setTrim': {
      const clip = selectedClip(state)
      const result = validateTrim(action.trimIn, action.trimOut, clip.durationSec)
      if (!result.ok) return { ...state, notice: result.reason }
      return withDraft(state, {
        ...selectedDraft(state),
        trimIn: result.startSec,
        trimOut: result.endSec,
      })
    }
    case 'applyVariant': {
      const draft = selectedDraft(state)
      const variant = generateCaptionVariants({
        title: draft.title,
        tags: draft.tags,
        hooks: state.jobs.hooks,
      }).find((item) => item.id === action.variantId)
      if (!variant) return state
      return withDraft(state, {
        ...draft,
        variantId: variant.id,
        hook: variant.hook,
        caption: variant.caption,
        hashtags: [...variant.hashtags],
      })
    }
    case 'regenerate': {
      const draft = selectedDraft(state)
      const variants = generateCaptionVariants({
        title: draft.title,
        tags: draft.tags,
        hooks: state.jobs.hooks,
      })
      const variant = variants.find((item) => item.id === draft.variantId) ?? variants[0]
      return withDraft(
        state,
        {
          ...draft,
          variantId: variant.id,
          hook: variant.hook,
          caption: variant.caption,
          hashtags: [...variant.hashtags],
        },
        'Template captions refreshed. No key required.',
      )
    }
    case 'setHook':
      return withDraft(state, { ...selectedDraft(state), hook: action.hook })
    case 'setCaption':
      return withDraft(state, { ...selectedDraft(state), caption: action.caption })
    case 'setHashtags':
      return withDraft(state, { ...selectedDraft(state), hashtags: action.hashtags })
    case 'applyServerCopy':
      return withDraft(
        state,
        {
          ...selectedDraft(state),
          variantId: 'server',
          hook: action.hook,
          caption: action.caption,
          hashtags: action.hashtags,
        },
        'Server rewrite replaced the open caption.',
      )
    case 'addClip': {
      if (state.clips.some((clip) => clip.id === action.clip.id)) return state
      return {
        ...state,
        clips: [...state.clips, action.clip],
        drafts: { ...state.drafts, [action.clip.id]: draftForClip(action.clip, state.jobs.hooks) },
        selectedId: action.clip.id,
        notice: 'Upload stays in this browser.',
      }
    }
    case 'removeClip': {
      const clip = state.clips.find((item) => item.id === action.clipId)
      if (!clip || clip.origin !== 'upload') return state
      const clips = state.clips.filter((item) => item.id !== action.clipId)
      const drafts = { ...state.drafts }
      delete drafts[action.clipId]
      const removedIds = new Set(state.queue.filter((item) => item.clipId === action.clipId).map((item) => item.id))
      const queue = state.queue.filter((item) => item.clipId !== action.clipId)
      const records = { ...state.jobs.records }
      for (const id of removedIds) delete records[id]
      const selectedId = state.selectedId === action.clipId ? clips[0]?.id ?? '' : state.selectedId
      const selectedQueueId = queue.some((item) => item.id === state.selectedQueueId)
        ? state.selectedQueueId
        : (queue[0]?.id ?? null)
      return {
        ...state,
        clips,
        drafts,
        queue,
        selectedId,
        selectedQueueId,
        jobs: { ...state.jobs, records },
        notice: 'Upload removed.',
      }
    }
    case 'enqueue': {
      const clip = selectedClip(state)
      const draft = selectedDraft(state)
      const result = validateTrim(draft.trimIn, draft.trimOut, clip.durationSec)
      if (!result.ok) return { ...state, notice: result.reason }
      const item = queueItemFromDraft(
        clip,
        { ...draft, trimIn: result.startSec, trimOut: result.endSec },
        state.queue,
      )
      return {
        ...state,
        queue: [...state.queue, item],
        selectedQueueId: item.id,
        jobs: {
          ...state.jobs,
          records: {
            ...state.jobs.records,
            [item.id]: blankJob({ account: 'sample.desk' }),
          },
        },
        notice: `Added to ${item.slot.replace('-', ' ')}. Local plan only.`,
      }
    }
    case 'reschedule': {
      const moved = state.queue.find((item) => item.id === action.itemId)
      if (!moved) return state
      return {
        ...state,
        queue: rescheduleItem(state.queue, action.itemId, action.slot),
        selectedQueueId: action.itemId,
        notice: `Moved “${moved.title}” to ${action.slot.replace('-', ' ')}.`,
      }
    }
    case 'restoreExample': {
      const sample = createInitialDeskState()
      return {
        ...state,
        queue: sample.queue,
        selectedQueueId: sample.selectedQueueId,
        jobs: { ...state.jobs, records: sample.jobs.records },
        notice: 'Example week restored. Nothing is posted.',
      }
    }
    case 'removeQueueItem': {
      const queue = state.queue.filter((item) => item.id !== action.itemId)
      const records = { ...state.jobs.records }
      delete records[action.itemId]
      return {
        ...state,
        queue,
        jobs: { ...state.jobs, records },
        selectedQueueId:
          state.selectedQueueId === action.itemId ? (queue[0]?.id ?? null) : state.selectedQueueId,
      }
    }
    case 'selectQueueItem':
      return { ...state, selectedQueueId: action.itemId }
    case 'setNotice':
      return { ...state, notice: action.notice }
    case 'hydrate': {
      const clips = action.clips.length > 0 ? action.clips : state.clips
      const plan = action.plan
      const queue = plan?.queue ?? state.queue
      const jobs =
        coerceJobs(plan?.jobs, queue.map((item) => item.id)) ??
        ensureJobRecords(state.jobs, queue.map((item) => item.id))
      const drafts = { ...state.drafts }
      for (const clip of clips) {
        if (!drafts[clip.id]) drafts[clip.id] = draftForClip(clip, jobs.hooks)
      }
      if (plan) {
        for (const [id, draft] of Object.entries(plan.drafts)) drafts[id] = draft
      }
      const selectedId = clips.some((clip) => clip.id === plan?.selectedId)
        ? (plan?.selectedId ?? state.selectedId)
        : clips.some((clip) => clip.id === state.selectedId)
          ? state.selectedId
          : (clips[0]?.id ?? '')
      const selectedQueueId = queue.some((item) => item.id === plan?.selectedQueueId)
        ? (plan?.selectedQueueId ?? null)
        : queue.some((item) => item.id === state.selectedQueueId)
          ? state.selectedQueueId
          : (queue[0]?.id ?? null)
      return gateReady({
        clips,
        selectedId,
        tagFilter: plan?.tagFilter || state.tagFilter,
        drafts,
        queue,
        selectedQueueId,
        notice: null,
        jobs,
      })
    }
    case 'selectCampaign': {
      if (!state.jobs.campaigns.some((campaign) => campaign.id === action.campaignId)) return state
      const campaign = state.jobs.campaigns.find((item) => item.id === action.campaignId)
      return gateReady({
        ...state,
        jobs: { ...state.jobs, selectedCampaignId: action.campaignId },
        notice: campaign
          ? `Using “${campaign.name}”. Sample rules only, not a live listing.`
          : state.notice,
      })
    }
    case 'addCampaign': {
      if (state.jobs.campaigns.some((campaign) => campaign.id === action.campaign.id)) return state
      if (!action.campaign.name.trim()) return state
      return gateReady({
        ...state,
        jobs: {
          ...state.jobs,
          campaigns: [...state.jobs.campaigns, action.campaign],
          selectedCampaignId: action.campaign.id,
        },
        notice: `Added “${action.campaign.name}” to the sample scoreboard.`,
      })
    }
    case 'setHooks': {
      const hooks = action.hooks
        .filter((hook) => hook.id.trim())
        .map((hook) => ({ id: hook.id, label: hook.label, pattern: hook.pattern }))
      if (hooks.length === 0) return { ...state, notice: 'Keep at least one hook template.' }
      return { ...state, jobs: { ...state.jobs, hooks } }
    }
    case 'setJob': {
      const current = state.jobs.records[action.itemId] ?? blankJob()
      const next = applyJobPatch(current, action.patch)
      if (!next) return state
      return gateReady({
        ...state,
        jobs: { ...state.jobs, records: { ...state.jobs.records, [action.itemId]: next } },
      })
    }
    case 'markReady': {
      const campaign = selectedCampaign(state.jobs)
      const subject = checklistSubject(state, action.itemId)
      if (!campaign || !subject) {
        return { ...state, notice: 'Pick a sample campaign and a queued clip first.' }
      }
      const result = evaluateChecklist(subject, campaign, queuePeers(state))
      if (!result.readyAllowed) {
        return { ...state, notice: 'Resolve every failing check before marking the clip ready.' }
      }
      const record = state.jobs.records[action.itemId] ?? blankJob()
      return {
        ...state,
        jobs: {
          ...state.jobs,
          records: { ...state.jobs.records, [action.itemId]: { ...record, ready: true } },
        },
        notice: `Marked “${subjectTitle(state, action.itemId)}” ready. Local plan only. Nothing is posted.`,
      }
    }
    case 'clearReady': {
      const record = state.jobs.records[action.itemId]
      if (!record?.ready) return state
      return {
        ...state,
        jobs: {
          ...state.jobs,
          records: { ...state.jobs.records, [action.itemId]: { ...record, ready: false } },
        },
        notice: 'Cleared ready. The clip stays on the local queue.',
      }
    }
    case 'simulateViews': {
      const item = state.queue.find((entry) => entry.id === action.itemId)
      const record = state.jobs.records[action.itemId] ?? blankJob()
      if (!item) return state
      const views = simulateCheckpointViews(
        viewSeed({
          clipId: item.id,
          account: record.account,
          platform: record.platform,
          hook: item.hook,
        }),
      )
      return {
        ...state,
        jobs: {
          ...state.jobs,
          records: {
            ...state.jobs.records,
            [action.itemId]: { ...record, day1Views: views.day1, day3Views: views.day3 },
          },
        },
        notice: 'Filled day-1 and day-3 views from the local sample model. Simulated, not measured.',
      }
    }
    case 'patchQueueItem': {
      const queue = state.queue.map((item) => {
        if (item.id !== action.itemId) return item
        return {
          ...item,
          caption: action.patch.caption ?? item.caption,
          hook: action.patch.hook ?? item.hook,
          hashtags: action.patch.hashtags ?? item.hashtags,
        }
      })
      return gateReady({ ...state, queue })
    }
    case 'insertRequiredTags': {
      const campaign = selectedCampaign(state.jobs)
      const current = state.queue.find((item) => item.id === action.itemId)
      if (!campaign || !current) return { ...state, notice: 'Pick a sample campaign and a queued clip first.' }
      const updated = withRequiredTokens(current, campaign)
      if (updated.added.length === 0) {
        return { ...state, notice: 'The queued caption already includes the required tags.' }
      }
      const queue = state.queue.map((item) => (item.id === action.itemId ? updated.item : item))
      return gateReady({
        ...state,
        queue,
        notice: `Added ${updated.added.join(' ')} to the queued caption.`,
      })
    }
    default:
      return state
  }
}

function subjectTitle(state: DeskState, itemId: string): string {
  return state.queue.find((item) => item.id === itemId)?.title ?? 'Clip'
}

function queuePeers(state: DeskState): { id: string; clipId: string; account: string }[] {
  return state.queue.map((item) => ({
    id: item.id,
    clipId: item.clipId,
    account: state.jobs.records[item.id]?.account ?? '',
  }))
}

function checklistSubject(state: DeskState, itemId: string): ChecklistSubject | null {
  const item = state.queue.find((entry) => entry.id === itemId)
  const record = state.jobs.records[itemId]
  if (!item || !record) return null
  return {
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
  }
}

function applyJobPatch(record: JobRecord, patch: JobPatch): JobRecord | null {
  const next: JobRecord = { ...record }
  if (patch.platform !== undefined) next.platform = patch.platform
  if (patch.account !== undefined) next.account = patch.account
  if (patch.streamer !== undefined) next.streamer = patch.streamer
  if (patch.width !== undefined) {
    if (!Number.isFinite(patch.width) || patch.width <= 0) return null
    next.width = Math.round(patch.width)
  }
  if (patch.height !== undefined) {
    if (!Number.isFinite(patch.height) || patch.height <= 0) return null
    next.height = Math.round(patch.height)
  }
  if (patch.contentPolicyReviewed !== undefined) next.contentPolicyReviewed = patch.contentPolicyReviewed
  if (patch.postedOn !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.postedOn)) return null
    next.postedOn = patch.postedOn
  }
  if (patch.day1Views !== undefined) {
    if (patch.day1Views !== null && !Number.isFinite(patch.day1Views)) return null
    next.day1Views = patch.day1Views === null ? null : Math.max(0, patch.day1Views)
  }
  if (patch.day3Views !== undefined) {
    if (patch.day3Views !== null && !Number.isFinite(patch.day3Views)) return null
    next.day3Views = patch.day3Views === null ? null : Math.max(0, patch.day3Views)
  }
  return next
}

function gateReady(state: DeskState): DeskState {
  const campaign = selectedCampaign(state.jobs)
  const records = { ...state.jobs.records }
  let changed = false
  if (!campaign) {
    for (const [id, record] of Object.entries(records)) {
      if (!record.ready) continue
      records[id] = { ...record, ready: false }
      changed = true
    }
    return changed ? { ...state, jobs: { ...state.jobs, records } } : state
  }
  const peers = queuePeers(state)
  for (const item of state.queue) {
    const record = records[item.id]
    if (!record?.ready) continue
    const subject = checklistSubject({ ...state, jobs: { ...state.jobs, records } }, item.id)
    if (!subject || !evaluateChecklist(subject, campaign, peers).readyAllowed) {
      records[item.id] = { ...record, ready: false }
      changed = true
    }
  }
  return changed ? { ...state, jobs: { ...state.jobs, records } } : state
}
