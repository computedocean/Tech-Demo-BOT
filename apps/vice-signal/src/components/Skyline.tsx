import { motion, useReducedMotion } from 'motion/react'
import type { Station } from '@/lib/stations'
import { neonCss } from '@/lib/stations'

type Props = {
  station: Station
}

const WINDOWS = [
  { x: 42, y: 58, w: 6, h: 8 },
  { x: 58, y: 52, w: 5, h: 7 },
  { x: 78, y: 64, w: 5, h: 6 },
  { x: 118, y: 48, w: 7, h: 9 },
  { x: 140, y: 56, w: 5, h: 7 },
  { x: 168, y: 42, w: 6, h: 8 },
  { x: 210, y: 54, w: 5, h: 6 },
  { x: 248, y: 46, w: 7, h: 10 },
  { x: 272, y: 58, w: 5, h: 7 },
  { x: 310, y: 50, w: 6, h: 8 },
  { x: 338, y: 62, w: 5, h: 6 },
  { x: 372, y: 44, w: 8, h: 11 },
  { x: 402, y: 56, w: 5, h: 7 },
  { x: 440, y: 48, w: 6, h: 9 },
  { x: 468, y: 60, w: 5, h: 6 },
  { x: 510, y: 40, w: 7, h: 10 },
  { x: 540, y: 54, w: 5, h: 7 },
  { x: 580, y: 46, w: 6, h: 8 },
  { x: 612, y: 58, w: 5, h: 6 },
  { x: 650, y: 42, w: 8, h: 12 },
  { x: 686, y: 52, w: 5, h: 7 },
  { x: 720, y: 60, w: 6, h: 6 },
  { x: 760, y: 48, w: 5, h: 8 },
  { x: 790, y: 56, w: 7, h: 7 },
]

export function Skyline({ station }: Props) {
  const reduce = useReducedMotion()
  const neon = neonCss(station)
  const duration = (station.pulseMs / 1000) * (reduce ? 0 : 1)

  return (
    <svg
      className="skyline"
      viewBox="0 0 840 160"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="buildFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1218" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#020608" stopOpacity="1" />
        </linearGradient>
        <filter id="neonBloom">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Water reflection band */}
      <motion.rect
        x="0"
        y="148"
        width="840"
        height="12"
        animate={{ fill: station.water }}
        transition={{ duration: 0.8 }}
        opacity={0.85}
      />

      <g fill="url(#buildFill)">
        <path d="M0 160 V92 H28 V70 H48 V88 H72 V56 H96 V78 H118 V64 H148 V42 H178 V68 H198 V54 H228 V72 H252 V38 H288 V60 H312 V48 H348 V70 H372 V34 H418 V58 H448 V46 H482 V66 H510 V30 H552 V52 H580 V44 H612 V62 H640 V36 H682 V54 H710 V46 H742 V68 H770 V50 H804 V78 H840 V160 Z" />
      </g>

      {/* Palm silhouettes */}
      <g fill="#050a0c" opacity={0.9}>
        <path d="M24 160 C24 120 8 108 18 96 C6 100 10 118 16 128 C4 118 2 104 14 92 C22 104 22 128 24 160 Z" />
        <path d="M812 160 C812 118 828 106 818 94 C830 98 826 116 820 126 C832 116 834 102 822 90 C814 102 814 126 812 160 Z" />
      </g>

      {WINDOWS.map((w, i) => (
        <motion.rect
          key={`${w.x}-${w.y}`}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          rx={0.6}
          filter="url(#neonBloom)"
          animate={{
            fill: neon,
            opacity: reduce
              ? 0.55 + (i % 3) * 0.1
              : [0.25, 0.95, 0.4, 0.85, 0.3],
          }}
          transition={
            reduce
              ? { duration: 0.6 }
              : {
                  duration: duration * (0.7 + (i % 5) * 0.12),
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: (i % 7) * 0.18,
                }
          }
        />
      ))}

      {/* Antenna blink */}
      <motion.circle
        cx="526"
        cy="24"
        r="3"
        animate={{ fill: neon, opacity: reduce ? 0.8 : [0.2, 1, 0.2] }}
        transition={
          reduce
            ? { duration: 0.5 }
            : { duration: duration * 0.45, repeat: Infinity, ease: 'easeInOut' }
        }
      />
    </svg>
  )
}
