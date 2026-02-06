export type AmbiguousPreference = 'earlier' | 'later'

export type PreviewMode = 'now' | 'deadline' | 'scrub'

export type LocationPoint = {
  lat: number
  lon: number
  label: string
  zone?: string
}

export type DeadlineInput = {
  date: string
  time: string
  zone: string
  ambiguousPreference: AmbiguousPreference
}

export type DeadlineParseResult = {
  valid: boolean
  error?: string
  ambiguous: boolean
  isNonexistent: boolean
  deadlineUtcMs?: number
  targetMinutesOfDay?: number
  selectedOffsetMinutes?: number
  candidateOffsetsMinutes?: number[]
}

export type DeadlineSlot = {
  id: string
  name: string
  date: string
  time: string
  zone: string
  ambiguousPreference: AmbiguousPreference
  locked: boolean
  createdAtMs: number
  updatedAtMs: number
}
