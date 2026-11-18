import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Atmosphere } from '@/components/Atmosphere'
import { Tuner } from '@/components/Tuner'
import {
  STATIONS,
  nearestStation,
  neonCss,
  type Station,
} from '@/lib/stations'

export default function App() {
  const [station, setStation] = useState<Station>(STATIONS[0])
  const [frequency, setFrequency] = useState(STATIONS[0].frequency)
  const neon = neonCss(station)

  function selectStation(next: Station) {
    setStation(next)
    setFrequency(next.frequency)
  }

  function scrub(freq: number) {
    setFrequency(freq)
    const near = nearestStation(freq)
    if (near.id !== station.id) setStation(near)
  }

  return (
    <div className="stage" style={{ ['--neon' as string]: neon }}>
      <Atmosphere station={station} />

      <main className="hero">
        <header className="brand-block">
          <motion.p
            className="brand"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>Vice</span>
            <span>Signal</span>
          </motion.p>
          <AnimatePresence mode="wait">
            <motion.h1
              key={station.id + '-headline'}
              className="headline"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
            >
              Tune the city. Steal the night.
            </motion.h1>
          </AnimatePresence>
          <p className="lede">
            Pirate frequencies remapping Leonida&apos;s neon weather — one dial,
            five atmospheres.
          </p>
        </header>

        <Tuner
          station={station}
          frequency={frequency}
          onSelect={selectStation}
          onScrub={scrub}
        />
      </main>
    </div>
  )
}
