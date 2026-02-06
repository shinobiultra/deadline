import { describe, expect, test } from 'vitest'
import {
  isNightAt,
  solarDeadlineLongitude,
  solarLineSpeedDegreesPerHour,
  subsolarLatitude
} from '@/features/solar/solarMath'

describe('solar math', () => {
  test('solar line shifts near 15 degrees per hour in mean mode', () => {
    const base = new Date('2026-02-01T00:00:00Z')
    const speed = solarLineSpeedDegreesPerHour(base, 22 * 60, false)
    expect(speed).toBeGreaterThan(14.95)
    expect(speed).toBeLessThan(15.05)
  })

  test('subsolar point is lit and antisolar point is dark', () => {
    const time = new Date('2026-06-21T12:00:00Z')
    const lat = subsolarLatitude(time)
    const lon = solarDeadlineLongitude(time, 12 * 60, false)

    expect(isNightAt(time, lat, lon, false)).toBe(false)
    expect(isNightAt(time, -lat, lon + 180, false)).toBe(true)
  })
})
