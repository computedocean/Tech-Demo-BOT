export type TrimSuccess = { ok: true; startSec: number; endSec: number }
export type TrimFailure = { ok: false; reason: string }
export type TrimResult = TrimSuccess | TrimFailure

const EPSILON = 1e-3

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function validateTrim(startSec: number, endSec: number, durationSec: number): TrimResult {
  if (![startSec, endSec, durationSec].every((value) => Number.isFinite(value))) {
    return { ok: false, reason: 'In, out, and duration must be finite numbers.' }
  }
  if (durationSec <= 0) {
    return { ok: false, reason: 'Duration must be greater than zero.' }
  }
  if (startSec < -EPSILON) {
    return { ok: false, reason: 'In point must be within the clip.' }
  }
  if (endSec - durationSec > EPSILON) {
    return { ok: false, reason: 'Out point must be within the clip.' }
  }
  if (endSec - startSec <= EPSILON) {
    return { ok: false, reason: 'In point must be before the out point.' }
  }
  return {
    ok: true,
    startSec: round2(Math.max(0, startSec)),
    endSec: round2(Math.min(durationSec, endSec)),
  }
}
