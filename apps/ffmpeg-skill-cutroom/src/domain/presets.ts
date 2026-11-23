import type { ExportPresetName } from './types.ts'

export type DeliveryPreset = {
  name: ExportPresetName
  label: string
  width: number
  height: number
  maxSeconds: number
  crf: string
  audioRate: string
  audioBitrate: string
  fps: number
  fit: 'crop' | 'pad'
  description: string
}

/** Frame, codec, and caps follow ffmpeg-skill 4.7.0 export.py presets. */
export const EXPORT_PRESETS: Record<ExportPresetName, DeliveryPreset> = {
  shorts: {
    name: 'shorts',
    label: 'Shorts',
    width: 1080,
    height: 1920,
    maxSeconds: 180,
    crf: '20',
    audioRate: '48000',
    audioBitrate: '128k',
    fps: 30,
    fit: 'crop',
    description: '1080×1920, 30 fps, max 180s, AAC 128k',
  },
  reels: {
    name: 'reels',
    label: 'Reels',
    width: 1080,
    height: 1920,
    maxSeconds: 90,
    crf: '20',
    audioRate: '48000',
    audioBitrate: '128k',
    fps: 30,
    fit: 'crop',
    description: '1080×1920, 30 fps, max 90s, AAC 128k',
  },
  x: {
    name: 'x',
    label: 'X',
    width: 1280,
    height: 720,
    maxSeconds: 140,
    crf: '22',
    audioRate: '44100',
    audioBitrate: '128k',
    fps: 30,
    fit: 'pad',
    description: '1280×720, max 140s, AAC 128k at 44.1 kHz',
  },
}

export const EXPORT_PRESET_NAMES: ExportPresetName[] = ['shorts', 'reels', 'x']
