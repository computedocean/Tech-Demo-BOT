/**
 * Original command builder for this cut-room subset.
 * Tool names and flags follow ffmpeg-skill 4.7.0 (MIT):
 * https://github.com/kajisho5/ffmpeg-skill
 * The ffmpeg lines are the ones this subset actually runs. This file is not upstream source.
 */
import { centerCrop, parseAspect } from './geometry.ts'
import { EXPORT_PRESETS, type DeliveryPreset } from './presets.ts'
import { formatCommand } from './quote.ts'
import type { ExportPresetName, MediaFacts, StepFlag, ToolName } from './types.ts'

export type CompileIo = {
  input: string
  output: string
  srt: string
  facts: MediaFacts
}

export type Compiled = {
  commands: string[]
  argv: string[][]
  writesMedia: boolean
  summary: string
  note: string
  next: MediaFacts
}

const MEDIA_TOOLS = new Set<ToolName>(['cut', 'caption', 'fit', 'loudness', 'export'])

export function writesMedia(tool: ToolName): boolean {
  return MEDIA_TOOLS.has(tool)
}

export function toolLine(tool: ToolName, flags: readonly StepFlag[]): string {
  const parts: string[] = [tool]
  for (const flag of flags) {
    parts.push(flag.name)
    if (flag.value !== '') parts.push(flag.value)
  }
  return parts.join(' ')
}

function flag(flags: readonly StepFlag[], name: string): string | undefined {
  return flags.find((item) => item.name === name)?.value
}

function requireNumber(flags: readonly StepFlag[], name: string, fallback: string): number {
  const raw = flag(flags, name) ?? fallback
  if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) {
    throw new Error(`${name} must be a plain number`)
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
  return value
}

function assertToken(value: string, label: string): string {
  if (value.length === 0 || value.length > 240) throw new Error(`${label} is empty or too long`)
  if (/[\n\r\0;`$\\]/.test(value) || value.includes('..')) {
    throw new Error(`${label} contains unsupported characters`)
  }
  return value
}

function videoEncode(crf: string): string[] {
  return ['-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p']
}

function audioEncode(bitrate: string, rate: string): string[] {
  return ['-c:a', 'aac', '-b:a', bitrate, '-ar', rate]
}

function base(bin: 'ffmpeg' | 'ffprobe', extra: string[]): string[] {
  return bin === 'ffmpeg' ? [bin, '-hide_banner', '-nostdin', ...extra] : [bin, '-hide_banner', ...extra]
}

function finish(argvList: string[][], summary: string, note: string, next: MediaFacts, media: boolean): Compiled {
  return {
    argv: argvList,
    commands: argvList.map((argv) => formatCommand(argv)),
    writesMedia: media,
    summary,
    note,
    next,
  }
}

function compileProbe(io: CompileIo): Compiled {
  const argv = base('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels',
    '-of',
    'json',
    assertToken(io.input, 'input'),
  ])
  return finish(
    [argv],
    'Measure the source before editing',
    'probe reads duration, size, frame rate, and audio with ffprobe. It writes no media.',
    io.facts,
    false,
  )
}

function compileScenes(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const rank = flag(flags, '--rank-by') ?? 'audio'
  if (rank !== 'audio' && rank !== 'duration') throw new Error('--rank-by must be audio or duration')
  const target = requireNumber(flags, '--target', '15')
  if (target <= 0 || target > 24 * 60 * 60) throw new Error('--target is out of range')
  const argv = base('ffmpeg', [
    '-i',
    assertToken(io.input, 'input'),
    '-vn',
    '-af',
    'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
    '-f',
    'null',
    '-',
  ])
  const note =
    rank === 'audio'
      ? 'scenes --rank-by audio ranks by measured loudness, not by what the picture means. This command prints per-frame RMS and writes no media. The cut step uses the deterministic loudest window.'
      : 'Audio energy was not available, so scenes --rank-by duration keeps the opening window. This command writes no media.'
  return finish([argv], `Rank a ${target}s window by ${rank}`, note, io.facts, false)
}

function compileCut(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const start = requireNumber(flags, '--start', '0')
  const duration = requireNumber(flags, '--duration', '15')
  if (start < 0 || duration <= 0 || start > 24 * 60 * 60 || duration > 24 * 60 * 60) {
    throw new Error('cut times are out of range')
  }
  const accurate = flags.some((item) => item.name === '--accurate')
  const input = assertToken(io.input, 'input')
  const output = assertToken(io.output, 'output')
  const argv = base('ffmpeg', ['-y', '-i', input, '-ss', trimNumber(start), '-t', trimNumber(duration)])
  if (io.facts.hasAudio) argv.push('-map', '0:v:0', '-map', '0:a:0')
  else argv.push('-map', '0:v:0', '-an')
  if (accurate) {
    argv.push(...videoEncode('20'))
    if (io.facts.hasAudio) argv.push(...audioEncode('192k', '48000'))
  } else {
    argv.push('-c', 'copy')
  }
  argv.push('-movflags', '+faststart', output)
  const next: MediaFacts = {
    ...io.facts,
    duration,
  }
  return finish(
    [argv],
    `Trim ${trimNumber(duration)}s from ${trimNumber(start)}s`,
    accurate
      ? 'cut --accurate re-encodes so the in-point is frame-exact. The source file is not the output.'
      : 'cut stream-copies when --accurate is off. The source file is not the output.',
    next,
    true,
  )
}

function compileCaption(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const mode = flag(flags, '--mode') ?? 'burn'
  if (mode !== 'burn') throw new Error('this subset burns captions (--mode burn)')
  const fontSize = requireNumber(flags, '--font-size', '18')
  if (fontSize < 8 || fontSize > 96) throw new Error('--font-size must be 8–96')
  const srt = assertToken(io.srt, 'srt')
  const input = assertToken(io.input, 'input')
  const output = assertToken(io.output, 'output')
  const escaped = srt.replaceAll('\\', '\\\\').replaceAll(':', '\\:').replaceAll(',', '\\,')
  const style = `FontName=DejaVu Sans,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=28`
  const argv = base('ffmpeg', [
    '-y',
    '-i',
    input,
    '-vf',
    `subtitles=filename=${escaped}:force_style='${style}'`,
    ...videoEncode('20'),
    ...(io.facts.hasAudio ? ['-c:a', 'copy'] : ['-an']),
    '-movflags',
    '+faststart',
    output,
  ])
  return finish(
    [argv],
    'Burn the bundled timed captions',
    'caption --mode burn draws the SRT with libass. The default plan reframes first so the cues sit inside the 9:16 frame. The cues are synthetic timed text, not a speech transcript.',
    io.facts,
    true,
  )
}

function compileFit(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const aspect = flag(flags, '--aspect') ?? '9:16'
  const fit = flag(flags, '--fit') ?? 'crop'
  const parsed = parseAspect(aspect)
  if (!parsed) throw new Error('--aspect must look like 9:16')
  if (fit !== 'crop' && fit !== 'pad') throw new Error('--fit must be crop or pad')
  const input = assertToken(io.input, 'input')
  const output = assertToken(io.output, 'output')
  let filter: string
  let next: MediaFacts = { ...io.facts }
  if (fit === 'crop' && io.facts.width && io.facts.height) {
    const box = centerCrop(io.facts.width, io.facts.height, parsed.w, parsed.h)
    filter = `crop=${box.w}:${box.h}:${box.x}:${box.y},setsar=1`
    next = { ...next, width: box.w, height: box.h }
  } else if (fit === 'crop') {
    filter = `crop='trunc(ih*${parsed.w}/${parsed.h}/2)*2:ih:(in_w-out_w)/2:0',setsar=1`
    next = { ...next, width: null, height: null }
  } else if (io.facts.width && io.facts.height) {
    const box = centerCrop(io.facts.width, io.facts.height, parsed.w, parsed.h)
    filter = `scale=${box.w}:${box.h}:force_original_aspect_ratio=decrease,pad=${box.w}:${box.h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`
    next = { ...next, width: box.w, height: box.h }
  } else {
    filter = `scale=iw:ih:force_original_aspect_ratio=decrease,pad=iw:ih:(ow-iw)/2:(oh-ih)/2:black,setsar=1`
  }
  const argv = base('ffmpeg', [
    '-y',
    '-i',
    input,
    '-vf',
    filter,
    ...videoEncode('20'),
    ...(io.facts.hasAudio ? ['-c:a', 'copy'] : ['-an']),
    '-movflags',
    '+faststart',
    output,
  ])
  return finish(
    [argv],
    `Reframe to ${aspect} (${fit})`,
    'fit --aspect keeps a centre crop at the source size and does not enlarge. Delivery frames such as 1080×1920 are the export preset’s job.',
    next,
    true,
  )
}

function compileLoudness(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const lufs = requireNumber(flags, '-I', '-14')
  const tp = requireNumber(flags, '--tp', '-1')
  const lra = requireNumber(flags, '--lra', '11')
  if (lufs < -70 || lufs > -5) throw new Error('-I must be between -70 and -5 LUFS')
  if (tp < -9 || tp > 0) throw new Error('--tp must be between -9 and 0 dBTP')
  if (lra < 1 || lra > 50) throw new Error('--lra must be between 1 and 50')
  const input = assertToken(io.input, 'input')
  const output = assertToken(io.output, 'output')
  const argv = base('ffmpeg', [
    '-y',
    '-i',
    input,
    '-c:v',
    'copy',
    '-af',
    `loudnorm=I=${trimNumber(lufs)}:TP=${trimNumber(tp)}:LRA=${trimNumber(lra)}`,
    ...audioEncode('192k', '48000'),
    output,
  ])
  return finish(
    [argv],
    `Normalize to ${trimNumber(lufs)} LUFS / ${trimNumber(tp)} dBTP`,
    'loudness uses EBU R128 loudnorm. The default target is −14 LUFS and −1 dBTP, matching loudness -I -14 --tp -1. Video is stream-copied.',
    io.facts,
    true,
  )
}

function deliveryFilter(preset: DeliveryPreset): string {
  if (preset.fit === 'crop') {
    return `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase,crop=${preset.width}:${preset.height},setsar=1,fps=${preset.fps}`
  }
  return `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${preset.fps}`
}

function compileExport(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const name = flag(flags, '--preset')
  if (name !== 'shorts' && name !== 'reels' && name !== 'x') {
    throw new Error('--preset must be shorts, reels, or x')
  }
  const preset = EXPORT_PRESETS[name]
  const fit = flag(flags, '--fit') ?? preset.fit
  if (fit !== 'crop' && fit !== 'pad') throw new Error('--fit must be crop or pad')
  const normalize = flags.some((item) => item.name === '--normalize')
  const shaped: DeliveryPreset = { ...preset, fit }
  const input = assertToken(io.input, 'input')
  const output = assertToken(io.output, 'output')
  const argv = base('ffmpeg', [
    '-y',
    '-i',
    input,
    '-vf',
    deliveryFilter(shaped),
    ...(normalize ? ['-af', 'loudnorm=I=-14:TP=-1:LRA=11'] : []),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    preset.crf,
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(preset.fps),
    ...(io.facts.hasAudio ? audioEncode(preset.audioBitrate, preset.audioRate) : ['-an']),
    '-t',
    String(preset.maxSeconds),
    '-movflags',
    '+faststart',
    output,
  ])
  const next: MediaFacts = {
    ...io.facts,
    width: preset.width,
    height: preset.height,
    duration:
      io.facts.duration === null ? null : Math.min(io.facts.duration, preset.maxSeconds),
  }
  return finish(
    [argv],
    `Export ${preset.label} (${preset.width}×${preset.height})`,
    `${preset.description}. export --preset ${name} is a local file only. Nothing is posted.`,
    next,
    true,
  )
}

function compileCheck(flags: readonly StepFlag[], io: CompileIo): Compiled {
  const platform = flag(flags, '--platform') ?? 'shorts'
  if (platform !== 'shorts' && platform !== 'reels' && platform !== 'x') {
    throw new Error('--platform must be shorts, reels, or x')
  }
  const argv = base('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_name,width,height,avg_frame_rate,sample_rate,channels',
    '-of',
    'json',
    assertToken(io.input, 'input'),
  ])
  return finish(
    [argv],
    `Check the file against ${platform}`,
    `check --platform ${platform} inspects the file that export would write. This demo does not upload it.`,
    io.facts,
    false,
  )
}

export function compile(tool: ToolName, flags: readonly StepFlag[], io: CompileIo): Compiled {
  switch (tool) {
    case 'probe':
      return compileProbe(io)
    case 'scenes':
      return compileScenes(flags, io)
    case 'cut':
      return compileCut(flags, io)
    case 'caption':
      return compileCaption(flags, io)
    case 'fit':
      return compileFit(flags, io)
    case 'loudness':
      return compileLoudness(flags, io)
    case 'export':
      return compileExport(flags, io)
    case 'check':
      return compileCheck(flags, io)
    default: {
      const neverTool: never = tool
      throw new Error(`unknown tool ${neverTool}`)
    }
  }
}

export function trimNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 1000) / 1000)
}

export function presetName(flags: readonly StepFlag[]): ExportPresetName | null {
  const name = flag(flags, '--preset') ?? flag(flags, '--platform')
  if (name === 'shorts' || name === 'reels' || name === 'x') return name
  return null
}
