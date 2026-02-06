import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { AmbientLight, DirectionalLight } from 'three'
import type { LocationPoint } from '@/features/deadline/types'
import {
  buildTerminatorPolyline,
  solarDeadlineLongitude,
  subsolarLatitude,
  subsolarLongitude,
  sunDirectionEcef
} from '@/features/solar/solarMath'
import { useElementSize } from '@/lib/useElementSize'

type Globe3DViewProps = {
  time: Date
  targetMinutesOfDay: number
  showSolarTime: boolean
  showDayNight: boolean
  useApparentSolar: boolean
  location?: LocationPoint | null
}

type PathDatum = {
  id: 'solar' | 'terminator'
  points: Array<{ lat: number; lng: number; altitude?: number }>
  color: string
}

type MarkerDatum = {
  id: string
  lat: number
  lng: number
  altitude: number
  color: string
  radius: number
  label: string
}

function buildMeridianPoints(lng: number) {
  const points: Array<{ lat: number; lng: number; altitude?: number }> = []
  for (let lat = -90; lat <= 90; lat += 2) {
    points.push({ lat, lng, altitude: 0.002 })
  }

  return points
}

export default function Globe3DView({
  time,
  targetMinutesOfDay,
  showSolarTime,
  showDayNight,
  useApparentSolar,
  location
}: Globe3DViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [countries, setCountries] = useState<Array<Feature<Geometry>>>([])
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

        const worldFeatures = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry>
        setCountries(worldFeatures.features)
      })
      .catch(() => {
        if (active) {
          setCountries([])
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

  const pathsData = useMemo<PathDatum[]>(() => {
    const paths: PathDatum[] = []

    if (showSolarTime) {
      paths.push({
        id: 'solar',
        points: buildMeridianPoints(solarLongitude),
        color: '#7cffb2'
      })
    }

    if (showDayNight) {
      paths.push({
        id: 'terminator',
        points: buildTerminatorPolyline(time, useApparentSolar).map((point) => ({
          lat: point.lat,
          lng: point.lon,
          altitude: 0.002
        })),
        color: '#6ee7ff'
      })
    }

    return paths
  }, [showDayNight, showSolarTime, solarLongitude, time, useApparentSolar])

  const markerData = useMemo<MarkerDatum[]>(() => {
    const subsolarLat = subsolarLatitude(time)
    const subsolarLon = subsolarLongitude(time, useApparentSolar)

    const markers: MarkerDatum[] = [
      {
        id: 'subsolar',
        lat: subsolarLat,
        lng: subsolarLon,
        altitude: 0.02,
        color: '#ffe38a',
        radius: 0.25,
        label: `subsolar point (${subsolarLat.toFixed(1)}°, ${subsolarLon.toFixed(1)}°)`
      }
    ]

    if (location) {
      markers.push({
        id: 'location',
        lat: location.lat,
        lng: location.lon,
        altitude: 0.016,
        color: '#6ee7ff',
        radius: 0.2,
        label: `you: ${location.label}`
      })
    }

    return markers
  }, [location, time, useApparentSolar])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) {
      return
    }

    const controls = globe.controls()
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.8
    controls.enablePan = false

    const [sunX, sunY, sunZ] = sunDirectionEcef(time, useApparentSolar)
    const ambient = new AmbientLight('#7caeff', showDayNight ? 0.22 : 0.58)
    const directional = new DirectionalLight('#ffffff', showDayNight ? 1.2 : 0.16)
    directional.position.set(sunX * 600, sunY * 600, sunZ * 600)

    globe.lights([ambient, directional])
  }, [showDayNight, time, useApparentSolar])

  return (
    <div className="h-full min-h-[320px] rounded-xl border border-cyan-400/20 bg-black/30" data-testid="globe3d-view" ref={wrapperRef}>
      {size.width > 0 && size.height > 0 ? (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0, 0, 0, 0)"
          globeImageUrl="/textures/earth-dark.jpg"
          showAtmosphere={showDayNight}
          atmosphereColor="#6ee7ff"
          atmosphereAltitude={0.16}
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => 'rgba(12, 34, 74, 0.92)'}
          polygonSideColor={() => 'rgba(7, 18, 38, 0.45)'}
          polygonStrokeColor={() => 'rgba(111, 170, 255, 0.36)'}
          polygonAltitude={0.0035}
          polygonCapCurvatureResolution={3}
          pathsData={pathsData}
          pathPoints="points"
          pathPointLat="lat"
          pathPointLng="lng"
          pathPointAlt="altitude"
          pathColor="color"
          pathStroke={(path) => ((path as PathDatum).id === 'solar' ? 0.42 : 0.28)}
          pathDashLength={(path) => ((path as PathDatum).id === 'terminator' ? 0.72 : 1)}
          pathDashGap={(path) => ((path as PathDatum).id === 'terminator' ? 0.35 : 0)}
          pathDashAnimateTime={(path) => ((path as PathDatum).id === 'terminator' ? 12_000 : 0)}
          pointsData={markerData}
          pointLat="lat"
          pointLng="lng"
          pointAltitude="altitude"
          pointColor="color"
          pointRadius="radius"
          pointLabel="label"
          onGlobeReady={() => {
            globeRef.current?.pointOfView({ lat: 18, lng: 0, altitude: 2.15 }, 0)
          }}
        />
      ) : null}
      <div className="pointer-events-none -mt-8 px-3 pb-2 text-[11px] text-cyan-100/70">
        drag to rotate · scroll to zoom · double click to re-center
      </div>
    </div>
  )
}
