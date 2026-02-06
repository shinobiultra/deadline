export const EARTH_RADIUS_KM = 6371

export function wrap180(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

export function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI
}

export function circularMinuteDifference(a: number, b: number): number {
  const raw = Math.abs((((a - b) % 1440) + 1440) % 1440)
  return Math.min(raw, 1440 - raw)
}
