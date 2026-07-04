import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { sampleBrainSurface, normalizeGeometry } from '../lib/sampleSurface'
import { buildNeuralGraph, buildPackets } from '../lib/buildGraph'
import { createSharedUniforms } from '../three/uniforms'
import { BRAIN_SIZE, QUALITY, SPLIT_DISTANCE } from '../config'
import { useBrainStore } from '../state/useBrainStore'
import { ParticleBrain } from './ParticleBrain'
import { NeuralNetwork } from './NeuralNetwork'
import { CoreScene } from './CoreScene'

const MODEL_URL = '/models/brain.glb'

/**
 * Owns the whole brain: converts the GLB into particle data, drives the
 * shared uniforms (time, hover, hemisphere split), and applies the idle
 * rotation / breathing to the group.
 */
export function BrainAssembly() {
  const { scene } = useGLTF(MODEL_URL)
  const group = useRef<THREE.Group>(null!)

  const stage = useBrainStore((s) => s.stage)
  const hovered = useBrainStore((s) => s.hovered)
  const setHovered = useBrainStore((s) => s.setHovered)
  const openBrain = useBrainStore((s) => s.openBrain)
  const finishOpening = useBrainStore((s) => s.finishOpening)

  /* ---- Stage 1/2 data: sample surface, build graph, spawn packets ---- */
  const { geometry, samples, graph, packets } = useMemo(() => {
    let mesh: THREE.Mesh | null = null
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
    })
    if (!mesh) throw new Error('brain.glb contains no mesh')
    const found = mesh as THREE.Mesh
    const geometry = normalizeGeometry(
      found.geometry as THREE.BufferGeometry,
      found.matrixWorld,
      BRAIN_SIZE,
    )
    const samples = sampleBrainSurface(geometry, QUALITY.particleCount)
    const graph = buildNeuralGraph(samples, QUALITY.hubCount, QUALITY.hubNeighbors)
    const packets = buildPackets(graph, QUALITY.packetCount)
    return { geometry, samples, graph, packets }
  }, [scene])

  const shared = useMemo(() => createSharedUniforms(SPLIT_DISTANCE), [])

  /* ---- Stage 5: hemisphere split timeline (GSAP) ---- */
  useEffect(() => {
    if (stage === 'opening') {
      gsap.to(shared.uSplit, {
        value: 1,
        duration: 1.5,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: finishOpening,
      })
    } else if (stage === 'idle') {
      gsap.to(shared.uSplit, {
        value: 0,
        duration: 1.2,
        ease: 'power2.inOut',
        overwrite: 'auto',
      })
    }
  }, [stage, shared, finishOpening])

  /* ---- per-frame: time, hover damping, idle rotation & breathing ---- */
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    shared.uTime.value = t
    shared.uScale.value =
      (size.height * gl.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5))

    const hoverTarget = hovered && stage === 'idle' ? 1 : 0
    shared.uHover.value = THREE.MathUtils.damp(shared.uHover.value, hoverTarget, 4, dt)

    const g = group.current
    if (!g) return
    if (stage === 'idle') {
      // Stage 3 — slow ±3° sway and gentle breathing
      g.rotation.y = THREE.MathUtils.damp(
        g.rotation.y,
        Math.sin(t * 0.22) * THREE.MathUtils.degToRad(3),
        2,
        dt,
      )
      const breath = 1 + Math.sin(t * 0.7) * 0.011
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, breath, 2, dt))
    } else {
      // settle so cluster camera flights have a stable target space
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, 0, 2.5, dt)
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1, 2.5, dt))
    }
  })

  const interactive = stage === 'idle'

  return (
    <group ref={group}>
      <ParticleBrain samples={samples} shared={shared} />
      <NeuralNetwork graph={graph} packets={packets} shared={shared} />
      <CoreScene shared={shared} />

      {/* invisible brain hull — hover + click target (Stages 4 & 5) */}
      <mesh
        geometry={geometry}
        raycast={interactive ? undefined : () => null}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'auto'
          openBrain()
        }}
      >
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
