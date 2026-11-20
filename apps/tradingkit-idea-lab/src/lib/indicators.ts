export function ema(values: number[], length: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN)
  if (length < 1 || values.length < length) return out
  let sum = 0
  for (let i = 0; i < length; i++) sum += values[i] ?? 0
  let prev = sum / length
  out[length - 1] = prev
  const alpha = 2 / (length + 1)
  for (let i = length; i < values.length; i++) {
    prev = alpha * (values[i] ?? 0) + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

export function sma(values: number[], length: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN)
  if (length < 1) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i] ?? 0
    if (i >= length) sum -= values[i - length] ?? 0
    if (i >= length - 1) out[i] = sum / length
  }
  return out
}

/** Wilder / Pine ta.rma. The seed is an SMA of the first `length` values. */
export function rma(values: number[], length: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN)
  if (length < 1 || values.length < length) return out
  let sum = 0
  for (let i = 0; i < length; i++) sum += values[i] ?? 0
  let prev = sum / length
  out[length - 1] = prev
  const alpha = 1 / length
  for (let i = length; i < values.length; i++) {
    prev = alpha * (values[i] ?? 0) + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

/** Pine-style RSI. The first close has no change, so the RMA is aligned to bar 1. */
export function rsi(closes: number[], length: number): number[] {
  const out = Array.from({ length: closes.length }, () => Number.NaN)
  if (closes.length < 2 || length < 1) return out
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const change = (closes[i] ?? 0) - (closes[i - 1] ?? 0)
    gains.push(Math.max(change, 0))
    losses.push(Math.max(-change, 0))
  }
  const avgGain = rma(gains, length)
  const avgLoss = rma(losses, length)
  for (let i = 0; i < avgGain.length; i++) {
    const gain = avgGain[i] ?? Number.NaN
    const loss = avgLoss[i] ?? Number.NaN
    if (!Number.isFinite(gain) || !Number.isFinite(loss)) continue
    if (loss === 0) {
      out[i + 1] = 100
    } else {
      const rs = gain / loss
      out[i + 1] = 100 - 100 / (1 + rs)
    }
  }
  return out
}

/** Highest value of the previous `length` bars, excluding the current bar. */
export function priorHighest(values: number[], length: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN)
  if (length < 1) return out
  for (let i = length; i < values.length; i++) {
    let max = -Infinity
    for (let j = i - length; j < i; j++) {
      const value = values[j] ?? Number.NaN
      if (value > max) max = value
    }
    out[i] = max
  }
  return out
}

/** Lowest value of the previous `length` bars, excluding the current bar. */
export function priorLowest(values: number[], length: number): number[] {
  const out = Array.from({ length: values.length }, () => Number.NaN)
  if (length < 1) return out
  for (let i = length; i < values.length; i++) {
    let min = Infinity
    for (let j = i - length; j < i; j++) {
      const value = values[j] ?? Number.NaN
      if (value < min) min = value
    }
    out[i] = min
  }
  return out
}
