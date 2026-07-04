import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { nodeById, nodeByPath } from '../data/portfolio'
import { useNavStore } from '../state/useNavStore'

/**
 * Minimal enterprise chrome: title block, clickable breadcrumb trail,
 * node info card and contextual hints. Pure DOM over the WebGL canvas.
 */
export function Overlay() {
  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)
  const divingTo = useNavStore((s) => s.divingTo)
  const surface = useNavStore((s) => s.surface)
  const surfaceTo = useNavStore((s) => s.surfaceTo)
  const { active: loading, progress } = useProgress()

  /* Esc surfaces one level */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useNavStore.getState().surface()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const current = nodeByPath(path)
  const depth = path.length - 1

  const hint =
    phase === 'forming'
      ? 'Assembling neural fabric…'
      : phase === 'diving' && divingTo
        ? `Entering ${nodeById(divingTo).name}…`
        : phase === 'surfacing'
          ? 'Surfacing…'
          : current.children.length > 0
            ? depth === 0
              ? 'Click a program brain to dive inside'
              : 'Dive deeper — click a system, Esc to surface'
            : 'Innermost node — Esc or click empty space to surface'

  return (
    <>
      <div className={`loading ${loading ? '' : 'done'}`}>
        <div className="loading-inner">
          <div className="loading-ring" />
          <span>INITIALISING NEURAL CORE — {Math.round(progress)}%</span>
        </div>
      </div>

      <header className="hud hud-top">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <h1>Neural Knowledge Core</h1>
            <p>Enterprise AI Knowledge Platform</p>
          </div>
        </div>

        <nav className="breadcrumb">
          {path.map((id, i) => {
            const node = nodeById(id)
            const isLast = i === path.length - 1
            return (
              <span key={id} className="crumb">
                {i > 0 && <em>/</em>}
                <button
                  className={isLast ? 'live' : ''}
                  disabled={isLast || phase !== 'idle'}
                  onClick={() => surfaceTo(i)}
                >
                  {node.name}
                </button>
              </span>
            )
          })}
        </nav>
      </header>

      <aside className={`node-card ${phase === 'idle' ? 'visible' : ''}`}>
        <span className="node-kicker" style={{ color: current.color }}>
          {depth === 0 ? 'Portfolio' : `Level ${depth}`}
        </span>
        <h2>{current.name}</h2>
        <p>{current.detail}</p>
        <span className="node-meta">
          {current.children.length > 0
            ? `${current.children.length} systems inside`
            : 'Leaf node'}
        </span>
      </aside>

      <footer className="hud hud-bottom">
        <p className="hint">{hint}</p>
        <div className="actions">
          {depth > 0 && phase === 'idle' && (
            <button onClick={surface}>← Surface</button>
          )}
        </div>
      </footer>
    </>
  )
}
