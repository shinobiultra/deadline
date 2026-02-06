import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { CommandPanel } from '@/ui/CommandPanel'
import { CountdownCard } from '@/ui/CountdownCard'
import { DistanceBox } from '@/ui/DistanceBox'
import { SettingsDrawer } from '@/ui/SettingsDrawer'
import { StatsStrip } from '@/ui/StatsStrip'
import { ToastStack, type ToastItem } from '@/ui/ToastStack'
import { Map2DView } from '@/views/map2d/Map2DView'
import { useTimezonePolygons } from '@/features/civil/useTimezonePolygons'
import { useCities } from '@/features/deadline/cities'
import { listDeadlineTimezoneOptions, normalizeDeadlineZone, parseDeadlineInput } from '@/features/deadline/deadlineMath'
import { useDeadlineStore } from '@/features/deadline/store'
import { useLandmarks } from '@/features/landmarks/useLandmarks'
import { computeLandmarkCrossings } from '@/features/landmarks/crossings'
import { solarDeadlineLongitude, solarDistanceToMeridian, solarLineSpeedDegreesPerHour } from '@/features/solar/solarMath'
import { useIntervalNow } from '@/lib/useIntervalNow'

const Globe3DView = lazy(() => import('@/views/globe3d/Globe3DView'))

type ViewMode = '2d' | '3d'

function notifyIfEnabled(enabled: boolean, message: string) {
  if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  void new Notification('deadLINE', { body: message })
}

export default function App() {
  const nowMs = useIntervalNow(1000)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [cityQuery, setCityQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const {
    deadlineDate,
    deadlineTime,
    deadlineZone,
    ambiguousPreference,
    location,
    showTimezones,
    showSolarTime,
    showDayNight,
    previewMode,
    useApparentSolar,
    useTimezonePolygons: useTimezonePolygonsMode,
    civilGlowMinutes,
    alertThresholdMinutes,
    enableCrossingAlerts,
    enableBrowserNotifications,
    setDeadlineDate,
    setDeadlineTime,
    setDeadlineZone,
    setAmbiguousPreference,
    setLocation,
    setShowTimezones,
    setShowSolarTime,
    setShowDayNight,
    setPreviewMode,
    setUseApparentSolar,
    setUseTimezonePolygons,
    setCivilGlowMinutes,
    setAlertThresholds,
    setEnableCrossingAlerts,
    setEnableBrowserNotifications
  } = useDeadlineStore()

  const timezones = useMemo(() => listDeadlineTimezoneOptions(), [])
  const cityResults = useCities(cityQuery)
  const landmarks = useLandmarks()
  const { status: timezonePolygonStatus, features: timezonePolygons } = useTimezonePolygons(useTimezonePolygonsMode)

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

  const effectiveTime = useMemo(() => {
    if (previewMode === 'deadline' && parseResult.valid && parseResult.deadlineUtcMs) {
      return new Date(parseResult.deadlineUtcMs)
    }

    return new Date(nowMs)
  }, [nowMs, parseResult.deadlineUtcMs, parseResult.valid, previewMode])

  const solarLongitude = useMemo(() => {
    if (!parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return 0
    }

    return solarDeadlineLongitude(effectiveTime, parseResult.targetMinutesOfDay, useApparentSolar)
  }, [effectiveTime, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

  const lineSpeed = useMemo(() => {
    if (!parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return 15
    }

    return solarLineSpeedDegreesPerHour(effectiveTime, parseResult.targetMinutesOfDay, useApparentSolar)
  }, [effectiveTime, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

  const distance = useMemo(() => {
    if (!location || !parseResult.valid || parseResult.targetMinutesOfDay === undefined) {
      return null
    }

    return solarDistanceToMeridian(location.lat, location.lon, solarLongitude)
  }, [location, parseResult.targetMinutesOfDay, parseResult.valid, solarLongitude])

  const crossingPlan = useMemo(() => {
    if (!parseResult.valid || parseResult.deadlineUtcMs === undefined || parseResult.targetMinutesOfDay === undefined) {
      return []
    }

    return computeLandmarkCrossings({
      landmarks,
      rangeStartMs: nowMs,
      rangeEndMs: parseResult.deadlineUtcMs,
      targetMinutesOfDay: parseResult.targetMinutesOfDay,
      apparentSolar: useApparentSolar
    })
  }, [landmarks, nowMs, parseResult.deadlineUtcMs, parseResult.targetMinutesOfDay, parseResult.valid, useApparentSolar])

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
          const message = `deadLINE crossed ${crossing.landmark.name} at ${crossingTime}`
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-ink">
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
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
          />

          <CountdownCard nowMs={nowMs} deadlineUtcMs={parseResult.deadlineUtcMs} />

          <StatsStrip
            solarLongitude={solarLongitude}
            speedDegPerHour={lineSpeed}
            useApparentSolar={useApparentSolar}
            deltaMinutesFromLocation={distance?.deltaMinutes}
            kmFromLocation={distance?.distanceKm}
          />

          <DistanceBox location={location} deltaMinutes={distance?.deltaMinutes} deltaKm={distance?.distanceKm} />

          <SettingsDrawer
            useApparentSolar={useApparentSolar}
            setUseApparentSolar={setUseApparentSolar}
            useTimezonePolygons={useTimezonePolygonsMode}
            setUseTimezonePolygons={setUseTimezonePolygons}
            timezonePolygonStatus={timezonePolygonStatus}
            civilGlowMinutes={civilGlowMinutes}
            setCivilGlowMinutes={setCivilGlowMinutes}
            alertThresholdMinutes={alertThresholdMinutes}
            setAlertThresholds={setAlertThresholds}
            enableCrossingAlerts={enableCrossingAlerts}
            setEnableCrossingAlerts={setEnableCrossingAlerts}
            enableBrowserNotifications={enableBrowserNotifications}
            setEnableBrowserNotifications={setEnableBrowserNotifications}
          />
        </aside>

        <section className="grid gap-2">
          <header className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-panel/40 p-2 text-xs">
            <h1 className="font-mono text-sm tracking-[0.18em] text-cyan-100">deadline</h1>
            <div className="flex items-center gap-2">
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
            </div>
          </header>

          <div className="min-h-[420px]">
            {parseResult.valid && parseResult.targetMinutesOfDay !== undefined ? (
              viewMode === '2d' ? (
                <Map2DView
                  time={effectiveTime}
                  targetMinutesOfDay={parseResult.targetMinutesOfDay}
                  showTimezones={showTimezones}
                  showSolarTime={showSolarTime}
                  showDayNight={showDayNight}
                  useApparentSolar={useApparentSolar}
                  useTimezonePolygons={useTimezonePolygonsMode}
                  timezonePolygons={timezonePolygons}
                  civilGlowMinutes={civilGlowMinutes}
                  location={location}
                  landmarks={landmarks}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-cyan-400/20 bg-black/30 text-sm text-cyan-100/70">
                      loading globe chunk...
                    </div>
                  }
                >
                  <Globe3DView
                    time={effectiveTime}
                    targetMinutesOfDay={parseResult.targetMinutesOfDay}
                    showSolarTime={showSolarTime}
                    showDayNight={showDayNight}
                    useApparentSolar={useApparentSolar}
                    location={location}
                  />
                </Suspense>
              )
            ) : (
              <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-rose-400/25 bg-rose-950/10 text-sm text-rose-200">
                fix deadline input to render map
              </div>
            )}
          </div>
        </section>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((previous) => previous.filter((toast) => toast.id !== id))} />
    </main>
  )
}
