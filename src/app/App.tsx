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
  describeTimezone,
  listDeadlineTimezoneOptions,
  normalizeDeadlineZone,
  parseDeadlineInput
} from '@/features/deadline/deadlineMath'
import { useDeadlineStore } from '@/features/deadline/store'
import { useLandmarks } from '@/features/landmarks/useLandmarks'
import { computeLandmarkCrossings } from '@/features/landmarks/crossings'
import {
  solarDeadlineLongitude,
  solarDistanceToMeridian,
  solarLineSpeedDegreesPerHour
} from '@/features/solar/solarMath'
import { useIntervalNow } from '@/lib/useIntervalNow'

const Globe3DView = lazy(() => import('@/views/globe3d/Globe3DView'))

type ViewMode = '2d' | '3d'

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

export default function App() {
  const nowMs = useIntervalNow(1000)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [showDetailView, setShowDetailView] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [debugMode, setDebugMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('debug') === '1'
  })

  const {
    deadlineDate,
    deadlineTime,
    deadlineZone,
    ambiguousPreference,
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
    setDeadlineDate,
    setDeadlineTime,
    setDeadlineZone,
    setAmbiguousPreference,
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

  const parseResult = useMemo(
    () =>
      parseDeadlineInput({
        date: deadlineDate,
        time: deadlineTime,
        zone: deadlineZone,
        ambiguousPreference
      }),
    [ambiguousPreference, deadlineDate, deadlineTime, deadlineZone]
  )

  const nowTime = useMemo(() => new Date(nowMs), [nowMs])

  const deadlineTimeDate = useMemo(() => {
    if (!parseResult.valid || !parseResult.deadlineUtcMs) {
      return null
    }
    return new Date(parseResult.deadlineUtcMs)
  }, [parseResult.deadlineUtcMs, parseResult.valid])

  const displayTime = useMemo(() => {
    if (!parseResult.valid || !parseResult.deadlineUtcMs) {
      return new Date(nowMs)
    }

    if (previewMode === 'deadline') {
      return new Date(parseResult.deadlineUtcMs)
    }

    if (previewMode === 'scrub') {
      const start = nowMs
      const end = parseResult.deadlineUtcMs
      return new Date(start + (end - start) * scrubRatio)
    }

    return new Date(nowMs)
  }, [nowMs, parseResult.deadlineUtcMs, parseResult.valid, previewMode, scrubRatio])

  const solarLongitude = useMemo(() => {
    if (!parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return 0
    }

    return solarDeadlineLongitude(displayTime, parseResult.targetMinutesOfDay, useApparentSolar)
  }, [displayTime, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

  const deadlineSolarLongitude = useMemo(() => {
    if (!parseResult.valid || parseResult.targetMinutesOfDay === undefined || !deadlineTimeDate) {
      return null
    }

    return solarDeadlineLongitude(deadlineTimeDate, parseResult.targetMinutesOfDay, useApparentSolar)
  }, [deadlineTimeDate, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

  const lineSpeed = useMemo(() => {
    if (!parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return 15
    }

    return solarLineSpeedDegreesPerHour(displayTime, parseResult.targetMinutesOfDay, useApparentSolar)
  }, [displayTime, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

  const distance = useMemo(() => {
    if (!location || !parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return null
    }

    return solarDistanceToMeridian(location.lat, location.lon, solarLongitude)
  }, [location, parseResult.targetMinutesOfDay, parseResult.valid, solarLongitude])

  const crossingPlan = useMemo(() => {
    if (
      !parseResult.valid ||
      parseResult.deadlineUtcMs === undefined ||
      parseResult.targetMinutesOfDay === undefined
    ) {
      return []
    }

    return computeLandmarkCrossings({
      landmarks,
      rangeStartMs: nowMs,
      rangeEndMs: parseResult.deadlineUtcMs,
      targetMinutesOfDay: parseResult.targetMinutesOfDay,
      apparentSolar: useApparentSolar
    })
  }, [
    landmarks,
    nowMs,
    parseResult.deadlineUtcMs,
    parseResult.targetMinutesOfDay,
    parseResult.valid,
    useApparentSolar
  ])

  const remainingMs = parseResult.deadlineUtcMs ? parseResult.deadlineUtcMs - nowMs : Number.POSITIVE_INFINITY

  const deadlineZoneLabel = describeTimezone(deadlineZone)
  const targetClockLabel =
    parseResult.valid && parseResult.targetMinutesOfDay !== undefined
      ? formatTargetClock(parseResult.targetMinutesOfDay)
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

  const handleDetailZoomOutExit = useCallback(() => {
    setShowDetailView(false)
    pushToast(`detail-auto-${Date.now()}`, 'zoomed out: switched back to deadLINE map')
  }, [pushToast])

  const [firedAlerts, setFiredAlerts] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setFiredAlerts(new Set())
  }, [parseResult.deadlineUtcMs, parseResult.targetMinutesOfDay, useApparentSolar])

  useEffect(() => {
    if (!parseResult.valid || parseResult.deadlineUtcMs === undefined) {
      return
    }

    const remaining = parseResult.deadlineUtcMs - nowMs
    if (remaining <= 0) {
      return
    }

    for (const threshold of alertThresholdMinutes) {
      const alertId = `time-${threshold}`
      if (firedAlerts.has(alertId)) {
        continue
      }

      if (remaining <= threshold * 60_000) {
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

        if (nowMs >= crossing.crossingMs && crossing.crossingMs <= parseResult.deadlineUtcMs) {
          const crossingTime = DateTime.fromMillis(crossing.crossingMs).toFormat('HH:mm:ss')
          const message = `crossed: ${crossing.landmark.name} · ${crossingTime}`
          pushToast(alertId, message)
          notifyIfEnabled(enableBrowserNotifications, message)
          setFiredAlerts((previous) => new Set(previous).add(alertId))
        }
      }
    }
  }, [
    alertThresholdMinutes,
    crossingPlan,
    enableBrowserNotifications,
    enableCrossingAlerts,
    firedAlerts,
    nowMs,
    parseResult.deadlineUtcMs,
    parseResult.valid,
    pushToast
  ])

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setDebugMode((value) => !value)
      }

      if (event.key.toLowerCase() === 'z') {
        setShowDetailView((value) => !value)
      }
    }

    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-ink" ref={rootRef}>
      <div className="noise-overlay" />
      <div className="scanline-overlay" />

      <div className="relative mx-auto grid max-w-[1300px] gap-3 px-3 py-3 md:grid-cols-[360px_1fr]">
        <aside className="grid gap-3">
          <CommandPanel
            deadlineDate={deadlineDate}
            setDeadlineDate={setDeadlineDate}
            deadlineTime={deadlineTime}
            setDeadlineTime={setDeadlineTime}
            deadlineZone={deadlineZone}
            setDeadlineZone={(value) => setDeadlineZone(normalizeDeadlineZone(value))}
            timezoneOptions={timezones}
            parseResult={parseResult}
            ambiguousPreference={ambiguousPreference}
            setAmbiguousPreference={setAmbiguousPreference}
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
          />

          <CountdownCard nowMs={nowMs} deadlineUtcMs={parseResult.deadlineUtcMs} />

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

          <div className="relative min-h-[420px] overflow-hidden rounded-xl">
            {parseResult.valid && parseResult.targetMinutesOfDay !== undefined ? (
              showDetailView ? (
                <DetailMapView
                  mode={viewMode}
                  nowTime={nowTime}
                  targetMinutesOfDay={parseResult.targetMinutesOfDay}
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
                  targetMinutesOfDay={parseResult.targetMinutesOfDay}
                  deadlineZoneLabel={deadlineZoneLabel}
                  deadlineOffsetMinutes={parseResult.selectedOffsetMinutes}
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
                    targetMinutesOfDay={parseResult.targetMinutesOfDay}
                    targetClockLabel={targetClockLabel}
                    deadlineZoneLabel={deadlineZoneLabel}
                    deadlineOffsetMinutes={parseResult.selectedOffsetMinutes}
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
        </section>
      </div>

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((previous) => previous.filter((toast) => toast.id !== id))}
      />

      <DebugOverlay enabled={debugMode} rootRef={rootRef} onClose={() => setDebugMode(false)} />
    </main>
  )
}
