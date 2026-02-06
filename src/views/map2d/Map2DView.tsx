import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry, LineString, Polygon } from 'geojson'
import { buildCivilBands } from '@/features/civil/civilBands'
import { civilIntensityForZone, type TimezonePolygonFeature } from '@/features/civil/timezonePolygons'
import type { LocationPoint } from '@/features/deadline/types'
import { buildNightPolygon, buildTerminatorPolyline, solarDeadlineLongitude } from '@/features/solar/solarMath'
import { useElementSize } from '@/lib/useElementSize'
import type { Landmark } from '@/features/landmarks/types'

type GeoFeatureCollection = FeatureCollection<Geometry>

type Map2DViewProps = {
  time: Date
  targetMinutesOfDay: number
  showTimezones: boolean
  showSolarTime: boolean
  showDayNight: boolean
  useApparentSolar: boolean
  useTimezonePolygons: boolean
  timezonePolygons: TimezonePolygonFeature[]
  civilGlowMinutes: number
  location: LocationPoint | null
  landmarks: Landmark[]
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

export function Map2DView(props: Map2DViewProps) {
  const {
    time,
    targetMinutesOfDay,
    showTimezones,
    showSolarTime,
    showDayNight,
    useApparentSolar,
    useTimezonePolygons,
    timezonePolygons,
    civilGlowMinutes,
    location,
    landmarks
  } = props

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [world, setWorld] = useState<GeoFeatureCollection | null>(null)
  const [hoverReadout, setHoverReadout] = useState<string>('')
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

  const solarLongitude = useMemo(
    () => solarDeadlineLongitude(time, targetMinutesOfDay, useApparentSolar),
    [targetMinutesOfDay, time, useApparentSolar]
  )

  const civilBands = useMemo(
    () => buildCivilBands(time, targetMinutesOfDay, civilGlowMinutes),
    [civilGlowMinutes, targetMinutesOfDay, time]
  )

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

    const projection = geoEquirectangular().fitExtent(
      [
        [14, 10],
        [size.width - 14, size.height - 10]
      ],
      { type: 'Sphere' }
    )

    const path = geoPath(projection, ctx)

    const graticule = geoGraticule10()
    ctx.strokeStyle = 'rgba(105, 191, 255, 0.12)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    path(graticule)
    ctx.stroke()

    if (showTimezones) {
      if (useTimezonePolygons && timezonePolygons.length > 0) {
        ctx.strokeStyle = 'rgba(110, 231, 255, 0.18)'
        ctx.lineWidth = 0.5
        for (const zoneFeature of timezonePolygons) {
          ctx.beginPath()
          path(zoneFeature.geometry)
          ctx.stroke()
        }

        for (const zoneFeature of timezonePolygons) {
          const intensity = civilIntensityForZone(
            zoneFeature.properties.zoneId,
            time,
            targetMinutesOfDay,
            civilGlowMinutes
          )
          if (intensity === null) {
            continue
          }

          const opacity = 0.09 + intensity * 0.24
          ctx.fillStyle = `rgba(124, 255, 178, ${opacity.toFixed(3)})`
          ctx.beginPath()
          path(zoneFeature.geometry)
          ctx.fill()
        }
      } else {
        for (const band of civilBands) {
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
      }
    }

    if (showDayNight) {
      const nightPoints = buildNightPolygon(time, useApparentSolar).map((point) => [point.lon, point.lat])
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
        coordinates: buildTerminatorPolyline(time, useApparentSolar).map((point) => [point.lon, point.lat])
      }

      ctx.strokeStyle = 'rgba(110, 231, 255, 0.8)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      path(terminatorLine)
      ctx.stroke()
    }

    if (world) {
      ctx.fillStyle = '#0f1a34'
      ctx.strokeStyle = 'rgba(119, 173, 255, 0.25)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      path(world)
      ctx.fill()
      ctx.stroke()
    }

    if (showSolarTime) {
      const solarMeridian: LineString = {
        type: 'LineString',
        coordinates: [
          [solarLongitude, -90],
          [solarLongitude, 90]
        ]
      }

      ctx.strokeStyle = '#7cffb2'
      ctx.shadowColor = 'rgba(124, 255, 178, 0.6)'
      ctx.shadowBlur = 12
      ctx.lineWidth = 2
      ctx.beginPath()
      path(solarMeridian)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    if (location) {
      const xy = projection([location.lon, location.lat])
      if (xy) {
        ctx.fillStyle = '#6ee7ff'
        ctx.beginPath()
        ctx.arc(xy[0], xy[1], 4.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = 'rgba(110, 231, 255, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(xy[0], xy[1], 8, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const toDraw = landmarks.slice(0, 16)
    ctx.fillStyle = 'rgba(255, 170, 110, 0.65)'
    for (const landmark of toDraw) {
      const xy = projection([landmark.lon, landmark.lat])
      if (!xy) {
        continue
      }

      ctx.fillRect(xy[0] - 1, xy[1] - 1, 2, 2)
    }
  }, [
    civilBands,
    civilGlowMinutes,
    landmarks,
    location,
    showDayNight,
    showSolarTime,
    showTimezones,
    size.height,
    size.width,
    solarLongitude,
    targetMinutesOfDay,
    time,
    timezonePolygons,
    useApparentSolar,
    useTimezonePolygons,
    world
  ])

  return (
    <div
      className="relative h-full min-h-[320px] rounded-xl border border-cyan-400/20 bg-black/20"
      data-testid="map2d-view"
      ref={wrapperRef}
      onMouseMove={(event) => {
        const canvas = canvasRef.current
        if (!canvas || !size.width || !size.height) {
          return
        }

        const projection = geoEquirectangular().fitExtent(
          [
            [14, 10],
            [size.width - 14, size.height - 10]
          ],
          { type: 'Sphere' }
        )

        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        if (!projection.invert) {
          return
        }

        const inverted = projection.invert([x, y])
        if (!inverted) {
          setHoverReadout('')
          return
        }

        const [lon, lat] = inverted
        setHoverReadout(`lon ${lon.toFixed(1)} | lat ${lat.toFixed(1)} | solar line ${solarLongitude.toFixed(1)}°`)
      }}
    >
      <canvas className="h-full w-full rounded-xl" ref={canvasRef} />
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-cyan-100/75">
        <span>{hoverReadout || 'hover map for coordinates'}</span>
        <span>projection: equirectangular</span>
      </div>
    </div>
  )
}
