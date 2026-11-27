import * as React from "react"
import { motion, useInView, useReducedMotion, type Transition, type Variants } from "motion/react"
import { cn } from "@/lib/utils"

export interface SplitTextProps extends Omit<React.ComponentProps<"span">, "children"> {
  children: string
  by?: "chars" | "words"
  /** Seconds between each unit. */
  stagger?: number
  /** Seconds before the first unit. */
  delay?: number
  /** Play once, or replay every time it scrolls into view. */
  once?: boolean
  as?: "span" | "h1" | "h2" | "h3" | "p"
}

// Intl.Segmenter's declarations live in lib.es2022.intl, and this file is compiled by whatever
// `lib` the project it is installed into uses. Declaring the shape here keeps it compiling under
// ES2017 and up; the runtime check is what decides whether the API is really there.
type GraphemeSegmenter = { segment(input: string): Iterable<{ segment: string }> }
type GraphemeSegmenterConstructor = new (
  locales: undefined,
  options: { granularity: "grapheme" }
) => GraphemeSegmenter

export function splitUnits(text: string, by: "chars" | "words"): string[] {
  if (by === "words") return text.split(/(\s+)/).filter((unit) => unit.length > 0)
  // Code points tear emoji, flags and combining marks apart — a unit must be a whole grapheme cluster.
  const Segmenter =
    typeof Intl === "undefined"
      ? undefined
      : (Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }).Segmenter
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: "grapheme" })
    return Array.from(segmenter.segment(text), (segment) => segment.segment)
  }
  return Array.from(text)
}

// A quartic ease-out: the curve GSAP calls power3.out.
const EASE = [0.165, 0.84, 0.44, 1] as const

const UNIT: Variants = {
  hidden: { y: "110%", opacity: 0 },
  shown: { y: "0%", opacity: 1 },
}

/*
 * One viewport observer watches the whole string and every unit follows it, so the cost is one
 * IntersectionObserver however long the text. Motion's frame loop runs only while units are moving and
 * sleeps once the entrance has played: there is no ticker left running for the life of the page.
 */
export function SplitText({
  children,
  by = "chars",
  stagger = 0.03,
  delay = 0,
  once = true,
  as: Tag = "span",
  className,
  ...props
}: SplitTextProps) {
  const ref = React.useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  // "Top of the text 85% of the way down the viewport" is where the entrance starts.
  const inView = useInView(ref, { once, margin: "0px 0px -15% 0px" })

  // Each unit's place in the stagger, counting only the units that animate.
  const units = React.useMemo(() => {
    let order = 0
    return splitUnits(children, by).map((text) => ({ text, order: /^\s+$/.test(text) ? -1 : order++ }))
  }, [children, by])

  const transitionFor = (order: number): Transition => {
    if (reduceMotion) return { duration: 0 }
    // Leaving the viewport (only when `once` is off) sends every unit back at once.
    if (!inView) return { duration: 0.3, ease: EASE }
    return { duration: 0.6, ease: EASE, delay: delay + stagger * order }
  }

  return React.createElement(
    Tag,
    {
      ref,
      "data-slot": "split-text",
      // Every unit is aria-hidden, so the text reaches assistive tech once as the root's accessible
      // name — and stays in the DOM once, so textContent, innerText and a copy of the selection all
      // return it once. role=generic (span) and role=paragraph (p) prohibit aria-label, so those two
      // are exposed as an image with a text alternative; a heading can name itself.
      role: Tag === "span" || Tag === "p" ? "img" : undefined,
      "aria-label": children,
      className: cn("inline-block", className),
      ...props,
    },
    units.map(({ text, order }, index) =>
      // Whitespace is emitted as a bare text node, not as a unit of its own: inside an inline-block
      // a lone collapsible space is trimmed to zero width and words run together, while an
      // inline-block of U+00A0 is never trimmed at a line end and pushes wrapped centred lines
      // off-centre. Between the wrappers it is an ordinary space in the parent's inline formatting
      // context — full width mid-line, trimmed at a line end.
      order < 0 ? (
        text
      ) : (
        <span key={index} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            data-split-unit
            className="inline-block"
            variants={UNIT}
            // `initial` is serialised into the SSR markup; the registry's scripting-off rule shows the
            // text where no script will ever run to reveal it.
            initial="hidden"
            animate={inView ? "shown" : "hidden"}
            transition={transitionFor(order)}
          >
            {text}
          </motion.span>
        </span>
      )
    )
  )
}
