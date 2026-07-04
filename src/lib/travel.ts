import gsap from 'gsap'
import { navMotion } from '../state/navMotion'
import { useNavStore } from '../state/useNavStore'

const nextFrameUntil = (cond: () => boolean) =>
  new Promise<void>((resolve) => {
    const tick = () => (cond() ? resolve() : requestAnimationFrame(tick))
    tick()
  })

function isPrefix(prefix: string[], full: string[]) {
  return prefix.every((id, i) => full[i] === id)
}

/** double-click / programmatic single-level dive — same motion as scrolling */
export function diveInto(childId: string) {
  const s = useNavStore.getState()
  if (s.phase !== 'explore' || s.traveling) return
  gsap.killTweensOf(navMotion)
  navMotion.targetId = childId
  gsap.to(navMotion, { zoomGoal: 1.02, duration: 1.5, ease: 'power2.inOut' })
}

/**
 * Multi-hop journey: surface to the common ancestor, glide across,
 * dive down to `targetPath`, optionally selecting a node on arrival —
 * the "zoom out, over, in" traversal of a knowledge link.
 */
export async function travelTo(targetPath: string[], selectId?: string) {
  const store = useNavStore.getState()
  if (store.phase !== 'explore' || store.traveling) return
  useNavStore.setState({ traveling: true, selectedId: null, hoveredChild: null })
  navMotion.auto = true
  gsap.killTweensOf(navMotion)

  try {
    // settle any in-progress zoom first
    gsap.to(navMotion, { zoomGoal: 0, duration: 0.5, ease: 'power1.out' })
    await nextFrameUntil(() => navMotion.zoom < 0.03)

    // up to the common ancestor
    while (!isPrefix(useNavStore.getState().path, targetPath)) {
      const popped = useNavStore.getState().ascend()
      if (!popped) break
      navMotion.targetId = popped
      navMotion.zoom = 1
      navMotion.zoomGoal = 1
      gsap.to(navMotion, { zoomGoal: 0, duration: 1.05, ease: 'power1.inOut' })
      await nextFrameUntil(() => navMotion.zoom < 0.03)
      navMotion.targetId = null
    }

    // down to the destination
    while (useNavStore.getState().path.length < targetPath.length) {
      const nextId = targetPath[useNavStore.getState().path.length]
      navMotion.targetId = nextId
      gsap.to(navMotion, { zoomGoal: 1.02, duration: 1.15, ease: 'power1.inOut' })
      const want = useNavStore.getState().path.length + 1
      await nextFrameUntil(() => useNavStore.getState().path.length >= want)
    }

    if (selectId) useNavStore.getState().select(selectId)
  } finally {
    gsap.killTweensOf(navMotion)
    navMotion.auto = false
    navMotion.zoomGoal = 0
    useNavStore.setState({ traveling: false })
  }
}

/** Esc / Surface button — one deliberate level up */
export function surfaceOneLevel() {
  const { path } = useNavStore.getState()
  if (path.length > 1) void travelTo(path.slice(0, -1))
}
