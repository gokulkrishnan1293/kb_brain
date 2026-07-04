import { COLORS } from '../config'

/**
 * The knowledge hierarchy plus the global knowledge graph. Every node
 * renders as a brain; LINKS may connect ANY node to ANY other node —
 * the view layer rolls them up to whatever level is on screen.
 *
 * Replace this sample data with your real portfolio.
 */
export interface PortfolioNode {
  id: string
  name: string
  detail: string
  color: string
  children: PortfolioNode[]
}

export interface KnowledgeLink {
  from: string
  to: string
  label?: string
}

const n = (
  id: string,
  name: string,
  detail: string,
  color: string,
  children: PortfolioNode[] = [],
): PortfolioNode => ({ id, name, detail, color, children })

export const PORTFOLIO: PortfolioNode = n(
  'portfolio',
  'Enterprise Portfolio',
  'The complete knowledge brain',
  COLORS.cyan,
  [
    n('payments', 'Payments', 'Money movement platform', COLORS.electricBlue, [
      n('gateway', 'Gateway', 'Card & wallet ingress', COLORS.electricBlue),
      n('fraud', 'Fraud Detection', 'Real-time risk scoring', COLORS.cyan, [
        n('rules', 'Rules Engine', 'Deterministic checks', COLORS.electricBlue),
        n('ml-scoring', 'ML Scoring', 'Behavioural models', COLORS.gold),
      ]),
      n('ledger', 'Ledger', 'Double-entry source of truth', COLORS.teal),
      n('payouts', 'Payouts', 'Settlement & disbursement', COLORS.electricBlue),
    ]),

    n('data-platform', 'Data Platform', 'Pipelines, lake & governance', COLORS.teal, [
      n('ingestion', 'Ingestion', 'Streaming + batch intake', COLORS.teal),
      n('lakehouse', 'Lakehouse', 'Unified storage layer', COLORS.electricBlue),
      n('catalog', 'Catalog', 'Lineage & discovery', COLORS.cyan),
    ]),

    n('ai-program', 'AI Program', 'Models, agents & evaluation', COLORS.gold, [
      n('agents', 'Agent Runtime', 'Autonomous task workers', COLORS.gold),
      n('model-hub', 'Model Hub', 'Serving & fine-tuning', COLORS.electricBlue),
      n('evals', 'Evaluations', 'Quality & safety harness', COLORS.teal),
    ]),

    n('customer', 'Customer 360', 'Identity, CRM & support', COLORS.cyan, [
      n('identity', 'Identity', 'Auth & profile graph', COLORS.cyan),
      n('crm', 'CRM', 'Accounts & journeys', COLORS.electricBlue),
      n('support', 'Support AI', 'Assisted resolution', COLORS.gold),
    ]),

    n('platform', 'Cloud Platform', 'Infra, CI/CD & observability', COLORS.electricBlue, [
      n('compute', 'Compute Mesh', 'Clusters & scheduling', COLORS.electricBlue),
      n('delivery', 'Delivery', 'Build & deploy pipelines', COLORS.teal),
      n('observability', 'Observability', 'Metrics, traces, logs', COLORS.cyan),
    ]),
  ],
)

/**
 * The neural wiring — knowledge flowing between any two nodes in the
 * tree, regardless of depth. Same-level links render directly; links at
 * higher views roll up into aggregated pathways; links leaving the
 * current view become portals on the shell.
 */
export const LINKS: KnowledgeLink[] = [
  // inside Payments
  { from: 'gateway', to: 'fraud', label: 'risk signals' },
  { from: 'fraud', to: 'ledger', label: 'case postings' },
  { from: 'payouts', to: 'ledger', label: 'settlement entries' },
  { from: 'rules', to: 'ml-scoring', label: 'escalations' },
  // inside Data Platform
  { from: 'ingestion', to: 'lakehouse', label: 'raw streams' },
  { from: 'catalog', to: 'lakehouse', label: 'lineage scan' },
  // inside AI Program
  { from: 'agents', to: 'model-hub', label: 'inference' },
  { from: 'evals', to: 'model-hub', label: 'benchmark runs' },
  // inside Customer 360
  { from: 'crm', to: 'identity', label: 'profile graph' },
  { from: 'support', to: 'identity', label: 'auth context' },
  // inside Cloud Platform
  { from: 'delivery', to: 'compute', label: 'deployments' },
  { from: 'observability', to: 'compute', label: 'cluster telemetry' },
  // cross-program knowledge sharing
  { from: 'ml-scoring', to: 'model-hub', label: 'model serving' },
  { from: 'fraud', to: 'lakehouse', label: 'feature store' },
  { from: 'lakehouse', to: 'model-hub', label: 'training data' },
  { from: 'support', to: 'agents', label: 'assist runtime' },
  { from: 'observability', to: 'payments', label: 'telemetry' },
  { from: 'crm', to: 'payments', label: 'billing accounts' },
]

/* ------------------------------------------------------------------ */
/* Tree indices & helpers                                              */
/* ------------------------------------------------------------------ */

const byId = new Map<string, PortfolioNode>()
const parentId = new Map<string, string | null>()

const index = (node: PortfolioNode, parent: string | null) => {
  byId.set(node.id, node)
  parentId.set(node.id, parent)
  node.children.forEach((c) => index(c, node.id))
}
index(PORTFOLIO, null)

export function nodeById(id: string): PortfolioNode {
  const node = byId.get(id)
  if (!node) throw new Error(`Unknown portfolio node: ${id}`)
  return node
}

export function nodeByPath(path: string[]): PortfolioNode {
  return nodeById(path[path.length - 1])
}

export function parentIdOf(id: string): string | null {
  return parentId.get(id) ?? null
}

/** ids from the portfolio root down to (and including) `id` */
export function pathOf(id: string): string[] {
  const out: string[] = []
  let cur: string | null = id
  while (cur) {
    out.unshift(cur)
    cur = parentId.get(cur) ?? null
  }
  return out
}

export function isDescendantOrSelf(id: string, ancestor: string): boolean {
  let cur: string | null = id
  while (cur) {
    if (cur === ancestor) return true
    cur = parentId.get(cur) ?? null
  }
  return false
}

/** lowest common ancestor of two node ids */
export function lcaOf(a: string, b: string): string {
  const pa = new Set(pathOf(a))
  let cur: string | null = b
  while (cur) {
    if (pa.has(cur)) return cur
    cur = parentId.get(cur) ?? null
  }
  return PORTFOLIO.id
}

/** the immediate child of `ancestor` on the path down to `id` (null if id === ancestor) */
export function childToward(ancestor: string, id: string): string | null {
  const path = pathOf(id)
  const i = path.indexOf(ancestor)
  if (i < 0 || i === path.length - 1) return null
  return path[i + 1]
}

/**
 * How node `x` appears when the view is rooted at `rootId`:
 * itself ('self'), through one of the root's children, or not at all.
 */
export function repAt(
  rootId: string,
  x: string,
): { kind: 'self' } | { kind: 'child'; id: string } | { kind: 'outside' } {
  if (x === rootId) return { kind: 'self' }
  if (!isDescendantOrSelf(x, rootId)) return { kind: 'outside' }
  const child = childToward(rootId, x)
  return child ? { kind: 'child', id: child } : { kind: 'outside' }
}
