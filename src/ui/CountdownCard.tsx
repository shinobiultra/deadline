import { DateTime } from 'luxon'
import { formatDuration } from '@/lib/time'

type CountdownCardProps = {
  nowMs: number
  deadlineUtcMs: number | undefined
}

export function CountdownCard({ nowMs, deadlineUtcMs }: CountdownCardProps) {
  if (!deadlineUtcMs) {
    return (
      <section className="rounded-xl border border-rose-300/25 bg-rose-950/20 p-3">
        <p className="text-xs text-rose-200">countdown unavailable: fix deadline input</p>
      </section>
    )
  }

  const remaining = deadlineUtcMs - nowMs
  const live = remaining > 0
  const deadlineIso = DateTime.fromMillis(deadlineUtcMs, { zone: 'utc' }).toFormat("yyyy-LL-dd HH:mm 'utc'")

  return (
    <section
      className="border-cyan-300/30 rounded-xl border bg-panel/70 p-3 shadow-neon"
      data-testid="countdown-card"
    >
      <p className="text-cyan-200/70 text-[10px] uppercase tracking-[0.18em]">countdown</p>
      <p className="font-mono text-3xl font-semibold leading-none text-neon">
        {formatDuration(Math.abs(remaining))}
      </p>
      <p className="text-cyan-100/70 mt-1 text-xs">
        {live ? 'time remaining' : 'deadline passed'} · {deadlineIso}
      </p>
    </section>
  )
}
