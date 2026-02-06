import { circularMinuteDifference, wrap180 } from '@/lib/geo'

type CivilBand = {
  offsetHours: number
  centerLongitude: number
  startLongitude: number
  endLongitude: number
  minuteDifference: number
  intensity: number
}

export function buildCivilBands(
  now: Date,
  targetMinutesOfDay: number,
  glowWindowMinutes: number
): CivilBand[] {
  const utcMinutes =
    now.getUTCHours() * 60 +
    now.getUTCMinutes() +
    now.getUTCSeconds() / 60 +
    now.getUTCMilliseconds() / 60_000
  const clampedWindow = Math.max(1, glowWindowMinutes)
  const bands: CivilBand[] = []

  for (let offset = -12; offset <= 14; offset += 1) {
    const localMinutes = utcMinutes + offset * 60
    const minuteDifference = circularMinuteDifference(localMinutes, targetMinutesOfDay)

    if (minuteDifference > clampedWindow) {
      continue
    }

    const center = wrap180(offset * 15)
    const start = wrap180(center - 7.5)
    const end = wrap180(center + 7.5)
    const intensity = 1 - minuteDifference / clampedWindow

    bands.push({
      offsetHours: offset,
      centerLongitude: center,
      startLongitude: start,
      endLongitude: end,
      minuteDifference,
      intensity
    })
  }

  return bands
}

export type { CivilBand }
