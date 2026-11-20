function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  ctx.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  hook: string,
  caption: string,
) {
  ctx.fillStyle = '#101418'
  ctx.fillRect(0, 0, width, height)
  drawCover(ctx, video, width, height)
  const gradient = ctx.createLinearGradient(0, height * 0.55, 0, height)
  gradient.addColorStop(0, 'rgba(8, 10, 14, 0)')
  gradient.addColorStop(1, 'rgba(8, 10, 14, 0.88)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, height * 0.55, width, height * 0.45)

  const padX = Math.round(width * 0.08)
  const maxWidth = width - padX * 2
  ctx.fillStyle = '#f3ecdf'
  ctx.font = '600 15px sans-serif'
  const hookLines = wrapLines(ctx, hook, maxWidth, 2)
  ctx.font = '600 22px sans-serif'
  const captionLines = wrapLines(ctx, caption, maxWidth, 4)
  const captionHeight = captionLines.length * 28
  let y = height - Math.round(height * 0.08) - captionHeight - hookLines.length * 20
  ctx.font = '600 15px sans-serif'
  ctx.fillStyle = '#e4d3b4'
  for (const line of hookLines) {
    ctx.fillText(line, padX, y)
    y += 20
  }
  y += 6
  ctx.font = '600 22px sans-serif'
  ctx.fillStyle = '#f7f4ef'
  for (const line of captionLines) {
    ctx.fillText(line, padX, y)
    y += 28
  }
}

function waitFor(target: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Could not read the clip for the preview burn.'))
    }
    const cleanup = () => {
      target.removeEventListener(event, onReady)
      target.removeEventListener('error', onError)
    }
    target.addEventListener(event, onReady)
    target.addEventListener('error', onError)
  })
}

export async function burnCaptionPreview(options: {
  src: string
  trimIn: number
  trimOut: number
  hook: string
  caption: string
}): Promise<Blob> {
  const video = document.createElement('video')
  video.src = options.src
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  await waitFor(video, 'loadedmetadata')
  const canvas = document.createElement('canvas')
  canvas.width = 360
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas preview is unavailable in this browser.')
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record a canvas preview.')
  }
  const stream = canvas.captureStream(15)
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })
  recorder.start(100)
  video.currentTime = options.trimIn
  await waitFor(video, 'seeked')
  await video.play()
  const end = options.trimOut
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Preview burn timed out.'))
    }, Math.max(2000, (end - options.trimIn) * 1000 + 2500))
    const draw = () => {
      paintFrame(ctx, video, canvas.width, canvas.height, options.hook, options.caption)
      if (video.ended || video.currentTime >= end - 0.03) {
        window.clearTimeout(timeout)
        video.pause()
        resolve()
        return
      }
      requestAnimationFrame(draw)
    }
    draw()
  })
  if (recorder.state !== 'inactive') recorder.stop()
  await stopped
  stream.getTracks().forEach((track) => track.stop())
  video.pause()
  video.removeAttribute('src')
  video.load()
  if (chunks.length === 0) throw new Error('The preview burn produced an empty file.')
  return new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
}
