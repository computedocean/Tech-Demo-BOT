/** Wilder / Pine-style smoothers used by the published Lens specification. */

export function ema(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  if (length <= 0 || values.length < length) return out
  const alpha = 2 / (length + 1)
  let sum = 0
  for (let i = 0; i < length; i++) sum += values[i]!
  let prev = sum / length
  out[length - 1] = prev
  for (let i = length; i < values.length; i++) {
    prev = alpha * values[i]! + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

export function emaAfterLeadingNulls(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  let start = 0
  while (start < values.length && values[start] == null) start++
  const compact: number[] = []
  for (let i = start; i < values.length; i++) {
    const value = values[i]
    if (value == null) return out
    compact.push(value)
  }
  const smoothed = ema(compact, length)
  for (let j = 0; j < smoothed.length; j++) out[start + j] = smoothed[j] ?? null
  return out
}

export function rma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  if (length <= 0 || values.length < length) return out
  let sum = 0
  for (let i = 0; i < length; i++) sum += values[i]!
  let prev = sum / length
  out[length - 1] = prev
  const alpha = 1 / length
  for (let i = length; i < values.length; i++) {
    prev = alpha * values[i]! + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

export function rmaAfterLeadingNulls(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  let start = 0
  while (start < values.length && values[start] == null) start++
  const compact: number[] = []
  for (let i = start; i < values.length; i++) {
    const value = values[i]
    if (value == null) return out
    compact.push(value)
  }
  const smoothed = rma(compact, length)
  for (let j = 0; j < smoothed.length; j++) out[start + j] = smoothed[j] ?? null
  return out
}

export function sma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  if (length <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!
    if (i >= length) sum -= values[i - length]!
    if (i >= length - 1) out[i] = sum / length
  }
  return out
}

/** Percent of the previous `length` values that are <= the current value. */
export function percentRank(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  if (length <= 0) return out
  for (let i = 0; i < values.length; i++) {
    const current = values[i]
    if (current == null || i < length) continue
    let rank = 0
    for (let back = 1; back <= length; back++) {
      const past = values[i - back]
      if (past != null && past <= current) rank += 1
    }
    out[i] = (100 * rank) / length
  }
  return out
}

export function rsi(closes: number[], length = 14): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: closes.length }, () => null)
  if (closes.length <= length) return out
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!
    gains.push(Math.max(change, 0))
    losses.push(Math.max(-change, 0))
  }
  const avgGain = rma(gains, length)
  const avgLoss = rma(losses, length)
  for (let i = 0; i < gains.length; i++) {
    const gain = avgGain[i]
    const loss = avgLoss[i]
    if (gain == null || loss == null) continue
    if (loss === 0) out[i + 1] = 100
    else if (gain === 0) out[i + 1] = 0
    else out[i + 1] = 100 - 100 / (1 + gain / loss)
  }
  return out
}

export function macdHistogram(closes: number[]): (number | null)[] {
  const fast = ema(closes, 12)
  const slow = ema(closes, 26)
  const line: (number | null)[] = closes.map((_, i) => {
    if (fast[i] == null || slow[i] == null) return null
    return fast[i]! - slow[i]!
  })
  const signal = emaAfterLeadingNulls(line, 9)
  return line.map((value, i) => {
    if (value == null || signal[i] == null) return null
    return value - signal[i]!
  })
}

export function trueRanges(highs: number[], lows: number[], closes: number[]): number[] {
  const tr: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i]! - lows[i]!)
      continue
    }
    tr.push(
      Math.max(
        highs[i]! - lows[i]!,
        Math.abs(highs[i]! - closes[i - 1]!),
        Math.abs(lows[i]! - closes[i - 1]!),
      ),
    )
  }
  return tr
}

export function atr(highs: number[], lows: number[], closes: number[], length = 14): (number | null)[] {
  return rma(trueRanges(highs, lows, closes), length)
}

export type Dmi = {
  diPlus: (number | null)[]
  diMinus: (number | null)[]
  adx: (number | null)[]
}

/** `ta.dmi(length, length)`: Wilder DI and ADX. */
export function dmi(highs: number[], lows: number[], closes: number[], length = 14): Dmi {
  const n = closes.length
  const plusDm: number[] = []
  const minusDm: number[] = []
  const tr = trueRanges(highs, lows, closes)
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      plusDm.push(0)
      minusDm.push(0)
      continue
    }
    const up = highs[i]! - highs[i - 1]!
    const down = lows[i - 1]! - lows[i]!
    plusDm.push(up > down && up > 0 ? up : 0)
    minusDm.push(down > up && down > 0 ? down : 0)
  }
  const smoothTr = rma(tr, length)
  const smoothPlus = rma(plusDm, length)
  const smoothMinus = rma(minusDm, length)
  const diPlus: (number | null)[] = Array.from({ length: n }, () => null)
  const diMinus: (number | null)[] = Array.from({ length: n }, () => null)
  const dx: (number | null)[] = Array.from({ length: n }, () => null)
  for (let i = 0; i < n; i++) {
    const trValue = smoothTr[i]
    const plus = smoothPlus[i]
    const minus = smoothMinus[i]
    if (trValue == null || plus == null || minus == null || trValue === 0) continue
    diPlus[i] = (100 * plus) / trValue
    diMinus[i] = (100 * minus) / trValue
    const sum = diPlus[i]! + diMinus[i]!
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(diPlus[i]! - diMinus[i]!)) / sum
  }
  return { diPlus, diMinus, adx: rmaAfterLeadingNulls(dx, length) }
}

/** Confirmed pivot. The value is written on the bar where `right` bars have closed after it. */
export function pivotHighs(values: number[], left: number, right: number): (number | null)[] {
  return pivots(values, left, right, "high")
}

export function pivotLows(values: number[], left: number, right: number): (number | null)[] {
  return pivots(values, left, right, "low")
}

function pivots(values: number[], left: number, right: number, mode: "high" | "low"): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null)
  for (let i = left + right; i < values.length; i++) {
    const pivotIndex = i - right
    const pivot = values[pivotIndex]!
    let extreme = true
    for (let j = pivotIndex - left; j <= pivotIndex + right; j++) {
      if (j === pivotIndex) continue
      const value = values[j]!
      if (mode === "high" ? value >= pivot : value <= pivot) {
        extreme = false
        break
      }
    }
    if (extreme) out[i] = pivot
  }
  return out
}
