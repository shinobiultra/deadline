import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString, Point } from 'geojson'
import type { Landmark } from '@/features/landmarks/types'
import type { LocationPoint } from '@/features/deadline/types'
import { clamp, wrap180 } from '@/lib/geo'

type DetailMapMode = '2d' | '3d'

type DetailMapViewProps = {
  mode: DetailMapMode
  nowTime: Date
  targetMinutesOfDay: number
  solarNowLongitude: number
  solarDeadlineLongitude: number | null
  location: LocationPoint | null
  showLandmarks: boolean
  landmarks: Landmark[]
  onZoomedOutExit?: () => void
}

type DetailLineFeatureProps = {
  id: string
  kind: 'now' | 'deadline'
}

type DetailPointProps = {
  id: string
  kind: 'landmark' | 'location'
  label: string
}

const OPEN_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'deadLINE-open-map',
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'openstreetmap',
      type: 'raster',
      source: 'openstreetmap',
      paint: {
        'raster-opacity': 0.96,
        'raster-contrast': 0.08,
        'raster-saturation': -0.2,
        'raster-brightness-max': 0.94
      }
    }
  ]
}

function buildMeridianLine(lon: number): [number, number][] {
  const points: [number, number][] = []

  for (let lat = -85; lat <= 85; lat += 1) {
    points.push([lon, lat])
  }

  return points
}

function buildLineCollection(
  solarNowLongitude: number,
  solarDeadlineLongitude: number | null
): FeatureCollection<LineString, DetailLineFeatureProps> {
  const features: FeatureCollection<LineString, DetailLineFeatureProps>['features'] = [
    {
      type: 'Feature',
      properties: { id: 'solar-now', kind: 'now' },
      geometry: {
        type: 'LineString',
        coordinates: buildMeridianLine(solarNowLongitude)
      }
    }
  ]

  if (solarDeadlineLongitude !== null) {
    features.push({
      type: 'Feature',
      properties: { id: 'solar-deadline', kind: 'deadline' },
      geometry: {
        type: 'LineString',
        coordinates: buildMeridianLine(solarDeadlineLongitude)
      }
    })
  }

  return {
    type: 'FeatureCollection',
    features
  }
}

function buildPointCollection(
  showLandmarks: boolean,
  landmarks: Landmark[],
  location: LocationPoint | null
): FeatureCollection<Point, DetailPointProps> {
  const features: FeatureCollection<Point, DetailPointProps>['features'] = []

  if (location) {
    features.push({
      type: 'Feature',
      properties: {
        id: 'location',
        kind: 'location',
        label: location.label
      },
      geometry: {
        type: 'Point',
        coordinates: [location.lon, location.lat]
      }
    })
  }

  if (showLandmarks) {
    const cap = 180
    for (const landmark of landmarks.slice(0, cap)) {
      features.push({
        type: 'Feature',
        properties: {
          id: landmark.id,
          kind: 'landmark',
          label: landmark.name
        },
        geometry: {
          type: 'Point',
          coordinates: [landmark.lon, landmark.lat]
        }
      })
    }
  }

  return {
    type: 'FeatureCollection',
    features
  }
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function DetailMapView(props: DetailMapViewProps) {
  const {
    mode,
    nowTime,
    targetMinutesOfDay,
    solarNowLongitude,
    solarDeadlineLongitude,
    location,
    showLandmarks,
    landmarks,
    onZoomedOutExit
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const nowTimeRef = useRef(nowTime)
  const targetMinutesRef = useRef(targetMinutesOfDay)
  const lineCollectionRef = useRef(buildLineCollection(solarNowLongitude, solarDeadlineLongitude))
  const pointCollectionRef = useRef(buildPointCollection(showLandmarks, landmarks, location))
  const initialCenterRef = useRef<[number, number]>(
    location ? [location.lon, location.lat] : [solarNowLongitude, 0]
  )
  const initialHasLocationRef = useRef(Boolean(location))
  const initialModeRef = useRef(mode)
  const autoExitTriggeredRef = useRef(false)

  const [loaded, setLoaded] = useState(false)
  const [followLine, setFollowLine] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(0)
  const [hoverReadout, setHoverReadout] = useState('')
  const [styleError, setStyleError] = useState<string | null>(null)

  const lineCollection = useMemo(
    () => buildLineCollection(solarNowLongitude, solarDeadlineLongitude),
    [solarDeadlineLongitude, solarNowLongitude]
  )

  const pointCollection = useMemo(
    () => buildPointCollection(showLandmarks, landmarks, location),
    [showLandmarks, landmarks, location]
  )

  useEffect(() => {
    nowTimeRef.current = nowTime
  }, [nowTime])

  useEffect(() => {
    targetMinutesRef.current = targetMinutesOfDay
  }, [targetMinutesOfDay])

  useEffect(() => {
    lineCollectionRef.current = lineCollection
  }, [lineCollection])

  useEffect(() => {
    pointCollectionRef.current = pointCollection
  }, [pointCollection])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) {
      return
    }

    setStyleError(null)

    const map = new maplibregl.Map({
      container,
      style: OPEN_MAP_STYLE,
      center: initialCenterRef.current,
      zoom: initialHasLocationRef.current ? 9.4 : 2.6,
      pitch: initialModeRef.current === '3d' ? 60 : 0,
      bearing: initialModeRef.current === '3d' ? -22 : 0,
      maxPitch: 70
    })

    mapRef.current = map

    const styleWatchdog = window.setTimeout(() => {
      if (!map.isStyleLoaded()) {
        setStyleError('detail tiles are still loading; check network or retry detail view')
      }
    }, 7000)

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right')

    map.on('load', () => {
      window.clearTimeout(styleWatchdog)
      setLoaded(true)
      setZoomLevel(map.getZoom())

      map.addSource('deadline-lines', {
        type: 'geojson',
        data: lineCollectionRef.current
      })

      map.addLayer({
        id: 'deadline-now',
        type: 'line',
        source: 'deadline-lines',
        filter: ['==', ['get', 'kind'], 'now'],
        paint: {
          'line-color': '#7cffb2',
          'line-width': ['interpolate', ['exponential', 1.24], ['zoom'], 2, 2.4, 9, 4.6, 15, 7.8],
          'line-opacity': 0.96,
          'line-blur': 0.5
        }
      })

      map.addLayer({
        id: 'deadline-now-glow',
        type: 'line',
        source: 'deadline-lines',
        filter: ['==', ['get', 'kind'], 'now'],
        paint: {
          'line-color': '#6ee7ff',
          'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 2, 7, 9, 11, 15, 16],
          'line-opacity': 0.2,
          'line-blur': 1.3
        }
      })

      map.addLayer({
        id: 'deadline-at',
        type: 'line',
        source: 'deadline-lines',
        filter: ['==', ['get', 'kind'], 'deadline'],
        paint: {
          'line-color': '#ffc27f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.4, 12, 4],
          'line-opacity': 0.72,
          'line-dasharray': [2.2, 1.1]
        }
      })

      map.addSource('deadline-points', {
        type: 'geojson',
        data: pointCollectionRef.current
      })

      map.addLayer({
        id: 'deadline-points',
        type: 'circle',
        source: 'deadline-points',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2,
            2,
            8,
            4,
            15,
            ['case', ['==', ['get', 'kind'], 'location'], 8, 5]
          ],
          'circle-color': ['case', ['==', ['get', 'kind'], 'location'], '#6ee7ff', '#ffab71'],
          'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'location'], 2, 0.5],
          'circle-stroke-color': '#082035'
        }
      })

      map.addLayer({
        id: 'deadline-point-labels',
        type: 'symbol',
        source: 'deadline-points',
        minzoom: 5,
        filter: ['==', ['get', 'kind'], 'landmark'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 13],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular']
        },
        paint: {
          'text-color': '#1d2b3e',
          'text-halo-color': '#f9fffb',
          'text-halo-width': 1.3
        }
      })

      map.on('mousemove', (event) => {
        const offsetHours = clamp(Math.round(wrap180(event.lngLat.lng) / 15), -12, 14)
        const localNowMinutes =
          nowTimeRef.current.getUTCHours() * 60 +
          nowTimeRef.current.getUTCMinutes() +
          nowTimeRef.current.getUTCSeconds() / 60 +
          offsetHours * 60

        const localNow = formatClock(localNowMinutes)
        const targetClock = formatClock(targetMinutesRef.current)
        const hitFeatures = map.queryRenderedFeatures(event.point, { layers: ['deadline-points'] })
        const topFeature = hitFeatures[0]
        const topLabel =
          typeof topFeature?.properties?.label === 'string' ? topFeature.properties.label : null
        const topKind = typeof topFeature?.properties?.kind === 'string' ? topFeature.properties.kind : null

        if (topLabel && topKind === 'landmark') {
          setHoverReadout(
            `cross candidate: ${topLabel} · lon ${event.lngLat.lng.toFixed(2)}° · lat ${event.lngLat.lat.toFixed(2)}°`
          )
          return
        }

        setHoverReadout(
          `lon ${event.lngLat.lng.toFixed(2)}° · lat ${event.lngLat.lat.toFixed(2)}° · UTC${offsetHours >= 0 ? '+' : ''}${offsetHours} · local ${localNow} · target ${targetClock}`
        )
      })

      map.on('click', (event) => {
        const hitFeatures = map.queryRenderedFeatures(event.point, { layers: ['deadline-points'] })
        const topFeature = hitFeatures[0]
        const topLabel =
          typeof topFeature?.properties?.label === 'string' ? topFeature.properties.label : null
        if (topLabel) {
          map.easeTo({
            center: [event.lngLat.lng, event.lngLat.lat],
            zoom: Math.max(map.getZoom(), 8.8),
            duration: 580
          })
          setHoverReadout(`focused: ${topLabel}`)
        }
      })

      map.on('moveend', () => {
        const currentZoom = map.getZoom()
        setZoomLevel(currentZoom)

        if (currentZoom > 2.2) {
          autoExitTriggeredRef.current = false
        }

        if (currentZoom <= 2.2 && onZoomedOutExit && !autoExitTriggeredRef.current) {
          autoExitTriggeredRef.current = true
          onZoomedOutExit()
        }
      })

      map.on('error', (event) => {
        if (event.error && 'message' in event.error) {
          const message = String(event.error.message)
          if (!message.includes('404')) {
            setStyleError(message)
          }
        }
      })
    })

    return () => {
      window.clearTimeout(styleWatchdog)
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [onZoomedOutExit])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) {
      return
    }

    const source = map.getSource('deadline-lines') as GeoJSONSource | undefined
    source?.setData(lineCollection)
  }, [lineCollection, loaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) {
      return
    }

    const source = map.getSource('deadline-points') as GeoJSONSource | undefined
    source?.setData(pointCollection)
  }, [loaded, pointCollection])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) {
      return
    }

    map.easeTo({
      pitch: mode === '3d' ? 60 : 0,
      bearing: mode === '3d' ? -22 : 0,
      duration: 500
    })
  }, [loaded, mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !followLine) {
      return
    }

    map.easeTo({
      center: [solarNowLongitude, location?.lat ?? 0],
      duration: 900,
      easing: (value) => value * (2 - value)
    })
  }, [followLine, loaded, location?.lat, solarNowLongitude])

  return (
    <div
      className="border-cyan-400/30 relative h-full min-h-[320px] rounded-xl border bg-black/20"
      data-testid="detail-map-view"
    >
      <div className="border-cyan-300/35 text-cyan-100 absolute left-2 top-2 z-20 grid gap-2 rounded-md border bg-black/70 px-2 py-2 text-[11px] shadow-neon">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost px-2 py-1"
            onClick={() => setFollowLine((value) => !value)}
          >
            follow line: {followLine ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1"
            onClick={() => {
              mapRef.current?.easeTo({
                center: [location?.lon ?? solarNowLongitude, location?.lat ?? 0],
                zoom: location ? 14.5 : 6.5,
                pitch: mode === '3d' ? 64 : 48,
                duration: 800
              })
            }}
          >
            zoom to line
          </button>
          <button
            type="button"
            className="btn-neon px-2 py-1"
            onClick={() => {
              mapRef.current?.easeTo({
                zoom: 17,
                pitch: mode === '3d' ? 68 : 52,
                duration: 850
              })
            }}
          >
            building close-up
          </button>
        </div>

        <p className="text-cyan-50 font-mono">
          style: open map raster · zoom {zoomLevel.toFixed(2)} · {mode === '3d' ? 'pitched' : 'flat'}
        </p>
        <p className="text-cyan-100/78">
          {hoverReadout || 'hover for civil timezone + target context · zoom out below 2.2 to return'}
        </p>
        {styleError ? <p className="text-rose-200">detail tiles warning: {styleError}</p> : null}
      </div>

      <div ref={containerRef} className="h-full w-full rounded-xl" />
      {!loaded ? (
        <div className="text-cyan-100/76 pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/35 text-xs">
          loading detail map tiles...
        </div>
      ) : null}
    </div>
  )
}
