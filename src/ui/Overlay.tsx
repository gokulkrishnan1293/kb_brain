import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { CLUSTERS } from '../config'
import { useBrainStore } from '../state/useBrainStore'

const HINTS: Record<string, string> = {
  idle: 'Click the brain to open the knowledge core',
  opening: 'Opening neural core…',
  open: 'Select a knowledge cluster to explore',
  cluster: 'Click empty space or press Esc to return',
}

/**
 * Minimal enterprise chrome: title block, contextual hint, breadcrumb
 * and back navigation. Pure DOM — crisp text over the WebGL canvas.
 */
export function Overlay() {
  const stage = useBrainStore((s) => s.stage)
  const activeCluster = useBrainStore((s) => s.activeCluster)
  const closeBrain = useBrainStore((s) => s.closeBrain)
  const leaveCluster = useBrainStore((s) => s.leaveCluster)
  const { active: loading, progress } = useProgress()

  /* Esc steps back one level */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useBrainStore.getState()
      if (s.stage === 'cluster') s.leaveCluster()
      else if (s.stage === 'open' || s.stage === 'opening') s.closeBrain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clusterName = activeCluster !== null ? CLUSTERS[activeCluster].name : null

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
          <span className={stage === 'idle' ? 'live' : ''}>Brain</span>
          {(stage === 'open' || stage === 'opening' || stage === 'cluster') && (
            <>
              <em>/</em>
              <span className={stage === 'open' || stage === 'opening' ? 'live' : ''}>Core</span>
            </>
          )}
          {clusterName && (
            <>
              <em>/</em>
              <span className="live">{clusterName}</span>
            </>
          )}
        </nav>
      </header>

      <footer className="hud hud-bottom">
        <p className="hint">{HINTS[stage]}</p>
        <div className="actions">
          {stage === 'cluster' && (
            <button onClick={leaveCluster}>← Back to core</button>
          )}
          {(stage === 'open' || stage === 'cluster') && (
            <button
              onClick={() => {
                if (stage === 'cluster') leaveCluster()
                closeBrain()
              }}
            >
              Close core
            </button>
          )}
        </div>
      </footer>
    </>
  )
}
