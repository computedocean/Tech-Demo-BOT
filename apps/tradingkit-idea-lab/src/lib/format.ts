export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatPct(fraction: number, withSign = false): string {
  if (!Number.isFinite(fraction)) return "—"
  const pct = fraction * 100
  const body = `${Math.abs(pct).toFixed(2)}%`
  if (!withSign) return pct < 0 ? `-${body}` : body
  if (pct > 0) return `+${body}`
  if (pct < 0) return `-${body}`
  return body
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

export function formatAxisMoney(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
