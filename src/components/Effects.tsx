import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import { useBrainStore } from '../state/useBrainStore'

/**
 * Post pipeline: mipmap bloom (the whole holographic look leans on it)
 * plus a soft vignette. Bloom intensity breathes in idle, lifts on
 * hover and when the knowledge core is open.
 */
export function Effects() {
  const bloom = useRef<BloomEffect>(null!)
  const level = useRef(0)

  useFrame((state, dt) => {
    if (!bloom.current) return
    const { stage, hovered } = useBrainStore.getState()
    const t = state.clock.elapsedTime

    let target = 1.05
    if (hovered && stage === 'idle') target = 1.4 // Stage 4 — glow up
    if (stage === 'opening' || stage === 'open') target = 1.35
    if (stage === 'cluster') target = 1.25

    level.current = THREE.MathUtils.damp(level.current, target, 3, dt)
    // Stage 3 — gentle bloom pulse
    bloom.current.intensity = level.current + Math.sin(t * 0.65) * 0.11
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        // upstream ref typing expects the class itself; the instance is what we get
        ref={bloom as unknown as React.RefObject<typeof BloomEffect>}
        mipmapBlur
        intensity={1.05}
        luminanceThreshold={0.08}
        luminanceSmoothing={0.35}
        radius={0.85}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.82} />
    </EffectComposer>
  )
}
