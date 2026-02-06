import { describe, expect, test } from 'vitest'
import { parseDeadlineInput } from '@/features/deadline/deadlineMath'

describe('parseDeadlineInput', () => {
  test('parses valid deadline', () => {
    const result = parseDeadlineInput({
      date: '2026-03-15',
      time: '22:00',
      zone: 'Europe/Prague',
      ambiguousPreference: 'earlier'
    })

    expect(result.valid).toBe(true)
    expect(result.targetMinutesOfDay).toBe(1320)
  })

  test('flags nonexistent dst wall time', () => {
    const result = parseDeadlineInput({
      date: '2025-03-30',
      time: '02:30',
      zone: 'Europe/Prague',
      ambiguousPreference: 'earlier'
    })

    expect(result.valid).toBe(false)
    expect(result.isNonexistent).toBe(true)
  })

  test('detects ambiguous dst wall time with both offsets', () => {
    const result = parseDeadlineInput({
      date: '2025-10-26',
      time: '02:30',
      zone: 'Europe/Prague',
      ambiguousPreference: 'earlier'
    })

    expect(result.valid).toBe(true)
    expect(result.ambiguous).toBe(true)
    expect(result.candidateOffsetsMinutes).toContain(60)
    expect(result.candidateOffsetsMinutes).toContain(120)
  })
})
