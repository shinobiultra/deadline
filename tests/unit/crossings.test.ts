import { describe, expect, test } from 'vitest'
import { computeLandmarkCrossings } from '@/features/landmarks/crossings'

describe('landmark crossings', () => {
  test('finds crossing with bisection close to expected instant', () => {
    const start = Date.parse('2026-01-01T00:00:00Z')
    const end = Date.parse('2026-01-01T06:00:00Z')

    const crossings = computeLandmarkCrossings({
      landmarks: [
        {
          id: 'test',
          name: 'test lon',
          lat: 0,
          lon: -30,
          tags: []
        }
      ],
      rangeStartMs: start,
      rangeEndMs: end,
      targetMinutesOfDay: 0,
      apparentSolar: false
    })

    expect(crossings).toHaveLength(1)
    const expected = Date.parse('2026-01-01T02:00:00Z')
    expect(Math.abs(crossings[0].crossingMs - expected)).toBeLessThanOrEqual(1000)
  })
})
