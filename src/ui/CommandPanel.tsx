import { DateTime } from 'luxon'
import type { CityRecord } from '@/features/deadline/cities'
import type { DeadlineParseResult, LocationPoint, PreviewMode } from '@/features/deadline/types'

type CommandPanelProps = {
  deadlineDate: string
  setDeadlineDate: (value: string) => void
  deadlineTime: string
  setDeadlineTime: (value: string) => void
  deadlineZone: string
  setDeadlineZone: (value: string) => void
  timezoneOptions: string[]
  parseResult: DeadlineParseResult
  ambiguousPreference: 'earlier' | 'later'
  setAmbiguousPreference: (value: 'earlier' | 'later') => void
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
  previewMode: PreviewMode
  setPreviewMode: (value: PreviewMode) => void
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
    ambiguousPreference,
    setAmbiguousPreference,
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
    previewMode,
    setPreviewMode
  } = props

  const nowZoneLabel = DateTime.now().setZone(deadlineZone).toFormat("ccc, dd LLL HH:mm 'local'")

  return (
    <section className="rounded-xl border border-cyan-300/30 bg-panel/80 p-3 shadow-neon">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">command</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span>deadline date</span>
          <input
            className="rounded-md border border-cyan-400/35 bg-black/40 px-2 py-1 font-mono text-cyan-50"
            type="date"
            value={deadlineDate}
            onChange={(event) => setDeadlineDate(event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-xs">
          <span>deadline time</span>
          <input
            className="rounded-md border border-cyan-400/35 bg-black/40 px-2 py-1 font-mono text-cyan-50"
            type="time"
            value={deadlineTime}
            onChange={(event) => setDeadlineTime(event.target.value)}
          />
        </label>

        <label className="grid gap-1 text-xs sm:col-span-2">
          <span>timezone (iana)</span>
          <input
            className="rounded-md border border-cyan-400/35 bg-black/40 px-2 py-1 font-mono text-cyan-50"
            value={deadlineZone}
            list="tz-options"
            onChange={(event) => setDeadlineZone(event.target.value)}
          />
          <datalist id="tz-options">
            {timezoneOptions.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <span className="text-[11px] text-cyan-100/60">now in selected zone: {nowZoneLabel}</span>
        </label>
      </div>

      {parseResult.error ? (
        <p className="mt-2 text-xs text-rose-300">{parseResult.error}</p>
      ) : null}

      {parseResult.ambiguous ? (
        <div className="mt-2 rounded-md border border-amber-300/35 bg-amber-950/20 p-2 text-xs text-amber-100">
          <p>ambiguous dst time detected. choose instance:</p>
          <div className="mt-1 flex gap-2">
            <button
              className="rounded border border-amber-300/40 px-2 py-1"
              onClick={() => setAmbiguousPreference('earlier')}
              type="button"
            >
              earlier {ambiguousPreference === 'earlier' ? '✓' : ''}
            </button>
            <button
              className="rounded border border-amber-300/40 px-2 py-1"
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
            className="rounded-md border border-cyan-400/35 bg-black/40 px-2 py-1"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            placeholder="search city or country"
          />
        </label>

        <div className="flex flex-wrap gap-1">
          {cityResults.map((city) => (
            <button
              key={`${city.name}-${city.zone}`}
              className="rounded border border-cyan-300/35 bg-black/25 px-2 py-1 text-[11px]"
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
            className="rounded border border-cyan-300/35 bg-black/25 px-2 py-1"
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
            use geolocation
          </button>

          <button
            className="rounded border border-cyan-300/35 bg-black/25 px-2 py-1"
            onClick={() => setLocation(null)}
            type="button"
          >
            clear location
          </button>

          {location ? <span className="self-center text-[11px] text-cyan-100/70">{location.label}</span> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg border border-cyan-300/25 p-2 text-xs sm:grid-cols-2">
        <label className="flex items-center justify-between">
          <span>show timezones</span>
          <input type="checkbox" checked={showTimezones} onChange={(event) => setShowTimezones(event.target.checked)} />
        </label>

        <label className="flex items-center justify-between">
          <span>show solar time</span>
          <input type="checkbox" checked={showSolarTime} onChange={(event) => setShowSolarTime(event.target.checked)} />
        </label>

        <label className="flex items-center justify-between">
          <span>show day/night</span>
          <input type="checkbox" checked={showDayNight} onChange={(event) => setShowDayNight(event.target.checked)} />
        </label>

        <label className="flex items-center justify-between">
          <span>preview mode</span>
          <select
            className="rounded border border-cyan-300/35 bg-black/35 px-1 py-0.5"
            value={previewMode}
            onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
          >
            <option value="now">now</option>
            <option value="deadline">at deadline</option>
          </select>
        </label>
      </div>
    </section>
  )
}
