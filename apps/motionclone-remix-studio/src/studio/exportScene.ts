import type { SceneTokens } from "./types.ts"

export function tokensCss(tokens: SceneTokens) {
  return `/* Northline tokens
 * Original scene from Northline Remix Studio.
 * Workflow idea: MotionClone — https://motionclone.lol
 * https://github.com/blixvip/MotionClone
 * This file does not contain MotionClone source or branding.
 */

:root {
  --ink: ${tokens.ink};
  --paper: ${tokens.paper};
  --signal: ${tokens.signal};
  --duration: ${tokens.duration}s;
  --delay: ${tokens.delay}s;
  --stagger: ${tokens.stagger}s;
}
`
}

export function sceneModule(tokens: SceneTokens) {
  const payload = JSON.stringify(
    {
      headline: tokens.headline,
      body: tokens.body,
      kicker: tokens.kicker,
      ink: tokens.ink,
      paper: tokens.paper,
      signal: tokens.signal,
      duration: tokens.duration,
      delay: tokens.delay,
      stagger: tokens.stagger,
      ease: tokens.ease,
    },
    null,
    2,
  )

  return `/**
 * Northline scene
 * Original reconstruction exported from Northline Remix Studio.
 * The reference-to-editable-code workflow is MotionClone's idea:
 * https://motionclone.lol
 * https://github.com/blixvip/MotionClone
 * This file is original. It does not include MotionClone source.
 *
 * Expected markup inside \`root\`:
 *   [data-ring] > circle[data-ring-shape]
 *   [data-bar] (three shapes)
 *   [data-ground]
 *   [data-kicker]
 *   [data-rule]
 *   [data-char] (one per headline glyph)
 *   [data-body]
 */
import gsap from "gsap";

export const tokens = ${payload};

function gsapEase(ease) {
  return ease === "back.out" ? "back.out(1.7)" : ease;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function computeBeats(tokens, glyphCount) {
  const duration = clamp(tokens.duration, 3, 12);
  const delay = clamp(tokens.delay, 0, duration * 0.45);
  const stagger = clamp(tokens.stagger, 0, 0.3);
  const span = Math.max(0.8, duration - delay);
  const count = Math.max(1, glyphCount);
  const ringStart = delay;
  const ringDur = span * 0.34;
  const barsStart = delay + span * 0.08;
  const barDur = Math.min(span * 0.28, Math.max(0.28, span * 0.42 - stagger * 2));
  const groundStart = delay + span * 0.05;
  const groundDur = Math.max(0.35, span * 0.22);
  const kickerStart = delay + span * 0.3;
  const kickerDur = Math.max(0.25, span * 0.12);
  const ruleStart = kickerStart;
  const ruleDur = Math.max(0.3, span * 0.18);
  const headlineStart = delay + span * 0.4;
  const charDur = Math.min(0.55, Math.max(0.22, span * 0.12));
  const bodyDur = Math.max(0.3, span * 0.14);
  const room = duration - bodyDur - 0.12 - headlineStart - charDur;
  const charStagger = count <= 1 ? 0 : Math.min(stagger, Math.max(0, room / (count - 1)));
  const headlineEnd = headlineStart + charDur + charStagger * (count - 1);
  const bodyStart = clamp(
    headlineEnd - charDur * 0.35,
    headlineStart + 0.05,
    Math.max(headlineStart + 0.05, duration - bodyDur),
  );
  return {
    duration, delay, stagger, ringStart, ringDur, barsStart, barDur,
    groundStart, groundDur, kickerStart, kickerDur, ruleStart, ruleDur,
    headlineStart, charDur, charStagger, bodyStart, bodyDur,
    ease: gsapEase(tokens.ease),
  };
}

export function buildScene(root) {
  const glyphs = root.querySelectorAll("[data-char]");
  const beats = computeBeats(tokens, glyphs.length);
  const tl = gsap.timeline({ paused: true });
  const ease = beats.ease;
  const ring = root.querySelector("[data-ring-shape]");
  const ringWrap = root.querySelector("[data-ring]");
  if (ring) {
    const length = ring.getTotalLength();
    const dash = length + 6;
    tl.fromTo(
      ring,
      { strokeDasharray: dash, strokeDashoffset: dash, opacity: 0 },
      { strokeDashoffset: -2, opacity: 1, duration: beats.ringDur, ease },
      beats.ringStart,
    );
  }
  if (ringWrap) {
    const hold = Math.max(0.4, beats.duration - beats.ringStart - beats.ringDur);
    tl.fromTo(
      ringWrap,
      { scale: 1, transformOrigin: "50% 50%" },
      { scale: 1.045, duration: hold, ease: "none" },
      beats.ringStart + beats.ringDur,
    );
  }
  const bars = root.querySelectorAll("[data-bar]");
  if (bars.length) {
    tl.fromTo(
      bars,
      { scaleY: 0, transformOrigin: "50% 100%" },
      { scaleY: 1, duration: beats.barDur, stagger: beats.stagger, ease },
      beats.barsStart,
    );
  }
  const ground = root.querySelector("[data-ground]");
  if (ground) {
    tl.fromTo(
      ground,
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: beats.groundDur, ease },
      beats.groundStart,
    );
  }
  const kicker = root.querySelector("[data-kicker]");
  if (kicker) {
    tl.fromTo(
      kicker,
      { yPercent: 80, opacity: 0 },
      { yPercent: 0, opacity: 0.78, duration: beats.kickerDur, ease },
      beats.kickerStart,
    );
  }
  const rule = root.querySelector("[data-rule]");
  if (rule) {
    tl.fromTo(
      rule,
      { scaleX: 0, transformOrigin: "0% 50%" },
      { scaleX: 1, duration: beats.ruleDur, ease },
      beats.ruleStart,
    );
  }
  if (glyphs.length) {
    tl.fromTo(
      glyphs,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: beats.charDur, stagger: beats.charStagger, ease },
      beats.headlineStart,
    );
  }
  const body = root.querySelector("[data-body]");
  if (body) {
    tl.fromTo(
      body,
      { yPercent: 70, opacity: 0 },
      { yPercent: 0, opacity: 0.86, duration: beats.bodyDur, ease },
      beats.bodyStart,
    );
  }
  return tl;
}
`
}
