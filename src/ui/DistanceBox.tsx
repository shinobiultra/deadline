import type { LocationPoint } from '@/features/deadline/types'
import { formatSignedMinutes } from '@/lib/time'

type DistanceBoxProps = {
  location: LocationPoint | null
  deltaMinutes?: number
  deltaKm?: number
}

export function DistanceBox({ location, deltaMinutes, deltaKm }: DistanceBoxProps) {
  if (!location || deltaMinutes === undefined || deltaKm === undefined) {
    return (
      <section className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 text-xs text-cyan-100/80">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/65">distance / remaining</p>
        <p className="mt-1">set location to compare your place vs moving solar line</p>
      </section>
    )
  }

  const ahead = deltaMinutes > 0
  return (
    <section className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 text-xs text-cyan-100/80">
      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/65">distance / remaining</p>
      <p className="mt-1 font-mono text-sm text-neon">
        {location.label}: {ahead ? 'ahead' : 'behind'} {formatSignedMinutes(Math.abs(deltaMinutes))}
      </p>
      <p className="text-cyan-100/70">~{deltaKm.toFixed(0)} km along your latitude</p>
    </section>
  )
}
