import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import { useNavStore } from '../state/useNavStore'

/**
 * Post pipeline: mipmap bloom (the whole holographic look leans on it)
 * plus a soft vignette. Bloom breathes in idle, sparkles while the dust
 * assembles and lifts slightly during dives.
 */
export function Effects() {
  const bloom = useRef<BloomEffect>(null!)
  const level = useRef(1.3)

  useFrame((state, dt) => {
    if (!bloom.current) return
    const { phase, hoveredChild } = useNavStore.getState()
    const t = state.clock.elapsedTime

    let target = 0.95
    if (phase === 'forming') target = 1.3
    else if (phase === 'diving') target = 1.3
    else if (phase === 'surfacing') target = 1.2
    else if (hoveredChild) target = 1.25

    level.current = THREE.MathUtils.damp(level.current, target, 3, dt)
    // gentle idle bloom pulse
    bloom.current.intensity = level.current + Math.sin(t * 0.65) * 0.11
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        // upstream ref typing expects the class itself; the instance is what we get
        ref={bloom as unknown as React.RefObject<typeof BloomEffect>}
        mipmapBlur
        intensity={1.3}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.35}
        radius={0.85}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.82} />
    </EffectComposer>
  )
}
