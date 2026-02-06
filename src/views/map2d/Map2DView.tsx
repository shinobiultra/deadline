import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry, LineString, Polygon } from 'geojson'
import { buildCivilBands } from '@/features/civil/civilBands'
import { civilIntensityForZone, type TimezonePolygonFeature } from '@/features/civil/timezonePolygons'
import type { LocationPoint } from '@/features/deadline/types'
import {
  buildNightPolygon,
  buildTerminatorPolyline,
  solarDeadlineLongitude
} from '@/features/solar/solarMath'
import { clamp, wrap180 } from '@/lib/geo'
import { useElementSize } from '@/lib/useElementSize'
import type { Landmark } from '@/features/landmarks/types'

type GeoFeatureCollection = FeatureCollection<Geometry>

type ViewState = {
  zoom: number
  offsetX: number
  offsetY: number
}

type Map2DViewProps = {
  nowTime: Date
  displayTime: Date
  deadlineTime: Date | null
  targetMinutesOfDay: number
  showTimezones: boolean
  showSolarTime: boolean
  showDayNight: boolean
  showLandmarks: boolean
  useApparentSolar: boolean
  useTimezonePolygons: boolean
  timezonePolygons: TimezonePolygonFeature[]
  civilGlowMinutes: number
  location: LocationPoint | null
  landmarks: Landmark[]
  reducedMotion: boolean
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

export function Map2DView(props: Map2DViewProps) {
  const {
    nowTime,
    displayTime,
    deadlineTime,
    targetMinutesOfDay,
    showTimezones,
    showSolarTime,
    showDayNight,
    showLandmarks,
    useApparentSolar,
    useTimezonePolygons,
    timezonePolygons,
    civilGlowMinutes,
    location,
    landmarks,
    reducedMotion
  } = props

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    baseOffsetX: number
    baseOffsetY: number
    pointerId: number
  } | null>(null)
  const animationRef = useRef<number | null>(null)

  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [world, setWorld] = useState<GeoFeatureCollection | null>(null)
  const [hoverReadout, setHoverReadout] = useState<string>('')
  const [view, setView] = useState<ViewState>({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [dragging, setDragging] = useState(false)

  const size = useElementSize(container)

  useEffect(() => {
    setContainer(wrapperRef.current)
  }, [])

  useEffect(() => {
    let active = true

    fetch('/data/world-110m.topo.json')
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

  const buildProjection = useCallback(
    (customView: ViewState = view) => {
      const projection = geoEquirectangular().fitExtent(
        [
          [14, 10],
          [size.width - 14, size.height - 10]
        ],
        { type: 'Sphere' }
      )

      const baseScale = projection.scale()
      const [tx, ty] = projection.translate()
      projection.scale(baseScale * customView.zoom)
      projection.translate([tx + customView.offsetX, ty + customView.offsetY])
      return projection
    },
    [size.height, size.width, view]
  )

  const defaultView = useCallback(
    (zoom: number): ViewState => {
      if (!size.width || !size.height) {
        return { zoom, offsetX: 0, offsetY: 0 }
      }

      const projection = geoEquirectangular().fitExtent(
        [
          [14, 10],
          [size.width - 14, size.height - 10]
        ],
        { type: 'Sphere' }
      )
      const worldWidth = 2 * Math.PI * projection.scale() * zoom
      const offsetX = location ? -(location.lon / 360) * worldWidth : 0

      return {
        zoom,
        offsetX,
        offsetY: 0
      }
    },
    [location, size.height, size.width]
  )

  const animateToView = useCallback((nextView: ViewState) => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const start = performance.now()
    const from = view
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
  }, [view])

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

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

  const civilBandsNow = useMemo(
    () => buildCivilBands(nowTime, targetMinutesOfDay, civilGlowMinutes),
    [civilGlowMinutes, nowTime, targetMinutesOfDay]
  )

  const civilBandsDeadline = useMemo(() => {
    if (!deadlineTime) {
      return []
    }

    return buildCivilBands(deadlineTime, targetMinutesOfDay, civilGlowMinutes)
  }, [civilGlowMinutes, deadlineTime, targetMinutesOfDay])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width || !size.height) {
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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)

    const gradient = ctx.createLinearGradient(0, 0, size.width, size.height)
    gradient.addColorStop(0, '#06101f')
    gradient.addColorStop(1, '#04060f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size.width, size.height)

    const projection = buildProjection()
    const worldWidth = 2 * Math.PI * projection.scale()
    const path = geoPath(projection, ctx)

    const wrapShifts = [-2, -1, 0, 1, 2]

    const drawWrapped = (draw: () => void) => {
      for (const shift of wrapShifts) {
        ctx.save()
        ctx.translate(shift * worldWidth, 0)
        draw()
        ctx.restore()
      }
    }

    drawWrapped(() => {
      const graticule = geoGraticule10()
      ctx.strokeStyle = 'rgba(105, 191, 255, 0.12)'
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

    if (showDayNight) {
      drawWrapped(() => {
        const nightPoints = buildNightPolygon(displayTime, useApparentSolar).map((point) => [point.lon, point.lat])
        const nightPolygon: Polygon = {
          type: 'Polygon',
          coordinates: [nightPoints]
        }

        ctx.fillStyle = 'rgba(2, 4, 10, 0.5)'
        ctx.beginPath()
        path(nightPolygon)
        ctx.fill()

        const terminatorLine: LineString = {
          type: 'LineString',
          coordinates: buildTerminatorPolyline(displayTime, useApparentSolar).map((point) => [point.lon, point.lat])
        }

        ctx.strokeStyle = 'rgba(110, 231, 255, 0.8)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        path(terminatorLine)
        ctx.stroke()
      })
    }

    if (world) {
      drawWrapped(() => {
        ctx.fillStyle = '#0f1a34'
        ctx.strokeStyle = 'rgba(119, 173, 255, 0.25)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        path(world)
        ctx.fill()
        ctx.stroke()
      })
    }

    if (showSolarTime) {
      drawWrapped(() => {
        const nowLine: LineString = {
          type: 'LineString',
          coordinates: [
            [nowSolarLongitude, -90],
            [nowSolarLongitude, 90]
          ]
        }

        ctx.strokeStyle = '#7cffb2'
        ctx.shadowColor = 'rgba(124, 255, 178, 0.8)'
        ctx.shadowBlur = 14
        ctx.lineWidth = 2.4
        ctx.beginPath()
        path(nowLine)
        ctx.stroke()
        ctx.shadowBlur = 0

        const scanPhase = (nowTime.getTime() / 7000) % 1
        const scanLat = -90 + scanPhase * 180
        const scanXY = projection([nowSolarLongitude, scanLat])
        if (scanXY) {
          ctx.fillStyle = '#d7ffe9'
          ctx.beginPath()
          ctx.arc(scanXY[0], scanXY[1], 3.2, 0, Math.PI * 2)
          ctx.fill()
        }

        if (deadlineSolarLongitude !== null) {
          const deadlineLine: LineString = {
            type: 'LineString',
            coordinates: [
              [deadlineSolarLongitude, -90],
              [deadlineSolarLongitude, 90]
            ]
          }

          ctx.setLineDash([8, 8])
          ctx.strokeStyle = 'rgba(255, 198, 127, 0.7)'
          ctx.lineWidth = 1.8
          ctx.beginPath()
          path(deadlineLine)
          ctx.stroke()
          ctx.setLineDash([])
        }
      })
    }

    if (showLandmarks) {
      drawWrapped(() => {
        const toDraw = landmarks.slice(0, 30)
        ctx.fillStyle = 'rgba(255, 170, 110, 0.75)'
        for (const landmark of toDraw) {
          const xy = projection([landmark.lon, landmark.lat])
          if (!xy) {
            continue
          }
          ctx.fillRect(xy[0] - 1.2, xy[1] - 1.2, 2.4, 2.4)
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

        ctx.strokeStyle = 'rgba(110, 231, 255, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(xy[0], xy[1], 8, 0, Math.PI * 2)
        ctx.stroke()
      })
    }
  }, [
    buildProjection,
    civilBandsDeadline,
    civilBandsNow,
    civilGlowMinutes,
    deadlineSolarLongitude,
    deadlineTime,
    displayTime,
    landmarks,
    location,
    nowSolarLongitude,
    nowTime,
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
    world
  ])

  return (
    <div
      className={`relative h-full min-h-[320px] select-none rounded-xl border border-cyan-400/20 bg-black/20 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      data-testid="map2d-view"
      ref={wrapperRef}
      onPointerDown={(event) => {
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          baseOffsetX: view.offsetX,
          baseOffsetY: view.offsetY,
          pointerId: event.pointerId
        }
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const projection = size.width && size.height ? buildProjection() : null

        if (dragRef.current) {
          const dx = event.clientX - dragRef.current.startX
          const dy = event.clientY - dragRef.current.startY
          setView((previous) => ({
            ...previous,
            offsetX: dragRef.current!.baseOffsetX + dx,
            offsetY: dragRef.current!.baseOffsetY + dy
          }))
          return
        }

        if (!projection || !projection.invert) {
          return
        }

        const canvas = canvasRef.current
        if (!canvas) {
          return
        }

        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const inverted = projection.invert([x, y])
        if (!inverted) {
          setHoverReadout('')
          return
        }

        const [lon, lat] = inverted
        setHoverReadout(`lon ${wrap180(lon).toFixed(1)} | lat ${lat.toFixed(1)} | solar now ${nowSolarLongitude.toFixed(1)}°`)
      }}
      onPointerUp={(event) => {
        if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
          dragRef.current = null
          setDragging(false)
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={(event) => {
        if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
          dragRef.current = null
          setDragging(false)
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onWheel={(event) => {
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        const px = event.clientX - rect.left
        const py = event.clientY - rect.top

        const scaleDelta = Math.exp(-event.deltaY * 0.0015)
        const nextZoom = clamp(view.zoom * scaleDelta, 1, 8)

        if (Math.abs(nextZoom - view.zoom) < 1e-4) {
          return
        }

        const ratio = nextZoom / view.zoom
        setView((previous) => ({
          zoom: nextZoom,
          offsetX: px - (px - previous.offsetX) * ratio,
          offsetY: py - (py - previous.offsetY) * ratio
        }))
      }}
      onDoubleClick={() => {
        setView((previous) => ({
          ...previous,
          zoom: clamp(previous.zoom * 1.35, 1, 8)
        }))
      }}
    >
      <canvas className="h-full w-full rounded-xl" ref={canvasRef} />
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-cyan-100/75">
        <span>{hoverReadout || 'drag endlessly to wrap world · wheel to zoom · double click to zoom in'}</span>
        <span>{view.zoom.toFixed(2)}x</span>
      </div>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/35 px-2 py-1 text-[10px] text-cyan-100/70">
        solar now {nowSolarLongitude.toFixed(1)}°
        {deadlineSolarLongitude !== null ? ` · at deadline ${deadlineSolarLongitude.toFixed(1)}°` : ''}
      </div>
      <button
        type="button"
        className="btn-ghost absolute right-2 top-2 px-2 py-1 text-[11px]"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          const next = defaultView(1)
          animateToView(next)
        }}
      >
        reset view
      </button>
    </div>
  )
}
