import { SwitchPill } from './SwitchPill'

const thresholdOptions = [1440, 360, 60, 15, 5, 1]

type SettingsDrawerProps = {
  useApparentSolar: boolean
  setUseApparentSolar: (value: boolean) => void
  useTimezonePolygons: boolean
  setUseTimezonePolygons: (value: boolean) => void
  brightDayLighting: boolean
  setBrightDayLighting: (value: boolean) => void
  timezonePolygonStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  civilGlowMinutes: number
  setCivilGlowMinutes: (value: number) => void
  alertThresholdMinutes: number[]
  setAlertThresholds: (value: number[]) => void
  enableCrossingAlerts: boolean
  setEnableCrossingAlerts: (value: boolean) => void
  enableBrowserNotifications: boolean
  setEnableBrowserNotifications: (value: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (value: boolean) => void
}

export function SettingsDrawer(props: SettingsDrawerProps) {
  const {
    useApparentSolar,
    setUseApparentSolar,
    useTimezonePolygons,
    setUseTimezonePolygons,
    brightDayLighting,
    setBrightDayLighting,
    timezonePolygonStatus,
    civilGlowMinutes,
    setCivilGlowMinutes,
    alertThresholdMinutes,
    setAlertThresholds,
    enableCrossingAlerts,
    setEnableCrossingAlerts,
    enableBrowserNotifications,
    setEnableBrowserNotifications,
    reducedMotion,
    setReducedMotion
  } = props

  const toggleThreshold = (value: number) => {
    if (alertThresholdMinutes.includes(value)) {
      setAlertThresholds(alertThresholdMinutes.filter((item) => item !== value))
      return
    }

    setAlertThresholds([...alertThresholdMinutes, value].sort((a, b) => b - a))
  }

  return (
    <details className="border-cyan-300/20 text-cyan-100/80 rounded-xl border bg-black/35 p-3 text-xs">
      <summary className="text-cyan-200/70 cursor-pointer select-none text-[10px] uppercase tracking-[0.18em]">
        settings
      </summary>
      <div className="mt-3 grid gap-3">
        <SwitchPill label="apparent solar" checked={useApparentSolar} onCheckedChange={setUseApparentSolar} />
        <SwitchPill
          label="bright daytime lighting"
          checked={brightDayLighting}
          onCheckedChange={setBrightDayLighting}
        />

        <SwitchPill
          label="accuracy mode (timezone polygons)"
          checked={useTimezonePolygons}
          onCheckedChange={setUseTimezonePolygons}
        />
        {useTimezonePolygons ? (
          <p className="text-cyan-100/70 text-[11px]">
            {timezonePolygonStatus === 'ready'
              ? 'timezone polygons loaded'
              : timezonePolygonStatus === 'loading'
                ? 'loading timezone polygons...'
                : timezonePolygonStatus === 'missing'
                  ? 'dataset missing: add public/data/timezones/timezones.geojson'
                  : timezonePolygonStatus === 'error'
                    ? 'failed to load polygon dataset'
                    : 'timezone polygons idle'}
          </p>
        ) : null}

        <label className="grid gap-1">
          <span>civil glow tolerance (minutes)</span>
          <input
            className="h-10"
            type="range"
            min={1}
            max={45}
            value={civilGlowMinutes}
            onChange={(event) => setCivilGlowMinutes(Number(event.target.value))}
          />
          <span className="text-cyan-100/70 font-mono">{civilGlowMinutes}m</span>
        </label>

        <fieldset className="grid gap-1">
          <legend>alert thresholds</legend>
          <div className="flex flex-wrap gap-2">
            {thresholdOptions.map((value) => (
              <button
                type="button"
                key={value}
                className={`btn-ghost px-2 py-1 ${alertThresholdMinutes.includes(value) ? 'border-neon/70 text-neon' : ''}`}
                onClick={() => toggleThreshold(value)}
              >
                {value >= 60 ? `${value / 60}h` : `${value}m`}
              </button>
            ))}
          </div>
        </fieldset>

        <SwitchPill
          label="landmark crossing alerts"
          checked={enableCrossingAlerts}
          onCheckedChange={setEnableCrossingAlerts}
        />

        <SwitchPill label="reduced motion" checked={reducedMotion} onCheckedChange={setReducedMotion} />

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
      </div>
    </details>
  )
}
