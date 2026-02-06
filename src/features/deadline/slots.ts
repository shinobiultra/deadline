import { DateTime } from 'luxon'
import type { AmbiguousPreference, DeadlineSlot } from './types'

const STORAGE_KEY = 'deadline-slots-v1'
const MAX_SLOTS = 10

type DeadlineSlotsPayload = {
  activeId: string
  slots: DeadlineSlot[]
}

function buildId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `slot-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

export function createDeadlineSlot(input: {
  name: string
  date: string
  time: string
  zone: string
  ambiguousPreference: AmbiguousPreference
  locked?: boolean
}): DeadlineSlot {
  const now = Date.now()
  return {
    id: buildId(),
    name: input.name,
    date: input.date,
    time: input.time,
    zone: input.zone,
    ambiguousPreference: input.ambiguousPreference,
    locked: Boolean(input.locked),
    createdAtMs: now,
    updatedAtMs: now
  }
}

export function defaultDeadlineSlot(localZone: string): DeadlineSlot {
  const tomorrow = DateTime.now()
    .setZone(localZone || 'UTC')
    .plus({ day: 1 })
    .set({
      second: 0,
      millisecond: 0
    })

  return createDeadlineSlot({
    name: 'deadline #1',
    date: tomorrow.toISODate() ?? '2026-01-01',
    time: tomorrow.toFormat('HH:mm'),
    zone: localZone || 'UTC',
    ambiguousPreference: 'earlier'
  })
}

function sanitizeSlot(slot: unknown): DeadlineSlot | null {
  if (!slot || typeof slot !== 'object') {
    return null
  }

  const record = slot as Partial<DeadlineSlot>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.date !== 'string' ||
    typeof record.time !== 'string' ||
    typeof record.zone !== 'string'
  ) {
    return null
  }

  const ambiguousPreference: AmbiguousPreference =
    record.ambiguousPreference === 'later' ? 'later' : 'earlier'

  return {
    id: record.id,
    name: record.name,
    date: record.date,
    time: record.time,
    zone: record.zone,
    ambiguousPreference,
    locked: Boolean(record.locked),
    createdAtMs: Number.isFinite(record.createdAtMs) ? Number(record.createdAtMs) : Date.now(),
    updatedAtMs: Number.isFinite(record.updatedAtMs) ? Number(record.updatedAtMs) : Date.now()
  }
}

export function loadDeadlineSlots(localZone: string): DeadlineSlotsPayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const slot = defaultDeadlineSlot(localZone)
      return { activeId: slot.id, slots: [slot] }
    }

    const payload = JSON.parse(raw) as Partial<DeadlineSlotsPayload>
    const parsed = Array.isArray(payload.slots)
      ? payload.slots.map((item) => sanitizeSlot(item)).filter((item): item is DeadlineSlot => item !== null)
      : []

    if (parsed.length === 0) {
      const slot = defaultDeadlineSlot(localZone)
      return { activeId: slot.id, slots: [slot] }
    }

    const deduped: DeadlineSlot[] = []
    const seen = new Set<string>()
    for (const slot of parsed) {
      if (seen.has(slot.id)) continue
      seen.add(slot.id)
      deduped.push(slot)
      if (deduped.length >= MAX_SLOTS) break
    }

    const firstSlot = deduped[0]
    if (!firstSlot) {
      const slot = defaultDeadlineSlot(localZone)
      return { activeId: slot.id, slots: [slot] }
    }

    const activeId =
      typeof payload.activeId === 'string' && deduped.some((slot) => slot.id === payload.activeId)
        ? payload.activeId
        : firstSlot.id

    return { activeId, slots: deduped }
  } catch {
    const slot = defaultDeadlineSlot(localZone)
    return { activeId: slot.id, slots: [slot] }
  }
}

export function saveDeadlineSlots(payload: DeadlineSlotsPayload) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeId: payload.activeId,
      slots: payload.slots.slice(0, MAX_SLOTS)
    })
  )
}

export function maxDeadlineSlots() {
  return MAX_SLOTS
}
