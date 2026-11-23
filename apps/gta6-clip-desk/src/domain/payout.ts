export type PayoutReason = 'no-views' | 'below-minimum' | 'capped' | 'ok'

export type PayoutRates = {
  payPer1k: number
  budgetLeft: number
  minimumViews: number
}

export type PayoutLine = {
  id: string
  views: number
  eligible: boolean
  raw: number
  paid: number
  reason: PayoutReason
}

export type PayoutResult = PayoutLine & {
  simulated: true
  label: 'Simulated'
}

export type WeekPayout = {
  simulated: true
  label: 'Simulated'
  lines: PayoutLine[]
  total: number
}

function rawCents(views: number, payPer1k: number): number {
  if (!Number.isFinite(views) || !Number.isFinite(payPer1k)) return 0
  return Math.round((Math.max(0, views) * Math.max(0, payPer1k)) / 10)
}

function budgetCents(budgetLeft: number): number {
  if (!Number.isFinite(budgetLeft)) return 0
  return Math.max(0, Math.round(budgetLeft * 100))
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

function settle(
  views: number,
  rates: PayoutRates,
  budgetRemainingCents: number,
): { rawCents: number; paidCents: number; reason: PayoutReason; eligible: boolean } {
  const safeViews = Number.isFinite(views) ? Math.max(0, views) : 0
  const raw = rawCents(safeViews, rates.payPer1k)
  const minimum = Number.isFinite(rates.minimumViews) ? Math.max(0, rates.minimumViews) : 0
  if (safeViews <= 0) {
    return { rawCents: 0, paidCents: 0, reason: 'no-views', eligible: false }
  }
  if (safeViews < minimum) {
    return { rawCents: raw, paidCents: 0, reason: 'below-minimum', eligible: false }
  }
  const paid = Math.min(raw, Math.max(0, budgetRemainingCents))
  return {
    rawCents: raw,
    paidCents: paid,
    reason: paid < raw ? 'capped' : 'ok',
    eligible: true,
  }
}

export function payoutForViews(input: PayoutRates & { views: number }): PayoutResult {
  const settled = settle(input.views, input, budgetCents(input.budgetLeft))
  return {
    id: 'clip',
    views: Number.isFinite(input.views) ? Math.max(0, input.views) : 0,
    eligible: settled.eligible,
    raw: fromCents(settled.rawCents),
    paid: fromCents(settled.paidCents),
    reason: settled.reason,
    simulated: true,
    label: 'Simulated',
  }
}

export function payoutForWeek(
  clips: readonly { id: string; views: number }[],
  rates: PayoutRates,
): WeekPayout {
  let remaining = budgetCents(rates.budgetLeft)
  const lines = clips.map((clip) => {
    const settled = settle(clip.views, rates, remaining)
    remaining -= settled.paidCents
    return {
      id: clip.id,
      views: Number.isFinite(clip.views) ? Math.max(0, clip.views) : 0,
      eligible: settled.eligible,
      raw: fromCents(settled.rawCents),
      paid: fromCents(settled.paidCents),
      reason: settled.reason,
    }
  })
  const total = fromCents(lines.reduce((sum, line) => sum + Math.round(line.paid * 100), 0))
  return { simulated: true, label: 'Simulated', lines, total }
}

export function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`
}

export function payoutReasonLabel(reason: PayoutReason, minimumViews: number): string {
  if (reason === 'no-views') return 'Enter views to calculate a simulated payout.'
  if (reason === 'below-minimum') return `Under the ${Math.round(minimumViews).toLocaleString()} view minimum, so the simulated payout is $0.00.`
  if (reason === 'capped') return 'Simulated payout capped by budget left.'
  return 'Simulated payout at the sample rate. Nothing is owed.'
}
