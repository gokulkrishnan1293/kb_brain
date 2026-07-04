import * as THREE from 'three'

/**
 * Uniforms shared by every material in brain space — one clock, one
 * projection scale, one split value, so all systems stay in sync.
 */
export interface SharedUniforms {
  uTime: { value: number }
  uScale: { value: number }
  uSplit: { value: number }
  uSplitDistance: { value: number }
  uMinY: { value: number }
  uYRange: { value: number }
}

export function createSharedUniforms(
  splitDistance: number,
  minY: number,
  yRange: number,
): SharedUniforms {
  return {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uSplit: { value: 0 },
    uSplitDistance: { value: splitDistance },
    uMinY: { value: minY },
    uYRange: { value: yRange },
  }
}

/**
 * Per-shell animation handles. GSAP tweens these directly; the same
 * refs are embedded in the shell's point, line and packet materials.
 */
export interface ShellControls {
  uForm: { value: number }
  uFade: { value: number }
  uFocus: { value: number }
  uTint: { value: THREE.Color }
  uTintAmount: { value: number }
  uSizeMul: { value: number }
  uLineOpacity: { value: number }
  uPacketOpacity: { value: number }
}

export function createShellControls(opts: {
  formed: boolean
  tint: string
  tintAmount: number
  sizeMul: number
}): ShellControls {
  return {
    uForm: { value: opts.formed ? 1 : 0 },
    uFade: { value: opts.formed ? 0 : 1 }, // formed shells (minis) fade in
    uFocus: { value: 0 },
    uTint: { value: new THREE.Color(opts.tint) },
    uTintAmount: { value: opts.tintAmount },
    uSizeMul: { value: opts.sizeMul },
    uLineOpacity: { value: 0 },
    uPacketOpacity: { value: 0 },
  }
}
