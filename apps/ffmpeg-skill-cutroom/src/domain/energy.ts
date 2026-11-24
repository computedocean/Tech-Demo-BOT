export type LoudestWindow = {
  start: number
  end: number
  seconds: number
  score: number
}

/**
 * Deterministic loudest-window proxy.
 * `levels` is mean power for each whole second, index 0 at t=0.
 * Ties keep the earliest start.
 */
export function loudestWindow(levels: readonly number[], seconds: number): LoudestWindow {
  const requested = Math.max(0, seconds)
  if (levels.length === 0 || requested === 0) {
    return { start: 0, end: 0, seconds: 0, score: 0 }
  }
  const width = Math.min(levels.length, Math.max(1, Math.round(requested)))
  let bestStart = 0
  let bestScore = Number.NEGATIVE_INFINITY
  const last = levels.length - width
  for (let start = 0; start <= last; start += 1) {
    let score = 0
    for (let offset = 0; offset < width; offset += 1) {
      score += levels[start + offset] ?? 0
    }
    if (score > bestScore) {
      bestScore = score
      bestStart = start
    }
  }
  return {
    start: bestStart,
    end: bestStart + width,
    seconds: width,
    score: bestScore / width,
  }
}
