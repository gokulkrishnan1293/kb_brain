import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { Html } from '@react-three/drei'
import { buildClusterHierarchy } from '../lib/hierarchy'
import {
  clusterVert,
  clusterFrag,
  treeLineVert,
  treeLineFrag,
} from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { ClusterDef, COLORS, QUALITY } from '../config'
import { useBrainStore } from '../state/useBrainStore'

interface Props {
  index: number
  def: ClusterDef
  position: [number, number, number]
  shared: SharedUniforms
  /** clusters emerge from the core once the brain is open */
  revealed: boolean
  /** this cluster is zoomed into (Stage 7) */
  active: boolean
  /** another cluster is zoomed into — fade back */
  dimmed: boolean
}

/**
 * Stage 6/7 — one holographic knowledge cluster. A compact particle
 * blob that, when focused, unfolds into a knowledge tree:
 * cluster → sub-clusters → documents → individual nodes.
 */
export function KnowledgeCluster({
  index,
  def,
  position,
  shared,
  revealed,
  active,
  dimmed,
}: Props) {
  const group = useRef<THREE.Group>(null!)
  const focusCluster = useBrainStore((s) => s.focusCluster)

  const data = useMemo(
    () => buildClusterHierarchy(QUALITY.clusterParticleCount, def.color, COLORS.cyan),
    [def.color],
  )

  const uniforms = useMemo(
    () => ({
      uTime: shared.uTime,
      uScale: shared.uScale,
      uReveal: { value: 0 },
      uExpand: { value: 0 },
      uFocus: { value: 0 },
      uOpacity: { value: 1 },
    }),
    [shared],
  )

  const pointsGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.blobPositions, 3))
    geo.setAttribute('aTree', new THREE.BufferAttribute(data.treePositions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(data.seeds, 1))
    return geo
  }, [data])

  const pointsMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: clusterVert,
        fragmentShader: clusterFrag,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  )

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.treeLines, 3))
    return geo
  }, [data])

  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: treeLineVert,
        fragmentShader: treeLineFrag,
        uniforms: {
          // shared references — the tree lines track the particle morph exactly
          uOpacity: uniforms.uOpacity,
          uExpand: uniforms.uExpand,
          uColor: { value: new THREE.Color(def.color) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms, def.color],
  )

  /* Stage 6 — emerge from the AI core with a staggered flight */
  useEffect(() => {
    const g = group.current
    const delay = 0.15 + index * 0.09
    if (revealed) {
      gsap.to(g.position, {
        x: position[0],
        y: position[1],
        z: position[2],
        duration: 1.2,
        delay,
        ease: 'power3.out',
        overwrite: 'auto',
      })
      gsap.to(uniforms.uReveal, {
        value: 1,
        duration: 1,
        delay,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    } else {
      gsap.to(g.position, { x: 0, y: 0, z: 0, duration: 0.55, ease: 'power2.in', overwrite: 'auto' })
      gsap.to(uniforms.uReveal, { value: 0, duration: 0.5, ease: 'power2.in', overwrite: 'auto' })
    }
  }, [revealed, index, position, uniforms])

  /* Stage 7 — unfold into the knowledge tree when focused */
  useEffect(() => {
    gsap.to(uniforms.uExpand, {
      value: active ? 1 : 0,
      duration: active ? 1.5 : 0.8,
      delay: active ? 0.35 : 0,
      ease: active ? 'power3.inOut' : 'power2.inOut',
      overwrite: 'auto',
    })
    gsap.to(uniforms.uFocus, { value: active ? 1 : 0, duration: 0.8, overwrite: 'auto' })
  }, [active, uniforms])

  /* fade when a sibling cluster is focused */
  useEffect(() => {
    gsap.to(uniforms.uOpacity, {
      value: dimmed ? 0.08 : 1,
      duration: 0.7,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
  }, [dimmed, uniforms])

  const labelVisible = revealed && !dimmed

  return (
    <group ref={group}>
      <points geometry={pointsGeometry} material={pointsMaterial} frustumCulled={false} />
      <lineSegments geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />

      {/* invisible hit target */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          if (revealed && !active) focusCluster(index)
        }}
        onPointerOver={() => {
          if (revealed && !dimmed) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      <Html
        position={[0, 0.19, 0]}
        center
        distanceFactor={2.4}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div className={`cluster-label ${labelVisible ? 'visible' : ''} ${active ? 'active' : ''}`}>
          <span className="cluster-name" style={{ color: def.color }}>
            {def.name}
          </span>
          <span className="cluster-detail">{def.detail}</span>
        </div>
      </Html>
    </group>
  )
}
