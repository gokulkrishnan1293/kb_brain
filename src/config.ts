/**
 * Central configuration: palette, quality tiers, cluster layout.
 * Everything visual is tuned from here so the scene stays art-directable.
 */

export const COLORS = {
  electricBlue: '#3BA7FF',
  cyan: '#62F5FF',
  teal: '#35E0C2',
  gold: '#FFC857',
  background: '#050608',
} as const

/** Adaptive quality — keeps particle counts GPU-friendly on weaker machines. */
export const QUALITY = (() => {
  const cores =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8
  const high = cores >= 8
  return {
    high,
    /** Stage 1 — brain surface particles (LOD: 250k hard ceiling) */
    particleCount: high ? 180_000 : 110_000,
    /** Stage 2 — neural hub nodes */
    hubCount: high ? 3_200 : 2_000,
    /** nearest neighbours per hub */
    hubNeighbors: 3,
    /** light packets travelling across the graph */
    packetCount: high ? 2_400 : 1_200,
    /** Stage 6 — particles per knowledge cluster */
    clusterParticleCount: high ? 1_600 : 900,
    /** AI core particles */
    coreParticleCount: high ? 5_000 : 2_800,
    dpr: [1, high ? 1.75 : 1.4] as [number, number],
  }
})()

/** How far each hemisphere slides apart along X (world units). */
export const SPLIT_DISTANCE = 0.92

/** Brain is normalised so its largest dimension equals this. */
export const BRAIN_SIZE = 2.3

export interface ClusterDef {
  name: string
  color: string
  detail: string
}

export const CLUSTERS: ClusterDef[] = [
  { name: 'Memory', color: COLORS.cyan, detail: 'Long-term context & recall' },
  { name: 'Projects', color: COLORS.electricBlue, detail: 'Active initiatives' },
  { name: 'Documents', color: COLORS.teal, detail: 'Indexed knowledge base' },
  { name: 'AI Agents', color: COLORS.gold, detail: 'Autonomous workers' },
  { name: 'Skills', color: COLORS.electricBlue, detail: 'Capability library' },
  { name: 'Workflows', color: COLORS.teal, detail: 'Orchestrated pipelines' },
]

/** Knowledge clusters float on a ring between the opened hemispheres. */
export const CLUSTER_POSITIONS: [number, number, number][] = CLUSTERS.map(
  (_, i) => {
    const a = Math.PI / 2 + (i / CLUSTERS.length) * Math.PI * 2
    return [
      Math.cos(a) * 0.58,
      Math.sin(a) * 0.46,
      (i % 2 === 0 ? 1 : -1) * 0.07,
    ]
  },
)

export const CAMERA = {
  fov: 42,
  idle: { pos: [0, 0.22, 3.1] as const, look: [0, 0.02, 0] as const },
  hover: { pos: [0, 0.2, 2.82] as const, look: [0, 0.02, 0] as const },
  open: { pos: [0, 0.28, 3.45] as const, look: [0, 0, 0] as const },
}
