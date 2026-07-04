import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { buildCoreParticles } from '../lib/coreParticles'
import { coreVert, coreFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { QUALITY } from '../config'

interface Props {
  shared: SharedUniforms
  color: string
  radius: number
  reveal: { value: number }
}

/**
 * The glowing intelligence at the centre of the current brain — a
 * swirling particle sphere around a white-hot heart that feeds bloom.
 */
export function NodeCore({ shared, color, radius, reveal }: Props) {
  const heart = useRef<THREE.Mesh>(null!)
  const group = useRef<THREE.Group>(null!)

  const data = useMemo(
    () => buildCoreParticles(QUALITY.coreParticleCount, radius),
    [radius],
  )

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(data.seeds, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
    return geo
  }, [data])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVert,
        fragmentShader: coreFrag,
        uniforms: {
          uTime: shared.uTime,
          uScale: shared.uScale,
          uReveal: reveal,
          uColorA: { value: new THREE.Color(color) },
          uColorB: { value: new THREE.Color('#eafcff') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared, reveal, color],
  )

  useFrame(() => {
    const t = shared.uTime.value
    if (heart.current) {
      const s = reveal.value * radius * (0.2 + Math.sin(t * 2.4) * 0.03)
      heart.current.scale.setScalar(Math.max(s, 0.0001))
    }
    if (group.current) group.current.rotation.y = t * 0.15
  })

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={heart}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={'#e8fbff'} toneMapped={false} />
      </mesh>
    </group>
  )
}
