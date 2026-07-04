/**
 * Continuous zoom state — mutable and frame-driven, deliberately outside
 * React/zustand. One scalar rules all navigation:
 *
 *   zoom 0 ──────────────▶ 1   diving toward `targetId`
 *        ◀──────────────        surfacing back out of it
 *
 * The wheel (and the travel controller / double-click) move `zoomGoal`;
 * the frame loop damps `zoom` toward it, evaluates `eased`, and performs
 * the seamless re-root swaps at the endpoints. Camera pose, shell fade,
 * doors, sibling dimming — everything reads `eased`.
 */
export const navMotion = {
  zoom: 0,
  zoomGoal: 0,
  /** smoothstep(zoom) — what the visuals consume */
  eased: 0,
  /** child id being zoomed toward / surfaced out of */
  targetId: null as string | null,
  /** true while the travel controller owns zoomGoal */
  auto: false,
}
