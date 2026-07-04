import { useMemo } from 'react'
import * as THREE from 'three'
import { BrainSamples } from '../lib/sampleSurface'
import { brainParticleVert, brainParticleFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'

interface Props {
  samples: BrainSamples
  shared: SharedUniforms
}

/**
 * Stage 1 — the brain rendered as a single draw call of ~200k
 * additive-blended points. All motion (noise float, pulse, split)
 * happens in the vertex shader.
 */
export function ParticleBrain({ samples, shared }: Props) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(samples.positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(samples.colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(samples.sizes, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(samples.seeds, 1))
    geo.setAttribute('aSide', new THREE.BufferAttribute(samples.sides, 1))
    return geo
  }, [samples])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: brainParticleVert,
        fragmentShader: brainParticleFrag,
        uniforms: {
          ...shared,
          uOpacity: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
