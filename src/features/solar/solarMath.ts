import { EARTH_RADIUS_KM, clamp, degreesToRadians, radiansToDegrees, wrap180 } from '@/lib/geo'

export type LonLatPoint = {
  lon: number
  lat: number
}

const MS_PER_MINUTE = 60_000

function fractionalYearRadians(time: Date): number {
  const start = Date.UTC(time.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((time.getTime() - start) / 86_400_000)
  const utcHour =
    time.getUTCHours() +
    time.getUTCMinutes() / 60 +
    time.getUTCSeconds() / 3600 +
    time.getUTCMilliseconds() / 3_600_000

  return ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHour - 12) / 24)
}

export function equationOfTimeMinutes(time: Date): number {
  const g = fractionalYearRadians(time)
  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g))
  )
}

export function solarDeclinationRadians(time: Date): number {
  const g = fractionalYearRadians(time)
  return (
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g)
  )
}

export function utcMinutesOfDay(time: Date): number {
  return (
    time.getUTCHours() * 60 +
    time.getUTCMinutes() +
    time.getUTCSeconds() / 60 +
    time.getUTCMilliseconds() / 60_000
  )
}

function equationOffset(time: Date, apparent: boolean): number {
  return apparent ? equationOfTimeMinutes(time) : 0
}

export function subsolarLongitude(time: Date, apparent = false): number {
  const utcHour = utcMinutesOfDay(time) / 60
  const e = equationOffset(time, apparent) / 60
  return wrap180(15 * (12 - utcHour - e))
}

export function subsolarLatitude(time: Date): number {
  return radiansToDegrees(solarDeclinationRadians(time))
}

export function solarDeadlineLongitude(time: Date, targetMinutesOfDay: number, apparent = false): number {
  const utcMin = utcMinutesOfDay(time)
  const e = equationOffset(time, apparent)
  return wrap180(15 * ((targetMinutesOfDay - utcMin - e) / 60))
}

export function solarPhaseDegrees(time: Date, targetMinutesOfDay: number, apparent = false): number {
  const utcTotalMinutes = time.getTime() / MS_PER_MINUTE
  const e = equationOffset(time, apparent)
  return 15 * ((targetMinutesOfDay - utcTotalMinutes - e) / 60)
}

export function solarTerminatorLatitudeAtLongitude(time: Date, longitude: number, apparent = false): number {
  const declination = solarDeclinationRadians(time)
  const tanDeclination = Math.tan(declination)

  if (Math.abs(tanDeclination) < 1e-9) {
    return 0
  }

  const hourAngle = degreesToRadians(wrap180(longitude - subsolarLongitude(time, apparent)))
  const latitude = Math.atan(-Math.cos(hourAngle) / tanDeclination)
  return clamp(radiansToDegrees(latitude), -89.999, 89.999)
}

export function buildTerminatorPolyline(time: Date, apparent = false, stepDegrees = 2): LonLatPoint[] {
  const points: LonLatPoint[] = []
  for (let lon = -180; lon <= 180; lon += stepDegrees) {
    points.push({
      lon,
      lat: solarTerminatorLatitudeAtLongitude(time, lon, apparent)
    })
  }

  if (points[points.length - 1]?.lon !== 180) {
    points.push({ lon: 180, lat: solarTerminatorLatitudeAtLongitude(time, 180, apparent) })
  }

  return points
}

export function isNightAt(time: Date, lat: number, lon: number, apparent = false): boolean {
  const declination = solarDeclinationRadians(time)
  const latitude = degreesToRadians(lat)
  const hourAngle = degreesToRadians(wrap180(lon - subsolarLongitude(time, apparent)))
  const sinAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)

  return sinAltitude < 0
}

export function buildNightPolygon(time: Date, apparent = false): LonLatPoint[] {
  const terminator = buildTerminatorPolyline(time, apparent)
  const northNight = isNightAt(time, 89.9, 0, apparent)

  if (northNight) {
    return [{ lon: -180, lat: 90 }, { lon: 180, lat: 90 }, ...[...terminator].reverse()]
  }

  return [{ lon: -180, lat: -90 }, { lon: 180, lat: -90 }, ...terminator]
}

export function solarDistanceToMeridian(
  lat: number,
  lon: number,
  lineLongitude: number
): {
  deltaLongitude: number
  deltaMinutes: number
  distanceKm: number
} {
  const deltaLongitude = wrap180(lon - lineLongitude)
  const deltaMinutes = deltaLongitude * 4
  const distanceKm = Math.abs(
    Math.cos(degreesToRadians(lat)) * degreesToRadians(deltaLongitude) * EARTH_RADIUS_KM
  )

  return { deltaLongitude, deltaMinutes, distanceKm }
}

export function solarLineSpeedDegreesPerHour(
  time: Date,
  targetMinutesOfDay: number,
  apparent = false
): number {
  const a = solarPhaseDegrees(time, targetMinutesOfDay, apparent)
  const b = solarPhaseDegrees(new Date(time.getTime() + 3_600_000), targetMinutesOfDay, apparent)
  return Math.abs(b - a)
}

export function sunDirectionEcef(time: Date, apparent = false): [number, number, number] {
  const lat = degreesToRadians(subsolarLatitude(time))
  const lon = degreesToRadians(subsolarLongitude(time, apparent))
  const x = Math.cos(lat) * Math.cos(lon)
  const y = Math.sin(lat)
  const z = Math.cos(lat) * Math.sin(lon)
  return [x, y, z]
}
