import { useEffect, useMemo, useRef, useState } from 'react'
import { initParticlesEngine } from '@tsparticles/react'
import Particles from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { motion } from 'framer-motion'

type NearDeadlineEffectsProps = {
  remainingMs: number
  reducedMotion: boolean
}

function stageFromRemaining(remainingMs: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (remainingMs <= 0) return 5
  if (remainingMs <= 60_000) return 4
  if (remainingMs <= 5 * 60_000) return 3
  if (remainingMs <= 15 * 60_000) return 2
  if (remainingMs <= 60 * 60_000) return 1
  return 0
}

export function NearDeadlineEffects({ remainingMs, reducedMotion }: NearDeadlineEffectsProps) {
  const [particlesReady, setParticlesReady] = useState(false)
  const [shockwaveTick, setShockwaveTick] = useState(0)
  const prevRemainingRef = useRef(remainingMs)

  useEffect(() => {
    void initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setParticlesReady(true))
  }, [])

  useEffect(() => {
    if (prevRemainingRef.current > 0 && remainingMs <= 0) {
      setShockwaveTick((count) => count + 1)
    }
    prevRemainingRef.current = remainingMs
  }, [remainingMs])

  const stage = stageFromRemaining(remainingMs)

  const particlesOptions = useMemo(() => {
    if (stage < 2 || reducedMotion) {
      return null
    }

    const intense = stage >= 4

    return {
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      particles: {
        number: { value: intense ? 120 : 45 },
        color: { value: intense ? ['#ffad66', '#ffd38f', '#ff7f50'] : ['#ffd38f', '#ffb26d'] },
        size: { value: intense ? { min: 1, max: 3.2 } : { min: 0.7, max: 2.2 } },
        opacity: { value: { min: 0.25, max: 0.9 } },
        move: {
          direction: 'top',
          speed: intense ? { min: 0.8, max: 2.8 } : { min: 0.35, max: 1.2 },
          outModes: { default: 'out' },
          random: true,
          trail: {
            enable: intense,
            length: intense ? 8 : 3,
            fill: { color: 'transparent' }
          }
        },
        life: {
          count: 1,
          duration: { value: { min: 0.5, max: 1.8 } }
        }
      },
      detectRetina: true
    }
  }, [reducedMotion, stage])

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {stage >= 1 && !reducedMotion ? <div className={`deadline-haze stage-${stage}`} /> : null}
      {particlesReady && particlesOptions ? <Particles id="deadline-effects" options={particlesOptions as never} /> : null}
      {stage >= 3 && !reducedMotion ? <div className="deadline-glitch" /> : null}
      {!reducedMotion && shockwaveTick > 0 ? (
        <motion.div
          key={shockwaveTick}
          className="deadline-shockwave"
          initial={{ opacity: 0.8, scale: 0.12 }}
          animate={{ opacity: 0, scale: 2.2 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      ) : null}
    </div>
  )
}
