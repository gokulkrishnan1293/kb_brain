/**
 * Central configuration: palette, quality tiers, camera poses.
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
    /** root brain surface particles (250k hard ceiling) */
    particleCount: high ? 180_000 : 110_000,
    /** particles per mini-brain (drawRange subset of the same buffer) */
    miniParticleCount: high ? 26_000 : 13_000,
    /** connection edges per mini-brain */
    miniEdgeCount: high ? 1_600 : 900,
    /** neural hub nodes */
    hubCount: high ? 3_200 : 2_000,
    /** nearest neighbours per hub */
    hubNeighbors: 3,
    /** light packets travelling across the root graph */
    packetCount: high ? 2_400 : 1_200,
    /** node-core particles */
    coreParticleCount: high ? 4_000 : 2_400,
    dpr: [1, high ? 1.75 : 1.4] as [number, number],
  }
})()

/** "Doors" flourish — how far hemispheres part while diving. */
export const SPLIT_DISTANCE = 0.92

/** Brain is normalised so its largest dimension equals this. */
export const BRAIN_SIZE = 2.3

/** resting opacity of the neural connection lines */
export const LINE_OPACITY = 0.16

/** resting opacity of dependency pathways between mini-brains */
export const DEP_OPACITY = 0.75

export const CAMERA = {
  fov: 42,
  idle: { pos: [0, 0.22, 3.1] as const, look: [0, 0.02, 0] as const },
  /** where the camera waits while the dust assembles */
  formingStart: { pos: [0, 0.42, 4.7] as const, look: [0, 0.02, 0] as const },
}
