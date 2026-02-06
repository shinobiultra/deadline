import { DateTime } from 'luxon'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  LocateFixed,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlock
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  onRenameSlot: (name: string) => void
  onDeleteSlot: () => void
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
  demoMode?: boolean
}

type WorkflowState = 'done' | 'pending' | 'blocked' | 'optional'

type WorkflowStep = {
  id: string
  label: string
  detail: string
  state: WorkflowState
}

const WORKFLOW_STORAGE_KEY = 'deadline-workflow-collapsed-v1'

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

function statusChipClass(kind: 'synced' | 'unsaved' | 'locked') {
  if (kind === 'locked') {
    return 'border-sky-300/50 bg-sky-900/35 text-sky-100'
  }

  if (kind === 'unsaved') {
    return 'border-amber-300/50 bg-amber-900/35 text-amber-100'
  }

  return 'border-neon/50 bg-emerald-900/35 text-emerald-100'
}

function readWorkflowCollapsePreference() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(WORKFLOW_STORAGE_KEY) === '1'
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
    onRenameSlot,
    onDeleteSlot,
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
    setScrubRatio,
    demoMode = false
  } = props

  const dateInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)
  const deleteTimerRef = useRef<number | null>(null)
  const completedWorkflowRef = useRef(false)

  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [slotNameDraft, setSlotNameDraft] = useState(activeSlot?.name ?? '')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [workflowCollapsed, setWorkflowCollapsed] = useState(readWorkflowCollapsePreference)

  useEffect(() => {
    if (!activeSlot) {
      setSlotNameDraft('')
      return
    }

    setSlotNameDraft(activeSlot.name)
    setDeleteArmed(false)
  }, [activeSlot])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(WORKFLOW_STORAGE_KEY, workflowCollapsed ? '1' : '0')
  }, [workflowCollapsed])

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current !== null) {
        window.clearTimeout(deleteTimerRef.current)
      }
    }
  }, [])

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

  const activeTargetClockLabel = formatTargetClock(activeParseResult.targetMinutesOfDay)

  const resolvedUtc = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.deadlineUtcMs === undefined) {
      return null
    }

    return DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: 'utc' })
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid])

  const resolvedJst = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.deadlineUtcMs === undefined) {
      return null
    }

    return DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: 'Asia/Tokyo' })
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid])

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
    activeParseResult.error,
    activeParseResult.valid,
    activeTargetClockLabel,
    deadlineDate,
    deadlineTime,
    deadlineZone,
    location,
    previewMode,
    resolvedUtc
  ])

  const workflowComplete = workflowSteps.every((step) => step.state === 'done' || step.state === 'optional')

  useEffect(() => {
    if (workflowComplete && !completedWorkflowRef.current) {
      setWorkflowCollapsed(true)
      completedWorkflowRef.current = true
      return
    }

    if (!workflowComplete) {
      completedWorkflowRef.current = false
    }
  }, [workflowComplete])

  const nextAction = workflowSteps.find((step) => step.state === 'pending' || step.state === 'blocked')

  const activeState: 'synced' | 'unsaved' | 'locked' = activeSlot?.locked
    ? 'locked'
    : draftDirty
      ? 'unsaved'
      : 'synced'

  const setDateTracked = (value: string) => {
    setDeadlineDate(value)
  }

  const setTimeTracked = (value: string) => {
    setDeadlineTime(value)
  }

  const setZoneTracked = (value: string) => {
    setDeadlineZone(value)
  }

  const quickShift = (delta: { days?: number; hours?: number; minutes?: number }) => {
    const base =
      parseCurrentInput(deadlineDate, deadlineTime, deadlineZone) ??
      DateTime.now().setZone(deadlineZone || 'UTC')
    const next = base.plus(delta).set({ second: 0, millisecond: 0 })
    setDeadlineDate(next.toISODate() ?? deadlineDate)
    setDeadlineTime(next.toFormat('HH:mm'))
  }

  const commitSlotRename = () => {
    if (!activeSlot || demoMode) {
      return
    }

    const normalized = slotNameDraft.trim()
    if (!normalized || normalized === activeSlot.name) {
      setSlotNameDraft(activeSlot.name)
      return
    }

    onRenameSlot(normalized)
  }

  const armOrDelete = () => {
    if (demoMode) {
      return
    }

    if (deleteArmed) {
      onDeleteSlot()
      setDeleteArmed(false)
      if (deleteTimerRef.current !== null) {
        window.clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
      }
      return
    }

    setDeleteArmed(true)
    if (deleteTimerRef.current !== null) {
      window.clearTimeout(deleteTimerRef.current)
    }
    deleteTimerRef.current = window.setTimeout(() => {
      setDeleteArmed(false)
      deleteTimerRef.current = null
    }, 2600)
  }

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
            <p className="text-cyan-50 mt-1 font-mono text-[14px]">
              {activeSlot.name} - {activeSlot.date} {activeSlot.time} {describeTimezone(activeSlot.zone)}
            </p>
            <p className="text-cyan-100/78 text-[11px]">
              = {resolvedUtc?.toFormat("yyyy-LL-dd HH:mm 'utc'") ?? '--'}
              {' • '}
              {resolvedJst?.toFormat("HH:mm 'jst'") ?? '--'}
            </p>
          </>
        ) : (
          <p className="mt-1 text-rose-200">no active deadline</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${statusChipClass(activeState)}`}
          >
            {activeState === 'synced' ? 'synced' : activeState === 'unsaved' ? 'draft unsaved' : 'locked'}
          </span>

          {demoMode ? (
            <span className="border-cyan-300/35 bg-cyan-950/30 text-cyan-100 rounded-full border px-2 py-0.5 text-[11px]">
              demo mode
            </span>
          ) : null}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
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
            disabled={demoMode}
            aria-label="new deadline slot"
          >
            <Plus size={14} />
            new
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={onDuplicateSlot}
            disabled={demoMode}
            aria-label="duplicate deadline slot"
          >
            <Copy size={14} />
            dup
          </button>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={onToggleLock}
            disabled={demoMode}
            aria-label="toggle deadline lock"
          >
            {activeSlot?.locked ? <Unlock size={14} /> : <Lock size={14} />}
            {activeSlot?.locked ? 'unlock' : 'lock'}
          </button>
          <button
            type="button"
            className={`btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px] ${deleteArmed ? 'border-rose-300/60 text-rose-100' : ''}`}
            onClick={armOrDelete}
            disabled={demoMode}
            aria-label="delete active deadline slot"
          >
            <Trash2 size={14} />
            {deleteArmed ? 'confirm' : 'del'}
          </button>
        </div>

        <label className="mt-2 grid gap-1 text-xs">
          <span className="text-cyan-100/75 inline-flex items-center gap-1">
            <Pencil size={13} />
            slot name
          </span>
          <input
            className="border-cyan-400/35 text-cyan-50 h-10 rounded-md border bg-black/40 px-2 font-mono"
            value={slotNameDraft}
            onChange={(event) => setSlotNameDraft(event.target.value)}
            onBlur={commitSlotRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitSlotRename()
              }
            }}
            maxLength={42}
            disabled={demoMode || !activeSlot}
            placeholder="deadline name"
            aria-label="rename active deadline slot"
          />
        </label>

        {draftDirty ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn-neon inline-flex items-center gap-1 px-2 py-1 text-[11px] ${applyDisabled ? 'opacity-60' : ''}`}
              onClick={onApplyDraft}
              disabled={applyDisabled || demoMode}
              aria-label="apply draft deadline"
            >
              <Check size={14} />
              apply
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-[11px]"
              onClick={onDiscardDraft}
              disabled={demoMode}
            >
              discard
            </button>
            <span className="self-center text-[11px] text-amber-100">unsaved draft changes</span>
          </div>
        ) : null}
      </div>

      <div className="border-cyan-300/25 mt-2 rounded-lg border bg-black/30 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.16em]">workflow</p>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-[11px]"
            onClick={() => setWorkflowCollapsed((value) => !value)}
          >
            {workflowCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {workflowCollapsed ? 'expand' : 'collapse'}
          </button>
        </div>

        {workflowCollapsed ? (
          <p className="text-cyan-100/84 mt-1 text-[12px]">
            status: {workflowComplete ? 'armed (all set)' : `next: ${nextAction?.label ?? 'continue setup'}`}
          </p>
        ) : (
          <>
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
          </>
        )}
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
              disabled={demoMode}
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
              disabled={demoMode}
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
              disabled={demoMode}
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
              disabled={demoMode}
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
            <span className="text-cyan-100/70 inline-flex gap-1 self-center text-[11px]">
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
