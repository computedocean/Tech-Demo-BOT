import { PRESET_COLOR_IDS, type PresetColorId } from './types.ts'

/**
 * Preset swatches are intentionally chosen for this playground.
 * The spec leaves the six preset colors undefined so each app can pick its own.
 */
export const PRESET_COLORS: Record<PresetColorId, { name: string; hex: string }> = {
  '1': { name: 'Red', hex: '#e5484d' },
  '2': { name: 'Orange', hex: '#f76b15' },
  '3': { name: 'Yellow', hex: '#e6b325' },
  '4': { name: 'Green', hex: '#30a46c' },
  '5': { name: 'Cyan', hex: '#12a594' },
  '6': { name: 'Purple', hex: '#8e4ec6' },
}

export const DEFAULT_NODE_COLOR = '#a8a29e'
export const DEFAULT_EDGE_COLOR = '#57534e'

const PRESET_SET: ReadonlySet<string> = new Set(PRESET_COLOR_IDS)

export function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  if (PRESET_SET.has(color)) return PRESET_COLORS[color as PresetColorId].hex
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color
  return fallback
}
