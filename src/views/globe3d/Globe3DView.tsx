import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  Line as ThreeLine,
  Mesh,
  ShaderMaterial,
  Vector3
} from 'three'
import { degreesToRadians } from '@/lib/geo'
import { solarDeadlineLongitude, sunDirectionEcef } from '@/features/solar/solarMath'

type Globe3DViewProps = {
  time: Date
  targetMinutesOfDay: number
  showSolarTime: boolean
  showDayNight: boolean
  useApparentSolar: boolean
}

function GlobeMesh({
  time,
  targetMinutesOfDay,
  showSolarTime,
  showDayNight,
  useApparentSolar
}: Globe3DViewProps) {
  const meshRef = useRef<Mesh>(null)

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.04
    }
  })

  const sunVector = useMemo(() => sunDirectionEcef(time, useApparentSolar), [time, useApparentSolar])

  const shader = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          sunDirection: { value: new Vector3(...sunVector) },
          dayColor: { value: new Color('#234f8a') },
          nightColor: { value: new Color('#02060f') },
          oceanGlow: { value: new Color('#6ee7ff') },
          dayNightMix: { value: showDayNight ? 1 : 0 }
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 sunDirection;
          uniform vec3 dayColor;
          uniform vec3 nightColor;
          uniform vec3 oceanGlow;
          uniform float dayNightMix;
          varying vec3 vNormal;

          void main() {
            float lit = dot(normalize(vNormal), normalize(sunDirection));
            float shade = smoothstep(-0.2, 0.25, lit);
            vec3 base = mix(nightColor, dayColor, mix(1.0, shade, dayNightMix));
            float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
            vec3 color = base + rim * 0.15 * oceanGlow;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      }),
    [showDayNight, sunVector]
  )

  const solarLine = useMemo(() => {
    const lon = solarDeadlineLongitude(time, targetMinutesOfDay, useApparentSolar)
    const positions: number[] = []
    for (let lat = -90; lat <= 90; lat += 2) {
      const latR = degreesToRadians(lat)
      const lonR = degreesToRadians(lon)
      const radius = 1.012
      positions.push(
        radius * Math.cos(latR) * Math.cos(lonR),
        radius * Math.sin(latR),
        radius * Math.cos(latR) * Math.sin(lonR)
      )
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return geometry
  }, [targetMinutesOfDay, time, useApparentSolar])

  const lineMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: '#7cffb2',
        linewidth: 2,
        blending: AdditiveBlending
      }),
    []
  )

  const solarLineObject = useMemo(() => new ThreeLine(solarLine, lineMaterial), [lineMaterial, solarLine])

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 96, 96]} />
        <primitive attach="material" object={shader} />
      </mesh>

      {showSolarTime ? <primitive object={solarLineObject} /> : null}

      <mesh position={[sunVector[0] * 1.25, sunVector[1] * 1.25, sunVector[2] * 1.25]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color="#ffe38a" />
      </mesh>
    </group>
  )
}

export default function Globe3DView(props: Globe3DViewProps) {
  return (
    <div className="h-full min-h-[320px] rounded-xl border border-cyan-400/20 bg-black/30" data-testid="globe3d-view">
      <Canvas camera={{ position: [0, 0, 2.9], fov: 35 }}>
        <ambientLight intensity={0.24} />
        <GlobeMesh {...props} />
      </Canvas>
      <div className="pointer-events-none -mt-8 px-3 pb-2 text-[11px] text-cyan-100/70">drag support can be added in v1.1</div>
    </div>
  )
}
