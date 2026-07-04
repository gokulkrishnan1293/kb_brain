import {
  KnowledgeLink,
  LINKS,
  lcaOf,
  childToward,
  nodeById,
  repAt,
} from '../data/portfolio'
import { layoutChildren } from './layout'

/** an aggregated pathway between two endpoints of the current view */
export interface ViewEdge {
  /** child id of the current root, or 'self' = the root's own core */
  a: string | 'self'
  b: string | 'self'
  links: KnowledgeLink[]
}

/** links leaving the current view, grouped by destination branch */
export interface ViewPortal {
  key: string
  /** node (at the LCA level) whose subtree the links lead to — the label */
  branchId: string
  /** unit direction from this brain toward that branch, local space */
  direction: [number, number, number]
  /** endpoints inside the current view that use this portal */
  via: (string | 'self')[]
  links: KnowledgeLink[]
}

/**
 * Projects the global LINKS list onto the view rooted at `rootId`:
 * links between two of the root's children (or their descendants) roll
 * up into aggregated edges; links whose far end lies outside the root
 * become portals on the shell, pointing toward their destination.
 */
export function computeLinkView(rootId: string): {
  edges: ViewEdge[]
  portals: ViewPortal[]
} {
  const edgeMap = new Map<string, ViewEdge>()
  const portalMap = new Map<string, ViewPortal>()

  for (const link of LINKS) {
    const ra = repAt(rootId, link.from)
    const rb = repAt(rootId, link.to)
    if (ra.kind === 'outside' && rb.kind === 'outside') continue

    if (ra.kind !== 'outside' && rb.kind !== 'outside') {
      const a = ra.kind === 'self' ? 'self' : ra.id
      const b = rb.kind === 'self' ? 'self' : rb.id
      if (a === b) continue // internal to one child — invisible at this level
      const key = [a, b].sort().join('→')
      let edge = edgeMap.get(key)
      if (!edge) edgeMap.set(key, (edge = { a, b, links: [] }))
      edge.links.push(link)
      continue
    }

    // one end outside the current view → portal
    const aInside = ra.kind !== 'outside'
    const insideRep = aInside ? ra : rb
    const outsideId = aInside ? link.to : link.from
    const via: string | 'self' =
      insideRep.kind === 'child' ? insideRep.id : 'self'

    const lca = lcaOf(rootId, outsideId)
    const branchId = childToward(lca, outsideId) ?? outsideId
    const hereBranch = childToward(lca, rootId)

    let portal = portalMap.get(branchId)
    if (!portal) {
      // direction: relative placement of the two branches at the LCA level
      const lcaNode = nodeById(lca)
      const layout = layoutChildren(lcaNode.children.length)
      const iHere = lcaNode.children.findIndex((c) => c.id === hereBranch)
      const iThere = lcaNode.children.findIndex((c) => c.id === branchId)
      let dir: [number, number, number] = [0, 0.4, 0.9]
      if (iHere >= 0 && iThere >= 0) {
        const p1 = layout[iHere].position
        const p2 = layout[iThere].position
        const d = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
        const len = Math.hypot(d[0], d[1], d[2]) || 1
        dir = [d[0] / len, d[1] / len, d[2] / len]
      }
      portalMap.set(
        branchId,
        (portal = {
          key: `portal:${branchId}`,
          branchId,
          direction: dir,
          via: [],
          links: [],
        }),
      )
    }
    if (!portal.via.includes(via)) portal.via.push(via)
    portal.links.push(link)
  }

  return { edges: [...edgeMap.values()], portals: [...portalMap.values()] }
}

/** all view edges touching a given child (for selection highlighting) */
export function edgesTouching(edges: ViewEdge[], childId: string): ViewEdge[] {
  return edges.filter((e) => e.a === childId || e.b === childId)
}
