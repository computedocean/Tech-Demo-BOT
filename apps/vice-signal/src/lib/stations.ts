export type Station = {
  id: string
  name: string
  tag: string
  frequency: number
  /** Hue in degrees for neon accent (avoid purple band ~270–300). */
  neonHue: number
  neonSat: number
  neonLit: number
  skyTop: string
  skyMid: string
  skyBottom: string
  water: string
  grain: number
  pulseMs: number
  sway: number
}

export const STATIONS: Station[] = [
  {
    id: 'wave',
    name: 'Wave Pirate',
    tag: 'Coast static',
    frequency: 103.1,
    neonHue: 178,
    neonSat: 0.72,
    neonLit: 0.62,
    skyTop: '#03161c',
    skyMid: '#0a3a44',
    skyBottom: '#145866',
    water: '#0c4a52',
    grain: 0.22,
    pulseMs: 3200,
    sway: 0.35,
  },
  {
    id: 'fever',
    name: 'Fever Coast',
    tag: 'Hot band',
    frequency: 105.5,
    neonHue: 8,
    neonSat: 0.88,
    neonLit: 0.58,
    skyTop: '#1a0610',
    skyMid: '#4a1028',
    skyBottom: '#8a2840',
    water: '#3a1830',
    grain: 0.48,
    pulseMs: 1400,
    sway: 0.85,
  },
  {
    id: 'palm',
    name: 'Palm Static',
    tag: 'Jungle bleed',
    frequency: 98.7,
    neonHue: 118,
    neonSat: 0.78,
    neonLit: 0.55,
    skyTop: '#06140a',
    skyMid: '#143820',
    skyBottom: '#2a6a38',
    water: '#123828',
    grain: 0.34,
    pulseMs: 2100,
    sway: 0.55,
  },
  {
    id: 'midnight',
    name: 'Midnight Broadcast',
    tag: 'After-hours',
    frequency: 91.2,
    neonHue: 28,
    neonSat: 0.82,
    neonLit: 0.52,
    skyTop: '#10060a',
    skyMid: '#3a1410',
    skyBottom: '#6a2a18',
    water: '#2a1418',
    grain: 0.4,
    pulseMs: 2800,
    sway: 0.4,
  },
  {
    id: 'gold',
    name: 'Leonida Gold',
    tag: 'Sunset strip',
    frequency: 88.4,
    neonHue: 48,
    neonSat: 0.9,
    neonLit: 0.6,
    skyTop: '#1a1008',
    skyMid: '#5a3810',
    skyBottom: '#b87828',
    water: '#3a2818',
    grain: 0.28,
    pulseMs: 2400,
    sway: 0.5,
  },
]

export function neonCss(station: Station, alpha = 1) {
  return `oklch(${station.neonLit} ${station.neonSat} ${station.neonHue} / ${alpha})`
}

export function nearestStation(freq: number): Station {
  return STATIONS.reduce((best, s) =>
    Math.abs(s.frequency - freq) < Math.abs(best.frequency - freq) ? s : best,
  )
}
