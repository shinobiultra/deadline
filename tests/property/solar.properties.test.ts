import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { solarDistanceToMeridian, buildTerminatorPolyline } from '@/features/solar/solarMath'
import { wrap180 } from '@/lib/geo'

describe('solar properties', () => {
  test('terminator points are finite and bounded', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2_000_000_000_000 }), (timestamp) => {
        const points = buildTerminatorPolyline(new Date(timestamp), false)
        expect(points.length).toBeGreaterThan(100)

        for (const point of points) {
          expect(Number.isFinite(point.lon)).toBe(true)
          expect(Number.isFinite(point.lat)).toBe(true)
          expect(point.lon).toBeGreaterThanOrEqual(-180)
          expect(point.lon).toBeLessThanOrEqual(180)
          expect(point.lat).toBeGreaterThanOrEqual(-90)
          expect(point.lat).toBeLessThanOrEqual(90)
        }
      }),
      { numRuns: 120 }
    )
  })

  test('distance mapping preserves longitude delta', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -80, max: 80, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        fc.float({ min: -180, max: 180, noNaN: true }),
        (lat, lon, deltaLon) => {
          const lineLon = wrap180(lon - deltaLon)
          const distance = solarDistanceToMeridian(lat, lon, lineLon)
          expect(Math.abs(distance.deltaLongitude - wrap180(deltaLon))).toBeLessThan(1e-6)
          expect(Math.abs(distance.deltaMinutes - wrap180(deltaLon) * 4)).toBeLessThan(1e-6)
        }
      ),
      { numRuns: 200 }
    )
  })
})
