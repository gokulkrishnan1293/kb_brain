import { create } from 'zustand'
import { PORTFOLIO } from '../data/portfolio'

/**
 * Navigation state machine for recursive zoom-dive:
 *
 *  boot ─▶ forming ─▶ idle ──dive(child)──▶ diving ──(camera arrives,
 *                      ▲  ▲                            re-root on child)──▶ idle
 *                      │  └── surfacing ◀──surface()───┘ (re-roots on parent
 *                      └──────(camera pulls back)         immediately)
 *
 * `path` holds node ids from the portfolio root down to the current root.
 */
export type Phase = 'boot' | 'forming' | 'idle' | 'diving' | 'surfacing'

interface NavState {
  phase: Phase
  path: string[]
  /** child id the camera is flying into */
  divingTo: string | null
  /** child id the camera is pulling back out of */
  surfacedFrom: string | null
  hoveredChild: string | null
  /** breadcrumb multi-level jump target (depth index), chained one level at a time */
  surfaceTarget: number | null

  beginForm: () => void
  finishForm: () => void
  setHoveredChild: (id: string | null) => void
  dive: (childId: string) => void
  finishDive: () => void
  surface: () => void
  finishSurface: () => void
  surfaceTo: (depth: number) => void
}

export const useNavStore = create<NavState>((set, get) => ({
  phase: 'boot',
  path: [PORTFOLIO.id],
  divingTo: null,
  surfacedFrom: null,
  hoveredChild: null,
  surfaceTarget: null,

  beginForm: () => {
    if (get().phase === 'boot') set({ phase: 'forming' })
  },

  finishForm: () => {
    if (get().phase === 'forming') set({ phase: 'idle' })
  },

  setHoveredChild: (hoveredChild) => set({ hoveredChild }),

  dive: (childId) => {
    if (get().phase !== 'idle') return
    set({ phase: 'diving', divingTo: childId, hoveredChild: null })
  },

  /** called by the camera rig the moment the flight ends — re-roots the scene */
  finishDive: () => {
    const { phase, divingTo, path } = get()
    if (phase !== 'diving' || !divingTo) return
    set({ phase: 'idle', path: [...path, divingTo], divingTo: null })
  },

  surface: () => {
    const { phase, path } = get()
    if (phase !== 'idle' || path.length <= 1) return
    // re-root on the parent immediately; the camera starts inside the
    // child (now a mini-brain again) and pulls back out
    set({
      phase: 'surfacing',
      path: path.slice(0, -1),
      surfacedFrom: path[path.length - 1],
      hoveredChild: null,
    })
  },

  finishSurface: () => {
    const { phase, surfaceTarget, path } = get()
    if (phase !== 'surfacing') return
    set({ phase: 'idle', surfacedFrom: null })
    if (surfaceTarget !== null) {
      if (path.length - 1 > surfaceTarget) get().surface()
      else set({ surfaceTarget: null })
    }
  },

  surfaceTo: (depth) => {
    const { phase, path } = get()
    if (phase !== 'idle' || depth >= path.length - 1 || depth < 0) return
    set({ surfaceTarget: depth })
    get().surface()
  },
}))
