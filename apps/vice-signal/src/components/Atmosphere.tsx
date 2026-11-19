import { motion, useReducedMotion } from 'motion/react'
import { Skyline } from '@/components/Skyline'
import { neonCss, type Station } from '@/lib/stations'

type Props = {
  station: Station
}

export function Atmosphere({ station }: Props) {
  const reduce = useReducedMotion()
  const neon = neonCss(station)
  const neonSoft = neonCss(station, 0.35)
  const neonFaint = neonCss(station, 0.12)

  return (
    <motion.div
      className="atmosphere"
      animate={{
        background: `linear-gradient(180deg, ${station.skyTop} 0%, ${station.skyMid} 48%, ${station.skyBottom} 100%)`,
      }}
      transition={{ duration: reduce ? 0.2 : 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Horizon haze */}
      <motion.div
        className="haze"
        animate={{
          background: `radial-gradient(ellipse 90% 55% at 50% 78%, ${neonSoft}, transparent 70%)`,
        }}
        transition={{ duration: 0.85 }}
      />

      {/* Drift bands */}
      <motion.div
        className="drift drift-a"
        animate={{
          opacity: 0.35 + station.sway * 0.25,
          x: reduce ? 0 : [0, 24, -12, 0],
        }}
        transition={
          reduce
            ? { duration: 0.4 }
            : {
                x: {
                  duration: 18 / (0.6 + station.sway),
                  repeat: Infinity,
                  ease: 'linear',
                },
                opacity: { duration: 0.8 },
              }
        }
        style={{
          background: `linear-gradient(115deg, transparent 20%, ${neonFaint} 50%, transparent 80%)`,
        }}
      />
      <motion.div
        className="drift drift-b"
        animate={{
          opacity: 0.2 + station.grain * 0.3,
          x: reduce ? 0 : [0, -30, 10, 0],
        }}
        transition={
          reduce
            ? { duration: 0.4 }
            : {
                x: {
                  duration: 22 / (0.5 + station.sway),
                  repeat: Infinity,
                  ease: 'linear',
                },
                opacity: { duration: 0.8 },
              }
        }
        style={{
          background: `linear-gradient(70deg, transparent 30%, ${neonCss(station, 0.08)} 55%, transparent 75%)`,
        }}
      />

      {/* Signal rings */}
      <motion.div
        className="signal-ring"
        style={{ borderColor: neon }}
        animate={
          reduce
            ? { opacity: 0.25, scale: 1 }
            : { opacity: [0.05, 0.35, 0.05], scale: [0.92, 1.08, 0.92] }
        }
        transition={
          reduce
            ? { duration: 0.3 }
            : {
                duration: station.pulseMs / 1000,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />

      <div className="skyline-plane">
        <Skyline station={station} />
      </div>

      {/* Film grain */}
      <motion.div
        className="grain"
        animate={{ opacity: station.grain }}
        transition={{ duration: 0.6 }}
        aria-hidden
      />
    </motion.div>
  )
}
