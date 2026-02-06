import { solarPhaseDegrees } from '@/features/solar/solarMath'
import type { Landmark, LandmarkCrossing } from './types'

export type CrossingOptions = {
  landmarks: Landmark[]
  rangeStartMs: number
  rangeEndMs: number
  targetMinutesOfDay: number
  apparentSolar: boolean
}

function solveBisection(
  targetPhase: number,
  targetMinutesOfDay: number,
  apparentSolar: boolean,
  lowMs: number,
  highMs: number
): number {
  let low = lowMs
  let high = highMs

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2
    const phase = solarPhaseDegrees(new Date(mid), targetMinutesOfDay, apparentSolar)
    if (phase > targetPhase) {
      low = mid
    } else {
      high = mid
    }
  }

  return Math.round((low + high) / 2)
}

export function computeLandmarkCrossings(options: CrossingOptions): LandmarkCrossing[] {
  const { landmarks, rangeStartMs, rangeEndMs, targetMinutesOfDay, apparentSolar } = options
  if (rangeEndMs <= rangeStartMs) {
    return []
  }

  const startPhase = solarPhaseDegrees(new Date(rangeStartMs), targetMinutesOfDay, apparentSolar)
  const endPhase = solarPhaseDegrees(new Date(rangeEndMs), targetMinutesOfDay, apparentSolar)

  const highPhase = Math.max(startPhase, endPhase)
  const lowPhase = Math.min(startPhase, endPhase)

  const crossings: LandmarkCrossing[] = []

  for (const landmark of landmarks) {
    const nMin = Math.ceil((lowPhase - landmark.lon) / 360)
    const nMax = Math.floor((highPhase - landmark.lon) / 360)

    for (let n = nMin; n <= nMax; n += 1) {
      const targetPhase = landmark.lon + n * 360
      const atStart =
        solarPhaseDegrees(new Date(rangeStartMs), targetMinutesOfDay, apparentSolar) - targetPhase
      const atEnd = solarPhaseDegrees(new Date(rangeEndMs), targetMinutesOfDay, apparentSolar) - targetPhase

      if (atStart === 0) {
        crossings.push({
          id: `${landmark.id}-${Math.round(rangeStartMs / 1000)}`,
          landmark,
          crossingMs: rangeStartMs
        })
        continue
      }

      if (atEnd === 0) {
        crossings.push({
          id: `${landmark.id}-${Math.round(rangeEndMs / 1000)}`,
          landmark,
          crossingMs: rangeEndMs
        })
        continue
      }

      if (Math.sign(atStart) === Math.sign(atEnd)) {
        continue
      }

      const crossingMs = solveBisection(
        targetPhase,
        targetMinutesOfDay,
        apparentSolar,
        rangeStartMs,
        rangeEndMs
      )

      if (crossingMs >= rangeStartMs && crossingMs <= rangeEndMs) {
        crossings.push({
          id: `${landmark.id}-${Math.round(crossingMs / 1000)}`,
          landmark,
          crossingMs
        })
      }
    }
  }

  return crossings.sort((a, b) => a.crossingMs - b.crossingMs)
}
