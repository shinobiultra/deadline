export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

export function formatSignedMinutes(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(Math.round(minutes))
  const hours = Math.floor(absMinutes / 60)
  const remainder = absMinutes % 60
  if (hours === 0) {
    return `${sign}${remainder}m`
  }

  return `${sign}${hours}h ${pad2(remainder)}m`
}
