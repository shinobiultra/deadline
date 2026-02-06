import { DateTime } from 'luxon'
import type { DeadlineInput, DeadlineParseResult } from './types'

function parseDate(date: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const [hour, minute] = time.split(':').map(Number)
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null
  }

  return { hour, minute }
}

export function parseDeadlineInput(input: DeadlineInput): DeadlineParseResult {
  const dateParts = parseDate(input.date)
  const timeParts = parseTime(input.time)

  if (!dateParts || !timeParts) {
    return { valid: false, ambiguous: false, isNonexistent: false, error: 'invalid date/time format' }
  }

  const { year, month, day } = dateParts
  const { hour, minute } = timeParts
  const dt = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour,
      minute,
      second: 0,
      millisecond: 0
    },
    {
      zone: input.zone
    }
  )

  if (!dt.isValid) {
    return {
      valid: false,
      ambiguous: false,
      isNonexistent: false,
      error: dt.invalidExplanation ?? 'invalid timezone date'
    }
  }

  const normalizedShift =
    dt.year !== year || dt.month !== month || dt.day !== day || dt.hour !== hour || dt.minute !== minute

  if (normalizedShift) {
    return {
      valid: false,
      ambiguous: false,
      isNonexistent: true,
      error: 'selected wall time does not exist in this timezone (dst jump)'
    }
  }

  const offsetCandidates = dt
    .getPossibleOffsets()
    .sort((a, b) => a.toMillis() - b.toMillis())
  const ambiguous = offsetCandidates.length > 1

  const selected =
    input.ambiguousPreference === 'later'
      ? offsetCandidates[offsetCandidates.length - 1]
      : offsetCandidates[0]

  return {
    valid: true,
    ambiguous,
    isNonexistent: false,
    deadlineUtcMs: selected.toUTC().toMillis(),
    targetMinutesOfDay: hour * 60 + minute,
    selectedOffsetMinutes: selected.offset,
    candidateOffsetsMinutes: offsetCandidates.map((candidate) => candidate.offset)
  }
}

export function listIanaTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone')
  }

  return ['UTC']
}
