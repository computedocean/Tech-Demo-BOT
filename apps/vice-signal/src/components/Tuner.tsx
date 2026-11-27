import { motion, AnimatePresence } from 'motion/react'
import { Slider } from '@/components/ui/slider'
import { STATIONS, neonCss, type Station } from '@/lib/stations'

type Props = {
  station: Station
  frequency: number
  onSelect: (station: Station) => void
  onScrub: (freq: number) => void
}

export function Tuner({ station, frequency, onSelect, onScrub }: Props) {
  const neon = neonCss(station)
  const min = 88
  const max = 108
  const needle = ((frequency - min) / (max - min)) * 100

  return (
    <div className="tuner" style={{ ['--neon' as string]: neon }}>
      <div className="tuner-stations" role="listbox" aria-label="Pirate stations">
        {STATIONS.map((s) => {
          const active = s.id === station.id
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={active}
              className={active ? 'station-btn is-active' : 'station-btn'}
              onClick={() => onSelect(s)}
            >
              <span className="station-freq">{s.frequency.toFixed(1)}</span>
              <span className="station-name">{s.name}</span>
            </button>
          )
        })}
      </div>

      <div className="dial">
        <div className="dial-meta">
          <AnimatePresence mode="wait">
            <motion.div
              key={station.id}
              className="dial-now"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              <p className="dial-tag">{station.tag}</p>
              <p className="dial-title">{station.name}</p>
            </motion.div>
          </AnimatePresence>
          <motion.p
            className="dial-hz"
            key={frequency.toFixed(1)}
            initial={{ opacity: 0.4, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            {frequency.toFixed(1)}
            <span> FM</span>
          </motion.p>
        </div>

        <div className="dial-track">
          <div className="dial-marks" aria-hidden>
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className={i % 5 === 0 ? 'mark major' : 'mark'} />
            ))}
          </div>
          <motion.div
            className="dial-needle"
            animate={{ left: `${needle}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          />
          <Slider
            className="dial-slider"
            min={min}
            max={max}
            step={0.1}
            value={[frequency]}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? v[0] : v
              onScrub(Number(next))
            }}
            aria-label="Frequency"
          />
        </div>
      </div>
    </div>
  )
}
