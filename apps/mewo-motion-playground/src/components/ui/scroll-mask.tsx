import * as React from "react"
import { cn } from "@/lib/utils"

export type ScrollMaskVariant = "iris" | "wipe" | "curtain" | "slats" | "grid" | "type"

export interface ScrollMaskProps extends React.ComponentProps<"section"> {
  /** Which mask geometry drives the reveal. */
  variant?: ScrollMaskVariant
  /** Image revealed through the mask. */
  src?: string
  /** Alternative text for the image. */
  alt?: string
  /** Word carved out of the frame in the type variant. */
  word?: string
  /** Scroll runway beyond the pinned viewport, in viewport heights. */
  scrollLength?: number
  /** Fraction of the runway after which the reveal has fully opened. */
  settle?: number
  /** Seconds the reveal trails the scroll position. 0 snaps instantly. */
  smooth?: number
  /** Edge softness of the mask, as a percentage of the frame. */
  feather?: number
  /** Delay spread across pieces. 0 fires them together. */
  stagger?: number
  /** Strip count for slats, column count for grid. */
  columns?: number
  /** Horizontal anchor of the reveal, as a percentage. */
  originX?: number
  /** Vertical anchor of the reveal, as a percentage. */
  originY?: number
  /** Sweep direction of the wipe variant, in degrees. */
  angle?: number
  /** Scale the image starts at before settling back to 1. */
  zoom?: number
  /** How the image fills the frame. */
  fit?: "cover" | "contain"
  /** Corner radius of the frame, in pixels. */
  radius?: number
  /** Opacity of the scrim laid over the image. */
  overlay?: number
  /** Colour behind the frame. */
  background?: string
  /** Fade children in as the reveal completes. */
  revealContent?: boolean
  /** Hold the reveal steady on the scroll position instead of damping toward it. */
  calm?: boolean
}

export const DEFAULT_SRC = "https://cataas.com/cat/fogXmHYpuMV51EaN"

// Stops used to draw one feathered mask edge.
const FEATHER_STEPS = 14
// Slats slide in this far, as a percentage of their height, and reach full
// opacity a little before they land.
const SLAT_TRAVEL = 62
const SLAT_FADE = 1.9
// Grid cells grow out of this scale as they fade in.
const CELL_SCALE = 0.9
// The word starts at this fraction of its final size; the rest of the frame
// fills in once the reveal is past TYPE_FILL_START.
const TYPE_SCALE = 0.42
const TYPE_FILL_START = 0.54
// Children fade in across this stretch of the eased reveal, rising as they do.
const CONTENT_START = 0.5
const CONTENT_END = 0.94
const CONTENT_RISE = 20
// Below this scale an iris window is a point; it is hidden rather than drawn.
const MIN_SCALE = 0.002

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const smoothstep = (t: number) => t * t * (3 - 2 * t)
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * Where the opaque edge of the mask sits, as a percentage of the frame, for an eased
 * reveal of 0 to 1. It starts two feathers out of sight and ends at the far side.
 */
export function maskEdge(eased: number, feather: number): number {
  return -2 * feather + (100 + 2 * feather) * eased
}

/** Gradient stops that stay opaque up to `edge`%, then fall away over `feather`%. */
function featheredStops(edge: number, feather: number): string {
  if (feather <= 0) return `#000 ${edge.toFixed(2)}%, transparent ${edge.toFixed(2)}%`
  const stops: string[] = []
  for (let i = 0; i <= FEATHER_STEPS; i++) {
    const u = i / FEATHER_STEPS
    stops.push(`rgba(0,0,0,${(1 - smootherstep(u)).toFixed(3)}) ${(edge + feather * u).toFixed(2)}%`)
  }
  return stops.join(", ")
}

/** An SVG mask with the word stretched across its full width. */
function wordMask(word: string): string {
  const text = word.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
  const width = Math.max(1, Array.from(word).length) * 126
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 264">` +
    `<text x="${width / 2}" y="197" text-anchor="middle" textLength="${width - 12}" lengthAdjust="spacingAndGlyphs" ` +
    `font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="200" font-weight="800">` +
    `${text}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/*
 * The four mask variants never change a mask while scrolling. Each pane is an element whose mask is
 * painted once, moved by a transform every frame, with the image inside given the inverse transform so it
 * holds still on screen: the iris scales, the wipe slides along its angle, each half of the curtain slides
 * out from the origin, and the word grows while a second, unmasked pane fades in over it. Transform and
 * opacity are all the compositor needs to redraw a frame, so the reveal costs no repaint. Animating the
 * gradient of a mask instead would repaint the whole frame on every frame of the scroll.
 */

/** A 2D affine transform in CSS `matrix(a, b, c, d, e, f)` order: (x, y) to (ax + cy + e, bx + dy + f). */
export type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `a` after `b`. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2]
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y]
const scaleAbout = (s: number, x: number, y: number): Matrix => [s, 0, 0, s, x - s * x, y - s * y]
const toCss = (m: Matrix) => `matrix(${m.map((value) => +value.toFixed(5)).join(",")})`

export type MaskedVariant = Exclude<ScrollMaskVariant, "slats" | "grid">

export interface MaskGeometry {
  variant: MaskedVariant
  /** Frame size in pixels. */
  width: number
  height: number
  feather: number
  originX: number
  originY: number
  angle: number
  word: string
}

export interface MaskPane {
  /** The static strip of the frame the pane is clipped to, in frame pixels. */
  clip: { left: number; width: number }
  /** The pane's own box, before its transform. */
  box: { width: number; height: number }
  /** The pane's mask, painted once. Null for an unmasked pane. */
  mask: { image: string; size: string; position: string } | null
}

export interface PanePose {
  visible: boolean
  opacity: number
  /** Pane box to clip coordinates. */
  pane: Matrix
  /** Image box (the frame) to pane coordinates. */
  image: Matrix
}

/** Distance from the origin to the farthest corner of the frame: where a circle covers it all. */
function farthestCorner(x: number, y: number, width: number, height: number) {
  return Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y))
}

/** The direction a wipe travels, the axis across it, and the gradient line's length, as CSS defines them. */
function wipeAxes(angle: number, width: number, height: number) {
  const theta = (angle * Math.PI) / 180
  const along = { x: Math.sin(theta), y: -Math.cos(theta) }
  const across = { x: -along.y, y: along.x }
  const length = Math.abs(width * along.x) + Math.abs(height * along.y)
  const breadth = Math.abs(width * across.x) + Math.abs(height * across.y)
  return { along, across, length, breadth }
}

/** The panes a masked variant needs, sized for the frame. Recomputed only when the frame or a prop changes. */
export function maskPanes(g: MaskGeometry): MaskPane[] {
  const { width: w, height: h } = g
  const soft = Math.max(0, g.feather)
  // A pane's mask is opaque over the reveal and feathers out beyond it; `grow` sizes the pane to hold both.
  const grow = 1 + soft / 100
  const opaque = 100 / grow
  const stops = featheredStops(opaque, 100 - opaque)
  const ox = (g.originX / 100) * w
  const whole = { left: 0, width: w }
  const fill = { size: "100% 100%", position: "0 0" }

  switch (g.variant) {
    case "iris": {
      const side = 2 * farthestCorner(ox, (g.originY / 100) * h, w, h) * grow
      return [{ clip: whole, box: { width: side, height: side }, mask: { image: `radial-gradient(circle closest-side, ${stops})`, ...fill } }]
    }
    case "wipe": {
      const { length, breadth } = wipeAxes(g.angle, w, h)
      return [{ clip: whole, box: { width: length * grow, height: breadth + 2 }, mask: { image: `linear-gradient(to right, ${stops})`, ...fill } }]
    }
    case "curtain":
      // Each half is clipped at the origin, so it can only open outward. They overlap by a pixel so no seam shows.
      return [
        { clip: { left: 0, width: ox + 0.5 }, box: { width: ox * grow, height: h }, mask: { image: `linear-gradient(to left, ${stops})`, ...fill } },
        { clip: { left: ox - 0.5, width: w - ox + 0.5 }, box: { width: (w - ox) * grow, height: h }, mask: { image: `linear-gradient(to right, ${stops})`, ...fill } },
      ]
    case "type":
      return [
        { clip: whole, box: { width: w, height: h }, mask: { image: wordMask(g.word), size: "contain", position: `${g.originX}% ${g.originY}%` } },
        { clip: whole, box: { width: w, height: h }, mask: null },
      ]
  }
}

/** Where every pane and its image sit for an eased reveal of 0 to 1 and an image scale of `imageScale`. */
export function maskPoses(g: MaskGeometry, eased: number, imageScale: number): PanePose[] {
  const { width: w, height: h } = g
  const soft = Math.max(0, g.feather)
  const grow = 1 + soft / 100
  const edge = maskEdge(eased, soft)
  const reach = edge / 100
  const open = edge + soft > 0
  const ox = (g.originX / 100) * w
  const oy = (g.originY / 100) * h
  const zoom = g.variant === "type" ? scaleAbout(imageScale, ox, oy) : scaleAbout(imageScale, w / 2, h / 2)

  // The image is placed so that pane, then image, lands it exactly where the zoom alone would.
  const pose = (pane: Matrix, clipLeft: number, visible: boolean, opacity = 1): PanePose => ({
    visible,
    opacity,
    pane,
    image: visible ? multiply(invert(pane), multiply(translate(-clipLeft, 0), zoom)) : IDENTITY,
  })

  switch (g.variant) {
    case "iris": {
      // A scaled mask's soft edge grows with it, so the scale tracks the middle of the original soft edge:
      // the circle reads the same size throughout, and at 1 it is opaque out to the farthest corner.
      const half = farthestCorner(ox, oy, w, h) * grow
      const s = Math.max(0, (edge + soft / 2) / (100 + soft / 2))
      const visible = s > MIN_SCALE
      return [pose([s, 0, 0, s, ox - s * half, oy - s * half], 0, visible)]
    }
    case "wipe": {
      const { along, across, length, breadth } = wipeAxes(g.angle, w, h)
      // The gradient line runs through the centre; the pane's opaque end sits at the edge's distance along it.
      const startX = w / 2 - (along.x * length) / 2
      const startY = h / 2 - (along.y * length) / 2
      const offset = reach * length - length
      const x = startX + along.x * offset - across.x * (breadth / 2 + 1)
      const y = startY + along.y * offset - across.y * (breadth / 2 + 1)
      return [pose([along.x, along.y, across.x, across.y, x, y], 0, open)]
    }
    case "curtain": {
      const left = ox
      const right = w - ox
      // Each half's opaque part starts at the origin and has reached `reach` of the way to its side.
      const leftX = ox - reach * left - left * (grow - 1)
      const rightClip = ox - 0.5
      const rightX = ox + reach * right - right - rightClip
      return [pose(translate(leftX, 0), 0, open && left >= 1), pose(translate(rightX, 0), rightClip, open && right >= 1)]
    }
    case "type": {
      const scale = TYPE_SCALE + (1 - TYPE_SCALE) * eased
      const alpha = clamp((eased - TYPE_FILL_START) / (1 - TYPE_FILL_START), 0, 1)
      const pane = scaleAbout(scale, ox, oy)
      // Once the plain pane is fully in, the word underneath it no longer shows.
      return [pose(pane, 0, alpha < 1), pose(pane, 0, alpha > 0, alpha)]
    }
  }
}

function setMask(el: HTMLElement, image: string, size = "100% 100%", position = "0 0") {
  for (const prefix of ["", "-webkit-"]) {
    el.style.setProperty(`${prefix}mask-image`, image)
    el.style.setProperty(`${prefix}mask-size`, size)
    el.style.setProperty(`${prefix}mask-position`, position)
    el.style.setProperty(`${prefix}mask-repeat`, "no-repeat")
  }
}

/** The nearest ancestor that scrolls vertically, or null when the page itself does. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === "auto" || overflowY === "scroll") return el
  }
  return null
}

export function ScrollMask({
  variant = "iris",
  src = DEFAULT_SRC,
  alt = "",
  word = "SCROLL",
  scrollLength = 1.7,
  settle = 0.84,
  smooth = 0.14,
  feather = 14,
  stagger = 0.55,
  columns = 9,
  originX = 50,
  originY = 50,
  angle = 108,
  zoom = 1.14,
  fit = "cover",
  radius = 18,
  overlay = 0,
  background = "transparent",
  revealContent = true,
  calm = false,
  children,
  className,
  style,
  ...props
}: ScrollMaskProps) {
  const stageRef = React.useRef<HTMLDivElement>(null)
  const frameRef = React.useRef<HTMLDivElement>(null)
  const clipRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const paneRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const imageRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const pieceRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const contentRef = React.useRef<HTMLDivElement>(null)
  const progressRef = React.useRef<number | null>(null)

  const pieced = variant === "slats" || variant === "grid"
  const paneCount = variant === "curtain" || variant === "type" ? 2 : 1
  const cols = Math.max(1, Math.floor(columns))
  // Grid rows follow the frame's shape so the cells stay close to square.
  const [gridRows, setGridRows] = React.useState(cols)
  const rows = variant === "grid" ? gridRows : 1
  const hasContent = children != null && children !== false
  const scrim = clamp(overlay, 0, 1)

  const pieces = React.useMemo(
    () => (pieced ? Array.from({ length: cols * rows }, (_, i) => ({ col: i % cols, row: Math.floor(i / cols) })) : []),
    [pieced, cols, rows]
  )

  React.useEffect(() => {
    const frame = frameRef.current
    if (!frame || variant !== "grid") return

    // An observer reports the frame's size once on observing, then on every change.
    const observer = new ResizeObserver(() => {
      if (frame.clientWidth > 0) setGridRows(Math.max(1, Math.round((cols * frame.clientHeight) / frame.clientWidth)))
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [variant, cols])

  React.useEffect(() => {
    const stage = stageRef.current
    const frame = frameRef.current
    // The root's ref stays the consumer's, so the section is reached through the stage.
    const section = stage?.parentElement
    if (!stage || !frame || !section) return

    const scroller = scrollParent(section)
    // Inside a scroll container the stage pins to that container, not the window.
    const fitViewport = () => {
      if (scroller) section.style.setProperty("--mewo-viewport", `${scroller.clientHeight}px`)
    }
    fitViewport()

    const settleAt = clamp(settle, 0.01, 1)
    const spread = clamp(stagger, 0, 0.95)
    const ox = originX / 100
    const oy = originY / 100

    // Pieces further out start later, the furthest by `stagger`.
    const distances = pieces.map(({ col, row }) =>
      variant === "slats"
        ? Math.abs((col + 0.5) / cols - ox)
        : Math.hypot((col + 0.5) / cols - ox, (row + 0.5) / rows - oy)
    )
    const reach = Math.max(1e-6, ...distances)

    let geometry: MaskGeometry | null = null

    // Sizes the panes and paints their masks. Runs on mount and on resize, never per frame.
    const layout = () => {
      if (pieced) return
      const width = frame.clientWidth
      const height = frame.clientHeight
      if (width <= 0 || height <= 0) return
      geometry = { variant: variant as MaskedVariant, width, height, feather, originX, originY, angle, word }
      maskPanes(geometry).forEach((pane, i) => {
        const clip = clipRefs.current[i]
        const element = paneRefs.current[i]
        const image = imageRefs.current[i]
        if (!clip || !element || !image) return
        clip.style.left = `${pane.clip.left}px`
        clip.style.width = `${pane.clip.width}px`
        element.style.width = `${pane.box.width}px`
        element.style.height = `${pane.box.height}px`
        if (pane.mask) setMask(element, pane.mask.image, pane.mask.size, pane.mask.position)
        image.style.width = `${width}px`
        image.style.height = `${height}px`
      })
    }

    const render = (progress: number) => {
      const eased = smoothstep(clamp(progress / settleAt, 0, 1))

      if (geometry) {
        maskPoses(geometry, eased, zoom + (1 - zoom) * eased).forEach((pose, i) => {
          const element = paneRefs.current[i]
          const image = imageRefs.current[i]
          if (!element || !image) return
          element.style.visibility = pose.visible ? "visible" : "hidden"
          if (!pose.visible) return
          element.style.transform = toCss(pose.pane)
          element.style.opacity = `${pose.opacity}`
          image.style.transform = toCss(pose.image)
        })
      }

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieceRefs.current[i]
        if (!piece) continue
        const delay = (distances[i] / reach) * spread
        const local = smoothstep(clamp((eased - delay) / (1 - spread), 0, 1))

        if (variant === "slats") {
          const side = i % 2 === 0 ? -1 : 1
          piece.style.transform = `translate3d(0, ${side * SLAT_TRAVEL * (1 - local)}%, 0)`
          piece.style.opacity = `${Math.min(1, local * SLAT_FADE)}`
        } else {
          piece.style.transform = `scale(${CELL_SCALE + (1 - CELL_SCALE) * local})`
          piece.style.opacity = `${local}`
        }
      }

      const content = contentRef.current
      if (content) {
        const shown = revealContent ? smoothstep(clamp((eased - CONTENT_START) / (CONTENT_END - CONTENT_START), 0, 1)) : 1
        content.style.opacity = `${shown}`
        content.style.transform = `translate3d(0, ${(1 - shown) * CONTENT_RISE}px, 0)`
        content.style.visibility = shown > 0 ? "visible" : "hidden"
      }
    }

    layout()

    // Reduced motion skips the reveal: CSS drops the scroll runway and the frame rests open.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render(1)
      const observer = new ResizeObserver(() => {
        layout()
        render(1)
      })
      observer.observe(frame)
      return () => observer.disconnect()
    }

    const damping = calm ? 0 : Math.max(0, smooth)
    let target = 0
    let raf = 0
    let last = 0

    const measure = () => {
      const origin = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0
      const scrolled = origin - section.getBoundingClientRect().top
      const runway = section.offsetHeight - stage.offsetHeight
      target = runway > 0 ? clamp(scrolled / runway, 0, 1) : 0
    }

    const tick = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.1)
      last = now

      let progress = progressRef.current ?? target
      progress = damping > 0 ? progress + (target - progress) * (1 - Math.exp(-dt / damping)) : target
      if (Math.abs(target - progress) < 0.0002) progress = target

      progressRef.current = progress
      render(progress)
      raf = progress === target ? 0 : requestAnimationFrame(tick)
    }

    const update = () => {
      measure()
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      fitViewport()
      layout()
      render(progressRef.current ?? target)
      update()
    }

    measure()
    // Snap on mount; afterwards keep the eased position across prop changes.
    progressRef.current = progressRef.current ?? target
    render(progressRef.current)
    if (progressRef.current !== target) update()

    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    if (scroller) observer.observe(scroller)
    // Scroll events do not bubble; capturing on the window hears a nested scroller too.
    window.addEventListener("scroll", update, { passive: true, capture: true })
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("scroll", update, { capture: true })
      window.removeEventListener("resize", resize)
    }
  }, [variant, word, scrollLength, settle, smooth, feather, stagger, cols, rows, pieces, pieced, originX, originY, angle, zoom, revealContent, calm, hasContent])

  const picture: React.CSSProperties = {
    backgroundImage: `linear-gradient(rgba(0,0,0,${scrim}), rgba(0,0,0,${scrim})), url(${JSON.stringify(src)})`,
    backgroundSize: `auto, ${fit}`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }
  // The picture is painted as a background so slats, cells and panes can each show their own
  // window onto it; this is what gives it a name for assistive tech.
  const labelled = alt ? ({ role: "img", "aria-label": alt } as const) : ({ "aria-hidden": true } as const)

  return (
    <section
      data-slot="scroll-mask"
      className={cn(
        "relative h-[calc(var(--mewo-viewport,100vh)*var(--mewo-length))] motion-reduce:h-[var(--mewo-viewport,100vh)]",
        className
      )}
      style={{ "--mewo-length": 1 + Math.max(0, scrollLength), background, ...style } as React.CSSProperties}
      {...props}
    >
      <div ref={stageRef} className="sticky top-0 box-border h-[var(--mewo-viewport,100vh)] w-full p-[clamp(16px,5vw,32px)]">
        <div ref={frameRef} className="relative size-full overflow-hidden" style={{ borderRadius: radius }}>
          {pieced ? (
            <div key={variant} {...labelled} className="absolute inset-0">
              {pieces.map(({ col, row }, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    pieceRefs.current[i] = el
                  }}
                  data-slot="scroll-mask-piece"
                  // Clipping half a pixel outside the cell lets neighbours overlap, so no hairline seams show.
                  className="absolute opacity-0 [clip-path:inset(-0.5px)] will-change-[transform,opacity]"
                  style={{
                    left: `${(col / cols) * 100}%`,
                    top: `${(row / rows) * 100}%`,
                    width: `${100 / cols}%`,
                    height: `${100 / rows}%`,
                  }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: `${-col * 100}%`,
                      top: `${-row * 100}%`,
                      width: `${cols * 100}%`,
                      height: `${rows * 100}%`,
                      ...picture,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div key={variant} {...labelled} className="absolute inset-0">
              {/* What shows when no script runs: the registry's scripting-off rule displays it. */}
              <div data-slot="scroll-mask-static" className="absolute inset-0 hidden" style={picture} />
              {Array.from({ length: paneCount }, (_, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    clipRefs.current[i] = el
                  }}
                  className="absolute inset-y-0 left-0 w-full overflow-hidden"
                >
                  <div
                    ref={(el) => {
                      paneRefs.current[i] = el
                    }}
                    data-slot="scroll-mask-layer"
                    // Sized, masked and placed by the effect once the frame has been measured.
                    className="invisible absolute top-0 left-0 origin-top-left will-change-[transform,opacity]"
                  >
                    <div
                      ref={(el) => {
                        imageRefs.current[i] = el
                      }}
                      data-slot="scroll-mask-image"
                      className="absolute top-0 left-0 origin-top-left will-change-transform"
                    >
                      {/* The picture sits on an untransformed child: Chrome repaints an element with a
                          layered background (scrim plus photo) whenever that element's own transform changes. */}
                      <div className="absolute inset-0" style={picture} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasContent && (
            <div
              ref={contentRef}
              data-slot="scroll-mask-content"
              className={cn(
                "absolute inset-0 flex items-center justify-center will-change-[transform,opacity]",
                revealContent && "opacity-0"
              )}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
