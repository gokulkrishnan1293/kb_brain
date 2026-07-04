/**
 * Deterministic placement of child mini-brains inside the parent brain.
 * Pure function of the child count — the camera rig and the renderer
 * both derive the same layout, so no positions need to live in state.
 */
export interface ChildLayout {
  position: [number, number, number]
  scale: number
}

export function layoutChildren(count: number): ChildLayout[] {
  if (count === 0) return []
  if (count === 1) return [{ position: [0, 0.05, 0], scale: 0.3 }]

  const scale = count <= 3 ? 0.27 : count <= 6 ? 0.23 : 0.19
  const radius = count <= 3 ? 0.42 : 0.52

  const layouts: ChildLayout[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 2 + (i / count) * Math.PI * 2
    layouts.push({
      position: [
        Math.cos(a) * radius,
        Math.sin(a) * radius * 0.82,
        (i % 2 === 0 ? 1 : -1) * 0.08,
      ],
      scale,
    })
  }
  return layouts
}
