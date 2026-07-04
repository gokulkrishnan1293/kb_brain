import { useMemo } from 'react'
import * as THREE from 'three'
import { NeuralGraph, PacketData } from '../lib/buildGraph'
import {
  neuralLineVert,
  neuralLineFrag,
  packetVert,
  packetFrag,
} from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { COLORS } from '../config'

interface Props {
  graph: NeuralGraph
  packets: PacketData
  shared: SharedUniforms
}

/**
 * Stage 2 — sparse hub graph: thin glowing connections plus light
 * packets continuously travelling along random edges. Two draw calls.
 */
export function NeuralNetwork({ graph, packets, shared }: Props) {
  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(graph.linePositions, 3))
    geo.setAttribute('aSide', new THREE.BufferAttribute(graph.lineSides, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(graph.lineSeeds, 1))
    return geo
  }, [graph])

  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: neuralLineVert,
        fragmentShader: neuralLineFrag,
        uniforms: {
          ...shared,
          uOpacity: { value: 0.16 },
          uColorA: { value: new THREE.Color(COLORS.electricBlue) },
          uColorB: { value: new THREE.Color(COLORS.cyan) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared],
  )

  const packetGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(packets.starts, 3))
    geo.setAttribute('aEnd', new THREE.BufferAttribute(packets.ends, 3))
    geo.setAttribute('aSideStart', new THREE.BufferAttribute(packets.sideStarts, 1))
    geo.setAttribute('aSideEnd', new THREE.BufferAttribute(packets.sideEnds, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(packets.speeds, 1))
    geo.setAttribute('aOffset', new THREE.BufferAttribute(packets.offsets, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(packets.seeds, 1))
    return geo
  }, [packets])

  const packetMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: packetVert,
        fragmentShader: packetFrag,
        uniforms: {
          ...shared,
          uOpacity: { value: 1 },
          uColorA: { value: new THREE.Color(COLORS.cyan).lerp(new THREE.Color('#ffffff'), 0.35) },
          uColorB: { value: new THREE.Color(COLORS.gold) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [shared],
  )

  return (
    <group>
      <lineSegments geometry={lineGeometry} material={lineMaterial} frustumCulled={false} />
      <points geometry={packetGeometry} material={packetMaterial} frustumCulled={false} />
    </group>
  )
}
