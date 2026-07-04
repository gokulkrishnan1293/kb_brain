import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { buildCoreParticles } from '../lib/hierarchy'
import { coreVert, coreFrag, pathwayVert, pathwayFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { CLUSTERS, CLUSTER_POSITIONS, COLORS, QUALITY } from '../config'
import { useBrainStore } from '../state/useBrainStore'
import { KnowledgeCluster } from './KnowledgeCluster'

interface Props {
  shared: SharedUniforms
}

/** Curved neural pathway from the AI core out to one knowledge cluster. */
function Pathway({
  target,
  color,
  uniforms,
}: {
  target: [number, number, number]
  color: string
  uniforms: { uTime: { value: number }; uOpacity: { value: number } }
}) {
  const line = useMemo(() => {
    const end = new THREE.Vector3(...target)
    const mid = end
      .clone()
      .multiplyScalar(0.5)
      .add(
        new THREE.Vector3(-end.y, end.x, (Math.random() - 0.5) * 0.2)
          .normalize()
          .multiplyScalar(0.14),
      )
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, end)
    const points = curve.getPoints(40)

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const ts = new Float32Array(points.length)
    for (let i = 0; i < points.length; i++) ts[i] = i / (points.length - 1)
    geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader: pathwayVert,
      fragmentShader: pathwayFrag,
      uniforms: {
        uTime: uniforms.uTime,
        uOpacity: uniforms.uOpacity,
        uColor: { value: new THREE.Color(color) },
        uFlowSpeed: { value: 0.35 + Math.random() * 0.25 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const line = new THREE.Line(geometry, material)
    line.frustumCulled = false
    return line
  }, [target, color, uniforms])

  return <primitive object={line} />
}

/**
 * Stage 6 — the glowing AI core revealed between the hemispheres,
 * orbited by six knowledge clusters wired back to it with animated
 * neural pathways.
 */
export function CoreScene({ shared }: Props) {
  const stage = useBrainStore((s) => s.stage)
  const activeCluster = useBrainStore((s) => s.activeCluster)
  const revealed = stage === 'open' || stage === 'cluster' || stage === 'opening'

  const heart = useRef<THREE.Mesh>(null!)
  const coreGroup = useRef<THREE.Group>(null!)

  const coreData = useMemo(
    () => buildCoreParticles(QUALITY.coreParticleCount, 0.15),
    [],
  )

  const coreUniforms = useMemo(
    () => ({
      uTime: shared.uTime,
      uScale: shared.uScale,
      uReveal: { value: 0 },
      uColorA: { value: new THREE.Color(COLORS.gold) },
      uColorB: { value: new THREE.Color(COLORS.cyan) },
    }),
    [shared],
  )

  const pathwayOpacity = useMemo(() => ({ value: 0 }), [])

  const coreGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(coreData.positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(coreData.seeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(coreData.sizes, 1))
    return geo
  }, [coreData])

  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVert,
        fragmentShader: coreFrag,
        uniforms: coreUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [coreUniforms],
  )

  /* core reveal — timed so it blooms in as the hemispheres part */
  useEffect(() => {
    if (revealed) {
      gsap.to(coreUniforms.uReveal, {
        value: 1,
        duration: 1.1,
        delay: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      })
      gsap.to(pathwayOpacity, {
        value: 0.75,
        duration: 0.9,
        delay: 1.5,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    } else {
      gsap.to(coreUniforms.uReveal, { value: 0, duration: 0.45, ease: 'power2.in', overwrite: 'auto' })
      gsap.to(pathwayOpacity, { value: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' })
    }
  }, [revealed, coreUniforms, pathwayOpacity])

  /* dim pathways while zoomed into a cluster */
  useEffect(() => {
    if (!revealed) return
    gsap.to(pathwayOpacity, {
      value: activeCluster === null ? 0.75 : 0.12,
      duration: 0.7,
      overwrite: 'auto',
    })
  }, [activeCluster, revealed, pathwayOpacity])

  useFrame(() => {
    const t = shared.uTime.value
    const r = coreUniforms.uReveal.value
    if (heart.current) {
      const s = r * (0.045 + Math.sin(t * 2.4) * 0.007)
      heart.current.scale.setScalar(Math.max(s, 0.0001))
    }
    if (coreGroup.current) coreGroup.current.rotation.y = t * 0.15
  })

  return (
    <group>
      <group ref={coreGroup}>
        <points geometry={coreGeometry} material={coreMaterial} frustumCulled={false} />
        {/* white-hot heart that feeds the bloom pass */}
        <mesh ref={heart}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color={'#e8fbff'} toneMapped={false} />
        </mesh>
      </group>

      {CLUSTERS.map((def, i) => (
        <Pathway
          key={`path-${def.name}`}
          target={CLUSTER_POSITIONS[i]}
          color={def.color}
          uniforms={{ uTime: shared.uTime, uOpacity: pathwayOpacity }}
        />
      ))}

      {CLUSTERS.map((def, i) => (
        <KnowledgeCluster
          key={def.name}
          index={i}
          def={def}
          position={CLUSTER_POSITIONS[i]}
          shared={shared}
          revealed={stage === 'open' || stage === 'cluster'}
          active={activeCluster === i}
          dimmed={activeCluster !== null && activeCluster !== i}
        />
      ))}
    </group>
  )
}
