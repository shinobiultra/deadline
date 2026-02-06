import html2canvas from 'html2canvas'
import { Camera, Bug, Sparkles, Radar } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { CommandPanel } from '@/ui/CommandPanel'
import { CountdownCard } from '@/ui/CountdownCard'
import { DebugOverlay } from '@/ui/DebugOverlay'
import { DistanceBox } from '@/ui/DistanceBox'
import { NearDeadlineEffects } from '@/ui/NearDeadlineEffects'
import { SettingsDrawer } from '@/ui/SettingsDrawer'
import { StatsStrip } from '@/ui/StatsStrip'
import { ToastStack, type ToastItem } from '@/ui/ToastStack'
import { Map2DView } from '@/views/map2d/Map2DView'
import { DetailMapView } from '@/views/detail/DetailMapView'
import { useTimezonePolygons } from '@/features/civil/useTimezonePolygons'
import { useCities } from '@/features/deadline/cities'
import {
  AOE_IANA_ZONE,
  describeTimezone,
  listDeadlineTimezoneOptions,
  normalizeDeadlineZone,
  parseDeadlineInput
} from '@/features/deadline/deadlineMath'
import { useDeadlineStore } from '@/features/deadline/store'
import {
  createDeadlineSlot,
  defaultDeadlineSlot,
  loadDeadlineSlots,
  maxDeadlineSlots,
  saveDeadlineSlots
} from '@/features/deadline/slots'
import type { AmbiguousPreference, DeadlineSlot } from '@/features/deadline/types'
import { useLandmarks } from '@/features/landmarks/useLandmarks'
import { computeLandmarkCrossings } from '@/features/landmarks/crossings'
import {
  solarDeadlineLongitude,
  solarDistanceToMeridian,
  solarLineSpeedDegreesPerHour
} from '@/features/solar/solarMath'
import { assetUrl } from '@/lib/assets'
import { useIntervalNow } from '@/lib/useIntervalNow'
import { useRenderNow } from '@/lib/useRenderNow'

const Globe3DView = lazy(() => import('@/views/globe3d/Globe3DView'))

type ViewMode = '2d' | '3d'

type DemoConfig = {
  enabled: boolean
  debug: boolean
  initialView: ViewMode
  detailOpen: boolean
}

type DeadlineDraft = {
  date: string
  time: string
  zone: string
  ambiguousPreference: AmbiguousPreference
}

const DEMO_NOW_ISO = '2026-02-05T08:21:44.000Z'
const DEMO_NOW_MS = new Date(DEMO_NOW_ISO).getTime()
const DEMO_SLOT: DeadlineSlot = {
  id: 'demo-aoe-2026-02-05',
  name: 'deadline #1',
  date: '2026-02-05',
  time: '00:00',
  zone: AOE_IANA_ZONE,
  ambiguousPreference: 'earlier',
  locked: false,
  createdAtMs: DEMO_NOW_MS,
  updatedAtMs: DEMO_NOW_MS
}

function draftFromSlot(slot: DeadlineSlot): DeadlineDraft {
  return {
    date: slot.date,
    time: slot.time,
    zone: slot.zone,
    ambiguousPreference: slot.ambiguousPreference
  }
}

function slotIndexName(index: number): string {
  return `deadline #${index + 1}`
}

function notifyIfEnabled(enabled: boolean, message: string) {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  void new Notification('deadLINE', { body: message })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function formatTargetClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function readDemoConfig(): DemoConfig {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      debug: false,
      initialView: '2d',
      detailOpen: false
    }
  }

  const params = new URLSearchParams(window.location.search)
  const enabled = params.get('demo') === '1'
  const debug = params.get('debug') === '1'
  const requestedView = params.get('view')?.toLowerCase()
  const initialView: ViewMode = requestedView === '3d' ? '3d' : '2d'
  const detailOpen = requestedView === 'detail'

  return {
    enabled,
    debug,
    initialView,
    detailOpen
  }
}

export default function App() {
  const demo = useMemo(() => readDemoConfig(), [])
  const nowMs = useIntervalNow(1000)
  const { nowMs: renderNowMs, fps: renderFps, driftMs: renderDriftMs } = useRenderNow(60, 30)
  const [viewMode, setViewMode] = useState<ViewMode>(demo.initialView)
  const [showDetailView, setShowDetailView] = useState(demo.detailOpen)
  const [cityQuery, setCityQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [terminatorComputeMs, setTerminatorComputeMs] = useState(0)

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [debugMode, setDebugMode] = useState(demo.debug)
  const [assetCheckError, setAssetCheckError] = useState<string | null>(null)
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const [slotsState, setSlotsState] = useState(() => {
    if (demo.enabled) {
      return { activeId: DEMO_SLOT.id, slots: [DEMO_SLOT] }
    }

    if (typeof window === 'undefined') {
      const slot = defaultDeadlineSlot(localZone)
      return { activeId: slot.id, slots: [slot] }
    }

    return loadDeadlineSlots(localZone)
  })

  const {
    location,
    showTimezones,
    showSolarTime,
    showDayNight,
    brightDayLighting,
    showLandmarks,
    previewMode,
    scrubRatio,
    useApparentSolar,
    useTimezonePolygons: useTimezonePolygonsMode,
    civilGlowMinutes,
    alertThresholdMinutes,
    enableCrossingAlerts,
    enableBrowserNotifications,
    reducedMotion,
    setLocation,
    setShowTimezones,
    setShowSolarTime,
    setShowDayNight,
    setBrightDayLighting,
    setShowLandmarks,
    setPreviewMode,
    setScrubRatio,
    setUseApparentSolar,
    setUseTimezonePolygons,
    setCivilGlowMinutes,
    setAlertThresholds,
    setEnableCrossingAlerts,
    setEnableBrowserNotifications,
    setReducedMotion
  } = useDeadlineStore()

  const timezones = useMemo(() => listDeadlineTimezoneOptions(), [])
  const cityResults = useCities(cityQuery)
  const landmarks = useLandmarks()
  const { status: timezonePolygonStatus, features: timezonePolygons } =
    useTimezonePolygons(useTimezonePolygonsMode)

  const activeSlot = useMemo(
    () => slotsState.slots.find((slot) => slot.id === slotsState.activeId) ?? slotsState.slots[0],
    [slotsState.activeId, slotsState.slots]
  )

  const [draftDeadline, setDraftDeadline] = useState<DeadlineDraft>(() =>
    activeSlot ? draftFromSlot(activeSlot) : draftFromSlot(defaultDeadlineSlot(localZone))
  )

  useEffect(() => {
    if (!activeSlot) {
      return
    }

    setDraftDeadline(draftFromSlot(activeSlot))
  }, [activeSlot])

  useEffect(() => {
    if (demo.enabled) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    saveDeadlineSlots(slotsState)
  }, [demo.enabled, slotsState])

  useEffect(() => {
    if (!demo.enabled) {
      return
    }

    setLocation(null)
    setPreviewMode('now')
    setScrubRatio(0)
    setShowLandmarks(false)
    setUseTimezonePolygons(false)
    setUseApparentSolar(false)
    setShowDayNight(true)
    setShowSolarTime(true)
    setShowTimezones(true)
  }, [
    demo.enabled,
    setLocation,
    setPreviewMode,
    setScrubRatio,
    setShowLandmarks,
    setUseTimezonePolygons,
    setUseApparentSolar,
    setShowDayNight,
    setShowSolarTime,
    setShowTimezones
  ])

  const draftDirty = useMemo(() => {
    if (!activeSlot) {
      return false
    }

    return (
      draftDeadline.date !== activeSlot.date ||
      draftDeadline.time !== activeSlot.time ||
      draftDeadline.zone !== activeSlot.zone ||
      draftDeadline.ambiguousPreference !== activeSlot.ambiguousPreference
    )
  }, [activeSlot, draftDeadline])

  useEffect(() => {
    if (!debugMode) {
      setAssetCheckError(null)
      return
    }

    let active = true
    const checkAssets = async () => {
      const probes = [
        assetUrl('data/world-110m.topo.json'),
        assetUrl('textures/earth-dark.jpg'),
        assetUrl('data/landmarks_core.json')
      ]

      for (const probe of probes) {
        try {
          const response = await fetch(probe, { method: 'GET' })
          if (!response.ok) {
            if (active) {
              setAssetCheckError(`assets broken: ${probe} -> ${response.status}`)
            }
            return
          }
        } catch {
          if (active) {
            setAssetCheckError(`assets broken: ${probe} fetch failed`)
          }
          return
        }
      }

      if (active) {
        setAssetCheckError(null)
      }
    }

    void checkAssets()
    return () => {
      active = false
    }
  }, [debugMode])

  const activeParseResult = useMemo(
    () =>
      parseDeadlineInput({
        date: activeSlot?.date ?? draftDeadline.date,
        time: activeSlot?.time ?? draftDeadline.time,
        zone: activeSlot?.zone ?? draftDeadline.zone,
        ambiguousPreference: activeSlot?.ambiguousPreference ?? draftDeadline.ambiguousPreference
      }),
    [activeSlot, draftDeadline]
  )

  const draftParseResult = useMemo(
    () =>
      parseDeadlineInput({
        date: draftDeadline.date,
        time: draftDeadline.time,
        zone: draftDeadline.zone,
        ambiguousPreference: draftDeadline.ambiguousPreference
      }),
    [draftDeadline]
  )

  const effectiveNowMs = demo.enabled ? DEMO_NOW_MS : nowMs
  const effectiveRenderNowMs = demo.enabled ? DEMO_NOW_MS : renderNowMs
  const visualNowMs = previewMode === 'now' ? effectiveRenderNowMs : effectiveNowMs
  const nowTime = useMemo(() => new Date(visualNowMs), [visualNowMs])

  const deadlineTimeDate = useMemo(() => {
    if (!activeParseResult.valid || !activeParseResult.deadlineUtcMs) {
      return null
    }
    return new Date(activeParseResult.deadlineUtcMs)
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid])

  const displayTime = useMemo(() => {
    if (!activeParseResult.valid || !activeParseResult.deadlineUtcMs) {
      return new Date(visualNowMs)
    }

    if (previewMode === 'deadline') {
      return new Date(activeParseResult.deadlineUtcMs)
    }

    if (previewMode === 'scrub') {
      const start = effectiveNowMs
      const end = activeParseResult.deadlineUtcMs
      return new Date(start + (end - start) * scrubRatio)
    }

    return new Date(visualNowMs)
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.valid,
    effectiveNowMs,
    previewMode,
    scrubRatio,
    visualNowMs
  ])

  const solarLongitude = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined) {
      return 0
    }

    return solarDeadlineLongitude(displayTime, activeParseResult.targetMinutesOfDay, useApparentSolar)
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, displayTime, useApparentSolar])

  const deadlineSolarLongitude = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined || !deadlineTimeDate) {
      return null
    }

    return solarDeadlineLongitude(deadlineTimeDate, activeParseResult.targetMinutesOfDay, useApparentSolar)
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, deadlineTimeDate, useApparentSolar])

  const lineSpeed = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined) {
      return 15
    }

    return solarLineSpeedDegreesPerHour(displayTime, activeParseResult.targetMinutesOfDay, useApparentSolar)
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, displayTime, useApparentSolar])

  const distance = useMemo(() => {
    if (!location || !activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined) {
      return null
    }

    return solarDistanceToMeridian(location.lat, location.lon, solarLongitude)
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, location, solarLongitude])

  const crossingPlan = useMemo(() => {
    if (
      !activeParseResult.valid ||
      activeParseResult.deadlineUtcMs === undefined ||
      activeParseResult.targetMinutesOfDay === undefined
    ) {
      return []
    }

    return computeLandmarkCrossings({
      landmarks,
      rangeStartMs: effectiveNowMs,
      rangeEndMs: activeParseResult.deadlineUtcMs,
      targetMinutesOfDay: activeParseResult.targetMinutesOfDay,
      apparentSolar: useApparentSolar
    })
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.targetMinutesOfDay,
    activeParseResult.valid,
    effectiveNowMs,
    landmarks,
    useApparentSolar
  ])

  const remainingMs = activeParseResult.deadlineUtcMs
    ? activeParseResult.deadlineUtcMs - effectiveNowMs
    : Number.POSITIVE_INFINITY

  const deadlineZoneLabel = describeTimezone(activeSlot?.zone ?? draftDeadline.zone)
  const targetClockLabel =
    activeParseResult.valid && activeParseResult.targetMinutesOfDay !== undefined
      ? formatTargetClock(activeParseResult.targetMinutesOfDay)
      : '--:--'

  const pushToast = useCallback((id: string, message: string) => {
    setToasts((previous) => {
      if (previous.some((toast) => toast.id === id)) {
        return previous
      }

      return [...previous, { id, message }]
    })

    window.setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id))
    }, 9_000)
  }, [])

  const updateDraftField = useCallback(
    (patch: Partial<DeadlineDraft>) => {
      setDraftDeadline((previous) => ({
        ...previous,
        ...patch
      }))
    },
    [setDraftDeadline]
  )

  const switchSlot = useCallback((id: string) => {
    setSlotsState((previous) => {
      if (!previous.slots.some((slot) => slot.id === id)) {
        return previous
      }

      return { ...previous, activeId: id }
    })
  }, [])

  const addNewSlot = useCallback(() => {
    if (demo.enabled) {
      return
    }

    setSlotsState((previous) => {
      if (previous.slots.length >= maxDeadlineSlots()) {
        pushToast('slots-cap', `slot limit reached (${maxDeadlineSlots()})`)
        return previous
      }

      const candidate = createDeadlineSlot({
        name: slotIndexName(previous.slots.length),
        date: draftDeadline.date,
        time: draftDeadline.time,
        zone: normalizeDeadlineZone(draftDeadline.zone),
        ambiguousPreference: draftDeadline.ambiguousPreference
      })

      return {
        activeId: candidate.id,
        slots: [...previous.slots, candidate]
      }
    })
  }, [demo.enabled, draftDeadline, pushToast])

  const duplicateActiveSlot = useCallback(() => {
    if (demo.enabled) {
      return
    }

    if (!activeSlot) {
      return
    }

    setSlotsState((previous) => {
      if (previous.slots.length >= maxDeadlineSlots()) {
        pushToast('slots-cap', `slot limit reached (${maxDeadlineSlots()})`)
        return previous
      }

      const copy = createDeadlineSlot({
        name: `${activeSlot.name} copy`,
        date: activeSlot.date,
        time: activeSlot.time,
        zone: activeSlot.zone,
        ambiguousPreference: activeSlot.ambiguousPreference,
        locked: false
      })

      return {
        activeId: copy.id,
        slots: [...previous.slots, copy]
      }
    })
  }, [activeSlot, demo.enabled, pushToast])

  const renameActiveSlot = useCallback(
    (name: string) => {
      if (demo.enabled || !activeSlot) {
        return
      }

      const normalized = name.trim()
      if (!normalized) {
        return
      }

      setSlotsState((previous) => ({
        activeId: previous.activeId,
        slots: previous.slots.map((slot) =>
          slot.id === previous.activeId
            ? {
                ...slot,
                name: normalized.slice(0, 42),
                updatedAtMs: Date.now()
              }
            : slot
        )
      }))
    },
    [activeSlot, demo.enabled]
  )

  const deleteActiveSlot = useCallback(() => {
    if (demo.enabled) {
      return
    }

    setSlotsState((previous) => {
      if (previous.slots.length <= 1) {
        pushToast('slots-min', 'at least one deadline slot must remain')
        return previous
      }

      const activeIndex = previous.slots.findIndex((slot) => slot.id === previous.activeId)
      if (activeIndex < 0) {
        return previous
      }

      const nextSlots = previous.slots.filter((slot) => slot.id !== previous.activeId)
      const nextActive = nextSlots[Math.max(0, activeIndex - 1)] ?? nextSlots[0]
      if (!nextActive) {
        return previous
      }

      return {
        activeId: nextActive.id,
        slots: nextSlots
      }
    })
  }, [demo.enabled, pushToast])

  const toggleActiveLock = useCallback(() => {
    if (demo.enabled) {
      return
    }

    if (!activeSlot) {
      return
    }

    setSlotsState((previous) => ({
      activeId: previous.activeId,
      slots: previous.slots.map((slot) =>
        slot.id === previous.activeId
          ? {
              ...slot,
              locked: !slot.locked,
              updatedAtMs: Date.now()
            }
          : slot
      )
    }))
  }, [activeSlot, demo.enabled])

  const applyDraftToActive = useCallback(() => {
    if (demo.enabled) {
      return
    }

    if (!activeSlot) {
      return
    }

    if (activeSlot.locked) {
      pushToast('slot-locked', 'active deadline is locked')
      return
    }

    if (!draftParseResult.valid) {
      pushToast('slot-invalid', 'fix draft deadline before apply')
      return
    }

    setSlotsState((previous) => ({
      activeId: previous.activeId,
      slots: previous.slots.map((slot) =>
        slot.id === previous.activeId
          ? {
              ...slot,
              date: draftDeadline.date,
              time: draftDeadline.time,
              zone: normalizeDeadlineZone(draftDeadline.zone),
              ambiguousPreference: draftDeadline.ambiguousPreference,
              updatedAtMs: Date.now()
            }
          : slot
      )
    }))
  }, [activeSlot, demo.enabled, draftDeadline, draftParseResult.valid, pushToast])

  const discardDraft = useCallback(() => {
    if (!activeSlot) {
      return
    }

    setDraftDeadline(draftFromSlot(activeSlot))
  }, [activeSlot])

  const handleDetailZoomOutExit = useCallback(() => {
    setShowDetailView(false)
    pushToast(`detail-auto-${Date.now()}`, 'zoomed out: switched back to deadLINE map')
  }, [pushToast])

  const [firedAlerts, setFiredAlerts] = useState<Set<string>>(() => new Set())
  const latestNowRef = useRef(effectiveNowMs)
  const previousRemainingRef = useRef<number | null>(null)
  const previousNowRef = useRef<number | null>(null)

  useEffect(() => {
    latestNowRef.current = effectiveNowMs
  }, [effectiveNowMs])

  useEffect(() => {
    const nowSnapshot = latestNowRef.current
    setFiredAlerts(new Set())
    previousRemainingRef.current =
      activeParseResult.deadlineUtcMs === undefined ? null : activeParseResult.deadlineUtcMs - nowSnapshot
    previousNowRef.current = nowSnapshot
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.targetMinutesOfDay,
    slotsState.activeId,
    useApparentSolar
  ])

  useEffect(() => {
    if (!activeParseResult.valid || activeParseResult.deadlineUtcMs === undefined) {
      return
    }

    const remaining = activeParseResult.deadlineUtcMs - effectiveNowMs
    if (remaining <= 0) {
      previousRemainingRef.current = remaining
      previousNowRef.current = effectiveNowMs
      return
    }

    const previousRemaining = previousRemainingRef.current
    const previousNow = previousNowRef.current

    for (const threshold of alertThresholdMinutes) {
      const alertId = `time-${threshold}`
      if (firedAlerts.has(alertId)) {
        continue
      }

      const thresholdMs = threshold * 60_000
      if (previousRemaining !== null && previousRemaining > thresholdMs && remaining <= thresholdMs) {
        const message = `deadline in ${threshold >= 60 ? `${threshold / 60}h` : `${threshold}m`}`
        pushToast(alertId, message)
        notifyIfEnabled(enableBrowserNotifications, message)
        setFiredAlerts((previous) => new Set(previous).add(alertId))
      }
    }

    if (enableCrossingAlerts) {
      for (const crossing of crossingPlan) {
        const alertId = `cross-${crossing.id}`
        if (firedAlerts.has(alertId)) {
          continue
        }

        if (
          previousNow !== null &&
          previousNow < crossing.crossingMs &&
          effectiveNowMs >= crossing.crossingMs &&
          crossing.crossingMs <= activeParseResult.deadlineUtcMs
        ) {
          const crossingTime = DateTime.fromMillis(crossing.crossingMs).toFormat('HH:mm:ss')
          const message = `crossed: ${crossing.landmark.name} · ${crossingTime}`
          pushToast(alertId, message)
          notifyIfEnabled(enableBrowserNotifications, message)
          setFiredAlerts((previous) => new Set(previous).add(alertId))
        }
      }
    }

    previousRemainingRef.current = remaining
    previousNowRef.current = effectiveNowMs
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.valid,
    alertThresholdMinutes,
    crossingPlan,
    enableBrowserNotifications,
    enableCrossingAlerts,
    firedAlerts,
    effectiveNowMs,
    pushToast
  ])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMetaCombo = event.ctrlKey || event.metaKey

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setDebugMode((value) => !value)
      }

      if (key === 'z') {
        setShowDetailView((value) => !value)
      }

      if (isMetaCombo && key === 'enter') {
        event.preventDefault()
        applyDraftToActive()
      }

      if (event.key === 'Escape' && draftDirty) {
        event.preventDefault()
        discardDraft()
      }

      if (isMetaCombo && key === 'd' && !event.shiftKey) {
        event.preventDefault()
        duplicateActiveSlot()
      }

      if (event.altKey && !Number.isNaN(Number(key))) {
        const index = Number(key) - 1
        if (index >= 0 && index < slotsState.slots.length) {
          const targetSlot = slotsState.slots[index]
          if (!targetSlot) {
            return
          }
          event.preventDefault()
          switchSlot(targetSlot.id)
        }
      }
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [applyDraftToActive, discardDraft, draftDirty, duplicateActiveSlot, slotsState.slots, switchSlot])

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-ink" ref={rootRef}>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />

      <div className="relative mx-auto grid max-w-[1540px] items-start gap-3 px-3 py-3 md:grid-cols-[360px_1fr]">
        <aside className="md:sticky md:top-3">
          <CommandPanel
            deadlineDate={draftDeadline.date}
            setDeadlineDate={(value) => updateDraftField({ date: value })}
            deadlineTime={draftDeadline.time}
            setDeadlineTime={(value) => updateDraftField({ time: value })}
            deadlineZone={draftDeadline.zone}
            setDeadlineZone={(value) => updateDraftField({ zone: normalizeDeadlineZone(value) })}
            timezoneOptions={timezones}
            parseResult={draftParseResult}
            activeParseResult={activeParseResult}
            ambiguousPreference={draftDeadline.ambiguousPreference}
            setAmbiguousPreference={(value) => updateDraftField({ ambiguousPreference: value })}
            activeSlot={
              activeSlot
                ? {
                    id: activeSlot.id,
                    name: activeSlot.name,
                    date: activeSlot.date,
                    time: activeSlot.time,
                    zone: activeSlot.zone,
                    locked: activeSlot.locked
                  }
                : null
            }
            slots={slotsState.slots.map((slot) => ({
              id: slot.id,
              name: slot.name
            }))}
            activeSlotId={slotsState.activeId}
            draftDirty={draftDirty}
            onSwitchSlot={switchSlot}
            onAddSlot={addNewSlot}
            onDuplicateSlot={duplicateActiveSlot}
            onToggleLock={toggleActiveLock}
            onRenameSlot={renameActiveSlot}
            onDeleteSlot={deleteActiveSlot}
            onApplyDraft={applyDraftToActive}
            onDiscardDraft={discardDraft}
            applyDisabled={
              demo.enabled || !draftParseResult.valid || !draftDirty || Boolean(activeSlot?.locked)
            }
            location={location}
            setLocation={setLocation}
            cityQuery={cityQuery}
            setCityQuery={setCityQuery}
            cityResults={cityResults}
            showTimezones={showTimezones}
            setShowTimezones={setShowTimezones}
            showSolarTime={showSolarTime}
            setShowSolarTime={setShowSolarTime}
            showDayNight={showDayNight}
            setShowDayNight={setShowDayNight}
            showLandmarks={showLandmarks}
            setShowLandmarks={setShowLandmarks}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            scrubRatio={scrubRatio}
            setScrubRatio={setScrubRatio}
            demoMode={demo.enabled}
          />
        </aside>

        <section className="grid gap-2" ref={stageRef} data-debug-key="map-stage">
          <header
            className="border-cyan-300/20 flex items-center justify-between rounded-xl border bg-panel/40 p-2 text-xs"
            data-debug-key="stage-header"
          >
            <h1 className="text-cyan-100 font-mono text-sm tracking-[0.18em]">deadline</h1>
            <div className="flex items-center gap-2" data-debug-key="view-toggle-row">
              <button
                className={`btn-toggle px-2 py-1 ${viewMode === '2d' ? 'active' : ''}`}
                type="button"
                onClick={() => setViewMode('2d')}
              >
                2d map
              </button>
              <button
                className={`btn-toggle px-2 py-1 ${viewMode === '3d' ? 'active' : ''}`}
                type="button"
                onClick={() => setViewMode('3d')}
              >
                3d globe
              </button>
              <button
                className={`btn-toggle px-2 py-1 ${showDetailView ? 'active' : ''}`}
                type="button"
                onClick={() => setShowDetailView((value) => !value)}
              >
                <span className="inline-flex items-center gap-1">
                  <Radar size={14} />
                  detail zoom
                </span>
              </button>
              <button
                className="btn-ghost inline-flex items-center gap-1 px-2 py-1"
                type="button"
                onClick={async () => {
                  if (!stageRef.current) return
                  const canvas = await html2canvas(stageRef.current, { backgroundColor: null })
                  canvas.toBlob((blob) => {
                    if (!blob) return
                    downloadBlob(blob, 'deadline-snap.png')
                  }, 'image/png')
                }}
              >
                <Camera size={14} />
                snap
              </button>
              <button
                className={`btn-ghost inline-flex items-center gap-1 px-2 py-1 ${debugMode ? 'border-rose-300/60 text-rose-200' : ''}`}
                type="button"
                onClick={() => setDebugMode((value) => !value)}
              >
                <Bug size={14} />
                debug
              </button>
            </div>
          </header>

          {debugMode && assetCheckError ? (
            <div className="rounded-md border border-rose-300/65 bg-rose-950/45 px-2 py-1 text-xs text-rose-100">
              {assetCheckError}
            </div>
          ) : null}

          <div className="border-cyan-300/30 bg-black/38 text-cyan-100/88 rounded-md border px-2 py-1 text-[11px]">
            <p className="text-cyan-50 font-mono">
              {activeSlot
                ? `${activeSlot.name} — ${activeSlot.date} ${activeSlot.time} ${deadlineZoneLabel}`
                : 'no active deadline'}
            </p>
            <p className="text-cyan-100/75">
              target {targetClockLabel}
              {' • '}
              {activeSlot?.locked ? 'locked' : draftDirty ? 'draft unsaved' : 'synced'}
            </p>
          </div>

          <div className="relative h-[clamp(340px,58vh,640px)] overflow-hidden rounded-xl">
            {activeParseResult.valid && activeParseResult.targetMinutesOfDay !== undefined ? (
              showDetailView ? (
                <DetailMapView
                  mode={viewMode}
                  nowTime={nowTime}
                  targetMinutesOfDay={activeParseResult.targetMinutesOfDay}
                  solarNowLongitude={solarLongitude}
                  solarDeadlineLongitude={deadlineSolarLongitude}
                  location={location}
                  showLandmarks={showLandmarks}
                  landmarks={landmarks}
                  onZoomedOutExit={handleDetailZoomOutExit}
                />
              ) : viewMode === '2d' ? (
                <Map2DView
                  nowTime={nowTime}
                  displayTime={displayTime}
                  deadlineTime={deadlineTimeDate}
                  targetMinutesOfDay={activeParseResult.targetMinutesOfDay}
                  deadlineZoneLabel={deadlineZoneLabel}
                  deadlineOffsetMinutes={activeParseResult.selectedOffsetMinutes}
                  showTimezones={showTimezones}
                  showSolarTime={showSolarTime}
                  showDayNight={showDayNight}
                  brightDayLighting={brightDayLighting}
                  showLandmarks={showLandmarks}
                  useApparentSolar={useApparentSolar}
                  useTimezonePolygons={useTimezonePolygonsMode}
                  timezonePolygons={timezonePolygons}
                  civilGlowMinutes={civilGlowMinutes}
                  location={location}
                  landmarks={landmarks}
                  reducedMotion={reducedMotion}
                  onPerf={({ terminatorComputeMs: ms }) => setTerminatorComputeMs(ms)}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="border-cyan-400/20 text-cyan-100/70 grid h-full min-h-[320px] place-items-center rounded-xl border bg-black/30 text-sm">
                      loading globe chunk...
                    </div>
                  }
                >
                  <Globe3DView
                    nowTime={nowTime}
                    displayTime={displayTime}
                    deadlineTime={deadlineTimeDate}
                    targetMinutesOfDay={activeParseResult.targetMinutesOfDay}
                    targetClockLabel={targetClockLabel}
                    deadlineZoneLabel={deadlineZoneLabel}
                    deadlineOffsetMinutes={activeParseResult.selectedOffsetMinutes}
                    showSolarTime={showSolarTime}
                    showDayNight={showDayNight}
                    showLandmarks={showLandmarks}
                    useApparentSolar={useApparentSolar}
                    reducedMotion={reducedMotion}
                    location={location}
                    landmarks={landmarks}
                  />
                </Suspense>
              )
            ) : (
              <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-rose-400/25 bg-rose-950/10 text-sm text-rose-200">
                fix deadline input to render map
              </div>
            )}

            <NearDeadlineEffects remainingMs={remainingMs} reducedMotion={reducedMotion} />

            {remainingMs <= 60 * 60_000 && remainingMs > 0 ? (
              <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-amber-300/45 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100">
                <span className="inline-flex items-center gap-1">
                  <Sparkles size={13} />
                  deadline pressure rising
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <CountdownCard nowMs={effectiveNowMs} deadlineUtcMs={activeParseResult.deadlineUtcMs} />

            <StatsStrip
              solarLongitude={solarLongitude}
              speedDegPerHour={lineSpeed}
              useApparentSolar={useApparentSolar}
              deltaMinutesFromLocation={distance?.deltaMinutes}
              kmFromLocation={distance?.distanceKm}
            />

            <DistanceBox
              location={location}
              deltaMinutes={distance?.deltaMinutes}
              deltaKm={distance?.distanceKm}
            />

            <SettingsDrawer
              useApparentSolar={useApparentSolar}
              setUseApparentSolar={setUseApparentSolar}
              useTimezonePolygons={useTimezonePolygonsMode}
              setUseTimezonePolygons={setUseTimezonePolygons}
              brightDayLighting={brightDayLighting}
              setBrightDayLighting={setBrightDayLighting}
              timezonePolygonStatus={timezonePolygonStatus}
              civilGlowMinutes={civilGlowMinutes}
              setCivilGlowMinutes={setCivilGlowMinutes}
              alertThresholdMinutes={alertThresholdMinutes}
              setAlertThresholds={setAlertThresholds}
              enableCrossingAlerts={enableCrossingAlerts}
              setEnableCrossingAlerts={setEnableCrossingAlerts}
              enableBrowserNotifications={enableBrowserNotifications}
              setEnableBrowserNotifications={setEnableBrowserNotifications}
              reducedMotion={reducedMotion}
              setReducedMotion={setReducedMotion}
            />
          </div>
        </section>
      </div>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((previous) => previous.filter((toast) => toast.id !== id))}
      />

      <DebugOverlay
        enabled={debugMode}
        rootRef={rootRef}
        onClose={() => setDebugMode(false)}
        perf={{
          fps: renderFps,
          renderDriftMs: renderDriftMs,
          terminatorComputeMs
        }}
      />
    </main>
  )
}
