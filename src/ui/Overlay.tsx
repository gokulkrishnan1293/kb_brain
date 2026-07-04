import { useEffect, useMemo } from 'react'
import { useProgress } from '@react-three/drei'
import {
  LINKS,
  nodeById,
  nodeByPath,
  parentIdOf,
  pathOf,
  repAt,
} from '../data/portfolio'
import { computeLinkView } from '../lib/linkView'
import { surfaceOneLevel, travelTo } from '../lib/travel'
import { useNavStore } from '../state/useNavStore'

/**
 * Enterprise chrome: title, clickable breadcrumb, node/selection card
 * with travel-able connections, contextual hints. Pure DOM.
 */
export function Overlay() {
  const phase = useNavStore((s) => s.phase)
  const path = useNavStore((s) => s.path)
  const selectedId = useNavStore((s) => s.selectedId)
  const traveling = useNavStore((s) => s.traveling)
  const deselect = useNavStore((s) => s.deselect)
  const { active: loading, progress } = useProgress()

  /* Esc: deselect first, then surface */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useNavStore.getState()
      if (s.selectedId) s.deselect()
      else surfaceOneLevel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const current = nodeByPath(path)
  const depth = path.length - 1
  const linkView = useMemo(() => computeLinkView(current.id), [current])

  /* card model: selected child, selected portal, or the current root */
  const card = useMemo(() => {
    if (selectedId && selectedId.startsWith('portal:')) {
      const portal = linkView.portals.find((p) => p.key === selectedId)
      if (portal) {
        const branch = nodeById(portal.branchId)
        return {
          kicker: 'External connection',
          color: branch.color,
          title: `⇄ ${branch.name}`,
          detail: `${portal.links.length} knowledge link${portal.links.length > 1 ? 's' : ''} leave this brain toward ${branch.name}.`,
          meta: 'Double-click the portal to travel',
          links: portal.links,
        }
      }
    }
    if (selectedId) {
      const node = nodeById(selectedId)
      const links = LINKS.filter((l) => {
        const ra = repAt(current.id, l.from)
        const rb = repAt(current.id, l.to)
        const aIsSel = ra.kind === 'child' && ra.id === selectedId
        const bIsSel = rb.kind === 'child' && rb.id === selectedId
        // exactly one endpoint here — links internal to the node aren't connections
        return aIsSel !== bIsSel
      })
      return {
        kicker: 'Selected',
        color: node.color,
        title: node.name,
        detail: node.detail,
        meta:
          node.children.length > 0
            ? `${node.children.length} systems inside · double-click to dive`
            : 'Leaf node · double-click to dive',
        links,
      }
    }
    return {
      kicker: depth === 0 ? 'Portfolio' : `Level ${depth}`,
      color: current.color,
      title: current.name,
      detail: current.detail,
      meta:
        current.children.length > 0
          ? `${current.children.length} systems inside`
          : 'Leaf node',
      links: [],
    }
  }, [selectedId, current, depth, linkView])

  const hint =
    phase === 'forming'
      ? 'Assembling neural fabric…'
      : traveling
        ? 'Traversing knowledge link…'
        : selectedId
          ? 'Showing linkage — click a connection to travel it, Esc to clear'
          : current.children.length > 0
            ? 'Scroll to zoom in · drag to rotate · click a brain to inspect'
            : 'Innermost node — scroll out or press Esc to surface'

  /** row click: travel to the link's far end (or just select a sibling) */
  const followLink = (from: string, to: string) => {
    const selfSide =
      selectedId && !selectedId.startsWith('portal:') ? selectedId : null
    const fromRep = repAt(current.id, from)
    const farId =
      selfSide && fromRep.kind === 'child' && fromRep.id === selfSide ? to : from
    const rep = repAt(current.id, farId)
    if (rep.kind === 'child' && rep.id === farId) {
      // a direct sibling — just shift the selection to it
      useNavStore.getState().select(farId)
    } else {
      // deeper or elsewhere — travel to its parent view and select it there
      const parent = parentIdOf(farId)
      if (parent) void travelTo(pathOf(parent), farId)
    }
  }

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
                  disabled={isLast || phase !== 'explore' || traveling}
                  onClick={() => void travelTo(path.slice(0, i + 1))}
                >
                  {node.name}
                </button>
              </span>
            )
          })}
        </nav>
      </header>

      <aside className={`node-card ${phase === 'explore' ? 'visible' : ''}`}>
        <span className="node-kicker" style={{ color: card.color }}>
          {card.kicker}
        </span>
        <h2>{card.title}</h2>
        <p>{card.detail}</p>
        <span className="node-meta">{card.meta}</span>

        {card.links.length > 0 && (
          <div className="link-list">
            {card.links.map((l, i) => {
              const other =
                selectedId &&
                !selectedId.startsWith('portal:') &&
                repAt(current.id, l.from).kind === 'child' &&
                (repAt(current.id, l.from) as { id?: string }).id === selectedId
                  ? l.to
                  : l.from
              const otherNode = nodeById(other)
              return (
                <button
                  key={i}
                  className="link-row"
                  disabled={traveling}
                  onClick={() => followLink(l.from, l.to)}
                >
                  <span className="link-dot" style={{ background: otherNode.color }} />
                  <span className="link-name">{otherNode.name}</span>
                  <span className="link-tag">{l.label ?? 'knowledge'}</span>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      <footer className="hud hud-bottom">
        <p className="hint">{hint}</p>
        <div className="actions">
          {selectedId && phase === 'explore' && (
            <button onClick={deselect}>Clear selection</button>
          )}
          {depth > 0 && phase === 'explore' && !traveling && (
            <button onClick={surfaceOneLevel}>← Surface</button>
          )}
        </div>
      </footer>
    </>
  )
}
