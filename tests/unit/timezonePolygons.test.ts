import { describe, expect, test } from 'vitest'
import { civilIntensityForZone, extractZoneId } from '@/features/civil/timezonePolygons'

describe('timezone polygon helpers', () => {
  test('extracts tzid from known keys', () => {
    expect(extractZoneId({ tzid: 'Europe/Prague' })).toBe('Europe/Prague')
    expect(extractZoneId({ timezone: 'America/New_York' })).toBe('America/New_York')
    expect(extractZoneId({ name: 'UTC' })).toBeNull()
  })

  test('computes intensity for matching civil time', () => {
    const date = new Date('2026-01-01T21:00:00Z')
    const intensity = civilIntensityForZone('Europe/Prague', date, 22 * 60, 15)
    expect(intensity).not.toBeNull()
    expect((intensity ?? 0) > 0.9).toBe(true)
  })
})
