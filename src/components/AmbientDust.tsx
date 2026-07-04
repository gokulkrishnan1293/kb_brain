import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../config'

/**
 * Faint drifting dust far behind the brain — cheap depth cue that keeps
 * the pure-black backdrop from feeling empty.
 */
export function AmbientDust({ count = 500 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 7
      positions[i * 3] = Math.cos(theta) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(theta) * r - 3
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [count])

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(COLORS.electricBlue).multiplyScalar(0.5),
        size: 0.02,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useFrame((state) => {
    if (points.current) points.current.rotation.y = state.clock.elapsedTime * 0.008
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
