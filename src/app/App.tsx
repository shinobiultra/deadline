import html2canvas from 'html2canvas'
import {
  Camera,
  Bug,
  Sparkles,
  Layers3,
  Share2,
  Menu,
  Plus,
  Copy,
  Lock,
  Unlock,
  Trash2,
  X,
  MapPin
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { DebugOverlay } from '@/ui/DebugOverlay'
import { NearDeadlineEffects } from '@/ui/NearDeadlineEffects'
import { Segmented } from '@/ui/Segmented'
import { SwitchPill } from '@/ui/SwitchPill'
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
import { initAnalytics, trackEvent } from '@/lib/analytics'
import { formatDuration, formatSignedMinutes } from '@/lib/time'
import { useIntervalNow } from '@/lib/useIntervalNow'
import { useRenderNow } from '@/lib/useRenderNow'

const Globe3DView = lazy(() => import('@/views/globe3d/Globe3DView'))

type ViewMode = '2d' | '3d'
type DetailMode = 'auto' | 'off' | 'on'
type BaseMapStyle = 'deadline-dark' | 'osm-light' | 'osm-dark'
type EffectTier = 'off' | 'subtle' | 'spicy'

type DemoConfig = {
  enabled: boolean
  debug: boolean
  initialView: ViewMode
  initialDetailMode: DetailMode
  capture: boolean
}

type DeadlineDraft = {
  date: string
  time: string
  zone: string
  ambiguousPreference: AmbiguousPreference
}

const DEMO_NOW_ISO = '2026-02-05T08:21:44.000Z'
const DEMO_NOW_MS = new Date(DEMO_NOW_ISO).getTime()
const DAY_MS = 24 * 60 * 60 * 1000
const UNWIND_SPEEDS = [120, 720, 3600] as const
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

function readDemoConfig(): DemoConfig {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      debug: false,
      initialView: '2d',
      initialDetailMode: 'auto',
      capture: false
    }
  }

  const params = new URLSearchParams(window.location.search)
  const enabled = params.get('demo') === '1'
  const debug = params.get('debug') === '1'
  const capture = params.get('capture') === '1'
  const requestedView = params.get('view')?.toLowerCase()
  const initialView: ViewMode = requestedView === '3d' ? '3d' : '2d'
  const initialDetailMode: DetailMode = requestedView === 'detail' ? 'on' : 'auto'

  return {
    enabled,
    debug,
    initialView,
    initialDetailMode,
    capture
  }
}

export default function App() {
  const demo = useMemo(() => readDemoConfig(), [])
  const nowMs = useIntervalNow(1000)
  const { nowMs: renderNowMs, fps: renderFps, driftMs: renderDriftMs } = useRenderNow(60, 30)
  const [viewMode, setViewMode] = useState<ViewMode>(demo.initialView)
  const [detailMode, setDetailMode] = useState<DetailMode>(demo.initialDetailMode)
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyle>('deadline-dark')
  const [effectsTier, setEffectsTier] = useState<EffectTier>(demo.enabled ? 'off' : 'subtle')
  const [deadlineDrawerOpen, setDeadlineDrawerOpen] = useState(false)
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false)
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [topControlsOpen, setTopControlsOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [locationPickArmed, setLocationPickArmed] = useState(false)
  const [showGreetingHint, setShowGreetingHint] = useState(true)
  const [viewportWidth, setViewportWidth] = useState(typeof window === 'undefined' ? 1280 : window.innerWidth)
  const [map2dViewState, setMap2dViewState] = useState<{
    zoom: number
    offsetX: number
    offsetY: number
    centerLon: number
    centerLat: number
  }>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    centerLon: 0,
    centerLat: 0
  })
  const [globeViewState, setGlobeViewState] = useState<{ lat: number; lng: number; altitude: number }>({
    lat: 18,
    lng: 0,
    altitude: 2.1
  })
  const [cityQuery, setCityQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [terminatorComputeMs, setTerminatorComputeMs] = useState(0)
  const [unwindActive, setUnwindActive] = useState(false)
  const [unwindSpeed, setUnwindSpeed] = useState<(typeof UNWIND_SPEEDS)[number]>(720)
  const [unwindAnchor, setUnwindAnchor] = useState<{ realMs: number; simMs: number } | null>(null)
  const unwindSpeedRef = useRef<(typeof UNWIND_SPEEDS)[number]>(720)

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
    setUseApparentSolar,
    setUseTimezonePolygons,
    setAlertThresholds,
    setEnableCrossingAlerts,
    setEnableBrowserNotifications,
    setReducedMotion
  } = useDeadlineStore()

  const timezones = useMemo(() => listDeadlineTimezoneOptions(), [])
  const cityResults = useCities(cityQuery)
  const landmarks = useLandmarks()
  const demoOverridesEnabled = demo.enabled
  const effectiveUseTimezonePolygonsMode = demoOverridesEnabled ? false : useTimezonePolygonsMode
  const { status: timezonePolygonStatus, features: timezonePolygons } = useTimezonePolygons(
    effectiveUseTimezonePolygonsMode
  )
  const effectiveLocation = demoOverridesEnabled ? null : location
  const effectiveShowTimezones = demoOverridesEnabled ? true : showTimezones
  const effectiveShowSolarTime = demoOverridesEnabled ? true : showSolarTime
  const effectiveShowDayNight = demoOverridesEnabled ? true : showDayNight
  const effectiveBrightDayLighting = demoOverridesEnabled ? true : brightDayLighting
  const effectiveShowLandmarks = demoOverridesEnabled ? false : showLandmarks
  const effectivePreviewMode = demoOverridesEnabled ? 'now' : previewMode
  const effectiveScrubRatio = demoOverridesEnabled ? 0 : scrubRatio
  const effectiveUseApparentSolar = demoOverridesEnabled ? false : useApparentSolar
  const effectiveReducedMotion = demoOverridesEnabled ? true : reducedMotion

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
    initAnalytics()
  }, [])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (demo.capture) {
      setShowGreetingHint(true)
      return
    }

    const timer = window.setTimeout(() => setShowGreetingHint(false), 7800)
    return () => window.clearTimeout(timer)
  }, [demo.capture])

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
  const visualNowMs = effectivePreviewMode === 'now' ? effectiveRenderNowMs : effectiveNowMs

  const deadlineTimeDate = useMemo(() => {
    if (!activeParseResult.valid || !activeParseResult.deadlineUtcMs) {
      return null
    }
    return new Date(activeParseResult.deadlineUtcMs)
  }, [activeParseResult.deadlineUtcMs, activeParseResult.valid])

  const unwindEligible =
    activeParseResult.valid &&
    activeParseResult.deadlineUtcMs !== undefined &&
    activeParseResult.deadlineUtcMs - effectiveNowMs > DAY_MS

  const unwindSimMs = useMemo(() => {
    if (!unwindActive || !unwindEligible || !unwindAnchor || activeParseResult.deadlineUtcMs === undefined) {
      return null
    }

    const elapsedRealMs = Math.max(0, effectiveRenderNowMs - unwindAnchor.realMs)
    const simulated = unwindAnchor.simMs + elapsedRealMs * unwindSpeed
    return Math.min(simulated, activeParseResult.deadlineUtcMs)
  }, [
    activeParseResult.deadlineUtcMs,
    effectiveRenderNowMs,
    unwindActive,
    unwindAnchor,
    unwindEligible,
    unwindSpeed
  ])

  const nowTime = useMemo(() => new Date(unwindSimMs ?? visualNowMs), [unwindSimMs, visualNowMs])

  const displayTime = useMemo(() => {
    if (!activeParseResult.valid || !activeParseResult.deadlineUtcMs) {
      return new Date(visualNowMs)
    }

    if (unwindSimMs !== null) {
      return new Date(unwindSimMs)
    }

    if (effectivePreviewMode === 'deadline') {
      return new Date(activeParseResult.deadlineUtcMs)
    }

    if (effectivePreviewMode === 'scrub') {
      const start = effectiveNowMs
      const end = activeParseResult.deadlineUtcMs
      return new Date(start + (end - start) * effectiveScrubRatio)
    }

    return new Date(visualNowMs)
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.valid,
    effectiveNowMs,
    effectivePreviewMode,
    effectiveScrubRatio,
    unwindSimMs,
    visualNowMs
  ])

  const solarLongitude = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined) {
      return 0
    }

    return solarDeadlineLongitude(
      displayTime,
      activeParseResult.targetMinutesOfDay,
      effectiveUseApparentSolar
    )
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, displayTime, effectiveUseApparentSolar])

  const deadlineSolarLongitude = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined || !deadlineTimeDate) {
      return null
    }

    return solarDeadlineLongitude(
      deadlineTimeDate,
      activeParseResult.targetMinutesOfDay,
      effectiveUseApparentSolar
    )
  }, [
    activeParseResult.targetMinutesOfDay,
    activeParseResult.valid,
    deadlineTimeDate,
    effectiveUseApparentSolar
  ])

  const lineSpeed = useMemo(() => {
    if (!activeParseResult.valid || activeParseResult.targetMinutesOfDay === undefined) {
      return 15
    }

    return solarLineSpeedDegreesPerHour(
      displayTime,
      activeParseResult.targetMinutesOfDay,
      effectiveUseApparentSolar
    )
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, displayTime, effectiveUseApparentSolar])

  const distance = useMemo(() => {
    if (
      !effectiveLocation ||
      !activeParseResult.valid ||
      activeParseResult.targetMinutesOfDay === undefined
    ) {
      return null
    }

    return solarDistanceToMeridian(effectiveLocation.lat, effectiveLocation.lon, solarLongitude)
  }, [activeParseResult.targetMinutesOfDay, activeParseResult.valid, effectiveLocation, solarLongitude])

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
      apparentSolar: effectiveUseApparentSolar
    })
  }, [
    activeParseResult.deadlineUtcMs,
    activeParseResult.targetMinutesOfDay,
    activeParseResult.valid,
    effectiveNowMs,
    effectiveUseApparentSolar,
    landmarks
  ])

  const remainingMs = activeParseResult.deadlineUtcMs
    ? activeParseResult.deadlineUtcMs - effectiveNowMs
    : Number.POSITIVE_INFINITY

  const unwindReferenceMs = unwindSimMs ?? effectiveNowMs
  const unwindCyclesLeft =
    activeParseResult.deadlineUtcMs === undefined
      ? 0
      : Math.max(0, (activeParseResult.deadlineUtcMs - unwindReferenceMs) / DAY_MS)
  const unwindTotalCycles =
    activeParseResult.deadlineUtcMs === undefined
      ? 0
      : Math.max(0, (activeParseResult.deadlineUtcMs - effectiveNowMs) / DAY_MS)
  const unwindPreviewUtcLabel = DateTime.fromMillis(unwindReferenceMs, { zone: 'utc' }).toFormat(
    "yyyy-LL-dd HH:mm 'utc'"
  )

  const deadlineZoneLabel = describeTimezone(activeSlot?.zone ?? draftDeadline.zone)
  const targetClockLabel =
    activeParseResult.valid && activeParseResult.targetMinutesOfDay !== undefined
      ? formatTargetClock(activeParseResult.targetMinutesOfDay)
      : '--:--'

  useEffect(() => {
    unwindSpeedRef.current = unwindSpeed
  }, [unwindSpeed])

  useEffect(() => {
    setUnwindActive(false)
    setUnwindAnchor(null)
  }, [activeParseResult.deadlineUtcMs, slotsState.activeId])

  useEffect(() => {
    if (!unwindEligible && unwindActive) {
      setUnwindActive(false)
      setUnwindAnchor(null)
    }
  }, [unwindActive, unwindEligible])

  useEffect(() => {
    if (
      unwindActive &&
      unwindSimMs !== null &&
      activeParseResult.deadlineUtcMs !== undefined &&
      unwindSimMs >= activeParseResult.deadlineUtcMs - 1
    ) {
      setUnwindActive(false)
      setUnwindAnchor(null)
    }
  }, [activeParseResult.deadlineUtcMs, unwindActive, unwindSimMs])

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

  const emitEvent = useCallback((name: string, params?: Record<string, string | number | boolean>) => {
    trackEvent(name, params)
  }, [])

  const toggleUnwind = useCallback(() => {
    if (!unwindEligible || activeParseResult.deadlineUtcMs === undefined) {
      return
    }

    if (unwindActive) {
      setUnwindActive(false)
      setUnwindAnchor(null)
      return
    }

    setUnwindAnchor({
      realMs: effectiveRenderNowMs,
      simMs: effectiveNowMs
    })
    setUnwindActive(true)
  }, [activeParseResult.deadlineUtcMs, effectiveNowMs, effectiveRenderNowMs, unwindActive, unwindEligible])

  const setUnwindSpeedTracked = useCallback(
    (next: (typeof UNWIND_SPEEDS)[number]) => {
      if (next === unwindSpeedRef.current) {
        return
      }

      if (unwindActive && unwindAnchor && activeParseResult.deadlineUtcMs !== undefined) {
        const elapsedRealMs = Math.max(0, effectiveRenderNowMs - unwindAnchor.realMs)
        const currentSimMs = Math.min(
          unwindAnchor.simMs + elapsedRealMs * unwindSpeedRef.current,
          activeParseResult.deadlineUtcMs
        )
        setUnwindAnchor({
          realMs: effectiveRenderNowMs,
          simMs: currentSimMs
        })
      }

      setUnwindSpeed(next)
    },
    [activeParseResult.deadlineUtcMs, effectiveRenderNowMs, unwindActive, unwindAnchor]
  )

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

    emitEvent('deadline_apply', {
      zone: normalizeDeadlineZone(draftDeadline.zone)
    })

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
  }, [activeSlot, demo.enabled, draftDeadline, draftParseResult.valid, emitEvent, pushToast])

  const discardDraft = useCallback(() => {
    if (!activeSlot) {
      return
    }

    setDraftDeadline(draftFromSlot(activeSlot))
  }, [activeSlot])

  const closeDeadlineDrawer = useCallback(() => {
    if (draftDirty) {
      const shouldDiscard = window.confirm('discard unsaved draft changes?')
      if (!shouldDiscard) {
        return
      }
      discardDraft()
    }
    setDeadlineDrawerOpen(false)
    setDeleteConfirmText('')
    setQuickActionsOpen(false)
  }, [discardDraft, draftDirty])

  const quickShiftDraft = useCallback(
    (duration: { days?: number; hours?: number; minutes?: number }) => {
      const current = parseCurrentInput(draftDeadline.date, draftDeadline.time, draftDeadline.zone)
      if (!current) {
        return
      }
      const next = current.plus(duration).set({ second: 0, millisecond: 0 })
      updateDraftField({
        date: next.toISODate() ?? draftDeadline.date,
        time: next.toFormat('HH:mm')
      })
    },
    [draftDeadline, updateDraftField]
  )

  const applyNow24hDraft = useCallback(() => {
    const next = DateTime.fromMillis(effectiveNowMs)
      .setZone(draftDeadline.zone || 'UTC')
      .plus({ day: 1 })
      .set({ second: 0, millisecond: 0 })

    updateDraftField({
      date: next.toISODate() ?? draftDeadline.date,
      time: next.toFormat('HH:mm')
    })
  }, [draftDeadline.date, draftDeadline.zone, effectiveNowMs, updateDraftField])

  const requestBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      pushToast(`geo-${Date.now()}`, 'geolocation unavailable in this browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: `my location (${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)})`
        })
        pushToast(`geo-ok-${Date.now()}`, 'location set')
      },
      () => {
        pushToast(`geo-fail-${Date.now()}`, 'location permission denied')
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [pushToast, setLocation])

  const createShareUrl = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('date', draftDeadline.date)
    url.searchParams.set('time', draftDeadline.time)
    url.searchParams.set('zone', draftDeadline.zone)
    url.searchParams.set('view', viewMode)
    url.searchParams.set(
      'layers',
      [
        effectiveShowSolarTime ? 'solar' : '',
        effectiveShowTimezones ? 'civil' : '',
        effectiveShowDayNight ? 'terminator' : '',
        effectiveShowLandmarks ? 'landmarks' : ''
      ]
        .filter(Boolean)
        .join(',')
    )
    url.searchParams.set('detail', detailMode)
    url.searchParams.set('base', baseMapStyle)
    return url.toString()
  }, [
    baseMapStyle,
    detailMode,
    draftDeadline.date,
    draftDeadline.time,
    draftDeadline.zone,
    effectiveShowDayNight,
    effectiveShowLandmarks,
    effectiveShowSolarTime,
    effectiveShowTimezones,
    viewMode
  ])

  const shareCurrentState = useCallback(async () => {
    const shareUrl = createShareUrl()
    emitEvent('share')
    try {
      await navigator.clipboard.writeText(shareUrl)
      pushToast(`share-${Date.now()}`, 'share link copied')
    } catch {
      pushToast(`share-fail-${Date.now()}`, shareUrl)
    }
  }, [createShareUrl, emitEvent, pushToast])

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
    effectiveUseApparentSolar
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

      if (isMetaCombo && key === 'enter') {
        event.preventDefault()
        applyDraftToActive()
      }

      if (event.key === 'Escape') {
        if (topControlsOpen) {
          event.preventDefault()
          setTopControlsOpen(false)
          return
        }

        if (deadlineDrawerOpen) {
          event.preventDefault()
          closeDeadlineDrawer()
          return
        }

        if (layersPanelOpen) {
          event.preventDefault()
          setLayersPanelOpen(false)
          return
        }

        if (infoDrawerOpen) {
          event.preventDefault()
          setInfoDrawerOpen(false)
          return
        }
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
  }, [
    applyDraftToActive,
    closeDeadlineDrawer,
    deadlineDrawerOpen,
    duplicateActiveSlot,
    infoDrawerOpen,
    layersPanelOpen,
    topControlsOpen,
    slotsState.slots,
    switchSlot
  ])

  const timezoneMatches = useMemo(() => {
    const query = timezoneSearch.trim().toLowerCase()
    const baseMatches = (
      query
        ? timezones.filter((option) => option.searchTerms.some((term) => term.includes(query)))
        : timezones
    ).slice(0, 250)

    if (baseMatches.some((option) => option.value === draftDeadline.zone)) {
      return baseMatches
    }

    const selected = timezones.find((option) => option.value === draftDeadline.zone)
    if (!selected) {
      return baseMatches
    }

    return [selected, ...baseMatches.slice(0, 249)]
  }, [draftDeadline.zone, timezones, timezoneSearch])

  const effectiveDetailMode: DetailMode = detailMode
  const detailActive =
    viewMode === '2d' &&
    effectiveDetailMode !== 'off' &&
    (effectiveDetailMode === 'on' || map2dViewState.zoom >= 2.7)

  const compactTopControls = viewportWidth < 980
  const compactHud = viewportWidth < 700

  useEffect(() => {
    if (!compactTopControls && topControlsOpen) {
      setTopControlsOpen(false)
    }
  }, [compactTopControls, topControlsOpen])

  const activeStateChip: 'synced' | 'draft' | 'locked' = activeSlot?.locked
    ? 'locked'
    : draftDirty
      ? 'draft'
      : 'synced'

  const changedFields = useMemo(() => {
    if (!activeSlot) {
      return []
    }
    const changed: string[] = []
    if (draftDeadline.date !== activeSlot.date) changed.push('date')
    if (draftDeadline.time !== activeSlot.time) changed.push('time')
    if (draftDeadline.zone !== activeSlot.zone) changed.push('timezone')
    if (draftDeadline.ambiguousPreference !== activeSlot.ambiguousPreference) changed.push('dst preference')
    return changed
  }, [activeSlot, draftDeadline])

  const deadlineUtcLabel =
    activeParseResult.deadlineUtcMs !== undefined
      ? DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: 'utc' }).toFormat(
          "yyyy-LL-dd HH:mm 'utc'"
        )
      : 'invalid deadline'

  const deadlineJstLabel =
    activeParseResult.deadlineUtcMs !== undefined
      ? DateTime.fromMillis(activeParseResult.deadlineUtcMs, { zone: 'Asia/Tokyo' }).toFormat("HH:mm 'jst'")
      : '--:-- jst'

  const countdownLabel =
    activeParseResult.deadlineUtcMs !== undefined
      ? `T-${formatDuration(Math.max(0, activeParseResult.deadlineUtcMs - effectiveNowMs))}`
      : 'T-unknown'

  const recentEvents = crossingPlan.slice(0, 3).map((crossing) => ({
    id: crossing.id,
    label: `${crossing.landmark.name} · ${DateTime.fromMillis(crossing.crossingMs).toFormat('HH:mm:ss')}`
  }))

  const shouldReduceEffects =
    effectiveReducedMotion || effectsTier === 'off' || (viewMode === '3d' ? renderFps < 45 : renderFps < 55)

  const debugPerf = demo.enabled
    ? {
        fps: 60,
        renderDriftMs: 0,
        terminatorComputeMs: 0
      }
    : {
        fps: renderFps,
        renderDriftMs: renderDriftMs,
        terminatorComputeMs
      }

  const detailStyleVariant = baseMapStyle === 'osm-light' ? 'osm-light' : 'osm-dark'

  const handleViewModeChange = useCallback(
    (next: ViewMode) => {
      if (next === viewMode) {
        return
      }

      emitEvent('view_mode_change', { mode: next })
      if (next === '3d') {
        setGlobeViewState((previous) => ({
          ...previous,
          lng: map2dViewState.centerLon,
          lat: map2dViewState.centerLat
        }))
      }
      setViewMode(next)
    },
    [emitEvent, map2dViewState.centerLat, map2dViewState.centerLon, viewMode]
  )

  const captureSnapshot = useCallback(async () => {
    if (!stageRef.current) {
      return
    }
    emitEvent('snap')
    const canvas = await html2canvas(stageRef.current, { backgroundColor: null })
    canvas.toBlob((blob) => {
      if (!blob) return
      downloadBlob(blob, 'deadline-snap.png')
    }, 'image/png')
  }, [emitEvent])

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-bg text-ink ${demo.capture ? 'capture-mode' : ''}`}
      ref={rootRef}
    >
      <div className="noise-overlay" />
      <div className="scanline-overlay" />
      <section className="relative h-screen w-screen p-2 md:p-3" ref={stageRef} data-debug-key="map-stage">
        <div className="border-cyan-400/25 relative h-full w-full overflow-hidden rounded-2xl border bg-black/30 shadow-neon">
          {debugMode && assetCheckError ? (
            <div className="absolute left-3 right-3 top-3 z-30 rounded-md border border-rose-300/65 bg-rose-950/60 px-2 py-1 text-xs text-rose-100">
              {assetCheckError}
            </div>
          ) : null}

          {activeParseResult.valid && activeParseResult.targetMinutesOfDay !== undefined ? (
            <>
              {viewMode === '2d' ? (
                <div className="absolute inset-0">
                  <Map2DView
                    nowTime={nowTime}
                    displayTime={displayTime}
                    deadlineTime={deadlineTimeDate}
                    targetMinutesOfDay={activeParseResult.targetMinutesOfDay}
                    deadlineZoneLabel={deadlineZoneLabel}
                    deadlineOffsetMinutes={activeParseResult.selectedOffsetMinutes}
                    showTimezones={effectiveShowTimezones}
                    showSolarTime={effectiveShowSolarTime}
                    showDayNight={effectiveShowDayNight}
                    brightDayLighting={effectiveBrightDayLighting}
                    showLandmarks={effectiveShowLandmarks}
                    useApparentSolar={effectiveUseApparentSolar}
                    useTimezonePolygons={effectiveUseTimezonePolygonsMode}
                    timezonePolygons={timezonePolygons}
                    civilGlowMinutes={civilGlowMinutes}
                    location={effectiveLocation}
                    landmarks={landmarks}
                    reducedMotion={effectiveReducedMotion}
                    baseMapStyle={baseMapStyle}
                    initialViewState={map2dViewState}
                    onViewStateChange={setMap2dViewState}
                    onMapClick={
                      locationPickArmed
                        ? ({ lat, lon }) => {
                            if (!demoOverridesEnabled) {
                              setLocation({
                                lat,
                                lon,
                                label: `picked ${lat.toFixed(3)}, ${lon.toFixed(3)}`
                              })
                            }
                            setLocationPickArmed(false)
                            pushToast(`pick-${Date.now()}`, 'location pinned from map')
                          }
                        : undefined
                    }
                    showInlineLegend={false}
                    showResetButton={false}
                    showStatusOverlay={false}
                    onPerf={({ terminatorComputeMs: ms }) => setTerminatorComputeMs(ms)}
                  />

                  <div
                    className={`absolute inset-0 transition-opacity duration-300 ${detailActive ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'}`}
                  >
                    <DetailMapView
                      mode="2d"
                      nowTime={nowTime}
                      targetMinutesOfDay={activeParseResult.targetMinutesOfDay}
                      solarNowLongitude={solarLongitude}
                      solarDeadlineLongitude={deadlineSolarLongitude}
                      location={effectiveLocation}
                      showLandmarks={effectiveShowLandmarks}
                      landmarks={landmarks}
                      captureMode={demo.capture}
                      styleVariant={detailStyleVariant}
                      minimalUi
                    />
                  </div>
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="border-cyan-400/20 text-cyan-100/70 absolute inset-0 grid min-h-[320px] place-items-center rounded-xl border bg-black/30 text-sm">
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
                    showSolarTime={effectiveShowSolarTime}
                    showDayNight={effectiveShowDayNight}
                    showLandmarks={effectiveShowLandmarks}
                    useApparentSolar={effectiveUseApparentSolar}
                    reducedMotion={effectiveReducedMotion}
                    location={effectiveLocation}
                    landmarks={landmarks}
                    captureMode={demo.capture}
                    initialViewState={globeViewState}
                    onViewStateChange={setGlobeViewState}
                    minimalHud
                    onPickLocation={
                      locationPickArmed
                        ? (pickedLocation) => {
                            if (!demoOverridesEnabled) {
                              setLocation(pickedLocation)
                            }
                            setLocationPickArmed(false)
                            pushToast(`pick-${Date.now()}`, 'location pinned from globe')
                          }
                        : undefined
                    }
                  />
                </Suspense>
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid min-h-[320px] place-items-center rounded-xl border border-rose-400/25 bg-rose-950/10 text-sm text-rose-200">
              fix deadline input to render map
            </div>
          )}

          <NearDeadlineEffects remainingMs={remainingMs} reducedMotion={shouldReduceEffects} />

          {showGreetingHint && !compactTopControls ? (
            <p className="border-cyan-300/30 text-cyan-100/80 pointer-events-none absolute left-1/2 top-[var(--hud-offset-top)] z-20 -translate-x-1/2 rounded-full border bg-black/40 px-3 py-1 text-[11px] transition-opacity">
              got a deadline? and wonder where on earth it literally is?
            </p>
          ) : null}

          <button
            type="button"
            data-testid="deadline-chip"
            data-debug-key="hud-deadline-chip"
            className="border-cyan-300/45 absolute z-20 rounded-lg border bg-black/65 px-3 py-2 text-left shadow-neon"
            style={{
              left: 'var(--hud-offset-left)',
              top: 'var(--hud-offset-top)',
              width: compactTopControls ? 'min(68vw, 420px)' : 'min(46vw, 520px)',
              maxWidth: compactTopControls
                ? 'calc(100vw - var(--hud-offset-left) - var(--hud-offset-right) - 76px)'
                : 'calc(100vw - var(--hud-offset-left) - var(--hud-offset-right) - 320px)'
            }}
            onClick={() => {
              emitEvent('deadline_drawer_open')
              setDeadlineDrawerOpen(true)
              setQuickActionsOpen(false)
              setTopControlsOpen(false)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              setQuickActionsOpen((value) => !value)
            }}
          >
            <p className="text-cyan-50 truncate font-mono text-sm">
              {activeSlot?.name ?? 'deadline'} · {activeSlot?.date ?? draftDeadline.date}{' '}
              {activeSlot?.time ?? draftDeadline.time} {deadlineZoneLabel.toLowerCase()}
            </p>
            <p className="text-cyan-100/80 truncate text-[11px]">
              = {deadlineUtcLabel} · {deadlineJstLabel}
            </p>
            <span
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${
                activeStateChip === 'locked'
                  ? 'border-sky-300/55 bg-sky-950/45 text-sky-100'
                  : activeStateChip === 'draft'
                    ? 'border-amber-300/55 bg-amber-950/45 text-amber-100'
                    : 'border-neon/55 bg-emerald-950/40 text-emerald-100'
              }`}
            >
              {activeStateChip}
            </span>
          </button>

          {quickActionsOpen ? (
            <div
              className="border-cyan-300/45 absolute z-30 flex max-w-[min(86vw,420px)] gap-2 rounded-md border bg-black/80 p-2 text-xs shadow-neon"
              style={{
                left: 'var(--hud-offset-left)',
                top: 'calc(var(--hud-offset-top) + 76px)'
              }}
            >
              <button type="button" className="btn-ghost px-2 py-1" onClick={addNewSlot}>
                <Plus size={14} />
                new
              </button>
              <button type="button" className="btn-ghost px-2 py-1" onClick={duplicateActiveSlot}>
                <Copy size={14} />
                dup
              </button>
              <button type="button" className="btn-ghost px-2 py-1" onClick={toggleActiveLock}>
                {activeSlot?.locked ? <Unlock size={14} /> : <Lock size={14} />}
                {activeSlot?.locked ? 'unlock' : 'lock'}
              </button>
              <button type="button" className="btn-ghost px-2 py-1" onClick={shareCurrentState}>
                <Share2 size={14} />
                share
              </button>
            </div>
          ) : null}

          {compactTopControls ? (
            <div
              className="absolute z-20"
              data-debug-key="hud-top-controls"
              style={{
                right: 'var(--hud-offset-right)',
                top: 'var(--hud-offset-top)'
              }}
            >
              <button
                type="button"
                data-testid="top-controls-menu"
                className="btn-ghost inline-flex items-center gap-1 px-2 py-1"
                onClick={() => setTopControlsOpen((value) => !value)}
                aria-label="open top controls"
              >
                <Menu size={14} />
              </button>

              {topControlsOpen ? (
                <div className="border-cyan-300/45 bg-black/88 absolute right-0 top-11 z-30 grid min-w-[220px] gap-2 rounded-lg border p-2 shadow-neon">
                  <Segmented
                    value={viewMode}
                    onChange={(next) => {
                      handleViewModeChange(next)
                      setTopControlsOpen(false)
                    }}
                    options={[
                      { value: '2d', label: '2d' },
                      { value: '3d', label: '3d' }
                    ]}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-ghost inline-flex flex-1 items-center justify-center gap-1 px-2 py-1"
                      type="button"
                      onClick={async () => {
                        await captureSnapshot()
                        setTopControlsOpen(false)
                      }}
                    >
                      <Camera size={14} />
                      snap
                    </button>
                    <button
                      className="btn-ghost inline-flex flex-1 items-center justify-center gap-1 px-2 py-1"
                      type="button"
                      onClick={async () => {
                        await shareCurrentState()
                        setTopControlsOpen(false)
                      }}
                    >
                      <Share2 size={14} />
                      share
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className="absolute z-20 flex items-center gap-2"
              data-testid="top-controls"
              data-debug-key="hud-top-controls"
              style={{
                right: 'var(--hud-offset-right)',
                top: 'var(--hud-offset-top)'
              }}
            >
              <Segmented
                value={viewMode}
                onChange={handleViewModeChange}
                options={[
                  { value: '2d', label: '2d' },
                  { value: '3d', label: '3d' }
                ]}
              />
              <button
                className="btn-ghost inline-flex items-center gap-1 px-2 py-1"
                type="button"
                onClick={captureSnapshot}
              >
                <Camera size={14} />
                snap
              </button>
              <button
                className="btn-ghost inline-flex items-center gap-1 px-2 py-1"
                type="button"
                onClick={shareCurrentState}
              >
                <Share2 size={14} />
                share
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="countdown-hud"
            data-debug-key="hud-countdown"
            className={`absolute z-20 rounded-lg border border-neon/55 bg-black/65 text-left shadow-neon ${compactHud ? 'px-2 py-1.5' : 'px-3 py-2'}`}
            style={{
              left: 'var(--hud-offset-left)',
              bottom: 'var(--hud-offset-bottom)',
              width: compactHud ? 'min(56vw, 220px)' : 'min(360px, 35vw)',
              maxWidth: 'calc(100vw - var(--hud-offset-left) - var(--hud-offset-right) - 104px)'
            }}
            onClick={() => setInfoDrawerOpen((value) => !value)}
          >
            <p className={`font-mono text-neon ${compactHud ? 'text-base' : 'text-lg'}`}>{countdownLabel}</p>
            <p className="text-cyan-100/75 truncate text-[11px]">deadline instant: {deadlineUtcLabel}</p>
          </button>

          <div
            className="absolute z-20"
            data-debug-key="hud-layers"
            style={{
              right: 'var(--hud-offset-right)',
              bottom: 'var(--hud-offset-bottom)'
            }}
          >
            <button
              type="button"
              data-testid="layers-button"
              className="btn-neon inline-flex items-center gap-1 px-3 py-2"
              onClick={() => {
                setQuickActionsOpen(false)
                setTopControlsOpen(false)
                setLayersPanelOpen((value) => {
                  const next = !value
                  if (next) {
                    emitEvent('layers_open')
                  }
                  return next
                })
              }}
            >
              <Layers3 size={15} />
              layers
            </button>

            {layersPanelOpen ? (
              <div
                className="border-cyan-300/45 absolute bottom-12 right-0 w-[330px] max-w-[88vw] rounded-lg border bg-black/85 p-3 text-xs shadow-neon"
                data-testid="layers-panel"
              >
                <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.14em]">base map</p>
                <div className="mt-1" data-testid="base-style-segmented">
                  <Segmented
                    value={baseMapStyle}
                    onChange={(style) => {
                      setBaseMapStyle(style)
                      emitEvent('style_change', { style })
                    }}
                    options={[
                      { value: 'deadline-dark', label: 'deadLINE dark' },
                      { value: 'osm-light', label: 'osm light' },
                      { value: 'osm-dark', label: 'osm dark' }
                    ]}
                  />
                </div>

                <p className="text-cyan-200/70 mt-3 text-[10px] uppercase tracking-[0.14em]">overlays</p>
                <div className="mt-1 grid gap-2">
                  <SwitchPill
                    label="solar lines"
                    checked={effectiveShowSolarTime}
                    onCheckedChange={(value) => {
                      if (!demoOverridesEnabled) {
                        setShowSolarTime(value)
                        emitEvent('layer_toggle', {
                          layer: 'solar_lines',
                          enabled: value
                        })
                      }
                    }}
                  />
                  <SwitchPill
                    label="civil timezones"
                    checked={effectiveShowTimezones}
                    onCheckedChange={(value) => {
                      if (!demoOverridesEnabled) {
                        setShowTimezones(value)
                        emitEvent('layer_toggle', {
                          layer: 'civil_timezones',
                          enabled: value
                        })
                      }
                    }}
                  />
                  <SwitchPill
                    label="terminator"
                    checked={effectiveShowDayNight}
                    onCheckedChange={(value) => {
                      if (!demoOverridesEnabled) {
                        setShowDayNight(value)
                        emitEvent('layer_toggle', {
                          layer: 'terminator',
                          enabled: value
                        })
                      }
                    }}
                  />
                  <SwitchPill
                    label="landmarks"
                    checked={effectiveShowLandmarks}
                    onCheckedChange={(value) => {
                      if (!demoOverridesEnabled) {
                        setShowLandmarks(value)
                        emitEvent('layer_toggle', {
                          layer: 'landmarks',
                          enabled: value
                        })
                      }
                    }}
                  />
                </div>

                <p className="text-cyan-200/70 mt-3 text-[10px] uppercase tracking-[0.14em]">detail lens</p>
                <div className="mt-1" data-testid="detail-mode-segmented">
                  <Segmented
                    value={effectiveDetailMode}
                    onChange={(next) => {
                      if (!demoOverridesEnabled) {
                        setDetailMode(next)
                      }
                    }}
                    options={[
                      { value: 'auto', label: 'auto' },
                      { value: 'off', label: 'off' },
                      { value: 'on', label: 'on' }
                    ]}
                  />
                </div>

                <p className="text-cyan-200/70 mt-3 text-[10px] uppercase tracking-[0.14em]">effects</p>
                <div className="mt-1" data-testid="effects-segmented">
                  <Segmented
                    value={effectsTier}
                    onChange={setEffectsTier}
                    options={[
                      { value: 'off', label: 'off' },
                      { value: 'subtle', label: 'subtle' },
                      { value: 'spicy', label: 'spicy' }
                    ]}
                  />
                </div>

                <details className="mt-3">
                  <summary className="text-cyan-100/80 cursor-pointer">legend</summary>
                  <p className="text-cyan-100/70 mt-1">
                    mint = solar now · amber = at deadline · cyan = terminator
                  </p>
                </details>
              </div>
            ) : null}
          </div>

          {locationPickArmed ? (
            <div
              className="border-cyan-300/45 text-cyan-50 absolute left-1/2 z-30 -translate-x-1/2 rounded-md border bg-black/75 px-3 py-1 text-xs shadow-neon"
              style={{
                top: compactTopControls
                  ? 'calc(var(--hud-offset-top) + 54px)'
                  : 'calc(var(--hud-offset-top) + 66px)'
              }}
            >
              pick on map armed: click map/globe to set location
            </div>
          ) : null}

          {unwindEligible ? (
            <div
              className="border-cyan-300/35 absolute z-20 rounded-md border bg-black/65 px-2 py-2 text-[11px]"
              data-testid="unwind-controls"
              style={{
                left: 'var(--hud-offset-left)',
                bottom: compactHud
                  ? 'calc(var(--hud-offset-bottom) + 72px)'
                  : 'calc(var(--hud-offset-bottom) + 88px)'
              }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={`btn-ghost px-2 py-1 text-[11px] ${unwindActive ? 'border-neon/70 text-neon' : ''}`}
                  data-testid="unwind-toggle"
                  onClick={toggleUnwind}
                >
                  {unwindActive ? 'stop unwind' : 'unwind'}
                </button>
                {UNWIND_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={`btn-ghost px-2 py-1 text-[11px] ${unwindSpeed === speed ? 'border-cyan-300/70 text-cyan-50' : ''}`}
                    onClick={() => setUnwindSpeedTracked(speed)}
                  >
                    x{speed}
                  </button>
                ))}
              </div>
              <p className="text-cyan-100/75 mt-1">
                {unwindActive ? 'unwind active' : 'unwind ready'} · cycles {unwindCyclesLeft.toFixed(2)} /{' '}
                {unwindTotalCycles.toFixed(2)}
              </p>
              <p className="text-cyan-100/65">sim {unwindPreviewUtcLabel}</p>
            </div>
          ) : null}

          {remainingMs <= 60 * 60_000 && remainingMs > 0 ? (
            <div
              className="pointer-events-none absolute rounded-md border border-amber-300/45 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100"
              style={{
                right: compactHud
                  ? 'calc(var(--hud-offset-right) + 72px)'
                  : 'calc(var(--hud-offset-right) + 84px)',
                bottom: 'var(--hud-offset-bottom)'
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Sparkles size={13} />
                deadline pressure rising
              </span>
            </div>
          ) : null}
        </div>

        {deadlineDrawerOpen ? (
          <div className="absolute inset-0 z-40">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="close deadline drawer backdrop"
              onClick={closeDeadlineDrawer}
            />
            <aside
              className="border-cyan-300/40 text-cyan-100 bg-black/92 absolute h-[calc(100%-var(--hud-offset-top)-var(--hud-offset-bottom))] w-[min(420px,92vw)] overflow-auto rounded-xl border p-3 shadow-neon"
              style={{
                right: 'var(--hud-offset-right)',
                top: 'var(--hud-offset-top)'
              }}
              data-testid="deadline-drawer"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-cyan-50 font-mono text-sm tracking-[0.12em]">deadline drawer</h2>
                <button type="button" className="btn-ghost px-2 py-1" onClick={closeDeadlineDrawer}>
                  <X size={14} />
                </button>
              </div>

              <section className="border-cyan-300/30 rounded-md border bg-black/35 p-2">
                <p className="text-cyan-200/75 text-[10px] uppercase tracking-[0.14em]">slots</p>
                <div className="mt-1 flex gap-2">
                  <select
                    className="border-cyan-400/35 text-cyan-50 h-10 flex-1 rounded-md border bg-black/40 px-2 font-mono"
                    value={slotsState.activeId}
                    onChange={(event) => switchSlot(event.target.value)}
                  >
                    {slotsState.slots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1"
                    onClick={addNewSlot}
                    aria-label="new deadline slot"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1"
                    onClick={duplicateActiveSlot}
                    aria-label="duplicate deadline slot"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1"
                    onClick={toggleActiveLock}
                    aria-label="toggle deadline lock"
                  >
                    {activeSlot?.locked ? <Unlock size={14} /> : <Lock size={14} />}
                  </button>
                </div>
                <input
                  className="border-cyan-400/35 text-cyan-50 mt-2 h-10 w-full rounded-md border bg-black/40 px-2 font-mono"
                  defaultValue={activeSlot?.name ?? ''}
                  key={activeSlot?.id ?? 'no-slot'}
                  onBlur={(event) => renameActiveSlot(event.target.value)}
                  aria-label="rename active deadline slot"
                />

                {deleteConfirmText === '' ? (
                  <button
                    type="button"
                    className="btn-ghost mt-2 inline-flex items-center gap-1 px-2 py-1 text-rose-200"
                    onClick={() => setDeleteConfirmText('pending')}
                  >
                    <Trash2 size={14} />
                    delete
                  </button>
                ) : (
                  <div className="mt-2 grid gap-2">
                    <p className="text-[11px] text-rose-200/85">type delete to confirm removal</p>
                    <input
                      className="h-10 rounded-md border border-rose-300/45 bg-black/40 px-2"
                      value={deleteConfirmText === 'pending' ? '' : deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      placeholder="delete"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-rose-200"
                        onClick={() => {
                          if (deleteConfirmText === 'delete') {
                            deleteActiveSlot()
                            setDeleteConfirmText('')
                          }
                        }}
                      >
                        confirm
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1"
                        onClick={() => setDeleteConfirmText('')}
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="border-cyan-300/30 mt-2 rounded-md border bg-black/35 p-2">
                <p className="text-cyan-200/75 text-[10px] uppercase tracking-[0.14em]">deadline editor</p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs">
                    <span>date</span>
                    <input
                      className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2 font-mono"
                      type="date"
                      value={draftDeadline.date}
                      onChange={(event) => updateDraftField({ date: event.target.value })}
                      disabled={Boolean(activeSlot?.locked)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span>time</span>
                    <input
                      className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2 font-mono"
                      type="time"
                      value={draftDeadline.time}
                      onChange={(event) => updateDraftField({ time: event.target.value })}
                      disabled={Boolean(activeSlot?.locked)}
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={() => quickShiftDraft({ minutes: -15 })}
                  >
                    -15m
                  </button>
                  <button
                    type="button"
                    className="btn-neon px-2 py-1 text-[11px]"
                    onClick={() => quickShiftDraft({ minutes: 15 })}
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    className="btn-neon px-2 py-1 text-[11px]"
                    onClick={() => quickShiftDraft({ hours: 1 })}
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    className="btn-neon px-2 py-1 text-[11px]"
                    onClick={() => quickShiftDraft({ days: 1 })}
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={applyNow24hDraft}
                  >
                    now+24h
                  </button>
                </div>
                <label className="mt-2 grid gap-1 text-xs">
                  <span>timezone</span>
                  <input
                    className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2 font-mono"
                    value={timezoneSearch}
                    onChange={(event) => setTimezoneSearch(event.target.value)}
                    placeholder="type city / iana / utc"
                  />
                  <select
                    className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2 font-mono"
                    value={draftDeadline.zone}
                    onChange={(event) =>
                      updateDraftField({ zone: normalizeDeadlineZone(event.target.value) })
                    }
                    disabled={Boolean(activeSlot?.locked)}
                  >
                    {timezoneMatches.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={() =>
                      updateDraftField({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' })
                    }
                  >
                    local
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={() => updateDraftField({ zone: 'UTC' })}
                  >
                    utc
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={() => updateDraftField({ zone: AOE_IANA_ZONE })}
                  >
                    aoe
                  </button>
                </div>
                <p className="text-cyan-100/72 mt-2 text-[11px]">
                  safe edit mode is active; map updates only after apply.
                </p>

                {draftDirty ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-neon px-2 py-1 text-[11px]"
                      onClick={applyDraftToActive}
                      disabled={Boolean(activeSlot?.locked) || !draftParseResult.valid}
                      aria-label="apply draft deadline"
                    >
                      apply
                    </button>
                    <button type="button" className="btn-ghost px-2 py-1 text-[11px]" onClick={discardDraft}>
                      discard
                    </button>
                    <span className="text-[11px] text-amber-100/90">
                      changed: {changedFields.join(', ') || 'unknown'}
                    </span>
                  </div>
                ) : null}
              </section>

              <section className="border-cyan-300/30 mt-2 rounded-md border bg-black/35 p-2">
                <p className="text-cyan-200/75 text-[10px] uppercase tracking-[0.14em]">location</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-neon px-2 py-1 text-[11px]"
                    onClick={requestBrowserLocation}
                  >
                    <MapPin size={13} />
                    use location
                  </button>
                  <button
                    type="button"
                    className={`btn-ghost px-2 py-1 text-[11px] ${locationPickArmed ? 'border-neon/70 text-neon' : ''}`}
                    onClick={() => {
                      setLocationPickArmed((value) => !value)
                      setDeadlineDrawerOpen(false)
                    }}
                  >
                    pick on map
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-[11px]"
                    onClick={() => setLocation(null)}
                  >
                    clear
                  </button>
                </div>
                <label className="mt-2 grid gap-1 text-xs">
                  <span>city search</span>
                  <input
                    className="border-cyan-400/35 h-10 rounded-md border bg-black/40 px-2 font-mono"
                    value={cityQuery}
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="search city"
                  />
                </label>
                {cityResults.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cityResults.slice(0, 6).map((city) => (
                      <button
                        type="button"
                        key={`${city.name}-${city.country}-${city.lat}-${city.lon}`}
                        className="btn-ghost px-2 py-1 text-[11px]"
                        onClick={() => {
                          setLocation({
                            lat: city.lat,
                            lon: city.lon,
                            label: `${city.name}, ${city.country}`
                          })
                          updateDraftField({ zone: city.zone })
                        }}
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="border-cyan-300/30 mt-2 rounded-md border bg-black/35 p-2">
                <button
                  type="button"
                  className="btn-ghost w-full px-2 py-1 text-left text-[11px]"
                  onClick={() => setAdvancedOpen((value) => !value)}
                >
                  {advancedOpen ? 'hide advanced' : 'show advanced'}
                </button>
                {advancedOpen ? (
                  <div className="mt-2 grid gap-2">
                    <SwitchPill
                      label="apparent solar"
                      checked={effectiveUseApparentSolar}
                      onCheckedChange={(value) => {
                        if (!demoOverridesEnabled) {
                          setUseApparentSolar(value)
                        }
                      }}
                    />
                    <SwitchPill
                      label="bright daytime lighting"
                      checked={effectiveBrightDayLighting}
                      onCheckedChange={(value) => {
                        if (!demoOverridesEnabled) {
                          setBrightDayLighting(value)
                        }
                      }}
                    />
                    <SwitchPill
                      label="accuracy mode (timezone polygons)"
                      checked={effectiveUseTimezonePolygonsMode}
                      onCheckedChange={(value) => {
                        if (!demoOverridesEnabled) {
                          setUseTimezonePolygons(value)
                        }
                      }}
                    />
                    <p className="text-cyan-100/72 text-[11px]">timezone polygons: {timezonePolygonStatus}</p>
                    <p className="text-cyan-100/72 text-[11px]">
                      dst ambiguity:{' '}
                      {draftParseResult.ambiguous ? 'ambiguous (choose earlier/later)' : 'clear'}
                    </p>
                    {draftParseResult.ambiguous ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={`btn-ghost px-2 py-1 text-[11px] ${draftDeadline.ambiguousPreference === 'earlier' ? 'border-neon/70 text-neon' : ''}`}
                          onClick={() => updateDraftField({ ambiguousPreference: 'earlier' })}
                        >
                          earlier
                        </button>
                        <button
                          type="button"
                          className={`btn-ghost px-2 py-1 text-[11px] ${draftDeadline.ambiguousPreference === 'later' ? 'border-neon/70 text-neon' : ''}`}
                          onClick={() => updateDraftField({ ambiguousPreference: 'later' })}
                        >
                          later
                        </button>
                      </div>
                    ) : null}
                    <p className="text-cyan-100/72 text-[11px]">alert thresholds</p>
                    <div className="flex flex-wrap gap-1">
                      {[1440, 360, 60, 15, 5, 1].map((threshold) => (
                        <button
                          key={threshold}
                          type="button"
                          className={`btn-ghost px-2 py-1 text-[11px] ${alertThresholdMinutes.includes(threshold) ? 'border-neon/70 text-neon' : ''}`}
                          onClick={() => {
                            if (alertThresholdMinutes.includes(threshold)) {
                              setAlertThresholds(alertThresholdMinutes.filter((value) => value !== threshold))
                            } else {
                              setAlertThresholds([...alertThresholdMinutes, threshold].sort((a, b) => b - a))
                            }
                          }}
                        >
                          {threshold >= 60 ? `${threshold / 60}h` : `${threshold}m`}
                        </button>
                      ))}
                    </div>
                    <SwitchPill
                      label="landmark crossing alerts"
                      checked={enableCrossingAlerts}
                      onCheckedChange={setEnableCrossingAlerts}
                    />
                    <SwitchPill
                      label="browser notifications"
                      checked={enableBrowserNotifications}
                      onCheckedChange={async (shouldEnable) => {
                        if (shouldEnable && 'Notification' in window) {
                          const permission = await Notification.requestPermission()
                          setEnableBrowserNotifications(permission === 'granted')
                          return
                        }
                        setEnableBrowserNotifications(false)
                      }}
                    />
                    <SwitchPill
                      label="reduced motion"
                      checked={effectiveReducedMotion}
                      onCheckedChange={(value) => {
                        if (!demoOverridesEnabled) {
                          setReducedMotion(value)
                        }
                      }}
                    />
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        ) : null}

        {infoDrawerOpen ? (
          <aside
            className="border-cyan-300/40 text-cyan-100 bg-black/88 absolute z-30 w-[min(420px,88vw)] rounded-xl border p-3 shadow-neon"
            style={{
              left: 'var(--hud-offset-left)',
              bottom: compactHud
                ? 'calc(var(--hud-offset-bottom) + 68px)'
                : 'calc(var(--hud-offset-bottom) + 86px)'
            }}
            data-testid="info-drawer"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-cyan-50 font-mono text-sm">info</h2>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setInfoDrawerOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px]">
              distance:{' '}
              {effectiveLocation && distance
                ? `${effectiveLocation.label} ${distance.deltaMinutes > 0 ? 'ahead' : 'behind'} ${formatSignedMinutes(Math.abs(distance.deltaMinutes))} · ~${distance.distanceKm.toFixed(0)}km`
                : 'set location to compare'}
            </p>
            <details className="mt-2">
              <summary className="text-cyan-100/86 cursor-pointer">stats</summary>
              <p className="mt-1 text-[11px]">
                solar lon {solarLongitude.toFixed(1)}° · speed {lineSpeed.toFixed(2)}°/h · mode{' '}
                {effectiveUseApparentSolar ? 'apparent' : 'mean'}
              </p>
            </details>
            <details className="mt-2" open>
              <summary className="text-cyan-100/86 cursor-pointer">up next</summary>
              <ul className="mt-1 grid gap-1 text-[11px]">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => <li key={event.id}>- {event.label}</li>)
                ) : (
                  <li>- no crossings in horizon</li>
                )}
              </ul>
            </details>
            {debugMode ? (
              <details className="mt-2" open>
                <summary className="text-cyan-100/86 cursor-pointer">debug</summary>
                <p className="mt-1 text-[11px]">
                  fps {debugPerf.fps} · drift {debugPerf.renderDriftMs.toFixed(2)}ms · terminator{' '}
                  {debugPerf.terminatorComputeMs.toFixed(2)}ms
                </p>
                <button
                  type="button"
                  className="btn-ghost mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                  onClick={() => setDebugMode(false)}
                >
                  <Bug size={13} />
                  close debug overlay
                </button>
              </details>
            ) : null}
          </aside>
        ) : null}
      </section>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((previous) => previous.filter((toast) => toast.id !== id))}
      />

      <DebugOverlay
        enabled={debugMode}
        rootRef={rootRef}
        onClose={() => setDebugMode(false)}
        perf={debugPerf}
      />
    </main>
  )
}
