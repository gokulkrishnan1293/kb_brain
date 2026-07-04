import { COLORS } from '../config'

/**
 * The knowledge hierarchy. Every node renders as a brain — the root
 * full-size, its children as mini-brains floating inside it. Diving
 * into a child re-roots the scene on it, so this tree can be any depth.
 *
 * Replace this sample data with your real portfolio.
 */
export interface PortfolioNode {
  id: string
  name: string
  detail: string
  color: string
  children: PortfolioNode[]
  /** sibling ids this node exchanges data with (drawn as neural traffic) */
  dependencies?: string[]
}

const n = (
  id: string,
  name: string,
  detail: string,
  color: string,
  children: PortfolioNode[] = [],
  dependencies?: string[],
): PortfolioNode => ({ id, name, detail, color, children, dependencies })

export const PORTFOLIO: PortfolioNode = n(
  'portfolio',
  'Enterprise Portfolio',
  'The complete knowledge brain',
  COLORS.cyan,
  [
    n('payments', 'Payments', 'Money movement platform', COLORS.electricBlue, [
      n('gateway', 'Gateway', 'Card & wallet ingress', COLORS.electricBlue, [], ['fraud']),
      n('fraud', 'Fraud Detection', 'Real-time risk scoring', COLORS.cyan, [
        n('rules', 'Rules Engine', 'Deterministic checks', COLORS.electricBlue),
        n('ml-scoring', 'ML Scoring', 'Behavioural models', COLORS.gold),
      ], ['ledger']),
      n('ledger', 'Ledger', 'Double-entry source of truth', COLORS.teal),
      n('payouts', 'Payouts', 'Settlement & disbursement', COLORS.electricBlue, [], ['ledger']),
    ], ['data-platform']),

    n('data-platform', 'Data Platform', 'Pipelines, lake & governance', COLORS.teal, [
      n('ingestion', 'Ingestion', 'Streaming + batch intake', COLORS.teal, [], ['lakehouse']),
      n('lakehouse', 'Lakehouse', 'Unified storage layer', COLORS.electricBlue),
      n('catalog', 'Catalog', 'Lineage & discovery', COLORS.cyan, [], ['lakehouse']),
    ], ['ai-program']),

    n('ai-program', 'AI Program', 'Models, agents & evaluation', COLORS.gold, [
      n('agents', 'Agent Runtime', 'Autonomous task workers', COLORS.gold, [], ['model-hub']),
      n('model-hub', 'Model Hub', 'Serving & fine-tuning', COLORS.electricBlue),
      n('evals', 'Evaluations', 'Quality & safety harness', COLORS.teal, [], ['model-hub']),
    ], ['data-platform']),

    n('customer', 'Customer 360', 'Identity, CRM & support', COLORS.cyan, [
      n('identity', 'Identity', 'Auth & profile graph', COLORS.cyan),
      n('crm', 'CRM', 'Accounts & journeys', COLORS.electricBlue, [], ['identity']),
      n('support', 'Support AI', 'Assisted resolution', COLORS.gold, [], ['identity']),
    ], ['payments']),

    n('platform', 'Cloud Platform', 'Infra, CI/CD & observability', COLORS.electricBlue, [
      n('compute', 'Compute Mesh', 'Clusters & scheduling', COLORS.electricBlue),
      n('delivery', 'Delivery', 'Build & deploy pipelines', COLORS.teal, [], ['compute']),
      n('observability', 'Observability', 'Metrics, traces, logs', COLORS.cyan, [], ['compute']),
    ]),
  ],
)

const byId = new Map<string, PortfolioNode>()
const index = (node: PortfolioNode) => {
  byId.set(node.id, node)
  node.children.forEach(index)
}
index(PORTFOLIO)

export function nodeById(id: string): PortfolioNode {
  const node = byId.get(id)
  if (!node) throw new Error(`Unknown portfolio node: ${id}`)
  return node
}

/** Resolves a path of ids (root first) to its final node. */
export function nodeByPath(path: string[]): PortfolioNode {
  return nodeById(path[path.length - 1])
}
