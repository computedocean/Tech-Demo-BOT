import type { DeskState, PersistedPlan } from '../domain/desk.ts'
import { isSlotId, type QueueItem } from '../domain/queue.ts'

const KEY = 'clip-desk-plan-v1'

function isQueueItem(value: unknown): value is QueueItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<QueueItem>
  return (
    typeof item.id === 'string' &&
    typeof item.clipId === 'string' &&
    typeof item.title === 'string' &&
    Array.isArray(item.tags) &&
    typeof item.trimIn === 'number' &&
    typeof item.trimOut === 'number' &&
    typeof item.caption === 'string' &&
    typeof item.hook === 'string' &&
    Array.isArray(item.hashtags) &&
    typeof item.slot === 'string' &&
    isSlotId(item.slot)
  )
}

export function loadPlan(): PersistedPlan | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedPlan>
    if (parsed.version !== 1 || !parsed.drafts || typeof parsed.drafts !== 'object') return null
    const queue = Array.isArray(parsed.queue) ? parsed.queue.filter(isQueueItem) : []
    return {
      version: 1,
      selectedId: typeof parsed.selectedId === 'string' ? parsed.selectedId : '',
      tagFilter: typeof parsed.tagFilter === 'string' ? parsed.tagFilter : 'all',
      drafts: parsed.drafts,
      queue,
      selectedQueueId: typeof parsed.selectedQueueId === 'string' ? parsed.selectedQueueId : null,
    }
  } catch {
    return null
  }
}

export function savePlan(state: DeskState): void {
  const plan: PersistedPlan = {
    version: 1,
    selectedId: state.selectedId,
    tagFilter: state.tagFilter,
    drafts: state.drafts,
    queue: state.queue,
    selectedQueueId: state.selectedQueueId,
  }
  localStorage.setItem(KEY, JSON.stringify(plan))
}
