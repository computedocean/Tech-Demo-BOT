import { GripVertical, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { DAYS, DAY_LABELS, PERIODS, PERIOD_LABELS, allSlots, isSlotId, slotLabel } from '../domain/queue.ts'
import type { DayId, QueueItem, SlotId } from '../domain/queue.ts'
import { Button } from './ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.tsx'

type WeekBoardProps = {
  queue: QueueItem[]
  selectedId: string | null
  onSelect: (itemId: string) => void
  onReschedule: (itemId: string, slot: SlotId) => void
  onRemove: (itemId: string) => void
  onRestore: () => void
}

function weekDates(now = new Date()): Record<DayId, string> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekday = today.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  today.setDate(today.getDate() + mondayOffset)
  const labels = {} as Record<DayId, string>
  DAYS.forEach((day, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    labels[day] = `${date.getMonth() + 1}/${date.getDate()}`
  })
  return labels
}

export function WeekBoard({
  queue,
  selectedId,
  onSelect,
  onReschedule,
  onRemove,
  onRestore,
}: WeekBoardProps) {
  const [over, setOver] = useState<SlotId | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; title: string } | null>(null)
  const dragId = useRef<string | null>(null)
  const dates = useMemo(() => weekDates(), [])
  const slots = allSlots()

  function slotFromPoint(x: number, y: number): SlotId | null {
    const under = document.elementFromPoint(x, y)
    const slotEl = under?.closest<HTMLElement>('[data-slot-id]')
    const slot = slotEl?.dataset.slotId ?? ''
    return isSlotId(slot) ? slot : null
  }

  function beginDrag(event: PointerEvent<HTMLElement>, itemId: string) {
    const target = event.target as HTMLElement
    if (target.closest('select, option, [data-no-drag]')) return
    dragId.current = itemId
    event.currentTarget.setPointerCapture(event.pointerId)
    const title = queue.find((item) => item.id === itemId)?.title ?? 'Cut'
    setGhost({ x: event.clientX, y: event.clientY, title })
    onSelect(itemId)
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    if (!dragId.current) return
    setGhost((current) =>
      current ? { ...current, x: event.clientX, y: event.clientY } : current,
    )
    setOver(slotFromPoint(event.clientX, event.clientY))
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const itemId = dragId.current
    dragId.current = null
    const slot = slotFromPoint(event.clientX, event.clientY)
    setGhost(null)
    setOver(null)
    if (itemId && slot) onReschedule(itemId, slot)
  }

  return (
    <Card data-testid="week-board">
      <CardHeader>
        <CardTitle>Weekly queue</CardTitle>
        <CardDescription>
          Drag a cut onto another slot, or pick a slot from the list. This is a local plan. Nothing is posted.
        </CardDescription>
        <Button type="button" variant="outline" size="sm" data-testid="restore-week" onClick={onRestore}>
          Restore example week
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="grid min-w-[880px] grid-cols-7 gap-2">
          {DAYS.map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <div className="px-1">
                <p className="text-sm font-medium">{DAY_LABELS[day]}</p>
                <p className="text-xs text-muted-foreground">{dates[day]}</p>
              </div>
              {PERIODS.map((period) => {
                const slot = `${day}-${period}` as SlotId
                const items = queue.filter((item) => item.slot === slot)
                return (
                  <div
                    key={slot}
                    data-testid={`slot-${slot}`}
                    data-slot-id={slot}
                    className={`flex min-h-28 flex-col gap-1.5 rounded-lg border border-dashed p-1.5 ${over === slot ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
                  >
                    <p className="px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                      {PERIOD_LABELS[period]}
                    </p>
                    {items.map((item) => (
                      <article
                        key={item.id}
                        data-testid={`queue-item-${item.id}`}
                        className={`rounded-md bg-card p-1.5 text-xs ring-1 ${item.id === selectedId ? 'ring-primary' : 'ring-foreground/10'}`}
                        onPointerDown={(event) => beginDrag(event, item.id)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
        onPointerCancel={() => {
          dragId.current = null
          setGhost(null)
          setOver(null)
        }}
                      >
                        <div className="flex items-start gap-1">
                          <button
                            type="button"
                            data-testid={`queue-drag-${item.id}`}
                            aria-label={`Drag ${item.title} to another slot`}
                            className="mt-0.5 cursor-grab touch-none text-muted-foreground"
                          >
                            <GripVertical className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onSelect(item.id)}
                          >
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="block truncate text-muted-foreground">{item.hook}</span>
                          </button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            data-no-drag
                            aria-label={`Remove ${item.title} from the queue`}
                            onClick={() => onRemove(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <label className="mt-1 block text-[10px] text-muted-foreground">
                          Slot
                          <select
                            className="mt-0.5 h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs text-foreground"
                            aria-label={`Planned slot for ${item.title}`}
                            value={item.slot}
                            onChange={(event) => onReschedule(item.id, event.target.value as SlotId)}
                          >
                            {slots.map((option) => (
                              <option key={option} value={option}>
                                {slotLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </CardContent>
      {ghost
        ? createPortal(
            <div
              data-testid="drag-ghost"
              className="pointer-events-none fixed z-50 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-lg"
              style={{ left: ghost.x + 14, top: ghost.y + 14 }}
            >
              {ghost.title}
            </div>,
            document.body,
          )
        : null}
    </Card>
  )
}
