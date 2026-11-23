export type CropBox = {
  w: number
  h: number
  x: number
  y: number
}

export function parseAspect(value: string): { w: number; h: number } | null {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value.trim())
  if (!match) return null
  const w = Number(match[1])
  const h = Number(match[2])
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) return null
  return { w, h }
}

function evenDown(value: number): number {
  const floored = Math.floor(value)
  return floored - (floored % 2)
}

/** Centre crop to an aspect at the source size. Even sizes and offsets, for 4:2:0. */
export function centerCrop(sw: number, sh: number, aspectW: number, aspectH: number): CropBox {
  const target = aspectW / aspectH
  const source = sw / sh
  if (source >= target) {
    const h = Math.max(2, evenDown(sh))
    let w = Math.max(2, evenDown((h * aspectW) / aspectH))
    if (w > sw) w = Math.max(2, evenDown(sw))
    const x = Math.max(0, evenDown((sw - w) / 2))
    return { w, h, x, y: 0 }
  }
  const w = Math.max(2, evenDown(sw))
  let h = Math.max(2, evenDown((w * aspectH) / aspectW))
  if (h > sh) h = Math.max(2, evenDown(sh))
  const y = Math.max(0, evenDown((sh - h) / 2))
  return { w, h, x: 0, y }
}
