import { DateTime } from 'luxon'
import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson'
import { circularMinuteDifference } from '@/lib/geo'

export type TimezonePolygonFeature = Feature<Polygon | MultiPolygon, { zoneId: string }>

export type TimezonePolygonStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

const ZONE_KEYS = ['tzid', 'TZID', 'timezone', 'zone', 'name', 'tz_name']

export function extractZoneId(properties: GeoJsonProperties | null): string | null {
  if (!properties) {
    return null
  }

  for (const key of ZONE_KEYS) {
    const value = properties[key]
    if (typeof value === 'string' && value.includes('/')) {
      return value
    }
  }

  return null
}

function normalizeTimezoneFeatures(collection: FeatureCollection): TimezonePolygonFeature[] {
  const normalized: TimezonePolygonFeature[] = []

  for (const feature of collection.features) {
    if (!feature.geometry) {
      continue
    }

    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      continue
    }

    const zoneId = extractZoneId(feature.properties)
    if (!zoneId) {
      continue
    }

    normalized.push({
      type: 'Feature',
      id: feature.id,
      geometry: feature.geometry,
      properties: { zoneId }
    })
  }

  return normalized
}

export function civilMinuteDifferenceForZone(
  zoneId: string,
  time: Date,
  targetMinutesOfDay: number
): number | null {
  const local = DateTime.fromJSDate(time, { zone: zoneId })
  if (!local.isValid) {
    return null
  }

  const localMinutes = local.hour * 60 + local.minute + local.second / 60
  return circularMinuteDifference(localMinutes, targetMinutesOfDay)
}

export function civilIntensityForZone(
  zoneId: string,
  time: Date,
  targetMinutesOfDay: number,
  glowWindowMinutes: number
): number | null {
  const difference = civilMinuteDifferenceForZone(zoneId, time, targetMinutesOfDay)
  if (difference === null) {
    return null
  }

  const window = Math.max(1, glowWindowMinutes)
  if (difference > window) {
    return null
  }

  return 1 - difference / window
}

let cache: TimezonePolygonFeature[] | null = null
let inflight: Promise<TimezonePolygonFeature[] | null> | null = null

export async function loadTimezonePolygonDataset(path = '/data/timezones/timezones.geojson') {
  if (cache) {
    return { status: 'ready' as const, features: cache }
  }

  if (!inflight) {
    inflight = fetch(path)
      .then((response) => {
        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          throw new Error(`failed to load timezone polygons (${response.status})`)
        }

        return response.json() as Promise<FeatureCollection>
      })
      .then((collection) => {
        if (!collection) {
          return null
        }

        cache = normalizeTimezoneFeatures(collection)
        return cache
      })
  }

  try {
    const result = await inflight
    inflight = null

    if (!result) {
      return { status: 'missing' as const, features: [] }
    }

    return { status: 'ready' as const, features: result }
  } catch (error) {
    inflight = null
    return { status: 'error' as const, features: [], error }
  }
}
