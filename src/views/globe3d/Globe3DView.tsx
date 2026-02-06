import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { AmbientLight, DirectionalLight, Raycaster, Vector2 } from 'three'
import type { LocationPoint } from '@/features/deadline/types'
import {
  buildTerminatorPolyline,
  solarDeadlineLongitude,
  subsolarLatitude,
  subsolarLongitude,
  sunDirectionEcef
} from '@/features/solar/solarMath'
import { assetUrl } from '@/lib/assets'
import { useElementSize } from '@/lib/useElementSize'

type Globe3DViewProps = {
  nowTime: Date
  displayTime: Date
  deadlineTime: Date | null
  targetMinutesOfDay: number
  targetClockLabel: string
  deadlineZoneLabel: string
  deadlineOffsetMinutes?: number
  showSolarTime: boolean
  showDayNight: boolean
  showLandmarks: boolean
  useApparentSolar: boolean
  reducedMotion: boolean
  captureMode?: boolean
  location?: LocationPoint | null
  landmarks: Array<{ id: string; name: string; lat: number; lon: number }>
}

type PathDatum = {
  id: 'solar-now-core' | 'solar-now-glow' | 'solar-now-beam' | 'solar-deadline' | 'terminator'
  kind: 'solar-now' | 'solar-deadline' | 'terminator'
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

type RingDatum = {
  id: string
  lat: number
  lng: number
  color: string[]
  maxRadius: number
  propagationSpeed: number
  repeatPeriod: number
}

type LabelDatum = {
  id: string
  lat: number
  lng: number
  text: string
  color: string
  altitude: number
  size: number
}

type ScreenPathState = {
  now: string
  deadline: string | null
}

type InteractiveGlobeMethods = GlobeMethods & {
  scene: () => { children: Array<unknown> }
  camera: () => {
    position: { clone: () => unknown }
  }
  renderer: () => {
    domElement: HTMLCanvasElement
  }
  toGeoCoords?: (point: { x: number; y: number; z: number }) => { lat: number; lng: number } | null
  pointOfView: (
    point?: {
      lat?: number
      lng?: number
      altitude?: number
    } | null,
    ms?: number
  ) => { lat: number; lng: number; altitude: number }
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function signedCircularMinuteDelta(targetMinutes: number, localMinutes: number): number {
  return ((((targetMinutes - localMinutes + 720) % 1440) + 1440) % 1440) - 720
}

function buildMeridianPoints(lng: number, altitude = 0.028) {
  const points: Array<{ lat: number; lng: number; altitude?: number }> = []
  for (let lat = -90; lat <= 90; lat += 1.5) {
    points.push({ lat, lng, altitude })
  }

  return points
}

function formatUtcOffset(minutes: number | undefined): string {
  if (minutes === undefined) {
    return 'offset unresolved'
  }

  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hour = Math.floor(abs / 60)
  const minute = abs % 60

  if (minute === 0) {
    return `UTC${sign}${String(hour).padStart(2, '0')}`
  }

  return `UTC${sign}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export default function Globe3DView({
  nowTime,
  displayTime,
  deadlineTime,
  targetMinutesOfDay,
  targetClockLabel,
  deadlineZoneLabel,
  deadlineOffsetMinutes,
  showSolarTime,
  showDayNight,
  showLandmarks,
  useApparentSolar,
  reducedMotion,
  captureMode = false,
  location,
  landmarks
}: Globe3DViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [countries, setCountries] = useState<Array<Feature<Geometry>>>([])
  const [hoverReadout, setHoverReadout] = useState('')
  const [screenPaths, setScreenPaths] = useState<ScreenPathState>({ now: '', deadline: null })
  const [globeReady, setGlobeReady] = useState(false)
  const [manualOrbitSeen, setManualOrbitSeen] = useState(false)
  const size = useElementSize(container)
  const raycasterRef = useRef(new Raycaster())
  const mouseRef = useRef(new Vector2())

  useEffect(() => {
    setContainer(wrapperRef.current)
  }, [])

  useEffect(() => {
    if (!captureMode) {
      return
    }

    const bridge = window as Window & {
      __deadlineCaptureSetGlobeView?: (lat: number, lng: number, altitude?: number) => void
    }

    bridge.__deadlineCaptureSetGlobeView = (lat: number, lng: number, altitude = 2.1) => {
      globeRef.current?.pointOfView({ lat, lng, altitude }, 0)
    }

    return () => {
      delete bridge.__deadlineCaptureSetGlobeView
    }
  }, [captureMode])

  useEffect(() => {
    let active = true

    fetch(assetUrl('data/world-110m.topo.json'))
      .then((response) => response.json())
      .then((topology) => {
        if (!active) {
          return
        }

        const worldFeatures = feature(
          topology,
          topology.objects.countries
        ) as unknown as FeatureCollection<Geometry>
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

  const nowSolarLongitudeRef = useRef(nowSolarLongitude)
  const deadlineSolarLongitudeRef = useRef(deadlineSolarLongitude)

  useEffect(() => {
    nowSolarLongitudeRef.current = nowSolarLongitude
  }, [nowSolarLongitude])

  useEffect(() => {
    deadlineSolarLongitudeRef.current = deadlineSolarLongitude
  }, [deadlineSolarLongitude])

  const lightingSampleTime = useMemo(
    () => new Date(Math.floor(displayTime.getTime() / 1000) * 1000),
    [displayTime]
  )

  const terminatorSampleTime = useMemo(
    () => new Date(Math.floor(displayTime.getTime() / 5000) * 5000),
    [displayTime]
  )

  const pathsData = useMemo<PathDatum[]>(() => {
    const paths: PathDatum[] = []

    if (showSolarTime) {
      paths.push({
        id: 'solar-now-glow',
        kind: 'solar-now',
        points: buildMeridianPoints(nowSolarLongitude, 0.03),
        color: 'rgba(110, 231, 255, 0.52)'
      })

      paths.push({
        id: 'solar-now-core',
        kind: 'solar-now',
        points: buildMeridianPoints(nowSolarLongitude, 0.036),
        color: '#7cffb2'
      })

      paths.push({
        id: 'solar-now-beam',
        kind: 'solar-now',
        points: buildMeridianPoints(nowSolarLongitude, 0.11),
        color: 'rgba(255, 124, 214, 0.64)'
      })

      if (deadlineSolarLongitude !== null) {
        paths.push({
          id: 'solar-deadline',
          kind: 'solar-deadline',
          points: buildMeridianPoints(deadlineSolarLongitude, 0.022),
          color: 'rgba(255, 194, 112, 0.95)'
        })
      }
    }

    if (showDayNight) {
      paths.push({
        id: 'terminator',
        kind: 'terminator',
        points: buildTerminatorPolyline(terminatorSampleTime, useApparentSolar).map((point) => ({
          lat: point.lat,
          lng: point.lon,
          altitude: 0.009
        })),
        color: '#6ee7ff'
      })
    }

    return paths
  }, [
    deadlineSolarLongitude,
    nowSolarLongitude,
    showDayNight,
    showSolarTime,
    terminatorSampleTime,
    useApparentSolar
  ])

  const ringData = useMemo<RingDatum[]>(() => {
    if (!showSolarTime || reducedMotion) {
      return []
    }

    const rings: RingDatum[] = []
    for (let lat = -72; lat <= 72; lat += 18) {
      rings.push({
        id: `ring-${lat}`,
        lat,
        lng: nowSolarLongitude,
        color: ['rgba(110, 231, 255, 0.42)', 'rgba(124, 255, 178, 0.16)', 'rgba(255, 120, 220, 0.05)'],
        maxRadius: 3.3,
        propagationSpeed: 0.64,
        repeatPeriod: 1100 + Math.abs(lat) * 12
      })
    }

    return rings
  }, [nowSolarLongitude, reducedMotion, showSolarTime])

  const markerData = useMemo<MarkerDatum[]>(() => {
    const subsolarLat = subsolarLatitude(lightingSampleTime)
    const subsolarLon = subsolarLongitude(lightingSampleTime, useApparentSolar)

    const markers: MarkerDatum[] = [
      {
        id: 'subsolar',
        lat: subsolarLat,
        lng: subsolarLon,
        altitude: 0.034,
        color: '#ffe38a',
        radius: 0.23,
        label: `subsolar point (${subsolarLat.toFixed(1)}°, ${subsolarLon.toFixed(1)}°)`
      }
    ]

    if (location) {
      markers.push({
        id: 'location',
        lat: location.lat,
        lng: location.lon,
        altitude: 0.025,
        color: '#6ee7ff',
        radius: 0.2,
        label: `you: ${location.label}`
      })
    }

    if (showLandmarks) {
      for (const landmark of landmarks.slice(0, 30)) {
        markers.push({
          id: landmark.id,
          lat: landmark.lat,
          lng: landmark.lon,
          altitude: 0.009,
          color: 'rgba(255, 158, 97, 0.82)',
          radius: 0.096,
          label: landmark.name
        })
      }
    }

    return markers
  }, [landmarks, lightingSampleTime, location, showLandmarks, useApparentSolar])

  const labelsData = useMemo<LabelDatum[]>(() => {
    const labels: LabelDatum[] = [
      {
        id: 'label-now',
        lat: -48,
        lng: nowSolarLongitude,
        text: 'solar now',
        color: '#7cffb2',
        altitude: 0.055,
        size: 0.54
      }
    ]

    if (deadlineSolarLongitude !== null) {
      labels.push({
        id: 'label-deadline',
        lat: 34,
        lng: deadlineSolarLongitude,
        text: 'solar at deadline',
        color: '#ffcb97',
        altitude: 0.045,
        size: 0.45
      })
    }

    return labels
  }, [deadlineSolarLongitude, nowSolarLongitude])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !globeReady) {
      return
    }

    const controls = globe.controls()
    controls.enableDamping = !captureMode
    controls.dampingFactor = captureMode ? 0 : 0.08
    controls.rotateSpeed = 0.66
    controls.zoomSpeed = 0.82
    controls.enablePan = false
    controls.autoRotate = !captureMode && !reducedMotion && !manualOrbitSeen
    controls.autoRotateSpeed = 0.27
  }, [captureMode, globeReady, manualOrbitSeen, reducedMotion])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !globeReady) {
      return
    }

    const [sunX, sunY, sunZ] = sunDirectionEcef(lightingSampleTime, useApparentSolar)
    const ambient = new AmbientLight('#7caeff', showDayNight ? 0.26 : 0.52)
    const directional = new DirectionalLight('#ffffff', showDayNight ? 1.6 : 0.24)
    directional.position.set(sunX * 620, sunY * 620, sunZ * 620)

    globe.lights([ambient, directional])
  }, [globeReady, lightingSampleTime, showDayNight, useApparentSolar])

  useEffect(() => {
    const globe = globeRef.current as
      | (GlobeMethods & {
          getScreenCoords?: (lat: number, lng: number, altitude?: number) => { x: number; y: number } | null
        })
      | undefined

    if (!globeReady || !showSolarTime || !globe || !globe.getScreenCoords) {
      setScreenPaths({ now: '', deadline: null })
      return
    }

    const buildPath = (longitude: number) => {
      const points: Array<[number, number]> = []
      for (let lat = -86; lat <= 86; lat += 3) {
        const screen = globe.getScreenCoords?.(lat, longitude, 0.14)
        if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
          continue
        }
        points.push([screen.x, screen.y])
      }

      if (points.length < 2) {
        return ''
      }

      return points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`)
        .join(' ')
    }

    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const targetFps = reducedMotion ? 20 : coarsePointer ? 30 : 60
    const frameBudgetMs = 1000 / targetFps
    let lastCommit = 0

    const updatePaths = () => {
      const nowPath = buildPath(nowSolarLongitudeRef.current)
      const deadlineLon = deadlineSolarLongitudeRef.current
      const deadlinePath = deadlineLon === null ? null : buildPath(deadlineLon)
      setScreenPaths((previous) => {
        if (previous.now === nowPath && previous.deadline === deadlinePath) {
          return previous
        }

        return { now: nowPath, deadline: deadlinePath }
      })
    }

    let rafId = 0
    const tick = (frameNow: number) => {
      if (frameNow - lastCommit >= frameBudgetMs) {
        lastCommit = frameNow
        updatePaths()
      }
      rafId = requestAnimationFrame(tick)
    }

    updatePaths()
    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)
  }, [globeReady, reducedMotion, showSolarTime, size.height, size.width])

  return (
    <div
      className="border-cyan-400/20 relative h-full min-h-[320px] rounded-xl border bg-black/30"
      data-testid="globe3d-view"
      data-globe-ready={globeReady ? '1' : '0'}
      data-world-ready={countries.length > 0 ? '1' : '0'}
      ref={wrapperRef}
      onPointerDownCapture={(event) => {
        if (event.target instanceof HTMLCanvasElement) {
          setManualOrbitSeen(true)
        }
      }}
      onWheelCapture={(event) => {
        const globe = globeRef.current as InteractiveGlobeMethods | undefined
        if (!globeReady || !globe) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        setManualOrbitSeen(true)

        const renderer = globe.renderer?.()
        const camera = globe.camera?.()
        const scene = globe.scene?.()
        const currentView = globe.pointOfView()
        if (!renderer || !camera || !scene || !currentView) {
          return
        }

        const rect = renderer.domElement.getBoundingClientRect()
        const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
        const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1
        mouseRef.current.set(nx, ny)
        raycasterRef.current.setFromCamera(mouseRef.current, camera as never)

        const intersects = raycasterRef.current.intersectObjects(scene.children as never, true)
        const hit = intersects.find((entry) => entry.point)
        const geoHit = hit?.point && globe.toGeoCoords ? globe.toGeoCoords(hit.point) : null

        const zoomScale = Math.exp(event.deltaY * 0.00135)
        const nextAltitude = Math.max(0.72, Math.min(3.9, currentView.altitude * zoomScale))

        if (geoHit) {
          const approachFactor = event.deltaY < 0 ? 0.2 : 0.08
          const nextLat = currentView.lat + (geoHit.lat - currentView.lat) * approachFactor
          const nextLng = currentView.lng + (geoHit.lng - currentView.lng) * approachFactor
          globe.pointOfView(
            {
              lat: nextLat,
              lng: nextLng,
              altitude: nextAltitude
            },
            0
          )
          return
        }

        globe.pointOfView(
          {
            altitude: nextAltitude
          },
          0
        )
      }}
    >
      {size.width > 0 && size.height > 0 ? (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0, 0, 0, 0)"
          globeImageUrl={assetUrl('textures/earth-dark.jpg')}
          showAtmosphere={showDayNight}
          atmosphereColor="#6ee7ff"
          atmosphereAltitude={0.16}
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => 'rgba(38, 78, 124, 0.34)'}
          polygonSideColor={() => 'rgba(17, 40, 66, 0.42)'}
          polygonStrokeColor={() => 'rgba(112, 196, 255, 0.38)'}
          polygonAltitude={0.0042}
          polygonCapCurvatureResolution={3}
          onPolygonHover={(polygon) => {
            if (!polygon) {
              setHoverReadout('')
              return
            }

            setHoverReadout('country hovered · line drift nominal')
          }}
          pathsData={pathsData}
          pathPoints="points"
          pathPointLat="lat"
          pathPointLng="lng"
          pathPointAlt="altitude"
          pathColor="color"
          pathStroke={(path) => {
            const id = (path as PathDatum).id
            if (id === 'solar-now-glow') {
              return 0.86
            }
            if (id === 'solar-now-core') {
              return 0.54
            }
            if (id === 'solar-now-beam') {
              return 0.34
            }
            if (id === 'solar-deadline') {
              return 0.5
            }
            return 0.3
          }}
          pathDashLength={(path) => {
            const id = (path as PathDatum).id
            if (id === 'solar-deadline') return 0.78
            if (id === 'solar-now-beam') return 0.2
            return 1
          }}
          pathDashGap={(path) => {
            const id = (path as PathDatum).id
            if (id === 'solar-deadline') return 0.36
            if (id === 'solar-now-beam') return 0.32
            return 0
          }}
          pathDashAnimateTime={(path) => {
            const id = (path as PathDatum).id
            if (id === 'solar-now-core') return 4400
            if (id === 'solar-now-beam') return 2200
            return 0
          }}
          onPathHover={(path) => {
            if (!path) {
              setHoverReadout('')
              return
            }

            const typed = path as PathDatum
            if (typed.kind === 'solar-now') {
              setHoverReadout(`solar now line · target ${targetClockLabel} in ${deadlineZoneLabel}`)
              return
            }

            if (typed.kind === 'solar-deadline') {
              setHoverReadout(`solar deadline ghost · ${targetClockLabel} ${deadlineZoneLabel}`)
              return
            }

            setHoverReadout('terminator · civil day/night boundary')
          }}
          ringsData={ringData}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.03}
          ringColor="color"
          ringMaxRadius="maxRadius"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          pointsData={markerData}
          pointLat="lat"
          pointLng="lng"
          pointAltitude="altitude"
          pointColor="color"
          pointRadius="radius"
          pointLabel="label"
          onPointHover={(point) => {
            if (!point) {
              setHoverReadout('')
              return
            }

            setHoverReadout((point as MarkerDatum).label)
          }}
          labelsData={labelsData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelColor="color"
          labelAltitude="altitude"
          labelSize="size"
          labelDotRadius={0.2}
          labelIncludeDot
          onGlobeClick={(coords) => {
            const offsetHours = Math.max(-12, Math.min(14, Math.round(coords.lng / 15)))
            const utcMinutes =
              displayTime.getUTCHours() * 60 +
              displayTime.getUTCMinutes() +
              displayTime.getUTCSeconds() / 60 +
              displayTime.getUTCMilliseconds() / 60_000
            const localMinutes = utcMinutes + offsetHours * 60
            const delta = signedCircularMinuteDelta(targetMinutesOfDay, localMinutes)
            const localClock = formatClock(localMinutes)
            setHoverReadout(
              `probe ${coords.lat.toFixed(1)}°, ${coords.lng.toFixed(1)}° · UTC${offsetHours >= 0 ? '+' : ''}${offsetHours} · local ${localClock} · target ${targetClockLabel} (${delta >= 0 ? '+' : ''}${Math.round(delta)}m)`
            )
            globeRef.current?.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.58 }, 680)
          }}
          onGlobeReady={() => {
            setGlobeReady(true)
            globeRef.current?.pointOfView({ lat: 18, lng: nowSolarLongitude - 18, altitude: 2.1 }, 0)
          }}
        />
      ) : null}

      {showSolarTime ? (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          {screenPaths.now ? (
            <path
              d={screenPaths.now}
              fill="none"
              stroke="rgba(110, 231, 255, 0.92)"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 8px rgba(124, 255, 178, 0.65))' }}
            />
          ) : null}
          {screenPaths.now ? (
            <path
              d={screenPaths.now}
              fill="none"
              stroke="rgba(124, 255, 178, 0.95)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {screenPaths.deadline ? (
            <path
              d={screenPaths.deadline}
              fill="none"
              stroke="rgba(255, 194, 112, 0.9)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 8"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255, 194, 112, 0.45))' }}
            />
          ) : null}
        </svg>
      ) : null}

      <button
        type="button"
        className="btn-ghost absolute right-2 top-2 z-20 px-2 py-1 text-[11px]"
        onClick={() => {
          setManualOrbitSeen(false)
          globeRef.current?.pointOfView({ lat: 18, lng: nowSolarLongitude - 18, altitude: 2.1 }, 620)
        }}
      >
        reset orbit
      </button>

      <div className="border-cyan-300/35 bg-black/56 text-cyan-100 pointer-events-none absolute left-2 top-2 rounded-md border px-2 py-1 text-[11px]">
        target {targetClockLabel} in {deadlineZoneLabel} ({formatUtcOffset(deadlineOffsetMinutes)})
        <br />
        solar now {nowSolarLongitude.toFixed(1)}°
        {deadlineSolarLongitude !== null ? ` · at deadline ${deadlineSolarLongitude.toFixed(1)}°` : ''}
        <br />
        mint beam: now · amber dash: deadline
      </div>

      <div className="text-cyan-100/78 pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px]">
        <span>{hoverReadout || 'drag to rotate · scroll to zoom · auto orbit enabled'}</span>
        <span>
          {manualOrbitSeen ? 'manual orbit active' : showLandmarks ? 'landmarks active' : 'landmarks off'}
        </span>
      </div>

      <div className="ring-cyan-300/15 pointer-events-none absolute inset-0 rounded-xl ring-1" />
    </div>
  )
}
