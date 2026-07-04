import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { CAMERA } from '../config'
import { layoutChildren } from '../lib/layout'
import { nodeByPath } from '../data/portfolio'
import { useNavStore } from '../state/useNavStore'
import { navMotion } from '../state/navMotion'
import { brainPose } from '../state/brainPose'

interface Pose {
  px: number
  py: number
  pz: number
  tx: number
  ty: number
  tz: number
}

const IDLE: Pose = {
  px: CAMERA.idle.pos[0],
  py: CAMERA.idle.pos[1],
  pz: CAMERA.idle.pos[2],
  tx: CAMERA.idle.look[0],
  ty: CAMERA.idle.look[1],
  tz: CAMERA.idle.look[2],
}

/**
 * Continuous camera: pose = lerp(idle, childPose(target), eased zoom).
 * At zoom 1 the target child fills the frame exactly as a full-size
 * brain does from idle, so the re-root swap is invisible. Also picks
 * the zoom target — the mini-brain nearest the pointer.
 */
export function CameraRig() {
  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)

  const basis = useRef<Pose>({
    ...IDLE,
    py: CAMERA.formingStart.pos[1],
    pz: CAMERA.formingStart.pos[2],
  })
  /** smoothed pose of the current zoom target */
  const tp = useRef<Pose>({ ...IDLE })
  const lastTarget = useRef<string | null>(null)
  const parallax = useRef({ x: 0, y: 0 })
  const look = useMemo(() => new THREE.Vector3(), [])
  const proj = useMemo(() => new THREE.Vector3(), [])

  const childPose = (id: string): Pose | null => {
    const node = nodeByPath(useNavStore.getState().path)
    const i = node.children.findIndex((c) => c.id === id)
    if (i < 0) return null
    const L = layoutChildren(node.children.length)[i]
    const c = proj.set(...L.position).applyEuler(brainPose.euler)
    const s = L.scale
    return {
      px: c.x + IDLE.px * s,
      py: c.y + IDLE.py * s,
      pz: c.z + IDLE.pz * s,
      tx: c.x + IDLE.tx * s,
      ty: c.y + IDLE.ty * s,
      tz: c.z + IDLE.tz * s,
    }
  }

  /* cinematic push-in while the dust assembles */
  useEffect(() => {
    if (phase === 'forming') {
      gsap.to(basis.current, { ...IDLE, duration: 4.2, ease: 'power2.inOut', overwrite: 'auto' })
    }
  }, [phase])

  useFrame((state, dt) => {
    const b = basis.current

    if (phase === 'explore') {
      /* target picking: nearest mini to the pointer, while commitment is low */
      const store = useNavStore.getState()
      const node = nodeByPath(store.path)
      if (
        !store.traveling &&
        !navMotion.auto &&
        node.children.length > 0 &&
        navMotion.zoomGoal > 0.001 &&
        navMotion.zoom < 0.25
      ) {
        const layout = layoutChildren(node.children.length)
        let best = -1
        let bestD = Infinity
        for (let i = 0; i < node.children.length; i++) {
          proj.set(...layout[i].position).applyEuler(brainPose.euler)
          proj.project(state.camera)
          const dx = proj.x - state.pointer.x
          const dy = proj.y - state.pointer.y
          const d = dx * dx + dy * dy
          if (d < bestD) {
            bestD = d
            best = i
          }
        }
        if (best >= 0) navMotion.targetId = node.children[best].id
      }

      /* smoothed target pose (snap on surface swaps, damp on retargets) */
      const id = navMotion.targetId
      if (id) {
        const cp = childPose(id)
        if (cp) {
          if (lastTarget.current !== id && navMotion.zoom > 0.5) {
            Object.assign(tp.current, cp) // surfacing: framing must match instantly
          } else {
            const k = 1 - Math.exp(-10 * dt)
            const p = tp.current
            p.px += (cp.px - p.px) * k
            p.py += (cp.py - p.py) * k
            p.pz += (cp.pz - p.pz) * k
            p.tx += (cp.tx - p.tx) * k
            p.ty += (cp.ty - p.ty) * k
            p.tz += (cp.tz - p.tz) * k
          }
        }
      }
      lastTarget.current = id

      /* pose = idle → target, weighted by eased zoom */
      const z = navMotion.eased
      const p = tp.current
      b.px = THREE.MathUtils.lerp(IDLE.px, p.px, z)
      b.py = THREE.MathUtils.lerp(IDLE.py, p.py, z)
      b.pz = THREE.MathUtils.lerp(IDLE.pz, p.pz, z)
      b.tx = THREE.MathUtils.lerp(IDLE.tx, p.tx, z)
      b.ty = THREE.MathUtils.lerp(IDLE.ty, p.ty, z)
      b.tz = THREE.MathUtils.lerp(IDLE.tz, p.tz, z)
    }

    /* damped pointer parallax, fading out as you commit to a dive */
    const amp = (1 - navMotion.eased) * 0.06 + 0.008
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, state.pointer.x * amp, 3, dt)
    parallax.current.y = THREE.MathUtils.damp(
      parallax.current.y,
      state.pointer.y * amp * 0.6,
      3,
      dt,
    )

    state.camera.position.set(b.px + parallax.current.x, b.py + parallax.current.y, b.pz)
    look.set(b.tx, b.ty, b.tz)
    state.camera.lookAt(look)
  })

  // path in deps keeps childPose fresh after re-roots
  void path

  return null
}
