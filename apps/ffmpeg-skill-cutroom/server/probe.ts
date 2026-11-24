import { runCommand } from './ffmpeg.ts'
import type { MediaFacts } from '../src/domain/types.ts'

export type ProbeReport = MediaFacts & {
  fps: string | null
  size: number | null
  videoCodec: string | null
  audioCodec: string | null
}

type ProbeJson = {
  format?: { duration?: string; size?: string }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    avg_frame_rate?: string
    sample_rate?: string
    channels?: number
  }>
}

export async function probeFile(file: string): Promise<ProbeReport | null> {
  const result = await runCommand([
    'ffprobe',
    '-hide_banner',
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    file,
  ])
  if (result.code !== 0) return null
  let parsed: ProbeJson
  try {
    parsed = JSON.parse(result.stdout) as ProbeJson
  } catch {
    return null
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video')
  const audio = parsed.streams?.find((stream) => stream.codec_type === 'audio')
  const duration = Number(parsed.format?.duration)
  const size = Number(parsed.format?.size)
  return {
    duration: Number.isFinite(duration) ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasAudio: Boolean(audio),
    fps: video?.avg_frame_rate ?? null,
    size: Number.isFinite(size) ? size : null,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
  }
}
