import type { MediaFacts } from './types.ts'

/** Designed amplitude of the synthetic sample. Quiet, then loud, so a loudest-window proxy is stable. */
export const QUIET_SECONDS = 5
export const SAMPLE_DURATION = 20
export const SAMPLE_WIDTH = 640
export const SAMPLE_HEIGHT = 360
export const SAMPLE_FPS = 30
export const QUIET_AMPLITUDE = 0.05
export const LOUD_AMPLITUDE = 0.8

export const BUNDLED_SAMPLE = {
  id: 'synthetic-test-pattern',
  filename: 'pattern.mp4',
  publicUrl: '/sample/pattern.mp4',
  sourcePath: 'public/sample/pattern.mp4',
  captionsPath: 'public/sample/captions.srt',
  label: 'Synthetic test pattern',
}

export const BUNDLED_LEVELS: number[] = Array.from({ length: SAMPLE_DURATION }, (_, second) => {
  const amplitude = second < QUIET_SECONDS ? QUIET_AMPLITUDE : LOUD_AMPLITUDE
  return amplitude * amplitude
})

export const BUNDLED_FACTS: MediaFacts = {
  duration: SAMPLE_DURATION,
  width: SAMPLE_WIDTH,
  height: SAMPLE_HEIGHT,
  hasAudio: true,
}

export const CAPTIONS_SRT = `1
00:00:00,200 --> 00:00:04,800
Synthetic test pattern

2
00:00:05,000 --> 00:00:09,800
Loudest 15 seconds

3
00:00:10,000 --> 00:00:14,600
Captions burned locally
`

export const PROXY_NOTE =
  '“Best N seconds” is the loudest contiguous N-second window by mean power per second, the same kind of proxy as ffmpeg-skill scenes --rank-by audio. It is not a semantic quality model. The bundled clip is a synthetic testsrc2 + sine pattern: quiet for the first 5s, louder after that, so the best 15s starts at 5s. Captions are bundled timed text, not Whisper.'
