import { generateCaptionVariants } from './captions.ts'
import { BUNDLED_CLIPS, toggleTag, type ClipRecord } from './clips.ts'
import type { QueueItem, SlotId } from './queue.ts'
import { createId, nextOpenSlot, rescheduleItem } from './queue.ts'
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
}

export type DeskState = {
  clips: ClipRecord[]
  selectedId: string
  tagFilter: string
  drafts: Record<string, ClipDraft>
  queue: QueueItem[]
  selectedQueueId: string | null
  notice: string | null
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

export function draftForClip(clip: ClipRecord): ClipDraft {
  const variant = generateCaptionVariants({ title: clip.title, tags: clip.tags })[0]
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
      const variant = generateCaptionVariants({ title: draft.title, tags: draft.tags }).find(
        (item) => item.id === action.variantId,
      )
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
      const variants = generateCaptionVariants({ title: draft.title, tags: draft.tags })
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
        drafts: { ...state.drafts, [action.clip.id]: draftForClip(action.clip) },
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
      const queue = state.queue.filter((item) => item.clipId !== action.clipId)
      const selectedId = state.selectedId === action.clipId ? clips[0]?.id ?? '' : state.selectedId
      const selectedQueueId = queue.some((item) => item.id === state.selectedQueueId)
        ? state.selectedQueueId
        : (queue[0]?.id ?? null)
      return { ...state, clips, drafts, queue, selectedId, selectedQueueId, notice: 'Upload removed.' }
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
        notice: 'Example week restored. Nothing is posted.',
      }
    }
    case 'removeQueueItem': {
      const queue = state.queue.filter((item) => item.id !== action.itemId)
      return {
        ...state,
        queue,
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
      const drafts = { ...state.drafts }
      for (const clip of clips) {
        if (!drafts[clip.id]) drafts[clip.id] = draftForClip(clip)
      }
      if (plan) {
        for (const [id, draft] of Object.entries(plan.drafts)) drafts[id] = draft
      }
      const selectedId = clips.some((clip) => clip.id === plan?.selectedId)
        ? (plan?.selectedId ?? state.selectedId)
        : clips.some((clip) => clip.id === state.selectedId)
          ? state.selectedId
          : (clips[0]?.id ?? '')
      const queue = plan?.queue ?? state.queue
      const selectedQueueId = queue.some((item) => item.id === plan?.selectedQueueId)
        ? (plan?.selectedQueueId ?? null)
        : queue.some((item) => item.id === state.selectedQueueId)
          ? state.selectedQueueId
          : (queue[0]?.id ?? null)
      return {
        clips,
        selectedId,
        tagFilter: plan?.tagFilter || state.tagFilter,
        drafts,
        queue,
        selectedQueueId,
        notice: null,
      }
    }
    default:
      return state
  }
}
