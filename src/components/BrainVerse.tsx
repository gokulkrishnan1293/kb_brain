import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { sampleBrainSurface, normalizeGeometry } from '../lib/sampleSurface'
import { buildNeuralGraph, buildPackets } from '../lib/buildGraph'
import { layoutChildren } from '../lib/layout'
import { nodeByPath } from '../data/portfolio'
import {
  createSharedUniforms,
  createShellControls,
} from '../three/uniforms'
import { BRAIN_SIZE, QUALITY, SPLIT_DISTANCE, LINE_OPACITY, DEP_OPACITY } from '../config'
import { useNavStore } from '../state/useNavStore'
import { BrainShell, ShellBuffers } from './BrainShell'
import { MiniBrain } from './MiniBrain'
import { NodeCore } from './NodeCore'
import { DependencyLinks } from './DependencyLinks'

const MODEL_URL = '/models/brain.glb'

/**
 * The recursive brain-verse. Renders the current node as a full-size
 * particle brain with its children floating inside as mini-brains.
 * Diving re-roots the tree on the child (scale-and-swap), so only two
 * levels ever render regardless of hierarchy depth.
 */
export function BrainVerse() {
  const { scene } = useGLTF(MODEL_URL)
  const group = useRef<THREE.Group>(null!)

  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)
  const divingTo = useNavStore((s) => s.divingTo)
  const beginForm = useNavStore((s) => s.beginForm)
  const finishForm = useNavStore((s) => s.finishForm)

  /* ---- one-time data pipeline: sample surface, graph, packets ---- */
  const { samples, buffers } = useMemo(() => {
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
    geometry.dispose()

    const buffers: ShellBuffers = {
      point: {
        position: new THREE.BufferAttribute(samples.positions, 3),
        aColor: new THREE.BufferAttribute(samples.colors, 3),
        aSize: new THREE.BufferAttribute(samples.sizes, 1),
        aSeed: new THREE.BufferAttribute(samples.seeds, 1),
        aSide: new THREE.BufferAttribute(samples.sides, 1),
        aScatter: new THREE.BufferAttribute(samples.scatters, 3),
      },
      line: {
        position: new THREE.BufferAttribute(graph.linePositions, 3),
        aSide: new THREE.BufferAttribute(graph.lineSides, 1),
        aSeed: new THREE.BufferAttribute(graph.lineSeeds, 1),
      },
      packet: {
        position: new THREE.BufferAttribute(packets.starts, 3),
        aEnd: new THREE.BufferAttribute(packets.ends, 3),
        aSideStart: new THREE.BufferAttribute(packets.sideStarts, 1),
        aSideEnd: new THREE.BufferAttribute(packets.sideEnds, 1),
        aSpeed: new THREE.BufferAttribute(packets.speeds, 1),
        aOffset: new THREE.BufferAttribute(packets.offsets, 1),
        aSeed: new THREE.BufferAttribute(packets.seeds, 1),
      },
      maxEdges: graph.edges.length,
    }
    return { samples, buffers }
  }, [scene])

  const shared = useMemo(
    () => createSharedUniforms(SPLIT_DISTANCE, samples.minY, samples.yRange),
    [samples],
  )

  const currentNode = useMemo(() => nodeByPath(path), [path])
  const childLayout = useMemo(
    () => layoutChildren(currentNode.children.length),
    [currentNode],
  )

  const rootCtl = useMemo(
    () =>
      createShellControls({
        formed: false, // root starts as scattered dust
        tint: currentNode.color,
        tintAmount: 0,
        sizeMul: 1,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const coreReveal = useMemo(() => ({ value: 0 }), [])
  const depOpacity = useMemo(() => ({ value: 0 }), [])

  /* keep the root shell tinted to the current node */
  useEffect(() => {
    rootCtl.uTint.value.set(currentNode.color)
    rootCtl.uTintAmount.value = path.length === 1 ? 0 : 0.5
  }, [currentNode, path.length, rootCtl])

  /* kick off the dust → form intro once the model is ready */
  useEffect(() => {
    const id = setTimeout(beginForm, 400)
    return () => clearTimeout(id)
  }, [beginForm])

  /* ---- phase-driven shell choreography ---- */
  useEffect(() => {
    if (phase === 'forming') {
      rootCtl.uForm.value = 0
      rootCtl.uFade.value = 1
      gsap.to(rootCtl.uForm, {
        value: 1,
        duration: 3.6,
        ease: 'power1.inOut',
        onComplete: finishForm,
      })
      gsap.to(rootCtl.uLineOpacity, { value: LINE_OPACITY, duration: 1.4, delay: 2.5 })
      gsap.to(rootCtl.uPacketOpacity, { value: 1, duration: 1.2, delay: 3.0 })
      gsap.to(coreReveal, { value: 1, duration: 1.0, delay: 3.0 })
      gsap.to(depOpacity, { value: DEP_OPACITY, duration: 1.0, delay: 3.5 })
    } else if (phase === 'diving') {
      // hemispheres part like doors while the shell thins to a veil
      gsap.to(shared.uSplit, { value: 0.22, duration: 1.1, ease: 'power2.inOut', overwrite: 'auto' })
      gsap.to(rootCtl.uFade, { value: 0, duration: 1.3, delay: 0.35, ease: 'power2.in', overwrite: 'auto' })
      gsap.to(rootCtl.uLineOpacity, { value: 0, duration: 0.9, overwrite: 'auto' })
      gsap.to(rootCtl.uPacketOpacity, { value: 0, duration: 0.9, overwrite: 'auto' })
      gsap.to(coreReveal, { value: 0, duration: 0.6, overwrite: 'auto' })
      gsap.to(depOpacity, { value: 0, duration: 0.6, overwrite: 'auto' })
    } else if (phase === 'surfacing') {
      // re-rooted on the parent already — its shell breathes back in
      shared.uSplit.value = 0
      rootCtl.uForm.value = 1
      gsap.fromTo(
        rootCtl.uFade,
        { value: 0 },
        { value: 1, duration: 1.5, delay: 0.2, ease: 'power2.out', overwrite: 'auto' },
      )
      gsap.to(rootCtl.uLineOpacity, { value: LINE_OPACITY, duration: 1.2, delay: 0.6, overwrite: 'auto' })
      gsap.to(rootCtl.uPacketOpacity, { value: 1, duration: 1.2, delay: 0.8, overwrite: 'auto' })
      gsap.fromTo(coreReveal, { value: 0 }, { value: 1, duration: 0.9, delay: 0.6, overwrite: 'auto' })
      gsap.fromTo(depOpacity, { value: 0 }, { value: DEP_OPACITY, duration: 0.9, delay: 0.8, overwrite: 'auto' })
    }
  }, [phase, rootCtl, shared, coreReveal, depOpacity, finishForm])

  /* ---- after a dive completes: the mini we entered becomes the root ---- */
  const prevDepth = useRef(path.length)
  useEffect(() => {
    if (path.length > prevDepth.current) {
      shared.uSplit.value = 0
      rootCtl.uForm.value = 1
      gsap.fromTo(
        rootCtl.uFade,
        { value: 0.45 },
        { value: 1, duration: 0.7, ease: 'power2.out', overwrite: 'auto' },
      )
      gsap.fromTo(
        rootCtl.uLineOpacity,
        { value: 0 },
        { value: LINE_OPACITY, duration: 1.0, delay: 0.3, overwrite: 'auto' },
      )
      gsap.fromTo(
        rootCtl.uPacketOpacity,
        { value: 0 },
        { value: 1, duration: 1.0, delay: 0.45, overwrite: 'auto' },
      )
      gsap.fromTo(coreReveal, { value: 0 }, { value: 1, duration: 0.9, delay: 0.4, overwrite: 'auto' })
      gsap.fromTo(depOpacity, { value: 0 }, { value: DEP_OPACITY, duration: 0.9, delay: 0.6, overwrite: 'auto' })
    }
    prevDepth.current = path.length
  }, [path, rootCtl, shared, coreReveal, depOpacity])

  /* ---- per-frame: clock, projection scale, idle sway & breathing ---- */
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    shared.uTime.value = t
    shared.uScale.value =
      (size.height * gl.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5))

    const g = group.current
    if (!g) return
    if (phase === 'idle' || phase === 'forming') {
      g.rotation.y = THREE.MathUtils.damp(
        g.rotation.y,
        Math.sin(t * 0.22) * THREE.MathUtils.degToRad(3),
        2,
        dt,
      )
      const breath = 1 + Math.sin(t * 0.7) * 0.009
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, breath, 2, dt))
    } else {
      // settle to identity so the camera's scale-and-swap maths hold exactly
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, 0, 6, dt)
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1, 6, dt))
    }
  })

  const interactive = phase === 'idle'
  const isLeaf = currentNode.children.length === 0

  return (
    <group ref={group}>
      <BrainShell
        buffers={buffers}
        shared={shared}
        controls={rootCtl}
        pointCount={QUALITY.particleCount}
        edgeCount={buffers.maxEdges}
        withPackets
        opacity={0.66}
      />

      <NodeCore
        shared={shared}
        color={currentNode.color}
        radius={isLeaf ? 0.17 : 0.09}
        reveal={coreReveal}
      />

      <DependencyLinks
        node={currentNode}
        layout={childLayout}
        shared={shared}
        opacity={depOpacity}
      />

      {currentNode.children.map((child, i) => (
        <MiniBrain
          key={child.id}
          node={child}
          index={i}
          layout={childLayout[i]}
          buffers={buffers}
          shared={shared}
          appearDelay={phase === 'forming' ? 3.3 + i * 0.15 : 0.35 + i * 0.09}
          dimmed={divingTo !== null && divingTo !== child.id}
          target={divingTo === child.id}
          interactive={interactive}
        />
      ))}
    </group>
  )
}

useGLTF.preload(MODEL_URL)
