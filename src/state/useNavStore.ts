import { create } from 'zustand'
import { PORTFOLIO } from '../data/portfolio'

/**
 * Discrete navigation state. Continuous motion (zoom progress) lives in
 * navMotion; this store tracks where we are and what is selected.
 *
 *  boot ─▶ forming ─▶ explore
 *
 * In explore, `path` changes only at the seamless swap points:
 * descend() when a dive completes, ascend() when surfacing begins.
 */
export type Phase = 'boot' | 'forming' | 'explore'

interface NavState {
  phase: Phase
  path: string[]
  /** click-selected node (child id) or portal key ('portal:<branchId>') */
  selectedId: string | null
  hoveredChild: string | null
  /** travel controller is flying a multi-hop journey */
  traveling: boolean

  beginForm: () => void
  finishForm: () => void
  setHoveredChild: (id: string | null) => void
  select: (id: string) => void
  deselect: () => void
  /** re-root one level down (called by the frame loop at the swap point) */
  descend: (childId: string) => void
  /** re-root one level up; returns the child we were in, or null at root */
  ascend: () => string | null
}

export const useNavStore = create<NavState>((set, get) => ({
  phase: 'boot',
  path: [PORTFOLIO.id],
  selectedId: null,
  hoveredChild: null,
  traveling: false,

  beginForm: () => {
    if (get().phase === 'boot') set({ phase: 'forming' })
  },

  finishForm: () => {
    if (get().phase === 'forming') set({ phase: 'explore' })
  },

  setHoveredChild: (hoveredChild) => set({ hoveredChild }),

  select: (id) => {
    if (get().phase === 'explore') set({ selectedId: id })
  },

  deselect: () => set({ selectedId: null }),

  descend: (childId) =>
    set((s) => ({
      path: [...s.path, childId],
      selectedId: null,
      hoveredChild: null,
    })),

  ascend: () => {
    const { path } = get()
    if (path.length <= 1) return null
    const popped = path[path.length - 1]
    set({ path: path.slice(0, -1), selectedId: null, hoveredChild: null })
    return popped
  },
}))
