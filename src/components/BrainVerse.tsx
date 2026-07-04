import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { sampleBrainSurface, normalizeGeometry } from '../lib/sampleSurface'
import { buildNeuralGraph, buildPackets } from '../lib/buildGraph'
import { layoutChildren } from '../lib/layout'
import { computeLinkView, edgesTouching } from '../lib/linkView'
import { nodeByPath, PortfolioNode } from '../data/portfolio'
import { createSharedUniforms, createShellControls } from '../three/uniforms'
import {
  BRAIN_SIZE,
  QUALITY,
  SPLIT_DISTANCE,
  LINE_OPACITY,
  AUTO_SPIN,
} from '../config'
import { useNavStore } from '../state/useNavStore'
import { navMotion } from '../state/navMotion'
import { brainPose } from '../state/brainPose'
import { BrainShell, ShellBuffers } from './BrainShell'
import { MiniBrain, SelectionRole } from './MiniBrain'
import { NodeCore } from './NodeCore'
import { KnowledgeLinks } from './KnowledgeLinks'
import { Portals } from './Portals'

const MODEL_URL = '/models/brain.glb'
const ss = THREE.MathUtils.smoothstep

/**
 * The recursive brain-verse, driven by one continuous zoom scalar.
 * Scroll dives toward the mini-brain nearest your pointer; crossing the
 * threshold re-roots the scene (scale-and-swap); scrolling out reverses
 * it. All shell choreography is a pure function of the zoom value, so
 * navigation is scrubbable and bidirectional.
 */
export function BrainVerse() {
  const { scene } = useGLTF(MODEL_URL)
  const group = useRef<THREE.Group>(null!)

  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)
  const selectedId = useNavStore((s) => s.selectedId)
  const traveling = useNavStore((s) => s.traveling)
  const beginForm = useNavStore((s) => s.beginForm)
  const finishForm = useNavStore((s) => s.finishForm)

  /* ---- one-time data pipeline ---- */
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
  const currentNodeRef = useRef<PortfolioNode>(currentNode)
  currentNodeRef.current = currentNode

  const childLayout = useMemo(
    () => layoutChildren(currentNode.children.length),
    [currentNode],
  )
  const linkView = useMemo(() => computeLinkView(currentNode.id), [currentNode])

  /* selection roles for children (linkage highlighting) */
  const roles = useMemo<Map<string, SelectionRole>>(() => {
    const map = new Map<string, SelectionRole>()
    if (!selectedId) {
      currentNode.children.forEach((c) => map.set(c.id, 'none'))
      return map
    }
    const linked = new Set<string>()
    if (selectedId.startsWith('portal:')) {
      const portal = linkView.portals.find((p) => p.key === selectedId)
      portal?.via.forEach((v) => v !== 'self' && linked.add(v))
    } else {
      for (const e of edgesTouching(linkView.edges, selectedId)) {
        if (e.a !== 'self') linked.add(e.a)
        if (e.b !== 'self') linked.add(e.b)
      }
    }
    currentNode.children.forEach((c) => {
      map.set(
        c.id,
        c.id === selectedId ? 'selected' : linked.has(c.id) ? 'linked' : 'dim',
      )
    })
    return map
  }, [selectedId, currentNode, linkView])

  const rootCtl = useMemo(
    () =>
      createShellControls({ formed: false, tint: '#ffffff', tintAmount: 0, sizeMul: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /* animation bases — GSAP writes these; the frame loop composes them with zoom */
  const baseShell = useMemo(() => ({ value: 1 }), [])
  const baseLines = useMemo(() => ({ value: 0 }), [])
  const basePackets = useMemo(() => ({ value: 0 }), [])
  const baseCore = useMemo(() => ({ value: 0 }), [])
  const baseLinks = useMemo(() => ({ value: 0 }), [])
  const coreReveal = useMemo(() => ({ value: 0 }), [])

  useEffect(() => {
    rootCtl.uTint.value.set(currentNode.color)
    rootCtl.uTintAmount.value = path.length === 1 ? 0 : 0.5
  }, [currentNode, path.length, rootCtl])

  /* dust → form intro */
  useEffect(() => {
    const id = setTimeout(beginForm, 400)
    return () => clearTimeout(id)
  }, [beginForm])

  useEffect(() => {
    if (phase !== 'forming') return
    rootCtl.uForm.value = 0
    gsap.to(rootCtl.uForm, {
      value: 1,
      duration: 3.6,
      ease: 'power1.inOut',
      onComplete: finishForm,
    })
    gsap.to(baseLines, { value: 1, duration: 1.4, delay: 2.5 })
    gsap.to(basePackets, { value: 1, duration: 1.2, delay: 3.0 })
    gsap.to(baseCore, { value: 1, duration: 1.0, delay: 3.0 })
    gsap.to(baseLinks, { value: 1, duration: 1.0, delay: 3.5 })
  }, [phase, rootCtl, baseLines, basePackets, baseCore, baseLinks, finishForm])

  /* re-root entrance: new level's systems come online */
  const prevDepth = useRef(path.length)
  useEffect(() => {
    if (path.length !== prevDepth.current) {
      const grew = path.length > prevDepth.current
      rootCtl.uForm.value = 1
      if (grew) {
        // soften the mini→full density jump
        gsap.fromTo(baseShell, { value: 0.55 }, { value: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
      } else {
        baseShell.value = 1
      }
      gsap.fromTo(baseLines, { value: 0 }, { value: 1, duration: 1.0, delay: 0.3, overwrite: 'auto' })
      gsap.fromTo(basePackets, { value: 0 }, { value: 1, duration: 1.0, delay: 0.45, overwrite: 'auto' })
      gsap.fromTo(baseCore, { value: 0 }, { value: 1, duration: 0.9, delay: 0.35, overwrite: 'auto' })
      gsap.fromTo(baseLinks, { value: 0 }, { value: 1, duration: 0.9, delay: 0.5, overwrite: 'auto' })
    }
    prevDepth.current = path.length
  }, [path, rootCtl, baseShell, baseLines, basePackets, baseCore, baseLinks])

  /* ---- wheel: the primary navigation input ---- */
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useNavStore.getState()
      if (s.phase !== 'explore' || s.traveling) return

      // wheel up / pinch out = dive in
      const raw = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      const delta = -raw * (e.ctrlKey ? 0.0045 : 0.0016)
      gsap.killTweensOf(navMotion) // user takes over from any auto-dive

      if (delta > 0) {
        if (!navMotion.targetId && currentNodeRef.current.children.length === 0) return
        navMotion.zoomGoal = Math.min(navMotion.zoomGoal + delta, 1.02)
      } else if (
        navMotion.zoomGoal <= 0.001 &&
        navMotion.zoom < 0.04 &&
        !navMotion.targetId
      ) {
        // resting at this level — surface swap, then back out continuously
        const popped = s.ascend()
        if (popped) {
          navMotion.targetId = popped
          navMotion.zoom = 1
          navMotion.zoomGoal = Math.max(0, 1 + delta)
        }
      } else {
        navMotion.zoomGoal = Math.max(navMotion.zoomGoal + delta, 0)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl])

  /* ---- drag-to-rotate + auto-spin ---- */
  const drag = useRef({ active: false, lastX: 0, lastY: 0, lastT: 0, vel: 0 })

  useEffect(() => {
    const el = gl.domElement
    const d = drag.current

    const rotatable = () => {
      const s = useNavStore.getState()
      return (
        (s.phase === 'forming' || s.phase === 'explore') &&
        !s.traveling &&
        navMotion.zoom < 0.15
      )
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

  useEffect(() => {
    gl.domElement.style.cursor =
      phase === 'explore' || phase === 'forming' ? 'grab' : 'auto'
  }, [phase, gl])

  /* ---- frame loop: zoom dynamics, swaps, choreography, spin ---- */
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const descend = useNavStore((s) => s.descend)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    shared.uTime.value = t
    shared.uScale.value =
      (size.height * gl.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5))

    /* zoom dynamics */
    const goal = THREE.MathUtils.clamp(navMotion.zoomGoal, 0, 1.02)
    navMotion.zoom = THREE.MathUtils.damp(
      navMotion.zoom,
      goal,
      navMotion.auto ? 5.5 : 7,
      dt,
    )
    const zc = THREE.MathUtils.clamp(navMotion.zoom, 0, 1)
    navMotion.eased = zc * zc * (3 - 2 * zc)

    /* dive swap: the target becomes the new root, framing unchanged */
    if (navMotion.targetId && navMotion.zoom > 0.985 && navMotion.zoomGoal >= 1) {
      descend(navMotion.targetId)
      navMotion.targetId = null
      navMotion.zoom = 0
      navMotion.zoomGoal = Math.max(0, navMotion.zoomGoal - 1)
    }
    /* fully surfaced — release the target */
    if (navMotion.targetId && navMotion.zoom < 0.02 && navMotion.zoomGoal <= 0.001) {
      navMotion.targetId = null
    }

    /* shell choreography — pure function of eased zoom */
    const z = navMotion.eased
    rootCtl.uFade.value = baseShell.value * (1 - ss(z, 0.35, 0.85))
    rootCtl.uLineOpacity.value =
      LINE_OPACITY * baseLines.value * (1 - ss(z, 0.18, 0.55))
    rootCtl.uPacketOpacity.value = basePackets.value * (1 - ss(z, 0.18, 0.55))
    shared.uSplit.value = 0.22 * ss(z, 0.06, 0.45) // doors part as you enter
    coreReveal.value = baseCore.value * (1 - ss(z, 0.06, 0.35))

    /* spin & breathing (frozen while zooming so the swap maths hold) */
    const g = group.current
    if (!g) return
    const d = drag.current
    const rotating = phase !== 'boot' && navMotion.zoom < 0.1 && !traveling

    if (rotating) {
      if (!d.active) {
        const hovering = useNavStore.getState().hoveredChild !== null
        const targetVel =
          hovering || selectedId !== null
            ? 0
            : AUTO_SPIN * (phase === 'forming' ? 0.35 : 1)
        d.vel = THREE.MathUtils.damp(d.vel, targetVel, 1.1, dt)
        brainPose.euler.y += d.vel * dt
        brainPose.euler.x = THREE.MathUtils.damp(brainPose.euler.x, 0, 0.25, dt)
      }
    } else {
      d.vel = 0
    }

    const breath = 1 + Math.sin(t * 0.7) * 0.009 * (1 - z)
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, breath, 4, dt))
    g.rotation.copy(brainPose.euler)
  })

  const interactive = phase === 'explore' && !traveling
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

      <KnowledgeLinks
        node={currentNode}
        layout={childLayout}
        view={linkView}
        shared={shared}
        base={baseLinks}
      />

      <Portals
        node={currentNode}
        layout={childLayout}
        view={linkView}
        shared={shared}
        base={baseLinks}
        interactive={interactive}
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
          selection={roles.get(child.id) ?? 'none'}
          interactive={interactive}
        />
      ))}
    </group>
  )
}

useGLTF.preload(MODEL_URL)
