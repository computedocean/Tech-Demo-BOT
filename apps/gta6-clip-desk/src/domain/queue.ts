export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const PERIODS = ['morning', 'afternoon', 'evening'] as const

export type DayId = (typeof DAYS)[number]
export type PeriodId = (typeof PERIODS)[number]
export type SlotId = `${DayId}-${PeriodId}`

export const DAY_LABELS: Record<DayId, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export const PERIOD_LABELS: Record<PeriodId, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

export type QueueItem = {
  id: string
  clipId: string
  title: string
  tags: string[]
  trimIn: number
  trimOut: number
  caption: string
  hook: string
  hashtags: string[]
  slot: SlotId
}

export function allSlots(): SlotId[] {
  return DAYS.flatMap((day) => PERIODS.map((period) => `${day}-${period}` as SlotId))
}

const SLOT_SET = new Set<string>(allSlots())

export function isSlotId(value: string): value is SlotId {
  return SLOT_SET.has(value)
}

export function slotLabel(slot: SlotId): string {
  const [day, period] = slot.split('-') as [DayId, PeriodId]
  return `${DAY_LABELS[day]} · ${PERIOD_LABELS[period]}`
}

export function rescheduleItem(items: readonly QueueItem[], itemId: string, slot: SlotId): QueueItem[] {
  if (!isSlotId(slot)) return items.map((item) => ({ ...item }))
  let found = false
  const next = items.map((item) => {
    if (item.id !== itemId) return { ...item }
    found = true
    return { ...item, slot }
  })
  return found ? next : items.map((item) => ({ ...item }))
}

export function nextOpenSlot(items: readonly QueueItem[]): SlotId {
  const used = new Set(items.map((item) => item.slot))
  for (const slot of allSlots()) {
    if (!used.has(slot)) return slot
  }
  return 'sun-evening'
}

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const stamp = Date.now().toString(36).slice(-4)
  return `${prefix}-${rand}${stamp}`
}
