import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoEquirectangular, geoGraticule10, geoPath, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry, LineString, Polygon } from 'geojson'
import { buildCivilBands } from '@/features/civil/civilBands'
import { civilIntensityForZone, type TimezonePolygonFeature } from '@/features/civil/timezonePolygons'
import type { LocationPoint } from '@/features/deadline/types'
import type { Landmark } from '@/features/landmarks/types'
import {
  buildNightPolygon,
  buildTerminatorPolyline,
  solarDeadlineLongitude,
  subsolarLatitude,
  subsolarLongitude,
  utcMinutesOfDay
} from '@/features/solar/solarMath'
import { assetUrl } from '@/lib/assets'
import { clamp, wrap180 } from '@/lib/geo'
import { useElementSize } from '@/lib/useElementSize'

type GeoFeatureCollection = FeatureCollection<Geometry>

type ViewState = {
  zoom: number
  offsetX: number
  offsetY: number
}

type HoverState = {
  x: number
  y: number
  readout: string
  detail: string
  landmarkId?: string
}

type Map2DViewProps = {
  nowTime: Date
  displayTime: Date
  deadlineTime: Date | null
  targetMinutesOfDay: number
  deadlineZoneLabel: string
  deadlineOffsetMinutes?: number
  showTimezones: boolean
  showSolarTime: boolean
  showDayNight: boolean
  brightDayLighting: boolean
  showLandmarks: boolean
  useApparentSolar: boolean
  useTimezonePolygons: boolean
  timezonePolygons: TimezonePolygonFeature[]
  civilGlowMinutes: number
  location: LocationPoint | null
  landmarks: Landmark[]
  reducedMotion: boolean
  baseMapStyle?: 'deadline-dark' | 'osm-light' | 'osm-dark'
  initialViewState?: Partial<ViewState>
  onViewStateChange?: (state: {
    zoom: number
    offsetX: number
    offsetY: number
    centerLon: number
    centerLat: number
  }) => void
  onMapClick?: (coords: { lat: number; lon: number }) => void
  showResetButton?: boolean
  showInlineLegend?: boolean
  showStatusOverlay?: boolean
  onPerf?: (metrics: { terminatorComputeMs: number }) => void
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  baseOffsetX: number
  baseOffsetY: number
}

function segmentBand(start: number, end: number): Array<{ start: number; end: number }> {
  if (start <= end) {
    return [{ start, end }]
  }

  return [
    { start, end: 180 },
    { start: -180, end }
  ]
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function wrapOffsetX(offsetX: number, worldWidth: number): number {
  if (!Number.isFinite(worldWidth) || worldWidth <= 0) {
    return offsetX
  }

  const half = worldWidth / 2
  const wrapped = ((((offsetX + half) % worldWidth) + worldWidth) % worldWidth) - half
  return Number.isFinite(wrapped) ? wrapped : offsetX
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function signedCircularMinuteDelta(targetMinutes: number, localMinutes: number): number {
  const raw = ((((targetMinutes - localMinutes + 720) % 1440) + 1440) % 1440) - 720
  return raw
}

function formatUtcOffsetFromHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '-'
  const abs = Math.abs(hours)
  return `UTC${sign}${String(abs).padStart(2, '0')}`
}

function formatUtcOffsetFromMinutes(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hour = Math.floor(abs / 60)
  const minute = abs % 60
  if (minute === 0) {
    return `UTC${sign}${String(hour).padStart(2, '0')}`
  }
  return `UTC${sign}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function avoidSeamLongitude(longitude: number): number {
  const wrapped = wrap180(longitude)
  const seamDistance = 180 - Math.abs(wrapped)
  if (seamDistance > 0.45) {
    return wrapped
  }

  return wrapped >= 0 ? 179.55 : -179.55
}

function nearestLandmark(lon: number, lat: number, landmarks: Landmark[], zoom: number): Landmark | null {
  if (landmarks.length === 0) {
    return null
  }

  const lonTolerance = 2.6 / Math.sqrt(Math.max(1, zoom))
  const latTolerance = 2.2 / Math.sqrt(Math.max(1, zoom))

  let best: Landmark | null = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const landmark of landmarks) {
    const dLon = wrap180(landmark.lon - lon)
    const dLat = landmark.lat - lat

    if (Math.abs(dLon) > lonTolerance || Math.abs(dLat) > latTolerance) {
      continue
    }

    const dist = dLon * dLon + dLat * dLat
    if (dist < bestDist) {
      bestDist = dist
      best = landmark
    }
  }

  return best
}

export function Map2DView(props: Map2DViewProps) {
  const {
    nowTime,
    displayTime,
    deadlineTime,
    targetMinutesOfDay,
    deadlineZoneLabel,
    deadlineOffsetMinutes,
    showTimezones,
    showSolarTime,
    showDayNight,
    brightDayLighting,
    showLandmarks,
    useApparentSolar,
    useTimezonePolygons,
    timezonePolygons,
    civilGlowMinutes,
    location,
    landmarks,
    reducedMotion,
    baseMapStyle = 'deadline-dark',
    initialViewState,
    onViewStateChange,
    onMapClick,
    showResetButton = true,
    showInlineLegend = true,
    showStatusOverlay = true,
    onPerf
  } = props

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragMovedRef = useRef(false)
  const animationRef = useRef<number | null>(null)
  const lastPerfPushRef = useRef(0)
  const initialViewAppliedRef = useRef(false)
  const viewRef = useRef<ViewState>({ zoom: 1, offsetX: 0, offsetY: 0 })

  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [world, setWorld] = useState<GeoFeatureCollection | null>(null)
  const [hoverState, setHoverState] = useState<HoverState | null>(null)
  const [view, setView] = useState<ViewState>({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [dragging, setDragging] = useState(false)

  const size = useElementSize(container)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    setContainer(wrapperRef.current)
  }, [])

  useEffect(() => {
    let active = true

    fetch(assetUrl('data/world-110m.topo.json'))
      .then((response) => response.json())
      .then((topology) => {
        if (!active) {
          return
        }

        const worldFeatures = feature(topology, topology.objects.countries) as unknown as GeoFeatureCollection
        setWorld(worldFeatures)
      })
      .catch(() => {
        if (active) {
          setWorld(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const baseProjectionMetrics = useMemo(() => {
    if (!size.width || !size.height) {
      return null
    }

    const projection = geoEquirectangular().fitExtent(
      [
        [14, 10],
        [size.width - 14, size.height - 10]
      ],
      { type: 'Sphere' }
    )

    return {
      scale: projection.scale(),
      translate: projection.translate() as [number, number]
    }
  }, [size.height, size.width])

  const worldWidthAtZoom = useCallback(
    (zoom: number) => {
      if (!baseProjectionMetrics) {
        return 0
      }

      return 2 * Math.PI * baseProjectionMetrics.scale * zoom
    },
    [baseProjectionMetrics]
  )

  const buildProjection = useCallback(
    (customView: ViewState = view): GeoProjection | null => {
      if (!baseProjectionMetrics || !size.width || !size.height) {
        return null
      }

      const projection = geoEquirectangular().fitExtent(
        [
          [14, 10],
          [size.width - 14, size.height - 10]
        ],
        { type: 'Sphere' }
      )

      const baseScale = baseProjectionMetrics.scale
      const [tx, ty] = baseProjectionMetrics.translate

      projection.scale(baseScale * customView.zoom)
      projection.translate([tx + customView.offsetX, ty + customView.offsetY])
      return projection
    },
    [baseProjectionMetrics, size.height, size.width, view]
  )

  const defaultView = useCallback(
    (zoom: number): ViewState => {
      if (!baseProjectionMetrics) {
        return { zoom, offsetX: 0, offsetY: 0 }
      }

      const worldWidth = worldWidthAtZoom(zoom)
      const offsetX = location ? wrapOffsetX(-(location.lon / 360) * worldWidth, worldWidth) : 0

      return {
        zoom,
        offsetX,
        offsetY: 0
      }
    },
    [baseProjectionMetrics, location, worldWidthAtZoom]
  )

  const animateToView = useCallback((nextView: ViewState) => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const start = performance.now()
    const from = viewRef.current
    const duration = 220

    const step = () => {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / duration)
      const eased = easeOutCubic(t)

      setView({
        zoom: from.zoom + (nextView.zoom - from.zoom) * eased,
        offsetX: from.offsetX + (nextView.offsetX - from.offsetX) * eased,
        offsetY: from.offsetY + (nextView.offsetY - from.offsetY) * eased
      })

      if (t < 1) {
        animationRef.current = requestAnimationFrame(step)
      } else {
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!initialViewState || !baseProjectionMetrics || initialViewAppliedRef.current) {
      return
    }

    const nextZoom = clamp(initialViewState.zoom ?? 1, 1, 8)
    const worldWidth = worldWidthAtZoom(nextZoom)
    setView({
      zoom: nextZoom,
      offsetX: wrapOffsetX(initialViewState.offsetX ?? 0, worldWidth),
      offsetY: clamp(initialViewState.offsetY ?? 0, -size.height * 0.4, size.height * 0.4)
    })
    initialViewAppliedRef.current = true
  }, [baseProjectionMetrics, initialViewState, size.height, worldWidthAtZoom])

  useEffect(() => {
    if (!onViewStateChange || !size.width || !size.height) {
      return
    }

    const projection = buildProjection(view)
    const center = projection?.invert?.([size.width / 2, size.height / 2])
    if (!center) {
      return
    }

    onViewStateChange({
      zoom: view.zoom,
      offsetX: view.offsetX,
      offsetY: view.offsetY,
      centerLon: wrap180(center[0]),
      centerLat: center[1]
    })
  }, [buildProjection, onViewStateChange, size.height, size.width, view])

  const civilSampleTime = useMemo(() => new Date(Math.floor(nowTime.getTime() / 1000) * 1000), [nowTime])

  const dayNightSampleTime = useMemo(
    () => new Date(Math.floor(displayTime.getTime() / 5000) * 5000),
    [displayTime]
  )

  const nowSolarLongitude = useMemo(
    () => solarDeadlineLongitude(nowTime, targetMinutesOfDay, useApparentSolar),
    [nowTime, targetMinutesOfDay, useApparentSolar]
  )

  const deadlineSolarLongitude = useMemo(() => {
    if (!deadlineTime) {
      return null
    }

    return solarDeadlineLongitude(deadlineTime, targetMinutesOfDay, useApparentSolar)
  }, [deadlineTime, targetMinutesOfDay, useApparentSolar])

  const drawnNowSolarLongitude = useMemo(() => avoidSeamLongitude(nowSolarLongitude), [nowSolarLongitude])
  const drawnDeadlineSolarLongitude = useMemo(
    () => (deadlineSolarLongitude === null ? null : avoidSeamLongitude(deadlineSolarLongitude)),
    [deadlineSolarLongitude]
  )

  const civilBandsNow = useMemo(
    () => buildCivilBands(civilSampleTime, targetMinutesOfDay, civilGlowMinutes),
    [civilGlowMinutes, civilSampleTime, targetMinutesOfDay]
  )

  const civilBandsDeadline = useMemo(() => {
    if (!deadlineTime) {
      return []
    }

    return buildCivilBands(deadlineTime, targetMinutesOfDay, civilGlowMinutes)
  }, [civilGlowMinutes, deadlineTime, targetMinutesOfDay])

  const handleHover = useCallback(
    (clientX: number, clientY: number) => {
      const projection = buildProjection(viewRef.current)
      if (!projection || !projection.invert) {
        setHoverState(null)
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        setHoverState(null)
        return
      }

      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setHoverState(null)
        return
      }

      const inverted = projection.invert([x, y])
      if (!inverted) {
        setHoverState(null)
        return
      }

      const [lonRaw, lat] = inverted
      const lon = wrap180(lonRaw)
      const offsetHours = clamp(Math.round(lon / 15), -12, 14)
      const localMinutes = utcMinutesOfDay(displayTime) + offsetHours * 60
      const localClock = formatClock(localMinutes)
      const deltaToTarget = signedCircularMinuteDelta(targetMinutesOfDay, localMinutes)
      const targetClock = formatClock(targetMinutesOfDay)
      const deltaText = `${deltaToTarget >= 0 ? '+' : '-'}${Math.abs(Math.round(deltaToTarget))}m`
      const hoverLandmark = showLandmarks ? nearestLandmark(lon, lat, landmarks, viewRef.current.zoom) : null

      if (hoverLandmark) {
        setHoverState({
          x,
          y,
          landmarkId: hoverLandmark.id,
          readout: `cross candidate: ${hoverLandmark.name}`,
          detail: `${hoverLandmark.lat.toFixed(2)}°, ${hoverLandmark.lon.toFixed(2)}° · target ${targetClock}`
        })
        return
      }

      const zoneLabel = formatUtcOffsetFromHours(offsetHours)

      setHoverState({
        x,
        y,
        readout: `lon ${lon.toFixed(1)}° · lat ${lat.toFixed(1)}° · ${zoneLabel}`,
        detail: `local ${localClock} · target ${targetClock} (${deltaText}) · solar now ${nowSolarLongitude.toFixed(1)}°`
      })
    },
    [buildProjection, displayTime, landmarks, nowSolarLongitude, showLandmarks, targetMinutesOfDay]
  )

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag && event.pointerId === drag.pointerId) {
        const currentView = viewRef.current
        const worldWidth = worldWidthAtZoom(currentView.zoom)
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (!dragMovedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          dragMovedRef.current = true
        }

        setView({
          zoom: currentView.zoom,
          offsetX: wrapOffsetX(drag.baseOffsetX + dx, worldWidth),
          offsetY: clamp(drag.baseOffsetY + dy, -size.height * 0.4, size.height * 0.4)
        })
        return
      }

      if (!dragging) {
        handleHover(event.clientX, event.clientY)
      }
    }

    const stopDragging = (event: PointerEvent | null) => {
      if (!dragRef.current) {
        return
      }

      if (event !== null && dragRef.current.pointerId !== event.pointerId) {
        return
      }

      if (event && !dragMovedRef.current && onMapClick) {
        const projection = buildProjection(viewRef.current)
        const canvas = canvasRef.current
        if (projection && projection.invert && canvas) {
          const rect = canvas.getBoundingClientRect()
          const x = event.clientX - rect.left
          const y = event.clientY - rect.top
          if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
            const point = projection.invert([x, y])
            if (point) {
              onMapClick({ lon: wrap180(point[0]), lat: point[1] })
            }
          }
        }
      }

      dragRef.current = null
      setDragging(false)
    }

    const onPointerUp = (event: PointerEvent) => stopDragging(event)
    const onPointerCancel = (event: PointerEvent) => stopDragging(event)
    const onBlur = () => stopDragging(null)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('blur', onBlur)
    }
  }, [buildProjection, dragging, handleHover, onMapClick, size.height, worldWidthAtZoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width || !size.height) {
      return
    }

    const projection = buildProjection()
    if (!projection) {
      return
    }

    const worldWidth = worldWidthAtZoom(view.zoom)
    if (!worldWidth) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(size.width * dpr)
    canvas.height = Math.floor(size.height * dpr)
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const path = geoPath(projection, ctx)
    const wrapShifts = [-2, -1, 0, 1, 2]
    let terminatorComputeMsLocal = 0

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)

    const drawWrapped = (draw: () => void) => {
      for (const shift of wrapShifts) {
        ctx.save()
        ctx.translate(shift * worldWidth, 0)
        draw()
        ctx.restore()
      }
    }

    const theme =
      baseMapStyle === 'osm-light'
        ? {
            backgroundTop: '#cad8eb',
            backgroundBottom: '#a9bfd8',
            graticule: 'rgba(79, 120, 168, 0.2)',
            landFill: '#dce6d9',
            landStroke: 'rgba(87, 125, 156, 0.3)',
            nightShade: 'rgba(18, 29, 45, 0.32)',
            dayGlowA: 'rgba(255, 252, 208, 0.24)',
            dayGlowB: 'rgba(175, 220, 255, 0.2)'
          }
        : baseMapStyle === 'osm-dark'
          ? {
              backgroundTop: '#101721',
              backgroundBottom: '#0b1019',
              graticule: 'rgba(103, 143, 186, 0.18)',
              landFill: '#243248',
              landStroke: 'rgba(112, 160, 205, 0.28)',
              nightShade: 'rgba(0, 0, 0, 0.46)',
              dayGlowA: 'rgba(239, 250, 206, 0.2)',
              dayGlowB: 'rgba(112, 174, 231, 0.18)'
            }
          : {
              backgroundTop: '#071129',
              backgroundBottom: '#04060f',
              graticule: 'rgba(105, 191, 255, 0.12)',
              landFill: brightDayLighting ? '#27527e' : '#0f1a34',
              landStroke: brightDayLighting ? 'rgba(162, 222, 255, 0.26)' : 'rgba(119, 173, 255, 0.25)',
              nightShade: brightDayLighting ? 'rgba(4, 8, 16, 0.52)' : 'rgba(2, 4, 10, 0.5)',
              dayGlowA: 'rgba(255, 241, 162, 0.34)',
              dayGlowB: 'rgba(154, 212, 255, 0.28)'
            }

    if (brightDayLighting || baseMapStyle !== 'deadline-dark') {
      ctx.fillStyle = '#071129'
      ctx.fillRect(0, 0, size.width, size.height)

      const sunLon = subsolarLongitude(dayNightSampleTime, useApparentSolar)
      const sunLat = subsolarLatitude(dayNightSampleTime)
      drawWrapped(() => {
        const center = projection([sunLon, sunLat])
        if (!center) {
          return
        }

        const glow = ctx.createRadialGradient(
          center[0],
          center[1],
          20,
          center[0],
          center[1],
          Math.max(size.width, size.height) * 0.75
        )
        glow.addColorStop(0, theme.dayGlowA)
        glow.addColorStop(0.28, theme.dayGlowB)
        glow.addColorStop(0.58, 'rgba(49, 109, 178, 0.20)')
        glow.addColorStop(1, 'rgba(9, 18, 39, 0)')

        ctx.fillStyle = glow
        ctx.fillRect(0, 0, size.width, size.height)
      })

      const atmospheric = ctx.createLinearGradient(0, 0, 0, size.height)
      atmospheric.addColorStop(0, 'rgba(125, 203, 255, 0.12)')
      atmospheric.addColorStop(1, 'rgba(0, 0, 0, 0.08)')
      ctx.fillStyle = atmospheric
      ctx.fillRect(0, 0, size.width, size.height)
    } else {
      const gradient = ctx.createLinearGradient(0, 0, size.width, size.height)
      gradient.addColorStop(0, theme.backgroundTop)
      gradient.addColorStop(1, theme.backgroundBottom)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size.width, size.height)
    }

    drawWrapped(() => {
      const graticule = geoGraticule10()
      ctx.strokeStyle = theme.graticule
      ctx.lineWidth = 0.8
      ctx.beginPath()
      path(graticule)
      ctx.stroke()
    })

    if (showTimezones) {
      if (useTimezonePolygons && timezonePolygons.length > 0) {
        drawWrapped(() => {
          ctx.strokeStyle = 'rgba(110, 231, 255, 0.2)'
          ctx.lineWidth = 0.5
          for (const zoneFeature of timezonePolygons) {
            ctx.beginPath()
            path(zoneFeature.geometry)
            ctx.stroke()
          }

          for (const zoneFeature of timezonePolygons) {
            const intensityNow = civilIntensityForZone(
              zoneFeature.properties.zoneId,
              nowTime,
              targetMinutesOfDay,
              civilGlowMinutes
            )
            if (intensityNow !== null) {
              const opacity = 0.08 + intensityNow * 0.24
              ctx.fillStyle = `rgba(124, 255, 178, ${opacity.toFixed(3)})`
              ctx.beginPath()
              path(zoneFeature.geometry)
              ctx.fill()
            }

            if (deadlineTime) {
              const intensityDeadline = civilIntensityForZone(
                zoneFeature.properties.zoneId,
                deadlineTime,
                targetMinutesOfDay,
                civilGlowMinutes
              )

              if (intensityDeadline !== null) {
                ctx.strokeStyle = 'rgba(255, 195, 120, 0.35)'
                ctx.lineWidth = 1
                ctx.beginPath()
                path(zoneFeature.geometry)
                ctx.stroke()
              }
            }
          }
        })
      } else {
        drawWrapped(() => {
          for (const band of civilBandsNow) {
            const opacity = 0.08 + band.intensity * 0.22
            const fill = `rgba(124, 255, 178, ${opacity.toFixed(3)})`

            for (const segment of segmentBand(band.startLongitude, band.endLongitude)) {
              const left = projection([segment.start, 0])?.[0]
              const right = projection([segment.end, 0])?.[0]
              if (left === undefined || right === undefined) {
                continue
              }

              const x = Math.min(left, right)
              const width = Math.abs(right - left)
              ctx.fillStyle = fill
              ctx.fillRect(x, 0, width, size.height)
            }
          }

          for (const band of civilBandsDeadline) {
            for (const segment of segmentBand(band.startLongitude, band.endLongitude)) {
              const left = projection([segment.start, 0])?.[0]
              const right = projection([segment.end, 0])?.[0]
              if (left === undefined || right === undefined) {
                continue
              }

              const x = Math.min(left, right)
              const width = Math.abs(right - left)
              ctx.strokeStyle = 'rgba(255, 195, 120, 0.4)'
              ctx.lineWidth = 1
              ctx.strokeRect(x, 0, width, size.height)
            }
          }
        })
      }
    }

    if (world) {
      drawWrapped(() => {
        ctx.fillStyle = theme.landFill
        ctx.strokeStyle = theme.landStroke
        ctx.lineWidth = 0.7
        ctx.beginPath()
        path(world)
        ctx.fill()
        ctx.stroke()
      })
    }

    if (showDayNight) {
      drawWrapped(() => {
        const computeStart = performance.now()
        const nightPoints = buildNightPolygon(dayNightSampleTime, useApparentSolar).map((point) => [
          point.lon,
          point.lat
        ])
        const nightPolygon: Polygon = {
          type: 'Polygon',
          coordinates: [nightPoints]
        }

        ctx.fillStyle = theme.nightShade
        ctx.beginPath()
        path(nightPolygon)
        ctx.fill()

        const terminatorLine: LineString = {
          type: 'LineString',
          coordinates: buildTerminatorPolyline(dayNightSampleTime, useApparentSolar).map((point) => [
            point.lon,
            point.lat
          ])
        }

        ctx.strokeStyle = 'rgba(110, 231, 255, 0.88)'
        ctx.shadowColor = 'rgba(110, 231, 255, 0.4)'
        ctx.shadowBlur = 8
        ctx.lineWidth = 1.6
        ctx.beginPath()
        path(terminatorLine)
        ctx.stroke()
        ctx.shadowBlur = 0
        terminatorComputeMsLocal = performance.now() - computeStart
      })
    }

    if (showSolarTime) {
      drawWrapped(() => {
        const nowLine: LineString = {
          type: 'LineString',
          coordinates: [
            [drawnNowSolarLongitude, -90],
            [drawnNowSolarLongitude, 90]
          ]
        }

        ctx.strokeStyle = '#7cffb2'
        ctx.shadowColor = 'rgba(124, 255, 178, 0.82)'
        ctx.shadowBlur = 16
        ctx.lineWidth = 2.8
        ctx.beginPath()
        path(nowLine)
        ctx.stroke()
        ctx.shadowBlur = 0

        if (!reducedMotion) {
          for (let i = 0; i < 5; i += 1) {
            const phase = (((nowTime.getTime() / 3200 + i * 0.2) % 1) + 1) % 1
            const scanLat = -90 + phase * 180
            const scanXY = projection([drawnNowSolarLongitude, scanLat])
            if (!scanXY) {
              continue
            }

            ctx.fillStyle = i % 2 === 0 ? 'rgba(216, 255, 234, 0.94)' : 'rgba(110, 231, 255, 0.84)'
            ctx.beginPath()
            ctx.arc(scanXY[0], scanXY[1], 2.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        if (drawnDeadlineSolarLongitude !== null) {
          const deadlineLine: LineString = {
            type: 'LineString',
            coordinates: [
              [drawnDeadlineSolarLongitude, -90],
              [drawnDeadlineSolarLongitude, 90]
            ]
          }

          ctx.setLineDash([10, 8])
          ctx.strokeStyle = 'rgba(255, 198, 127, 0.82)'
          ctx.lineWidth = 2.1
          ctx.beginPath()
          path(deadlineLine)
          ctx.stroke()
          ctx.setLineDash([])
        }
      })
    }

    if (showLandmarks) {
      drawWrapped(() => {
        const maxVisible = view.zoom >= 3 ? 90 : view.zoom >= 1.6 ? 45 : 24
        for (const landmark of landmarks.slice(0, maxVisible)) {
          const xy = projection([landmark.lon, landmark.lat])
          if (!xy) {
            continue
          }

          const active = landmark.id === hoverState?.landmarkId
          ctx.fillStyle = active ? 'rgba(255, 224, 151, 0.95)' : 'rgba(255, 170, 110, 0.8)'
          ctx.beginPath()
          ctx.arc(xy[0], xy[1], active ? 2.9 : 1.8, 0, Math.PI * 2)
          ctx.fill()

          if (active) {
            ctx.strokeStyle = 'rgba(255, 196, 129, 0.72)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(xy[0], xy[1], 7.4, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      })
    }

    if (location) {
      drawWrapped(() => {
        const xy = projection([location.lon, location.lat])
        if (!xy) {
          return
        }

        ctx.fillStyle = '#6ee7ff'
        ctx.beginPath()
        ctx.arc(xy[0], xy[1], 4.5, 0, Math.PI * 2)
        ctx.fill()

        const pulse = reducedMotion ? 8 : 8 + ((nowTime.getTime() / 200) % 4)
        ctx.strokeStyle = 'rgba(110, 231, 255, 0.58)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(xy[0], xy[1], pulse, 0, Math.PI * 2)
        ctx.stroke()
      })
    }

    if (onPerf && showDayNight) {
      const now = performance.now()
      if (now - lastPerfPushRef.current >= 500) {
        lastPerfPushRef.current = now
        onPerf({
          terminatorComputeMs: Number(terminatorComputeMsLocal.toFixed(2))
        })
      }
    }
  }, [
    brightDayLighting,
    buildProjection,
    civilBandsDeadline,
    civilBandsNow,
    civilGlowMinutes,
    deadlineSolarLongitude,
    drawnDeadlineSolarLongitude,
    drawnNowSolarLongitude,
    deadlineTime,
    dayNightSampleTime,
    hoverState?.landmarkId,
    landmarks,
    location,
    nowSolarLongitude,
    nowTime,
    civilSampleTime,
    reducedMotion,
    showDayNight,
    showLandmarks,
    showSolarTime,
    showTimezones,
    size.height,
    size.width,
    targetMinutesOfDay,
    timezonePolygons,
    useApparentSolar,
    useTimezonePolygons,
    view.zoom,
    world,
    baseMapStyle,
    worldWidthAtZoom,
    onPerf
  ])

  const deadlineOffsetLabel =
    typeof deadlineOffsetMinutes === 'number'
      ? formatUtcOffsetFromMinutes(deadlineOffsetMinutes)
      : 'offset unresolved'

  return (
    <div
      className={`border-cyan-400/20 relative h-full min-h-[320px] select-none rounded-xl border bg-black/20 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      data-testid="map2d-view"
      ref={wrapperRef}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }

        const currentView = viewRef.current
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          baseOffsetX: currentView.offsetX,
          baseOffsetY: currentView.offsetY,
          pointerId: event.pointerId
        }
        dragMovedRef.current = false
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) {
          handleHover(event.clientX, event.clientY)
        }
      }}
      onPointerLeave={() => {
        if (!dragRef.current) {
          setHoverState(null)
        }
      }}
      onWheel={(event) => {
        event.preventDefault()

        const rect = event.currentTarget.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top

        setView((previous) => {
          const scaleDelta = Math.exp(-event.deltaY * 0.0015)
          const nextZoom = clamp(previous.zoom * scaleDelta, 1, 8)
          if (Math.abs(nextZoom - previous.zoom) < 1e-4) {
            return previous
          }

          const ratio = nextZoom / previous.zoom
          const worldWidth = worldWidthAtZoom(nextZoom)

          return {
            zoom: nextZoom,
            offsetX: wrapOffsetX(px - (px - previous.offsetX) * ratio, worldWidth),
            offsetY: clamp(py - (py - previous.offsetY) * ratio, -size.height * 0.4, size.height * 0.4)
          }
        })
      }}
      onDoubleClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top

        setView((previous) => {
          const nextZoom = clamp(previous.zoom * 1.35, 1, 8)
          const ratio = nextZoom / previous.zoom
          const worldWidth = worldWidthAtZoom(nextZoom)

          return {
            zoom: nextZoom,
            offsetX: wrapOffsetX(px - (px - previous.offsetX) * ratio, worldWidth),
            offsetY: clamp(py - (py - previous.offsetY) * ratio, -size.height * 0.4, size.height * 0.4)
          }
        })
      }}
    >
      <canvas className="h-full w-full rounded-xl" ref={canvasRef} />

      {hoverState ? (
        <div
          className="border-cyan-300/30 text-cyan-100 pointer-events-none absolute z-20 max-w-[min(340px,86vw)] rounded-md border bg-black/65 px-2 py-1 text-[11px] shadow-neon"
          data-testid="map2d-hover"
          style={{
            left: Math.min(size.width - 250, hoverState.x + 14),
            top: Math.min(size.height - 62, hoverState.y + 12)
          }}
        >
          <p className="text-cyan-50 font-mono">{hoverState.readout}</p>
          <p className="text-cyan-100/70">{hoverState.detail}</p>
        </div>
      ) : null}

      <div className="text-cyan-100/75 pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px]">
        <span>
          {hoverState?.readout ?? 'drag endlessly to wrap world · wheel to zoom · double click to zoom in'}
        </span>
        <span>{view.zoom.toFixed(2)}x</span>
      </div>

      {showInlineLegend ? (
        <div className="text-cyan-100/76 pointer-events-none absolute bottom-7 right-2 rounded bg-black/45 px-2 py-1 text-[10px]">
          mint = solar now · amber dash = solar at deadline · cyan curve = terminator
        </div>
      ) : null}

      {showStatusOverlay ? (
        <div className="bg-black/42 text-cyan-100/74 pointer-events-none absolute left-2 top-2 rounded px-2 py-1 text-[10px]">
          target {formatClock(targetMinutesOfDay)} in {deadlineZoneLabel} ({deadlineOffsetLabel})
          <br />
          solar now {nowSolarLongitude.toFixed(1)}°
          {deadlineSolarLongitude !== null ? ` · at deadline ${deadlineSolarLongitude.toFixed(1)}°` : ''}
        </div>
      ) : null}

      {showResetButton ? (
        <button
          type="button"
          className="btn-ghost absolute right-2 top-2 px-2 py-1 text-[11px]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            animateToView(defaultView(1))
          }}
        >
          reset view
        </button>
      ) : null}
    </div>
  )
}
