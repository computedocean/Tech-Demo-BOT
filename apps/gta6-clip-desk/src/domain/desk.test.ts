import { describe, expect, test } from 'bun:test'
import { simulateAnalytics } from './analytics.ts'
import { generateCaptionVariants } from './captions.ts'
import { BUNDLED_CLIPS, filterClips, toggleTag } from './clips.ts'
import { createInitialDeskState, deskReducer } from './desk.ts'
import { EXPORT_FIELDS, queueToCsv, queueToJson } from './export.ts'
import { rescheduleItem, type QueueItem } from './queue.ts'
import { buildRewriteRequest } from './rewrite-request.ts'
import { validateTrim } from './trim.ts'

describe('library tagging and filter', () => {
  test('filters by tag and keeps the full library on all', () => {
    const clips = [
      { id: 'a', tags: ['night', 'city'] },
      { id: 'b', tags: ['stunt', 'funny'] },
      { id: 'c', tags: ['Chase'] },
    ]
    expect(filterClips(clips, 'all').map((clip) => clip.id)).toEqual(['a', 'b', 'c'])
    expect(filterClips(clips, 'funny').map((clip) => clip.id)).toEqual(['b'])
    expect(filterClips(clips, 'CHASE').map((clip) => clip.id)).toEqual(['c'])
    expect(filterClips(clips, 'cruise')).toEqual([])
    expect(filterClips(BUNDLED_CLIPS, 'night').map((clip) => clip.id)).toEqual([
      'harbor-cruise',
      'grid-pass',
    ])
  })

  test('toggleTag adds and removes without caring about case', () => {
    const tagged = toggleTag(['night'], 'chase')
    expect(tagged).toEqual(['night', 'chase'])
    expect(filterClips([{ id: 'a', tags: tagged }], 'chase')).toHaveLength(1)
    expect(toggleTag(tagged, 'Night')).toEqual(['chase'])
  })
})

describe('trim validation', () => {
  test('accepts an in point before the out point inside the duration', () => {
    expect(validateTrim(0.5, 4, 6)).toEqual({ ok: true, startSec: 0.5, endSec: 4 })
    expect(validateTrim(0, 6, 6)).toEqual({ ok: true, startSec: 0, endSec: 6 })
  })

  test('rejects in >= out and points outside the duration', () => {
    expect(validateTrim(3, 3, 6).ok).toBe(false)
    expect(validateTrim(4, 2, 6).ok).toBe(false)
    expect(validateTrim(-0.2, 3, 6)).toMatchObject({ ok: false })
    expect(validateTrim(1, 6.4, 6)).toMatchObject({ ok: false })
    expect(validateTrim(Number.NaN, 2, 6).ok).toBe(false)
  })
})

describe('template captions', () => {
  test('builds several editable variants with no key', () => {
    const input = { title: 'Harbor cruise', tags: ['night', 'cruise'] }
    const first = generateCaptionVariants(input)
    const second = generateCaptionVariants(input)
    expect(first.length).toBeGreaterThanOrEqual(3)
    expect(first).toEqual(second)
    expect(new Set(first.map((variant) => variant.id)).size).toBe(first.length)
    for (const variant of first) {
      expect(variant.hook.length).toBeGreaterThan(0)
      expect(variant.caption.length).toBeGreaterThan(0)
      expect(variant.hashtags.length).toBeGreaterThan(0)
      expect(variant.hashtags.every((tag) => tag.startsWith('#'))).toBe(true)
      expect(`${variant.hook} ${variant.caption}`).toContain('Harbor cruise')
    }
    expect(first[0].hook).not.toBe(first[1].hook)
  })
})

describe('queue reschedule', () => {
  const items: QueueItem[] = [
    {
      id: 'sample-harbor',
      clipId: 'harbor-cruise',
      title: 'Harbor cruise',
      tags: ['night'],
      trimIn: 0.4,
      trimOut: 5.2,
      caption: 'Hold the line.',
      hook: 'Stay.',
      hashtags: ['#ClipDesk'],
      slot: 'mon-morning',
    },
    {
      id: 'sample-chase',
      clipId: 'lane-chase',
      title: 'Lane chase',
      tags: ['chase'],
      trimIn: 0,
      trimOut: 4,
      caption: 'Two shapes.',
      hook: 'Look.',
      hashtags: ['#OpenWorld'],
      slot: 'wed-evening',
    },
  ]

  test('updates the planned slot and leaves the other item', () => {
    const next = rescheduleItem(items, 'sample-harbor', 'fri-evening')
    expect(next.find((item) => item.id === 'sample-harbor')?.slot).toBe('fri-evening')
    expect(next.find((item) => item.id === 'sample-chase')?.slot).toBe('wed-evening')
    expect(items[0].slot).toBe('mon-morning')
  })

  test('reducer reschedule updates the planned slot', () => {
    const state = createInitialDeskState()
    const next = deskReducer(state, {
      type: 'reschedule',
      itemId: 'sample-chase',
      slot: 'sun-morning',
    })
    expect(next.queue.find((item) => item.id === 'sample-chase')?.slot).toBe('sun-morning')
    expect(next.queue.find((item) => item.id === 'sample-harbor')?.slot).toBe('mon-morning')
  })
})

describe('export fields', () => {
  test('JSON and CSV include the scheduled fields', () => {
    const [item] = createInitialDeskState().queue
    const parsed = JSON.parse(queueToJson([item])) as Record<string, unknown>[]
    expect(Object.keys(parsed[0] ?? {})).toEqual([...EXPORT_FIELDS])
    expect(parsed[0]).toMatchObject({
      clipId: item.clipId,
      title: item.title,
      tags: item.tags,
      trimIn: item.trimIn,
      trimOut: item.trimOut,
      caption: item.caption,
      hook: item.hook,
      hashtags: item.hashtags,
      slot: item.slot,
    })

    const csv = queueToCsv([
      { ...item, caption: 'Line, with comma', title: 'Quote "cut"' },
    ])
    const [header, row] = csv.trimEnd().split('\n')
    expect(header).toBe(EXPORT_FIELDS.join(','))
    expect(row).toContain(item.clipId)
    expect(row).toContain(item.slot)
    expect(row).toContain(item.tags.join('|'))
    expect(row).toContain('"Line, with comma"')
    expect(row).toContain('"Quote ""cut"""')
    expect(row).toContain(String(item.trimIn))
    expect(row).toContain(String(item.trimOut))
  })
})

describe('simulated analytics', () => {
  test('labels fixture numbers and omits payout fields', () => {
    const input = { title: 'Harbor cruise', slot: 'mon-morning', trimIn: 0.4, trimOut: 5.2 }
    const stats = simulateAnalytics(input)
    expect(stats.simulated).toBe(true)
    expect(stats.label).toBe('Simulated')
    expect(stats.model.toLowerCase()).toContain('dummy local model')
    expect(stats).not.toHaveProperty('revenue')
    expect(JSON.stringify(stats).toLowerCase()).not.toContain('revenue')
    expect(simulateAnalytics(input)).toEqual(stats)
    const trimSeconds = input.trimOut - input.trimIn
    expect(stats.watchTimeSec).toBe(Math.round(stats.views * stats.completionRate * trimSeconds))
    expect(stats.views).toBeGreaterThanOrEqual(900)
    expect(stats.completionRate).toBeGreaterThan(0)
    expect(stats.completionRate).toBeLessThan(1)
  })
})

describe('rewrite request', () => {
  test('sends text fields only', () => {
    const body = buildRewriteRequest({
      title: 'Harbor cruise',
      tags: ['night'],
      hook: 'Stay.',
      caption: 'Hold.',
      hashtags: ['#GTA6'],
    })
    expect(Object.keys(body).sort()).toEqual(['caption', 'hashtags', 'hook', 'tags', 'title'])
    expect(JSON.stringify(body)).not.toMatch(/src|blob|mp4|key/i)
  })
})
