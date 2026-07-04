import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { CAMERA, CLUSTER_POSITIONS } from '../config'
import { useBrainStore } from '../state/useBrainStore'

/**
 * Cinematic camera: GSAP flies a virtual basis (position + look target)
 * between stages; a small damped pointer parallax rides on top so the
 * scene always feels alive without OrbitControls fighting the tweens.
 */
export function CameraRig() {
  const stage = useBrainStore((s) => s.stage)
  const hovered = useBrainStore((s) => s.hovered)
  const activeCluster = useBrainStore((s) => s.activeCluster)

  const basis = useRef({
    px: CAMERA.idle.pos[0],
    py: CAMERA.idle.pos[1],
    pz: CAMERA.idle.pos[2],
    tx: CAMERA.idle.look[0],
    ty: CAMERA.idle.look[1],
    tz: CAMERA.idle.look[2],
  })
  const parallax = useRef({ x: 0, y: 0 })
  const look = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    let pos: readonly number[]
    let lookAt: readonly number[]
    let duration = 1.6
    let ease = 'power3.inOut'

    if (stage === 'cluster' && activeCluster !== null) {
      // Stage 7 — fly into the selected knowledge cluster
      const [cx, cy, cz] = CLUSTER_POSITIONS[activeCluster]
      pos = [cx * 1.32, cy * 1.32 + 0.03, cz + 0.9]
      lookAt = [cx, cy, cz]
      duration = 1.9
    } else if (stage === 'open' || stage === 'opening') {
      pos = CAMERA.open.pos
      lookAt = CAMERA.open.look
      duration = 1.7
    } else if (hovered) {
      // Stage 4 — ease slightly closer on hover
      pos = CAMERA.hover.pos
      lookAt = CAMERA.hover.look
      duration = 1.0
      ease = 'power2.out'
    } else {
      pos = CAMERA.idle.pos
      lookAt = CAMERA.idle.look
      duration = 1.4
    }

    gsap.to(basis.current, {
      px: pos[0],
      py: pos[1],
      pz: pos[2],
      tx: lookAt[0],
      ty: lookAt[1],
      tz: lookAt[2],
      duration,
      ease,
      overwrite: 'auto',
    })
  }, [stage, hovered, activeCluster])

  useFrame((state, dt) => {
    const amp = stage === 'cluster' ? 0.015 : 0.07
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, state.pointer.x * amp, 3, dt)
    parallax.current.y = THREE.MathUtils.damp(parallax.current.y, state.pointer.y * amp * 0.6, 3, dt)

    const b = basis.current
    state.camera.position.set(b.px + parallax.current.x, b.py + parallax.current.y, b.pz)
    look.set(b.tx, b.ty, b.tz)
    state.camera.lookAt(look)
  })

  return null
}
