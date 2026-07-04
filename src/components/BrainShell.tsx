import { useMemo } from 'react'
import * as THREE from 'three'
import {
  brainParticleVert,
  brainParticleFrag,
  neuralLineVert,
  neuralLineFrag,
  packetVert,
  packetFrag,
} from '../three/shaders'
import { SharedUniforms, ShellControls } from '../three/uniforms'
import { COLORS } from '../config'

/**
 * GPU buffers built once from the sampled brain and shared by every
 * shell in the scene — the root brain and each mini-brain create their
 * own BufferGeometry but reference the SAME attribute arrays, using
 * drawRange to render fewer particles at small scales (built-in LOD).
 */
export interface ShellBuffers {
  point: Record<string, THREE.BufferAttribute>
  line: Record<string, THREE.BufferAttribute>
  packet: Record<string, THREE.BufferAttribute>
  maxEdges: number
}

interface Props {
  buffers: ShellBuffers
  shared: SharedUniforms
  controls: ShellControls
  /** particles to draw (subset of the shared buffer) */
  pointCount: number
  /** connection edges to draw */
  edgeCount: number
  withPackets?: boolean
  /** base particle opacity — lower on the root so the interior reads */
  opacity?: number
}

export function BrainShell({
  buffers,
  shared,
  controls,
  pointCount,
  edgeCount,
  withPackets = false,
  opacity = 0.85,
}: Props) {
  const pointGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    for (const [name, attr] of Object.entries(buffers.point)) geo.setAttribute(name, attr)
    geo.setDrawRange(0, pointCount)
    return geo
  }, [buffers, pointCount])

  const pointMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: brainParticleVert,
        fragmentShader: brainParticleFrag,
        uniforms: {
          ...shared,
          uForm: controls.uForm,
          uFade: controls.uFade,
          uFocus: controls.uFocus,
          uTint: controls.uTint,
          uTintAmount: controls.uTintAmount,
          uSizeMul: controls.uSizeMul,
          uOpacity: { value: opacity },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared, controls],
  )

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    for (const [name, attr] of Object.entries(buffers.line)) geo.setAttribute(name, attr)
    geo.setDrawRange(0, Math.min(edgeCount, buffers.maxEdges) * 2)
    return geo
  }, [buffers, edgeCount])

  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: neuralLineVert,
        fragmentShader: neuralLineFrag,
        uniforms: {
          ...shared,
          uOpacity: controls.uLineOpacity,
          uTint: controls.uTint,
          uTintAmount: controls.uTintAmount,
          uColorA: { value: new THREE.Color(COLORS.electricBlue) },
          uColorB: { value: new THREE.Color(COLORS.cyan) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared, controls],
  )

  const packetGeometry = useMemo(() => {
    if (!withPackets) return null
    const geo = new THREE.BufferGeometry()
    for (const [name, attr] of Object.entries(buffers.packet)) geo.setAttribute(name, attr)
    return geo
  }, [buffers, withPackets])

  const packetMaterial = useMemo(() => {
    if (!withPackets) return null
    return new THREE.ShaderMaterial({
      vertexShader: packetVert,
      fragmentShader: packetFrag,
      uniforms: {
        ...shared,
        uOpacity: controls.uPacketOpacity,
        uSizeMul: controls.uSizeMul,
        uColorA: {
          value: new THREE.Color(COLORS.cyan).lerp(new THREE.Color('#ffffff'), 0.35),
        },
        uColorB: { value: new THREE.Color(COLORS.gold) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [shared, controls, withPackets])

  return (
    <group>
      <points geometry={pointGeometry} material={pointMaterial} frustumCulled={false} />
      <lineSegments geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />
      {packetGeometry && packetMaterial && (
        <points geometry={packetGeometry} material={packetMaterial} frustumCulled={false} />
      )}
    </group>
  )
}
