/**
 * Uniform objects shared by every brain-space material so the split,
 * hover and time animations stay perfectly in sync across the particle
 * cloud, the neural lines and the light packets.
 */
export interface SharedUniforms {
  uTime: { value: number }
  uScale: { value: number }
  uSplit: { value: number }
  uSplitDistance: { value: number }
  uHover: { value: number }
}

export function createSharedUniforms(splitDistance: number): SharedUniforms {
  return {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uSplit: { value: 0 },
    uSplitDistance: { value: splitDistance },
    uHover: { value: 0 },
  }
}
