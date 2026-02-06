import { DateTime } from 'luxon'
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Lock,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Trash2,
  Unlock
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CityRecord } from '@/features/deadline/cities'
import { AOE_IANA_ZONE, describeTimezone, type TimezoneOption } from '@/features/deadline/deadlineMath'
import type { DeadlineParseResult, LocationPoint, PreviewMode } from '@/features/deadline/types'
import { Segmented } from './Segmented'
import { SwitchPill } from './SwitchPill'

type CommandPanelProps = {
  deadlineDate: string
  setDeadlineDate: (value: string) => void
  deadlineTime: string
  setDeadlineTime: (value: string) => void
  deadlineZone: string
  setDeadlineZone: (value: string) => void
  timezoneOptions: TimezoneOption[]
  parseResult: DeadlineParseResult
  activeParseResult: DeadlineParseResult
  ambiguousPreference: 'earlier' | 'later'
  setAmbiguousPreference: (value: 'earlier' | 'later') => void
  activeSlot: {
    id: string
    name: string
    date: string
    time: string
    zone: string
    locked: boolean
  } | null
  slots: Array<{ id: string; name: string }>
  activeSlotId: string
  draftDirty: boolean
  onSwitchSlot: (id: string) => void
  onAddSlot: () => void
  onDuplicateSlot: () => void
  onToggleLock: () => void
  onApplyDraft: () => void
  onDiscardDraft: () => void
  applyDisabled: boolean
  location: LocationPoint | null
  setLocation: (location: LocationPoint | null) => void
  cityQuery: string
  setCityQuery: (value: string) => void
  cityResults: CityRecord[]
  showTimezones: boolean
  setShowTimezones: (value: boolean) => void
  showSolarTime: boolean
  setShowSolarTime: (value: boolean) => void
  showDayNight: boolean
  setShowDayNight: (value: boolean) => void
  showLandmarks: boolean
  setShowLandmarks: (value: boolean) => void
  previewMode: PreviewMode
  setPreviewMode: (value: PreviewMode) => void
  scrubRatio: number
  setScrubRatio: (value: number) => void
}

type WorkflowState = 'done' | 'pending' | 'blocked' | 'optional'

type WorkflowStep = {
  id: string
  label: string
  detail: string
  state: WorkflowState
}

function dateStringTomorrow() {
  return DateTime.now().plus({ day: 1 }).toISODate() ?? '2026-01-01'
}

function formatTargetClock(minutes: number | undefined) {
  if (minutes === undefined) {
    return '--:--'
  }

  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatOffset(minutes: number | undefined) {
  if (minutes === undefined) {
    return 'offset pending'
  }

  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hour = Math.floor(abs / 60)
  const minute = abs % 60
  if (minute === 0) {
    return `UTC${sign}${String(hour).padStart(2, '0')}`
  }

  return `UTC${sign}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseCurrentInput(date: string, time: string, zone: string): DateTime | null {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null
  }

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
    { zone: zone || 'UTC' }
  )

  return dt.isValid ? dt : null
}

function workflowDotClass(state: WorkflowState) {
  if (state === 'done') return 'bg-neon shadow-[0_0_10px_rgba(124,255,178,0.5)]'
  if (state === 'blocked') return 'bg-rose-300'
  if (state === 'optional') return 'bg-cyan-200/40'
  return 'bg-cyan-200/65'
}

function workflowLabelClass(state: WorkflowState) {
  if (state === 'done') return 'text-cyan-50'
  if (state === 'blocked') return 'text-rose-200'
  return 'text-cyan-100/90'
}

export function CommandPanel(props: CommandPanelProps) {
  const {
    deadlineDate,
    setDeadlineDate,
    deadlineTime,
    setDeadlineTime,
    deadlineZone,
    setDeadlineZone,
    timezoneOptions,
    parseResult,
    activeParseResult,
    ambiguousPreference,
    setAmbiguousPreference,
    activeSlot,
    slots,
    activeSlotId,
    draftDirty,
    onSwitchSlot,
    onAddSlot,
    onDuplicateSlot,
    onToggleLock,
    onApplyDraft,
    onDiscardDraft,
    applyDisabled,
    location,
    setLocation,
    cityQuery,
    setCityQuery,
    cityResults,
    showTimezones,
    setShowTimezones,
    showSolarTime,
    setShowSolarTime,
    showDayNight,
    setShowDayNight,
    showLandmarks,
    setShowLandmarks,
    previewMode,
    setPreviewMode,
    scrubRatio,
    setScrubRatio
  } = props

  const dateInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [lastEditedAtMs, setLastEditedAtMs] = useState(() => Date.now())

  const markEdited = () => setLastEditedAtMs(Date.now())

  const zoneNow = DateTime.now().setZone(deadlineZone)
  const nowZoneLabel = zoneNow.isValid ? zoneNow.toFormat("ccc, dd LLL HH:mm 'local'") : 'invalid timezone'

  const timezoneMatches = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase()
    const baseMatches = (
      query
        ? timezoneOptions.filter((option) => option.searchTerms.some((term) => term.includes(query)))
        : timezoneOptions
    ).slice(0, 250)

    if (baseMatches.some((option) => option.value === deadlineZone)) {
      return baseMatches
    }

    const selected = timezoneOptions.find((option) => option.value === deadlineZone)
    if (!selected) {
      return baseMatches
    }

    return [selected, ...baseMatches.slice(0, 249)]
  }, [deadlineZone, timezoneOptions, timezoneSearch])

  const hasSelectedOption = timezoneOptions.some((option) => option.value === deadlineZone)

  const targetClockLabel = formatTargetClock(parseResult.targetMinutesOfDay)
  const activeTargetClockLabel = formatTargetClock(activeParseResult.targetMinutesOfDay)

  const resolvedUtc = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.deadlineUtcMs === undefined) {
      return null
    }

    return DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: 'utc' })
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid])

  const resolvedZone = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.deadlineUtcMs === undefined) {
      return null
    }

    return DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: activeSlot?.zone ?? deadlineZone })
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid, activeSlot?.zone, deadlineZone])

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const hasDateTime = Boolean(deadlineDate && deadlineTime)

    return [
      {
        id: 'step-1',
        label: 'set deadline date + time',
        detail: hasDateTime ? `${deadlineDate} ${deadlineTime}` : 'waiting for input',
        state: hasDateTime ? 'done' : 'pending'
      },
      {
        id: 'step-2',
        label: 'pick timezone',
        detail: describeTimezone(deadlineZone),
        state: deadlineZone ? 'done' : 'pending'
      },
      {
        id: 'step-3',
        label: 'resolve true utc instant',
        detail: activeParseResult.valid
          ? `${resolvedUtc?.toFormat("yyyy-LL-dd HH:mm 'utc'") ?? 'ready'}`
          : activeParseResult.error || 'waiting for valid wall time',
        state: activeParseResult.valid ? 'done' : 'blocked'
      },
      {
        id: 'step-4',
        label: 'verify lines on map/globe',
        detail: `tracking ${activeTargetClockLabel} · preview ${previewMode}`,
        state: activeParseResult.valid ? 'done' : 'pending'
      },
      {
        id: 'step-5',
        label: 'optional: set your location',
        detail: location ? location.label : 'not set',
        state: location ? 'done' : 'optional'
      }
    ]
  }, [
    deadlineDate,
    deadlineTime,
    deadlineZone,
    location,
    activeParseResult.error,
    activeParseResult.valid,
    previewMode,
    resolvedUtc,
    activeTargetClockLabel
  ])

  const nextAction = workflowSteps.find((step) => step.state === 'pending' || step.state === 'blocked')

  const setDateTracked = (value: string) => {
    markEdited()
    setDeadlineDate(value)
  }

  const setTimeTracked = (value: string) => {
    markEdited()
    setDeadlineTime(value)
  }

  const setZoneTracked = (value: string) => {
    markEdited()
    setDeadlineZone(value)
  }

  const quickShift = (delta: { days?: number; hours?: number; minutes?: number }) => {
    const base =
      parseCurrentInput(deadlineDate, deadlineTime, deadlineZone) ??
      DateTime.now().setZone(deadlineZone || 'UTC')
    const next = base.plus(delta).set({ second: 0, millisecond: 0 })
    markEdited()
    setDeadlineDate(next.toISODate() ?? deadlineDate)
    setDeadlineTime(next.toFormat('HH:mm'))
  }

  const workflowStatusLabel = activeParseResult.valid ? 'active tracking' : 'active deadline invalid'

  return (
    <section
      className="border-cyan-300/30 rounded-xl border bg-panel/80 p-3 shadow-neon"
      data-debug-key="command-panel"
    >
      <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.18em]">command</p>

      <div className="border-cyan-300/30 mt-2 rounded-lg border bg-black/35 p-2">
        <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.16em]">active deadline</p>
        {activeSlot ? (
          <>
            <p className="text-cyan-50 mt-1 font-mono">
              {activeSlot.name} · {activeSlot.date} {activeSlot.time} · {describeTimezone(activeSlot.zone)}
            </p>
            <p className="text-cyan-100/72 text-[11px]">
              target {activeTargetClockLabel} · {activeSlot.locked ? 'locked' : 'editable'}
            </p>
          </>
        ) : (
          <p className="mt-1 text-rose-200">no active deadline</p>
        )}

        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <select
            className="border-cyan-400/35 text-cyan-50 h-10 rounded-md border bg-black/40 px-2 font-mono text-xs"
            value={activeSlotId}
            onChange={(event) => onSwitchSlot(event.target.value)}
            aria-label="switch deadline slot"
          >
            {slots.map((slot, index) => (
              <option key={slot.id} value={slot.id}>
                {index + 1}. {slot.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={onAddSlot}
            aria-label="new deadline slot"
          >
            <Plus size={14} />
            new
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={onDuplicateSlot}
            aria-label="duplicate deadline slot"
          >
            <Copy size={14} />
            dup
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={onToggleLock}
            aria-label="toggle deadline lock"
          >
            {activeSlot?.locked ? <Unlock size={14} /> : <Lock size={14} />}
            {activeSlot?.locked ? 'unlock' : 'lock'}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn-neon inline-flex items-center gap-1 px-2 py-1 text-[11px] ${applyDisabled ? 'opacity-60' : ''}`}
            onClick={onApplyDraft}
            disabled={applyDisabled}
            aria-label="apply draft deadline"
          >
            <Check size={14} />
            apply
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-[11px]"
            onClick={onDiscardDraft}
            disabled={!draftDirty}
          >
            discard
          </button>
          <span className="text-cyan-100/70 self-center text-[11px]">
            {draftDirty
              ? 'draft changed · cmd/ctrl+enter apply · esc discard'
              : 'draft matches active deadline'}
          </span>
        </div>
      </div>

      <div className="border-cyan-300/25 mt-2 rounded-lg border bg-black/30 p-2">
        <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.16em]">workflow</p>
        <ul className="mt-1 grid gap-1.5 text-xs">
          {workflowSteps.map((step, index) => (
            <li className="relative pl-6" key={step.id}>
              <span
                className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${workflowDotClass(step.state)}`}
              />
              {index < workflowSteps.length - 1 ? (
                <span className="bg-cyan-300/25 absolute left-[4px] top-[14px] h-[calc(100%-4px)] w-px" />
              ) : null}
              <p className={`text-[12px] ${workflowLabelClass(step.state)}`}>
                {index + 1}. {step.label}
              </p>
              <p className="text-cyan-100/64 text-[11px]">{step.detail}</p>
            </li>
          ))}
        </ul>
        <p className="text-cyan-100/72 mt-1 text-[11px]">
          next action: {nextAction ? nextAction.label : 'all set'}
        </p>
      </div>

      <div className="bg-black/38 mt-2 rounded-lg border border-neon/40 p-2 text-xs">
        <p className="text-cyan-200/68 text-[10px] uppercase tracking-[0.16em]">deadline tracker</p>
        {activeParseResult.valid && resolvedUtc && resolvedZone ? (
          <>
            <p className="mt-1 font-mono text-neon">
              {workflowStatusLabel} · target {activeTargetClockLabel}
            </p>
            <p className="text-cyan-100/74">
              active wall time: {activeSlot?.date ?? '--'} {activeSlot?.time ?? '--'} ·{' '}
              {describeTimezone(activeSlot?.zone ?? deadlineZone)}
            </p>
            <p className="text-cyan-100/74">
              resolved utc instant: {resolvedUtc.toFormat("yyyy-LL-dd HH:mm 'utc'")}
            </p>
            <p className="text-cyan-100/74">
              offset at deadline: {formatOffset(activeParseResult.selectedOffsetMinutes)}
            </p>
            <p className="text-cyan-100/74">
              zone-local at instant: {resolvedZone.toFormat('ccc, dd LLL HH:mm')}
            </p>
            <p className="text-cyan-100/74">
              draft wall time: {deadlineDate} {deadlineTime} · {describeTimezone(deadlineZone)} · target{' '}
              {targetClockLabel}
            </p>
          </>
        ) : (
          <p className="mt-1 text-rose-200">
            active tracking paused:{' '}
            {activeParseResult.error || 'complete date/time/timezone to resolve deadline instant'}
          </p>
        )}
        <p className="text-cyan-100/60 mt-1 text-[11px]">
          last edit {DateTime.fromMillis(lastEditedAtMs).toFormat('HH:mm:ss')}
        </p>
      </div>

      <p
        className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${
          parseResult.valid
            ? 'text-cyan-100/86 border-neon/45 bg-emerald-950/25'
            : 'border-rose-300/45 bg-rose-950/20 text-rose-100/90'
        }`}
      >
        {parseResult.valid
          ? 'safe edit mode: changes stay in draft until apply'
          : 'draft invalid: fix date/time/timezone before apply'}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs" data-debug-key="date-field">
          <span>deadline date</span>
          <div className="relative" data-debug-key="date-input-wrap">
            <input
              className="border-cyan-400/35 text-cyan-50 h-10 w-full rounded-md border bg-black/40 px-2 pr-12 font-mono"
              type="date"
              ref={dateInputRef}
              value={deadlineDate}
              onChange={(event) => setDateTracked(event.target.value)}
              data-debug-key="date-input"
            />
            <button
              type="button"
              className="btn-ghost absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-l-none rounded-r-md"
              onClick={() => {
                const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
                input?.showPicker?.()
                input?.focus()
              }}
              aria-label="open calendar picker"
              data-debug-key="date-icon-btn"
            >
              <CalendarDays size={15} />
            </button>
          </div>
        </label>

        <label className="grid gap-1 text-xs" data-debug-key="time-field">
          <span>deadline time</span>
          <div className="relative" data-debug-key="time-input-wrap">
            <input
              className="border-cyan-400/35 text-cyan-50 h-10 w-full rounded-md border bg-black/40 px-2 pr-12 font-mono"
              type="time"
              ref={timeInputRef}
              value={deadlineTime}
              onChange={(event) => setTimeTracked(event.target.value)}
              data-debug-key="time-input"
            />
            <button
              type="button"
              className="btn-ghost absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-l-none rounded-r-md"
              onClick={() => {
                const input = timeInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
                input?.showPicker?.()
                input?.focus()
              }}
              aria-label="open time picker"
              data-debug-key="time-icon-btn"
            >
              <Clock3 size={15} />
            </button>
          </div>
        </label>

        <div className="grid gap-1 text-xs sm:col-span-2">
          <span>quick adjust</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => quickShift({ days: -1 })}
            >
              -1d
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => quickShift({ hours: -1 })}
            >
              -1h
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => quickShift({ minutes: -15 })}
            >
              -15m
            </button>
            <button
              type="button"
              className="btn-neon px-2 py-1 text-[11px]"
              onClick={() => quickShift({ minutes: 15 })}
            >
              +15m
            </button>
            <button
              type="button"
              className="btn-neon px-2 py-1 text-[11px]"
              onClick={() => quickShift({ hours: 1 })}
            >
              +1h
            </button>
            <button
              type="button"
              className="btn-neon px-2 py-1 text-[11px]"
              onClick={() => quickShift({ days: 1 })}
            >
              +1d
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => {
                const next = DateTime.now()
                  .setZone(deadlineZone || 'UTC')
                  .plus({ day: 1 })
                  .set({ second: 0, millisecond: 0 })
                markEdited()
                setDeadlineDate(next.toISODate() ?? dateStringTomorrow())
                setDeadlineTime(next.toFormat('HH:mm'))
              }}
            >
              now+24h
            </button>
          </div>
        </div>

        <label className="grid gap-1 text-xs sm:col-span-2">
          <span>timezone</span>
          <div className="relative">
            <Search
              size={14}
              className="text-cyan-200/65 pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
            />
            <input
              className="border-cyan-400/35 text-cyan-50 h-10 w-full rounded-md border bg-black/40 pl-8 pr-2 font-mono"
              value={timezoneSearch}
              onChange={(event) => setTimezoneSearch(event.target.value)}
              placeholder="type a city or tz (prague / tokyo / utc+9)"
              data-testid="timezone-search"
            />
          </div>

          <div className="flex gap-2">
            <select
              className="border-cyan-400/35 text-cyan-50 h-10 w-full rounded-md border bg-black/40 px-2 font-mono"
              value={hasSelectedOption ? deadlineZone : '__custom__'}
              onChange={(event) => {
                const value = event.target.value
                if (value !== '__custom__') {
                  setZoneTracked(value)
                }
              }}
              data-testid="timezone-select"
            >
              {!hasSelectedOption ? (
                <option value="__custom__">{deadlineZone || 'custom timezone'}</option>
              ) : null}
              {timezoneMatches.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => setZoneTracked(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}
            >
              local
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => setZoneTracked('UTC')}
            >
              utc
            </button>
            <button
              type="button"
              className="btn-neon px-2 py-1 text-[11px]"
              onClick={() => setZoneTracked(AOE_IANA_ZONE)}
            >
              aoe
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() => {
                markEdited()
                setDeadlineDate(dateStringTomorrow())
                setDeadlineTime('23:59')
                setDeadlineZone(AOE_IANA_ZONE)
              }}
            >
              hard stop
            </button>
          </div>

          <span className="text-cyan-100/60 text-[11px]">
            selected: {describeTimezone(deadlineZone)} · now in selected zone: {nowZoneLabel}
          </span>
        </label>
      </div>

      {parseResult.error ? <p className="mt-2 text-xs text-rose-300">{parseResult.error}</p> : null}

      {parseResult.ambiguous ? (
        <div className="mt-2 rounded-md border border-amber-300/35 bg-amber-950/20 p-2 text-xs text-amber-100">
          <p>ambiguous dst time detected. choose instance:</p>
          <div className="mt-1 flex gap-2">
            <button
              className="btn-ghost px-2 py-1"
              onClick={() => setAmbiguousPreference('earlier')}
              type="button"
            >
              earlier {ambiguousPreference === 'earlier' ? '✓' : ''}
            </button>
            <button
              className="btn-ghost px-2 py-1"
              onClick={() => setAmbiguousPreference('later')}
              type="button"
            >
              later {ambiguousPreference === 'later' ? '✓' : ''}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs">
        <label className="grid gap-1">
          <span>city search (offline)</span>
          <input
            className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            placeholder="search city or country"
          />
        </label>

        <div className="flex flex-wrap gap-1">
          {cityResults.map((city) => (
            <button
              key={`${city.name}-${city.zone}`}
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={() =>
                setLocation({
                  lat: city.lat,
                  lon: city.lon,
                  zone: city.zone,
                  label: `${city.name}, ${city.country}`
                })
              }
              type="button"
            >
              {city.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-neon inline-flex items-center gap-1 px-2 py-1"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    label: 'my location'
                  })
                },
                () => {
                  // no-op
                },
                {
                  enableHighAccuracy: false,
                  timeout: 8000
                }
              )
            }}
            type="button"
          >
            <LocateFixed size={14} />
            use location
          </button>

          <button
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1"
            onClick={() => setLocation(null)}
            type="button"
          >
            <Trash2 size={14} />
            clear
          </button>

          {location ? (
            <span className="text-cyan-100/70 inline-flex items-center gap-1 self-center text-[11px]">
              <MapPin size={12} />
              {location.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-cyan-300/25 mt-3 grid gap-2 rounded-lg border p-2 text-xs">
        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchPill label="civil" checked={showTimezones} onCheckedChange={setShowTimezones} />
          <SwitchPill label="solar" checked={showSolarTime} onCheckedChange={setShowSolarTime} />
          <SwitchPill label="day/night" checked={showDayNight} onCheckedChange={setShowDayNight} />
          <SwitchPill label="landmarks" checked={showLandmarks} onCheckedChange={setShowLandmarks} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span>time view</span>
          <Segmented
            value={previewMode}
            onChange={setPreviewMode}
            options={[
              { value: 'now', label: 'now' },
              { value: 'deadline', label: 'deadline' },
              { value: 'scrub', label: 'scrub' }
            ]}
          />
        </div>

        {previewMode === 'scrub' ? (
          <label className="grid gap-1">
            <span className="text-cyan-100/70 text-[11px]">warp</span>
            <input
              className="h-10"
              type="range"
              min={0}
              max={1000}
              value={Math.round(scrubRatio * 1000)}
              onChange={(event) => setScrubRatio(Number(event.target.value) / 1000)}
            />
          </label>
        ) : null}
      </div>
    </section>
  )
}
