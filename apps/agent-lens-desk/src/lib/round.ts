export function roundTo(value: number | null, decimals: number): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const scale = 10 ** decimals
  return Math.round((value + Number.EPSILON) * scale) / scale
}

export function isoClose(openSeconds: number, barSeconds: number): string {
  return new Date((openSeconds + barSeconds) * 1000).toISOString().replace(".000Z", "Z")
}

export function utcDay(openSeconds: number): string {
  return new Date(openSeconds * 1000).toISOString().slice(0, 10)
}
