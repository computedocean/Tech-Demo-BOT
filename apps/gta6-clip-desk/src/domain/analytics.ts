export type SimulatedAnalytics = {
  simulated: true
  label: 'Simulated'
  model: string
  views: number
  watchTimeSec: number
  completionRate: number
}

export const ANALYTICS_MODEL =
  'Dummy local model: views = 900 + hash(title|slot) % 4100; completion = 0.22 + (hash % 40) / 100; watchTimeSec = round(views * completion * trimSeconds). No payout term is computed.'

export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function simulateAnalytics(input: {
  title: string
  slot: string
  trimIn: number
  trimOut: number
}): SimulatedAnalytics {
  const seed = hashString(`${input.title}|${input.slot}`)
  const views = 900 + (seed % 4100)
  const completionRate = Math.round((0.22 + (seed % 40) / 100) * 100) / 100
  const trimSeconds = Math.max(0, input.trimOut - input.trimIn)
  const watchTimeSec = Math.round(views * completionRate * trimSeconds)
  return {
    simulated: true,
    label: 'Simulated',
    model: ANALYTICS_MODEL,
    views,
    watchTimeSec,
    completionRate,
  }
}
