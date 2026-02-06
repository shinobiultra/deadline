import { DateTime } from 'luxon'
import { CalendarDays, Clock3, LocateFixed, MapPin, Search, Trash2 } from 'lucide-react'
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
  showLandmarks: boolean
  setShowLandmarks: (value: boolean) => void
  previewMode: PreviewMode
  setPreviewMode: (value: PreviewMode) => void
  scrubRatio: number
  setScrubRatio: (value: number) => void
}

function dateStringTomorrow() {
  return DateTime.now().plus({ day: 1 }).toISODate() ?? '2026-01-01'
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

  return (
    <section className="rounded-xl border border-cyan-300/30 bg-panel/80 p-3 shadow-neon" data-debug-key="command-panel">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">command</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs" data-debug-key="date-field">
          <span>deadline date</span>
          <div className="relative" data-debug-key="date-input-wrap">
            <input
              className="h-10 w-full rounded-md border border-cyan-400/35 bg-black/40 px-2 pr-11 font-mono text-cyan-50"
              type="date"
              ref={dateInputRef}
              value={deadlineDate}
              onChange={(event) => setDeadlineDate(event.target.value)}
              data-debug-key="date-input"
            />
            <button
              type="button"
              className="btn-ghost absolute right-1 top-1/2 -translate-y-1/2 p-1.5"
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
              className="h-10 w-full rounded-md border border-cyan-400/35 bg-black/40 px-2 pr-11 font-mono text-cyan-50"
              type="time"
              ref={timeInputRef}
              value={deadlineTime}
              onChange={(event) => setDeadlineTime(event.target.value)}
              data-debug-key="time-input"
            />
            <button
              type="button"
              className="btn-ghost absolute right-1 top-1/2 -translate-y-1/2 p-1.5"
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

        <label className="grid gap-1 text-xs sm:col-span-2">
          <span>timezone</span>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-cyan-200/65" />
            <input
              className="h-10 w-full rounded-md border border-cyan-400/35 bg-black/40 pl-8 pr-2 font-mono text-cyan-50"
              value={timezoneSearch}
              onChange={(event) => setTimezoneSearch(event.target.value)}
              placeholder="type a city or tz (prague / tokyo / utc+9)"
              data-testid="timezone-search"
            />
          </div>

          <div className="flex gap-2">
            <select
              className="h-10 w-full rounded-md border border-cyan-400/35 bg-black/40 px-2 font-mono text-cyan-50"
              value={hasSelectedOption ? deadlineZone : '__custom__'}
              onChange={(event) => {
                const value = event.target.value
                if (value !== '__custom__') {
                  setDeadlineZone(value)
                }
              }}
              data-testid="timezone-select"
            >
              {!hasSelectedOption ? <option value="__custom__">{deadlineZone || 'custom timezone'}</option> : null}
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
              onClick={() => setDeadlineZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}
            >
              local
            </button>
            <button type="button" className="btn-ghost px-2 py-1 text-[11px]" onClick={() => setDeadlineZone('UTC')}>
              utc
            </button>
            <button type="button" className="btn-neon px-2 py-1 text-[11px]" onClick={() => setDeadlineZone(AOE_IANA_ZONE)}>
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

          <span className="text-[11px] text-cyan-100/60">
            selected: {describeTimezone(deadlineZone)} · now in selected zone: {nowZoneLabel}
          </span>
        </label>
      </div>

      {parseResult.error ? <p className="mt-2 text-xs text-rose-300">{parseResult.error}</p> : null}

      {parseResult.ambiguous ? (
        <div className="mt-2 rounded-md border border-amber-300/35 bg-amber-950/20 p-2 text-xs text-amber-100">
          <p>ambiguous dst time detected. choose instance:</p>
          <div className="mt-1 flex gap-2">
            <button className="btn-ghost px-2 py-1" onClick={() => setAmbiguousPreference('earlier')} type="button">
              earlier {ambiguousPreference === 'earlier' ? '✓' : ''}
            </button>
            <button className="btn-ghost px-2 py-1" onClick={() => setAmbiguousPreference('later')} type="button">
              later {ambiguousPreference === 'later' ? '✓' : ''}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-xs">
        <label className="grid gap-1">
          <span>city search (offline)</span>
          <input
            className="h-10 rounded-md border border-cyan-400/35 bg-black/40 px-2"
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

          <button className="btn-ghost inline-flex items-center gap-1 px-2 py-1" onClick={() => setLocation(null)} type="button">
            <Trash2 size={14} />
            clear
          </button>

          {location ? (
            <span className="inline-flex items-center gap-1 self-center text-[11px] text-cyan-100/70">
              <MapPin size={12} />
              {location.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg border border-cyan-300/25 p-2 text-xs">
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
            <span className="text-[11px] text-cyan-100/70">warp</span>
            <input
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
