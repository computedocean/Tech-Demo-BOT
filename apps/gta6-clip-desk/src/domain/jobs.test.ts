import { describe, expect, test } from 'bun:test'
import { generateCaptionVariants } from './captions.ts'
import {
  buildCampaign,
  parseCampaignText,
  rankCampaigns,
  SAMPLE_CAMPAIGNS,
  SAMPLE_PASTE,
  type Campaign,
} from './campaigns.ts'
import { duplicateClipOnAccount, evaluateChecklist, type ChecklistCampaign, type ChecklistSubject } from './checklist.ts'
import { createInitialDeskState, deskReducer } from './desk.ts'
import { payoutForViews, payoutForWeek } from './payout.ts'
import {
  addIsoDays,
  buildFridayTitles,
  buildNightlyReport,
  isFridayDate,
  simulateCheckpointViews,
  TRACKER_CSV_COLUMNS,
  trackerExportRows,
  trackerToCsv,
  trackerToJson,
  type TrackedClip,
} from './tracker.ts'

const lantern = SAMPLE_CAMPAIGNS[0]
const rates = {
  payPer1k: lantern.payPer1k,
  budgetLeft: lantern.budgetLeft,
  minimumViews: lantern.minimumViews,
}

function subject(patch: Partial<ChecklistSubject> = {}): ChecklistSubject {
  return {
    id: 'sample-harbor',
    clipId: 'harbor-cruise',
    trimIn: 0.4,
    trimOut: 5.2,
    caption: 'Hold the line @lanterndesk',
    hook: 'Stay.',
    hashtags: ['#LanternRoute', '#OpenWorld'],
    platform: 'TikTok',
    account: 'sample.north',
    streamer: 'Nia Calder',
    width: 1080,
    height: 1920,
    contentPolicyReviewed: true,
    ...patch,
  }
}

function campaign(patch: Partial<ChecklistCampaign> = {}): ChecklistCampaign {
  return {
    platforms: [...lantern.platforms],
    streamers: [...lantern.streamers],
    requiredHashtags: [...lantern.requiredHashtags],
    requiredMentions: [...lantern.requiredMentions],
    minLengthSec: lantern.minLengthSec,
    maxLengthSec: lantern.maxLengthSec,
    bannedContent: [...lantern.bannedContent],
    ...patch,
  }
}

function check(id: string, patch?: Partial<ChecklistSubject>, rules?: Partial<ChecklistCampaign>) {
  const result = evaluateChecklist(subject(patch), campaign(rules), [
    { id: 'sample-harbor', clipId: 'harbor-cruise', account: patch?.account ?? 'sample.north' },
  ])
  const row = result.checks.find((item) => item.id === id)
  if (!row) throw new Error(`missing check ${id}`)
  return { row, readyAllowed: result.readyAllowed }
}

describe('campaign ranking', () => {
  test('orders sample campaigns by pay per 1K, then budget left', () => {
    const ranked = rankCampaigns(SAMPLE_CAMPAIGNS)
    expect(ranked.map((item) => item.id)).toEqual(['sample-lantern', 'sample-paper', 'sample-quiet'])
    expect(ranked[0]?.payPer1k).toBe(ranked[1]?.payPer1k)
    expect(ranked[0]?.budgetLeft).toBeGreaterThan(ranked[1]?.budgetLeft ?? 0)
  })

  test('breaks a full tie by name', () => {
    const ranked = rankCampaigns([
      { name: 'B', payPer1k: 5, budgetLeft: 10 },
      { name: 'A', payPer1k: 5, budgetLeft: 10 },
      { name: 'C', payPer1k: 9, budgetLeft: 1 },
      { name: 'D', payPer1k: 5, budgetLeft: 40 },
    ])
    expect(ranked.map((item) => item.name)).toEqual(['C', 'D', 'A', 'B'])
  })
})

describe('rule text parsing', () => {
  test('parses the bundled sample paste into campaign fields', () => {
    const parsed = parseCampaignText(SAMPLE_PASTE)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.draft).toMatchObject({
      name: 'Sample: Glasswater Run',
      payPer1k: 5.75,
      budgetLeft: 1260,
      minimumViews: 1200,
      platforms: ['TikTok', 'Shorts', 'X'],
      streamers: ['Ivo Lane', 'Sable Quinn'],
      requiredHashtags: ['#Glasswater', '#NightCut'],
      requiredMentions: ['@glassdesk'],
      minLengthSec: 3,
      maxLengthSec: 30,
      bannedContent: ['real brand logos', 'copyrighted music'],
    })
    const built = buildCampaign(parsed.draft, [])
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.campaign.label).toBe('Sample')
    expect(built.campaign.sample).toBe(true)
    expect(built.campaign.id).toBe('sample-glasswater-run')
    const ranked = rankCampaigns([...SAMPLE_CAMPAIGNS, built.campaign])
    expect(ranked.map((item) => item.id)).toEqual([
      'sample-lantern',
      'sample-paper',
      'sample-glasswater-run',
      'sample-quiet',
    ])
  })

  test('accepts equals, dashes, bullets, and warns when a field is missing', () => {
    const parsed = parseCampaignText(`
      CAMPAIGN NAME - Sample: Loose Rules
      Pay per 1K views - $4.50
      min views = 1 000
      Allowed platforms:
      - tiktok
      - myspace
      Allowed streamers:
      - Nia Calder
      - Ellis Voss
      clip length range: 30 to 8 seconds
    `)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.draft.name).toBe('Sample: Loose Rules')
    expect(parsed.draft.payPer1k).toBe(4.5)
    expect(parsed.draft.minimumViews).toBe(1000)
    expect(parsed.draft.budgetLeft).toBe(0)
    expect(parsed.draft.platforms).toEqual(['TikTok'])
    expect(parsed.draft.streamers).toEqual(['Nia Calder', 'Ellis Voss'])
    expect(parsed.draft.minLengthSec).toBe(8)
    expect(parsed.draft.maxLengthSec).toBe(30)
    expect(parsed.warnings.join(' ')).toContain('Budget left')
    expect(parsed.warnings.join(' ')).toContain('myspace')
    expect(parsed.warnings.join(' ')).toContain('Swapped')
  })

  test('rejects a paste with no name or no pay', () => {
    expect(parseCampaignText('Pay per 1K: 4').ok).toBe(false)
    expect(parseCampaignText('Campaign: Sample: Nameless').ok).toBe(false)
    const built = buildCampaign(
      {
        name: '',
        payPer1k: 1,
        budgetLeft: 1,
        minimumViews: 1,
        platforms: [],
        streamers: [],
        requiredHashtags: [],
        requiredMentions: [],
        minLengthSec: 8,
        maxLengthSec: 3,
        bannedContent: [],
      },
      [],
    )
    expect(built.ok).toBe(false)
  })
})

describe('payout math', () => {
  test('gates views under the minimum and caps the rest at budget left', () => {
    const under = payoutForViews({ views: 999, payPer1k: 10, budgetLeft: 100, minimumViews: 1000 })
    expect(under).toMatchObject({
      simulated: true,
      label: 'Simulated',
      eligible: false,
      raw: 9.99,
      paid: 0,
      reason: 'below-minimum',
    })
    const exact = payoutForViews({ views: 1000, payPer1k: 10, budgetLeft: 100, minimumViews: 1000 })
    expect(exact).toMatchObject({ eligible: true, raw: 10, paid: 10, reason: 'ok' })
    const capped = payoutForViews({ views: 5000, payPer1k: 10, budgetLeft: 20, minimumViews: 0 })
    expect(capped).toMatchObject({ eligible: true, raw: 50, paid: 20, reason: 'capped' })
    const emptyBudget = payoutForViews({ views: 5000, payPer1k: 10, budgetLeft: 0, minimumViews: 0 })
    expect(emptyBudget).toMatchObject({ eligible: true, paid: 0, reason: 'capped' })
    const none = payoutForViews({ views: 0, payPer1k: 8, budgetLeft: 420, minimumViews: 0 })
    expect(none.reason).toBe('no-views')
    expect(none.paid).toBe(0)
    expect(payoutForViews({ views: -40, payPer1k: 8, budgetLeft: 10, minimumViews: 0 }).reason).toBe('no-views')
    const fractional = payoutForViews({ views: 1500, payPer1k: 3.25, budgetLeft: 100, minimumViews: 0 })
    expect(fractional.paid).toBe(4.88)
  })

  test('spends a shared week budget in order and skips clips under the minimum', () => {
    const week = payoutForWeek(
      [
        { id: 'low', views: 10 },
        { id: 'high', views: 2000 },
        { id: 'next', views: 2000 },
      ],
      { payPer1k: 10, budgetLeft: 15, minimumViews: 1000 },
    )
    expect(week.label).toBe('Simulated')
    expect(week.simulated).toBe(true)
    expect(week.lines[0]).toMatchObject({ id: 'low', paid: 0, reason: 'below-minimum', eligible: false })
    expect(week.lines[1]).toMatchObject({ id: 'high', paid: 15, reason: 'capped', eligible: true })
    expect(week.lines[2]).toMatchObject({ id: 'next', paid: 0, reason: 'capped' })
    expect(week.total).toBe(15)
  })
})

describe('checklist rules', () => {
  test('length rule uses the campaign range, including the endpoints', () => {
    expect(check('length').row.pass).toBe(true)
    expect(check('length', { trimIn: 0, trimOut: 4 }).row.pass).toBe(true)
    expect(check('length', { trimIn: 0, trimOut: 30 }).row.pass).toBe(true)
    expect(check('length', { trimIn: 0, trimOut: 3.99 }).row.pass).toBe(false)
    expect(check('length', { trimIn: 0, trimOut: 30.01 }).row.pass).toBe(false)
  })

  test('aspect rule passes 9:16 and fails other ratios', () => {
    expect(check('aspect', { width: 1080, height: 1920 }).row.pass).toBe(true)
    expect(check('aspect', { width: 720, height: 1280 }).row.pass).toBe(true)
    expect(check('aspect', { width: 1920, height: 1080 }).row.pass).toBe(false)
    expect(check('aspect', { width: 1080, height: 1080 }).row.pass).toBe(false)
  })

  test('platform rule checks 1080x1920, the allowed list, and each length window', () => {
    const open = { platforms: ['TikTok', 'Reels', 'Shorts', 'X'] as Campaign['platforms'] }
    expect(check('platform', { platform: 'TikTok', width: 1080, height: 1920, trimIn: 0, trimOut: 10 }, open).row.pass).toBe(true)
    expect(check('platform', { platform: 'Reels', width: 1080, height: 1920, trimIn: 0, trimOut: 10 }, open).row.pass).toBe(true)
    expect(check('platform', { platform: 'Shorts', width: 1080, height: 1920, trimIn: 0, trimOut: 10 }, open).row.pass).toBe(true)
    expect(check('platform', { platform: 'X', width: 1080, height: 1920, trimIn: 0, trimOut: 10 }, open).row.pass).toBe(true)
    const small = check('platform', { width: 720, height: 1280 })
    expect(small.row.pass).toBe(false)
    expect(small.row.detail).toContain('1080×1920')
    const blocked = check('platform', { platform: 'Reels' })
    expect(blocked.row.pass).toBe(false)
    expect(blocked.row.detail).toContain('not on this campaign')
    expect(check('platform', { platform: 'TikTok', trimIn: 0, trimOut: 2 }, open).row.pass).toBe(false)
    expect(check('platform', { platform: 'Reels', trimIn: 0, trimOut: 2 }, open).row.pass).toBe(false)
    expect(check('platform', { platform: 'Shorts', trimIn: 0, trimOut: 2 }, open).row.pass).toBe(true)
    expect(check('platform', { platform: 'X', trimIn: 0, trimOut: 2 }, open).row.pass).toBe(true)
    expect(check('platform', { platform: 'TikTok', trimIn: 0, trimOut: 70 }, { ...open, minLengthSec: 1, maxLengthSec: 180 }).row.pass).toBe(false)
    expect(check('platform', { platform: 'Reels', trimIn: 0, trimOut: 70 }, { ...open, minLengthSec: 1, maxLengthSec: 180 }).row.pass).toBe(true)
    expect(check('platform', { platform: 'Shorts', trimIn: 0, trimOut: 70 }, { ...open, minLengthSec: 1, maxLengthSec: 180 }).row.pass).toBe(false)
    expect(check('platform', { platform: 'X', trimIn: 0, trimOut: 100 }, { ...open, minLengthSec: 1, maxLengthSec: 180 }).row.pass).toBe(true)
    expect(check('platform', { platform: 'X', trimIn: 0, trimOut: 150 }, { ...open, minLengthSec: 1, maxLengthSec: 180 }).row.pass).toBe(false)
    expect(check('platform', { platform: '' }).row.pass).toBe(false)
  })

  test('caption rule requires every hashtag and mention', () => {
    expect(check('caption').row.pass).toBe(true)
    const missingTag = check('caption', { hashtags: ['#OpenWorld'], caption: '@lanterndesk' })
    expect(missingTag.row.pass).toBe(false)
    expect(missingTag.row.detail).toContain('#LanternRoute')
    const missingMention = check('caption', { caption: 'No mention here' })
    expect(missingMention.row.pass).toBe(false)
    expect(missingMention.row.detail).toContain('@lanterndesk')
    expect(check('caption', { hashtags: ['#openworld'], caption: 'See #LanternRoute and @Lanterndesk' }).row.pass).toBe(true)
    const prefix = evaluateChecklist(
      subject({ hashtags: [], caption: '#OpenWorld only', hook: '' }),
      campaign({ requiredHashtags: ['#Open'], requiredMentions: [] }),
      [],
    )
    expect(prefix.checks.find((item) => item.id === 'caption')?.pass).toBe(false)
  })

  test('streamer rule accepts only an allowed name', () => {
    expect(check('streamer', { streamer: 'nia calder' }).row.pass).toBe(true)
    expect(check('streamer', { streamer: '' }).row.pass).toBe(false)
    expect(check('streamer', { streamer: 'Someone Else' }).row.pass).toBe(false)
  })

  test('policy rule stays failed until the manual tick', () => {
    const failed = check('policy', { contentPolicyReviewed: false })
    expect(failed.row.pass).toBe(false)
    expect(failed.row.detail.toLowerCase()).toContain('real brand logos')
    expect(check('policy', { contentPolicyReviewed: true }).row.pass).toBe(true)
  })

  test('ready stays blocked while any rule fails', () => {
    expect(check('policy', { contentPolicyReviewed: false }).readyAllowed).toBe(false)
    expect(evaluateChecklist(subject(), campaign(), []).readyAllowed).toBe(true)
  })
})

describe('duplicate detection', () => {
  test('fails the same clip on one account and allows a different account or clip', () => {
    const peers = [
      { id: 'a', clipId: 'harbor-cruise', account: 'sample.north' },
      { id: 'b', clipId: 'harbor-cruise', account: 'Sample.North' },
      { id: 'c', clipId: 'harbor-cruise', account: 'sample.south' },
      { id: 'd', clipId: 'lane-chase', account: 'sample.north' },
    ]
    expect(duplicateClipOnAccount(peers[0], peers)).toBe(true)
    expect(duplicateClipOnAccount(peers[2], peers)).toBe(false)
    expect(duplicateClipOnAccount(peers[3], peers)).toBe(false)
    const failed = evaluateChecklist(subject({ id: 'a', account: 'sample.north' }), campaign(), peers)
    expect(failed.checks.find((item) => item.id === 'duplicate')?.pass).toBe(false)
    expect(failed.readyAllowed).toBe(false)
    const blank = evaluateChecklist(subject({ account: '  ' }), campaign(), [])
    expect(blank.checks.find((item) => item.id === 'duplicate')?.pass).toBe(false)
  })
})

describe('tracker export and reports', () => {
  const clips: TrackedClip[] = [
    {
      id: 'harbor',
      title: 'Harbor cruise',
      platform: 'TikTok',
      hook: 'Stay, "please"',
      account: 'sample.north',
      postedOn: '2026-11-16',
      day1Views: 100,
      day3Views: 5000,
    },
    {
      id: 'chase',
      title: 'Lane chase',
      platform: 'Shorts',
      hook: 'Look',
      account: 'sample.south',
      postedOn: '2026-11-18',
      day1Views: 80,
      day3Views: 100,
    },
  ]

  test('csv uses date, clip, platform, hook, views, and paid', () => {
    const rows = trackerExportRows(clips, { payPer1k: 8, budgetLeft: 10, minimumViews: 2000 })
    const csv = trackerToCsv(rows)
    const [header, first, second] = csv.trimEnd().split('\n')
    expect(header).toBe(TRACKER_CSV_COLUMNS.join(','))
    expect(header).toBe('date,clip,platform,hook,views,paid')
    expect(first).toContain('2026-11-17')
    expect(first).toContain('Harbor cruise')
    expect(first).toContain(',0')
    expect(second).toContain('2026-11-19')
    expect(second).toContain('"Stay, ""please"""')
    expect(second?.endsWith(',10')).toBe(true)
    const under = trackerExportRows(
      [{ ...clips[1], day1Views: 50, day3Views: null }],
      { payPer1k: 8, budgetLeft: 100, minimumViews: 2000 },
    )
    expect(under[0]?.paid).toBe(0)
    const parsed = JSON.parse(trackerToJson(rows)) as Record<string, unknown>[]
    expect(Object.keys(parsed[0] ?? {})).toEqual([...TRACKER_CSV_COLUMNS])
    expect(addIsoDays('2026-11-30', 3)).toBe('2026-12-03')
  })

  test('simulate is deterministic and labeled simulated', () => {
    const first = simulateCheckpointViews('sample-harbor|sample.north|TikTok|Stay.')
    const second = simulateCheckpointViews('sample-harbor|sample.north|TikTok|Stay.')
    expect(second).toEqual(first)
    expect(first.label).toBe('Simulated')
    expect(first.simulated).toBe(true)
    expect(first.day3).toBeGreaterThanOrEqual(first.day1)
    expect(first.model.toLowerCase()).toContain('simulated')
  })

  test('nightly and Friday reports are template text with simulated earnings', () => {
    const report = buildNightlyReport({
      reportDate: '2026-11-23',
      campaignName: 'Sample: Lantern Route',
      clips: [
        clips[0],
        { ...clips[1], day3Views: 3000 },
        {
          id: 'grid',
          title: 'Grid pass',
          platform: 'TikTok',
          hook: 'Grid',
          account: 'sample.east',
          postedOn: '2026-11-19',
          day1Views: 100,
          day3Views: 100,
        },
        {
          id: 'roof',
          title: 'Rooftop hop',
          platform: 'Shorts',
          hook: 'Hop',
          account: 'sample.west',
          postedOn: '2026-11-19',
          day1Views: null,
          day3Views: 50,
        },
      ],
      rates: { payPer1k: 8, budgetLeft: 1000, minimumViews: 1000 },
    })
    expect(report.label).toBe('Simulated')
    expect(report.clipsPosted).toBe(4)
    expect(report.top3.map((item) => item.clip)).toEqual(['Harbor cruise', 'Lane chase', 'Grid pass'])
    expect(report.totalViews).toBe(5000 + 3000 + 100 + 50)
    expect(report.simulatedEarnings).toBe(40 + 24)
    expect(report.text).toContain('Nightly report (Simulated)')
    expect(report.text).toContain('Clips posted: 4')
    expect(report.text).toContain('Simulated earnings: $64.00')
    expect(report.text).toContain('Swap the hook on "Grid pass"')
    expect(report.text).toContain('No model key')
    expect(report.whatToChange.length).toBeGreaterThan(0)

    expect(isFridayDate('2026-11-20')).toBe(true)
    expect(isFridayDate('2026-11-23')).toBe(false)
    const friday = buildFridayTitles({
      reportDate: '2026-11-20',
      clips: [
        { title: 'Lane chase', hook: 'Look', views: 3000 },
        { title: 'Harbor cruise', hook: 'Stay', views: 5000 },
      ],
    })
    expect(friday.isFriday).toBe(true)
    expect(friday.titles[0]?.title).toBe('Harbor cruise')
    expect(friday.text).toContain('Friday best titles (Simulated)')
    const preview = buildFridayTitles({
      reportDate: '2026-11-23',
      clips: [{ title: 'Harbor cruise', hook: 'Stay', views: 10 }],
    })
    expect(preview.isFriday).toBe(false)
    expect(preview.text).toContain('preview')
    expect(preview.text).toContain('Simulated')
  })
})

describe('hook bank and ready gate', () => {
  test('custom hook templates feed the caption generator and defaults stay put', () => {
    const [first] = generateCaptionVariants({ title: 'Harbor cruise', tags: ['night'] })
    expect(first?.hook).toBe('Stay for the last beat of Harbor cruise.')
    const custom = generateCaptionVariants({
      title: 'Harbor cruise',
      tags: ['night'],
      hooks: [{ id: 'custom', label: 'Custom', pattern: 'Watch {title} twice.' }],
    })
    expect(custom).toHaveLength(1)
    expect(custom[0]?.hook).toBe('Watch Harbor cruise twice.')
  })

  test('mark ready is blocked until the checklist passes, including duplicates', () => {
    let state = createInitialDeskState()
    const blocked = deskReducer(state, { type: 'markReady', itemId: 'sample-harbor' })
    expect(blocked.jobs.records['sample-harbor']?.ready).toBe(false)
    expect(blocked.notice).toMatch(/failing check/i)

    state = deskReducer(state, {
      type: 'setJob',
      itemId: 'sample-harbor',
      patch: { streamer: 'Nia Calder', contentPolicyReviewed: true },
    })
    state = deskReducer(state, { type: 'insertRequiredTags', itemId: 'sample-harbor' })
    state = deskReducer(state, { type: 'markReady', itemId: 'sample-harbor' })
    expect(state.jobs.records['sample-harbor']?.ready).toBe(true)

    state = deskReducer(state, {
      type: 'setJob',
      itemId: 'sample-harbor',
      patch: { contentPolicyReviewed: false },
    })
    expect(state.jobs.records['sample-harbor']?.ready).toBe(false)

    state = deskReducer(state, {
      type: 'setJob',
      itemId: 'sample-harbor',
      patch: { contentPolicyReviewed: true },
    })
    state = deskReducer(state, { type: 'markReady', itemId: 'sample-harbor' })
    state = deskReducer(state, { type: 'enqueue' })
    const extra = state.queue.at(-1)
    expect(extra).toBeTruthy()
    state = deskReducer(state, { type: 'setJob', itemId: extra?.id ?? '', patch: { account: 'sample.north' } })
    const duplicated = deskReducer(state, { type: 'markReady', itemId: 'sample-harbor' })
    expect(duplicated.jobs.records['sample-harbor']?.ready).toBe(false)
    expect(duplicated.notice).toMatch(/failing check/i)

    const simulated = deskReducer(createInitialDeskState(), { type: 'simulateViews', itemId: 'sample-harbor' })
    const again = deskReducer(createInitialDeskState(), { type: 'simulateViews', itemId: 'sample-harbor' })
    expect(simulated.jobs.records['sample-harbor']?.day1Views).toBe(again.jobs.records['sample-harbor']?.day1Views)
    expect(simulated.jobs.records['sample-harbor']?.day3Views).toBeGreaterThanOrEqual(
      simulated.jobs.records['sample-harbor']?.day1Views ?? 0,
    )
  })
})
