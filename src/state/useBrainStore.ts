import { create } from 'zustand'

/**
 * Global interaction state machine.
 *
 *  idle ──click──▶ opening ──(gsap done)──▶ open ──cluster click──▶ cluster
 *   ▲                                        │  ▲                     │
 *   └────────────── close ───────────────────┘  └────── back ─────────┘
 */
export type Stage = 'idle' | 'opening' | 'open' | 'cluster'

interface BrainState {
  stage: Stage
  hovered: boolean
  activeCluster: number | null
  setHovered: (h: boolean) => void
  openBrain: () => void
  /** called by the GSAP split timeline when the hemispheres finish moving */
  finishOpening: () => void
  closeBrain: () => void
  focusCluster: (index: number) => void
  leaveCluster: () => void
}

export const useBrainStore = create<BrainState>((set, get) => ({
  stage: 'idle',
  hovered: false,
  activeCluster: null,

  setHovered: (hovered) => set({ hovered }),

  openBrain: () => {
    if (get().stage === 'idle') set({ stage: 'opening', hovered: false })
  },

  finishOpening: () => {
    if (get().stage === 'opening') set({ stage: 'open' })
  },

  closeBrain: () => {
    const { stage } = get()
    if (stage === 'open' || stage === 'opening')
      set({ stage: 'idle', activeCluster: null })
  },

  focusCluster: (index) => {
    if (get().stage === 'open') set({ stage: 'cluster', activeCluster: index })
  },

  leaveCluster: () => {
    if (get().stage === 'cluster') set({ stage: 'open', activeCluster: null })
  },
}))
