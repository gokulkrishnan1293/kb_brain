import { BrainSamples } from './sampleSurface'

export interface Edge {
  a: number // index into hub arrays
  b: number
}

export interface NeuralGraph {
  hubCount: number
  /** xyz per hub */
  hubPositions: Float32Array
  hubSides: Float32Array
  edges: Edge[]
  /** 2 vertices per edge, xyz */
  linePositions: Float32Array
  lineSides: Float32Array
  lineSeeds: Float32Array
}

/**
 * Stage 2 — builds a sparse "neural" graph over the particle cloud.
 * Hubs are a strided subset of the surface particles; each hub connects
 * to its k nearest hub neighbours found through a uniform spatial hash
 * grid (O(n) instead of O(n²)).
 */
export function buildNeuralGraph(
  samples: BrainSamples,
  hubCount: number,
  k: number,
): NeuralGraph {
  const { positions, sides, count } = samples

  // strided-with-jitter subset gives even coverage without clumping
  const stride = Math.max(1, Math.floor(count / hubCount))
  const hubIndex: number[] = []
  for (let i = 0; i < hubCount; i++) {
    const base = i * stride
    const j = base + Math.floor(Math.random() * stride)
    hubIndex.push(Math.min(j, count - 1))
  }

  const n = hubIndex.length
  const hubPositions = new Float32Array(n * 3)
  const hubSides = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const s = hubIndex[i]
    hubPositions[i * 3] = positions[s * 3]
    hubPositions[i * 3 + 1] = positions[s * 3 + 1]
    hubPositions[i * 3 + 2] = positions[s * 3 + 2]
    hubSides[i] = sides[s]
  }

  // --- spatial hash grid ---
  const cell = 0.14
  const grid = new Map<string, number[]>()
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`

  for (let i = 0; i < n; i++) {
    const key = keyOf(
      hubPositions[i * 3],
      hubPositions[i * 3 + 1],
      hubPositions[i * 3 + 2],
    )
    let bucket = grid.get(key)
    if (!bucket) grid.set(key, (bucket = []))
    bucket.push(i)
  }

  const maxDist = cell * 1.9
  const maxDistSq = maxDist * maxDist
  const edgeSet = new Set<number>()
  const edges: Edge[] = []

  const neighbors: { idx: number; d: number }[] = []
  for (let i = 0; i < n; i++) {
    neighbors.length = 0
    const x = hubPositions[i * 3]
    const y = hubPositions[i * 3 + 1]
    const z = hubPositions[i * 3 + 2]
    const cx = Math.floor(x / cell)
    const cy = Math.floor(y / cell)
    const cz = Math.floor(z / cell)

    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!bucket) continue
          for (const j of bucket) {
            if (j === i) continue
            const ddx = hubPositions[j * 3] - x
            const ddy = hubPositions[j * 3 + 1] - y
            const ddz = hubPositions[j * 3 + 2] - z
            const d = ddx * ddx + ddy * ddy + ddz * ddz
            if (d < maxDistSq) neighbors.push({ idx: j, d })
          }
        }

    neighbors.sort((a, b) => a.d - b.d)
    const links = Math.min(k, neighbors.length)
    for (let m = 0; m < links; m++) {
      const j = neighbors[m].idx
      const key = i < j ? i * n + j : j * n + i
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ a: i, b: j })
    }
  }

  const linePositions = new Float32Array(edges.length * 6)
  const lineSides = new Float32Array(edges.length * 2)
  const lineSeeds = new Float32Array(edges.length * 2)
  for (let e = 0; e < edges.length; e++) {
    const { a, b } = edges[e]
    linePositions.set(
      [
        hubPositions[a * 3], hubPositions[a * 3 + 1], hubPositions[a * 3 + 2],
        hubPositions[b * 3], hubPositions[b * 3 + 1], hubPositions[b * 3 + 2],
      ],
      e * 6,
    )
    lineSides[e * 2] = hubSides[a]
    lineSides[e * 2 + 1] = hubSides[b]
    const seed = Math.random()
    lineSeeds[e * 2] = seed
    lineSeeds[e * 2 + 1] = seed
  }

  return { hubCount: n, hubPositions, hubSides, edges, linePositions, lineSides, lineSeeds }
}

export interface PacketData {
  count: number
  starts: Float32Array
  ends: Float32Array
  sideStarts: Float32Array
  sideEnds: Float32Array
  speeds: Float32Array
  offsets: Float32Array
  seeds: Float32Array
}

/** Light packets that continuously travel along random graph edges. */
export function buildPackets(graph: NeuralGraph, packetCount: number): PacketData {
  const m = Math.min(packetCount, graph.edges.length * 2)
  const starts = new Float32Array(m * 3)
  const ends = new Float32Array(m * 3)
  const sideStarts = new Float32Array(m)
  const sideEnds = new Float32Array(m)
  const speeds = new Float32Array(m)
  const offsets = new Float32Array(m)
  const seeds = new Float32Array(m)

  const { hubPositions, hubSides, edges } = graph
  for (let i = 0; i < m; i++) {
    const edge = edges[Math.floor(Math.random() * edges.length)]
    const flip = Math.random() < 0.5
    const a = flip ? edge.b : edge.a
    const b = flip ? edge.a : edge.b
    starts.set(
      [hubPositions[a * 3], hubPositions[a * 3 + 1], hubPositions[a * 3 + 2]],
      i * 3,
    )
    ends.set(
      [hubPositions[b * 3], hubPositions[b * 3 + 1], hubPositions[b * 3 + 2]],
      i * 3,
    )
    sideStarts[i] = hubSides[a]
    sideEnds[i] = hubSides[b]
    speeds[i] = 0.25 + Math.random() * 0.55
    offsets[i] = Math.random()
    seeds[i] = Math.random()
  }

  return { count: m, starts, ends, sideStarts, sideEnds, speeds, offsets, seeds }
}
