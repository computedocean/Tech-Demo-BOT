import gsap from "gsap"
import { computeBeats } from "./timing.ts"
import type { SceneTokens } from "./types.ts"

export function buildTimeline(root: ParentNode, tokens: SceneTokens) {
  const glyphs = root.querySelectorAll<HTMLElement>("[data-char]")
  const beats = computeBeats(tokens, glyphs.length)
  const tl = gsap.timeline({ paused: true })
  const ease = beats.ease

  const ring = root.querySelector<SVGCircleElement>("[data-ring-shape]")
  const ringWrap = root.querySelector<SVGElement>("[data-ring]")
  if (ring) {
    const length = ring.getTotalLength()
    const dash = length + 6
    tl.fromTo(
      ring,
      { strokeDasharray: dash, strokeDashoffset: dash, opacity: 0 },
      {
        strokeDashoffset: -2,
        opacity: 1,
        duration: beats.ringDur,
        ease,
      },
      beats.ringStart,
    )
  }
  if (ringWrap) {
    const hold = Math.max(0.4, beats.duration - beats.ringStart - beats.ringDur)
    tl.fromTo(
      ringWrap,
      { scale: 1, transformOrigin: "50% 50%" },
      { scale: 1.045, duration: hold, ease: "none" },
      beats.ringStart + beats.ringDur,
    )
  }

  const bars = root.querySelectorAll<HTMLElement>("[data-bar]")
  if (bars.length > 0) {
    tl.fromTo(
      bars,
      { scaleY: 0, transformOrigin: "50% 100%" },
      { scaleY: 1, duration: beats.barDur, stagger: beats.stagger, ease },
      beats.barsStart,
    )
  }

  const ground = root.querySelector("[data-ground]")
  if (ground) {
    tl.fromTo(
      ground,
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: beats.groundDur, ease },
      beats.groundStart,
    )
  }

  const kicker = root.querySelector("[data-kicker]")
  if (kicker) {
    tl.fromTo(
      kicker,
      { yPercent: 80, opacity: 0 },
      { yPercent: 0, opacity: 0.78, duration: beats.kickerDur, ease },
      beats.kickerStart,
    )
  }

  const rule = root.querySelector("[data-rule]")
  if (rule) {
    tl.fromTo(
      rule,
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: beats.ruleDur, ease },
      beats.ruleStart,
    )
  }

  if (glyphs.length > 0) {
    tl.fromTo(
      glyphs,
      { yPercent: 110, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: beats.charDur,
        stagger: beats.charStagger,
        ease,
      },
      beats.headlineStart,
    )
  }

  const body = root.querySelector("[data-body]")
  if (body) {
    tl.fromTo(
      body,
      { yPercent: 70, opacity: 0 },
      { yPercent: 0, opacity: 0.86, duration: beats.bodyDur, ease },
      beats.bodyStart,
    )
  }

  return tl
}
