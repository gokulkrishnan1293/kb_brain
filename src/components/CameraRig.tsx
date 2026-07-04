import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { CAMERA } from '../config'
import { layoutChildren } from '../lib/layout'
import { nodeByPath } from '../data/portfolio'
import { useNavStore } from '../state/useNavStore'

const IDLE = {
  px: CAMERA.idle.pos[0],
  py: CAMERA.idle.pos[1],
  pz: CAMERA.idle.pos[2],
  tx: CAMERA.idle.look[0],
  ty: CAMERA.idle.look[1],
  tz: CAMERA.idle.look[2],
}

/**
 * Cinematic camera with scale-and-swap dives.
 *
 * Diving: the camera flies to `childPos + childScale * idlePose`. At that
 * moment the child fills the frame exactly as a full-size brain would
 * from the idle pose — so the scene re-roots, the camera snaps to the
 * idle pose, and nothing visibly changes. Depth is therefore unlimited.
 * Surfacing runs the same trick in reverse.
 */
export function CameraRig() {
  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)
  const divingTo = useNavStore((s) => s.divingTo)
  const surfacedFrom = useNavStore((s) => s.surfacedFrom)
  const finishDive = useNavStore((s) => s.finishDive)
  const finishSurface = useNavStore((s) => s.finishSurface)

  const basis = useRef({
    ...IDLE,
    // boot: hold far out; the forming tween brings us in
    pz: CAMERA.formingStart.pos[2],
    py: CAMERA.formingStart.pos[1],
  })
  const parallax = useRef({ x: 0, y: 0 })
  const look = useMemo(() => new THREE.Vector3(), [])
  const prevPhase = useRef(phase)

  /** camera pose that frames child `id` of the current root exactly like idle frames a root */
  const childPose = (id: string) => {
    const node = nodeByPath(path)
    const i = node.children.findIndex((c) => c.id === id)
    const L = layoutChildren(node.children.length)[Math.max(i, 0)]
    const [cx, cy, cz] = L.position
    const s = L.scale
    return {
      px: cx + IDLE.px * s,
      py: cy + IDLE.py * s,
      pz: cz + IDLE.pz * s,
      tx: cx + IDLE.tx * s,
      ty: cy + IDLE.ty * s,
      tz: cz + IDLE.tz * s,
    }
  }

  useEffect(() => {
    const b = basis.current

    if (phase === 'forming') {
      gsap.to(b, { ...IDLE, duration: 4.2, ease: 'power2.inOut', overwrite: 'auto' })
    } else if (phase === 'diving' && divingTo) {
      gsap.to(b, {
        ...childPose(divingTo),
        duration: 2.1,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: finishDive,
      })
    } else if (phase === 'surfacing' && surfacedFrom) {
      // scene already re-rooted on the parent: snap to the equivalent
      // in-parent pose (identical framing), then pull back out
      gsap.killTweensOf(b)
      Object.assign(b, childPose(surfacedFrom))
      gsap.to(b, {
        ...IDLE,
        duration: 1.9,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onComplete: finishSurface,
      })
    } else if (phase === 'idle' && prevPhase.current === 'diving') {
      // seamless swap: the child is now the root — same framing, new space
      gsap.killTweensOf(b)
      Object.assign(b, IDLE)
    }

    prevPhase.current = phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, divingTo, surfacedFrom, path])

  useFrame((state, dt) => {
    const amp = phase === 'idle' ? 0.06 : 0.008
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, state.pointer.x * amp, 3, dt)
    parallax.current.y = THREE.MathUtils.damp(
      parallax.current.y,
      state.pointer.y * amp * 0.6,
      3,
      dt,
    )

    const b = basis.current
    state.camera.position.set(b.px + parallax.current.x, b.py + parallax.current.y, b.pz)
    look.set(b.tx, b.ty, b.tz)
    state.camera.lookAt(look)
  })

  return null
}
