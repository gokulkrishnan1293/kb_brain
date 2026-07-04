import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { COLORS } from '../config'

export interface BrainSamples {
  count: number
  /** particle rest positions on the brain surface */
  positions: Float32Array
  /** per-particle RGB from the enterprise palette */
  colors: Float32Array
  /** world-space point sizes */
  sizes: Float32Array
  /** random phase/seed per particle, drives pulse + noise variation */
  seeds: Float32Array
  /** -1 left hemisphere, +1 right — drives the split animation */
  sides: Float32Array
  /** far scattered start positions for the dust → form intro */
  scatters: Float32Array
  /** geometry bounds — drives the stem-up assembly stagger */
  minY: number
  yRange: number
}

const paletteWeighted = [
  { color: new THREE.Color(COLORS.electricBlue), weight: 0.42 },
  { color: new THREE.Color(COLORS.cyan), weight: 0.32 },
  { color: new THREE.Color(COLORS.teal), weight: 0.22 },
  { color: new THREE.Color(COLORS.gold), weight: 0.04 }, // small gold accent
]

function pickColor(r: number, out: THREE.Color) {
  let acc = 0
  for (const entry of paletteWeighted) {
    acc += entry.weight
    if (r <= acc) {
      out.copy(entry.color)
      return
    }
  }
  out.copy(paletteWeighted[0].color)
}

/**
 * Converts the brain mesh surface into a GPU-ready particle cloud
 * using MeshSurfaceSampler (Stage 1).
 */
export function sampleBrainSurface(
  geometry: THREE.BufferGeometry,
  count: number,
): BrainSamples {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  const sampler = new MeshSurfaceSampler(mesh).build()

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const sides = new Float32Array(count)
  const scatters = new Float32Array(count * 3)

  const p = new THREE.Vector3()
  const c = new THREE.Color()
  const jitter = new THREE.Color()

  for (let i = 0; i < count; i++) {
    sampler.sample(p)
    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z

    pickColor(Math.random(), c)
    // subtle per-particle lightness variation so the field doesn't band
    const l = 0.85 + Math.random() * 0.35
    jitter.copy(c).multiplyScalar(l)
    colors[i * 3] = jitter.r
    colors[i * 3 + 1] = jitter.g
    colors[i * 3 + 2] = jitter.b

    // varying sizes; ~2% oversized "star" particles catch the bloom
    const star = Math.random() < 0.02
    sizes[i] = star
      ? 0.014 + Math.random() * 0.008
      : 0.0038 + Math.random() * 0.0052

    seeds[i] = Math.random()
    sides[i] = p.x >= 0 ? 1 : -1

    // scattered nebula start position (dust → form intro)
    const theta = Math.random() * Math.PI * 2
    const cosPhi = Math.random() * 2 - 1
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi)
    const r = 2.4 + Math.pow(Math.random(), 0.7) * 2.4
    scatters[i * 3] = Math.cos(theta) * sinPhi * r
    scatters[i * 3 + 1] = cosPhi * r
    scatters[i * 3 + 2] = Math.sin(theta) * sinPhi * r
  }

  mesh.material.dispose()

  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  return {
    count,
    positions,
    colors,
    sizes,
    seeds,
    sides,
    scatters,
    minY: box.min.y,
    yRange: Math.max(box.max.y - box.min.y, 1e-3),
  }
}

/**
 * Normalises raw GLB geometry: bakes the node transform, recenters on the
 * origin and scales so the largest dimension equals `targetSize`.
 */
export function normalizeGeometry(
  source: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  targetSize: number,
): THREE.BufferGeometry {
  const geo = source.clone()
  geo.applyMatrix4(worldMatrix)
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const scale = targetSize / Math.max(size.x, size.y, size.z)
  geo.translate(-center.x, -center.y, -center.z)
  geo.scale(scale, scale, scale)
  geo.computeBoundingSphere()
  return geo
}
