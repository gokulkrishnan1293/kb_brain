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
import { BRAIN_SIZE, QUALITY, SPLIT_DISTANCE, LINE_OPACITY, DEP_OPACITY, AUTO_SPIN } from '../config'
import { useNavStore } from '../state/useNavStore'
import { brainPose } from '../state/brainPose'
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

  /* ---- drag-to-rotate + auto-spin ---- */
  const gl = useThree((s) => s.gl)
  const drag = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vel: 0,
  })

  useEffect(() => {
    const el = gl.domElement
    const d = drag.current

    const rotatable = () => {
      const p = useNavStore.getState().phase
      return p === 'idle' || p === 'forming'
    }

    const onDown = (e: PointerEvent) => {
      if (!rotatable()) return
      d.active = true
      d.lastX = e.clientX
      d.lastY = e.clientY
      d.lastT = performance.now()
      brainPose.lastDragTravel = 0
      el.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!d.active) return
      const dx = e.clientX - d.lastX
      const dy = e.clientY - d.lastY
      d.lastX = e.clientX
      d.lastY = e.clientY
      brainPose.lastDragTravel += Math.abs(dx) + Math.abs(dy)

      brainPose.euler.y += dx * 0.005
      brainPose.euler.x = THREE.MathUtils.clamp(
        brainPose.euler.x + dy * 0.003,
        -0.38,
        0.38,
      )

      // smoothed release velocity for inertia
      const now = performance.now()
      const dtMove = Math.max(now - d.lastT, 1) / 1000
      d.lastT = now
      d.vel = THREE.MathUtils.clamp(
        d.vel * 0.7 + ((dx * 0.005) / dtMove) * 0.3,
        -2.2,
        2.2,
      )
    }
    const onUp = () => {
      d.active = false
      el.style.cursor = rotatable() ? 'grab' : 'auto'
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  /* cursor reflects what a press would do in the current phase */
  useEffect(() => {
    gl.domElement.style.cursor =
      phase === 'idle' || phase === 'forming' ? 'grab' : 'auto'
  }, [phase, gl])

  /* ---- per-frame: clock, projection scale, spin & breathing ---- */
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    shared.uTime.value = t
    shared.uScale.value =
      (size.height * gl.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5))

    const g = group.current
    if (!g) return
    const d = drag.current

    if (phase === 'idle' || phase === 'forming') {
      if (!d.active) {
        // inertia decays into the ambient auto-spin; spin holds while a
        // mini is hovered so it stays easy to click
        const hovering = useNavStore.getState().hoveredChild !== null
        const targetVel = hovering
          ? 0
          : AUTO_SPIN * (phase === 'forming' ? 0.35 : 1)
        d.vel = THREE.MathUtils.damp(d.vel, targetVel, 1.1, dt)
        brainPose.euler.y += d.vel * dt
        // tilt eases back to level over a few seconds
        brainPose.euler.x = THREE.MathUtils.damp(brainPose.euler.x, 0, 0.25, dt)
      }
      const breath = 1 + Math.sin(t * 0.7) * 0.009
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, breath, 2, dt))
    } else {
      // freeze the pose during dives — the camera maths accounts for the
      // current rotation, so no snap-back is needed
      d.vel = 0
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, 1, 6, dt))
    }

    g.rotation.copy(brainPose.euler)
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
