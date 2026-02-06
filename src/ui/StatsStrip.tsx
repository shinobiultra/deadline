import { formatSignedMinutes } from '@/lib/time'

type StatsStripProps = {
  solarLongitude: number
  speedDegPerHour: number
  useApparentSolar: boolean
  deltaMinutesFromLocation?: number
  kmFromLocation?: number
}

export function StatsStrip(props: StatsStripProps) {
  const { solarLongitude, speedDegPerHour, useApparentSolar, deltaMinutesFromLocation, kmFromLocation } =
    props

  return (
    <section className="border-cyan-300/20 text-cyan-100/80 rounded-xl border bg-black/35 p-3 text-xs">
      <p className="text-cyan-200/65 text-[10px] uppercase tracking-[0.18em]">stats</p>
      <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <p className="font-mono text-neon">{solarLongitude.toFixed(1)}°</p>
          <p>solar line lon</p>
        </div>
        <div>
          <p className="font-mono text-neon">{speedDegPerHour.toFixed(2)}°/h</p>
          <p>line speed</p>
        </div>
        <div>
          <p className="font-mono text-neon">{(speedDegPerHour / 15).toFixed(3)}x</p>
          <p>vs ideal 15°/h</p>
        </div>
        <div>
          <p className="font-mono text-neon">{useApparentSolar ? 'apparent' : 'mean'}</p>
          <p>solar mode</p>
        </div>
        {deltaMinutesFromLocation !== undefined && kmFromLocation !== undefined ? (
          <>
            <div>
              <p className="text-cyan-200 font-mono">{formatSignedMinutes(deltaMinutesFromLocation)}</p>
              <p>from your lon</p>
            </div>
            <div>
              <p className="text-cyan-200 font-mono">~{kmFromLocation.toFixed(0)} km</p>
              <p>distance at lat</p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
