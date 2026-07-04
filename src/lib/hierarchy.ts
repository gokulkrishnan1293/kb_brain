import * as THREE from 'three'

export interface ClusterHierarchy {
  /** compact blob rest positions (cluster local space) */
  blobPositions: Float32Array
  /** expanded tree positions: root → sub-clusters → documents → nodes */
  treePositions: Float32Array
  colors: Float32Array
  sizes: Float32Array
  seeds: Float32Array
  /** line segments connecting root→subs and subs→docs, revealed on expand */
  treeLines: Float32Array
}

function gaussian() {
  // Box–Muller
  const u = Math.max(Math.random(), 1e-6)
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Stage 7 — precomputes both layouts for a knowledge cluster:
 * a compact holographic blob, and the expanded knowledge tree
 * (Cluster → Sub-clusters → Documents → Individual nodes).
 * A single uExpand uniform morphs between them on the GPU.
 */
export function buildClusterHierarchy(
  count: number,
  baseColor: string,
  accentColor: string,
): ClusterHierarchy {
  const blobPositions = new Float32Array(count * 3)
  const treePositions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)

  const base = new THREE.Color(baseColor)
  const accent = new THREE.Color(accentColor)
  const tmp = new THREE.Color()

  // ---- tree skeleton ----
  const SUBS = 4
  const DOCS_PER_SUB = 5
  const subCenters: THREE.Vector3[] = []
  const docCenters: THREE.Vector3[][] = []

  for (let s = 0; s < SUBS; s++) {
    const a = (s / SUBS) * Math.PI * 2 + 0.5
    const sub = new THREE.Vector3(
      Math.cos(a) * 0.26,
      (s % 2 === 0 ? 1 : -1) * 0.09,
      Math.sin(a) * 0.26,
    )
    subCenters.push(sub)
    const docs: THREE.Vector3[] = []
    for (let d = 0; d < DOCS_PER_SUB; d++) {
      const phi = Math.acos(1 - (2 * (d + 0.5)) / DOCS_PER_SUB)
      const theta = Math.PI * (1 + Math.sqrt(5)) * d
      docs.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        )
          .multiplyScalar(0.105)
          .add(sub),
      )
    }
    docCenters.push(docs)
  }

  // ---- assign particles ----
  for (let i = 0; i < count; i++) {
    // compact blob: gaussian sphere
    blobPositions[i * 3] = gaussian() * 0.055
    blobPositions[i * 3 + 1] = gaussian() * 0.055
    blobPositions[i * 3 + 2] = gaussian() * 0.055

    const r = Math.random()
    let target: THREE.Vector3
    let spread: number
    if (r < 0.08) {
      // stays near the cluster root — keeps the tree anchored
      target = new THREE.Vector3(0, 0, 0)
      spread = 0.035
    } else if (r < 0.2) {
      // highlights a sub-cluster centre
      target = subCenters[i % SUBS]
      spread = 0.028
    } else {
      // individual nodes orbiting a document
      const s = i % SUBS
      const d = Math.floor(i / SUBS) % DOCS_PER_SUB
      target = docCenters[s][d]
      spread = 0.03
    }
    treePositions[i * 3] = target.x + gaussian() * spread
    treePositions[i * 3 + 1] = target.y + gaussian() * spread
    treePositions[i * 3 + 2] = target.z + gaussian() * spread

    tmp.copy(base).lerp(accent, Math.random() * 0.45)
    tmp.multiplyScalar(0.8 + Math.random() * 0.5)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b

    sizes[i] = Math.random() < 0.05
      ? 0.012 + Math.random() * 0.006
      : 0.0032 + Math.random() * 0.004
    seeds[i] = Math.random()
  }

  // ---- connecting lines: root→subs, subs→docs ----
  const segments: number[] = []
  for (let s = 0; s < SUBS; s++) {
    segments.push(0, 0, 0, subCenters[s].x, subCenters[s].y, subCenters[s].z)
    for (let d = 0; d < DOCS_PER_SUB; d++) {
      segments.push(
        subCenters[s].x, subCenters[s].y, subCenters[s].z,
        docCenters[s][d].x, docCenters[s][d].y, docCenters[s][d].z,
      )
    }
  }

  return {
    blobPositions,
    treePositions,
    colors,
    sizes,
    seeds,
    treeLines: new Float32Array(segments),
  }
}

/** Fibonacci sphere point cloud for the AI core. */
export function buildCoreParticles(count: number, radius: number) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    // three shells for depth
    const shell = radius * (0.55 + 0.45 * Math.pow(Math.random(), 0.5))
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * shell
    positions[i * 3 + 1] = Math.cos(phi) * shell
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell
    seeds[i] = Math.random()
    sizes[i] = 0.003 + Math.random() * 0.005
  }
  return { positions, seeds, sizes }
}
