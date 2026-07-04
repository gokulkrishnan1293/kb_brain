import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { PortfolioNode } from '../data/portfolio'
import { ChildLayout } from '../lib/layout'
import { SharedUniforms, createShellControls } from '../three/uniforms'
import { BrainShell, ShellBuffers } from './BrainShell'
import { QUALITY } from '../config'
import { useNavStore } from '../state/useNavStore'
import { navMotion } from '../state/navMotion'
import { diveInto } from '../lib/travel'

export type SelectionRole = 'none' | 'selected' | 'linked' | 'dim'

interface Props {
  node: PortfolioNode
  index: number
  layout: ChildLayout
  buffers: ShellBuffers
  shared: SharedUniforms
  appearDelay: number
  selection: SelectionRole
  interactive: boolean
}

const ss = THREE.MathUtils.smoothstep

/**
 * A child node as a miniature brain. Click = select (lights up its
 * linkage), double-click = dive, scroll toward it = continuous dive.
 * All fading is composed per-frame: entrance × zoom-dim × selection.
 */
export function MiniBrain({
  node,
  index,
  layout,
  buffers,
  shared,
  appearDelay,
  selection,
  interactive,
}: Props) {
  const group = useRef<THREE.Group>(null!)
  const labelFade = useRef<HTMLDivElement>(null)
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const bobAmp = useRef(0)
  const selMix = useRef(1)
  const gl = useThree((s) => s.gl)

  const select = useNavStore((s) => s.select)
  const deselect = useNavStore((s) => s.deselect)
  const setHoveredChild = useNavStore((s) => s.setHoveredChild)
  const hovered = useNavStore((s) => s.hoveredChild === node.id)

  const controls = useMemo(
    () =>
      createShellControls({
        formed: true,
        tint: node.color,
        tintAmount: 0.55,
        sizeMul: layout.scale,
      }),
    [node.color, layout.scale],
  )

  const entrance = useMemo(() => ({ value: 0 }), [])
  const mountDelay = useRef(appearDelay)

  /* staggered entrance */
  useEffect(() => {
    const g = group.current
    const delay = mountDelay.current
    g.scale.setScalar(layout.scale * 0.55)
    gsap.to(entrance, { value: 1, duration: 0.9, delay, ease: 'power2.out' })
    gsap.to(g.scale, {
      x: layout.scale,
      y: layout.scale,
      z: layout.scale,
      duration: 1.1,
      delay,
      ease: 'back.out(1.3)',
    })
    return () => {
      gsap.killTweensOf([entrance, g.scale])
    }
  }, [entrance, layout.scale])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const z = navMotion.eased
    const isTarget = navMotion.targetId === node.id

    /* gentle bob, held still while zoom is in play */
    bobAmp.current = THREE.MathUtils.damp(
      bobAmp.current,
      interactive && navMotion.zoom < 0.08 ? 1 : 0,
      3,
      dt,
    )
    const g = group.current
    g.position.set(
      layout.position[0],
      layout.position[1] + Math.sin(t * 0.8 + index * 2.1) * 0.014 * bobAmp.current,
      layout.position[2],
    )

    /* composed fade: entrance × zoom-dim (non-targets recede) × selection */
    const dimZ = isTarget ? 1 : 1 - ss(z, 0.12, 0.5)
    selMix.current = THREE.MathUtils.damp(
      selMix.current,
      selection === 'dim' ? 0.15 : 1,
      5,
      dt,
    )
    controls.uFade.value = entrance.value * dimZ * selMix.current
    controls.uLineOpacity.value = 0.1 * entrance.value * dimZ * selMix.current

    const focusTarget =
      hovered || isTarget || selection === 'selected'
        ? 1
        : selection === 'linked'
          ? 0.6
          : 0.25
    controls.uFocus.value = THREE.MathUtils.damp(controls.uFocus.value, focusTarget, 5, dt)

    /* label: recede behind the brain, vanish while diving or when dimmed */
    if (labelFade.current) {
      g.getWorldPosition(worldPos)
      const depthFade = 0.15 + 0.85 * ss(worldPos.z, -0.4, 0.1)
      const zoomFade = 1 - ss(z, 0.18, 0.42)
      const selFade = selection === 'dim' ? 0 : 1
      labelFade.current.style.opacity = String(depthFade * zoomFade * selFade)
    }
  })

  const labelVisible = interactive

  return (
    <group ref={group} position={layout.position}>
      <BrainShell
        buffers={buffers}
        shared={shared}
        controls={controls}
        pointCount={QUALITY.miniParticleCount}
        edgeCount={QUALITY.miniEdgeCount}
        opacity={0.95}
      />

      {/* brand-coloured beacon at the mini's heart */}
      <mesh scale={0.055}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={node.color} toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* hit target — click selects, double-click dives */}
      <mesh
        // never pass undefined here — R3F would overwrite the method with it
        raycast={interactive ? THREE.Mesh.prototype.raycast : () => null}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return // that was a drag, not a click
          if (selection === 'selected') deselect()
          else select(node.id)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          gl.domElement.style.cursor = 'auto'
          diveInto(node.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHoveredChild(node.id)
          gl.domElement.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHoveredChild(null)
          const s = useNavStore.getState()
          gl.domElement.style.cursor =
            (s.phase === 'explore' || s.phase === 'forming') && !s.traveling
              ? 'grab'
              : 'auto'
        }}
      >
        <sphereGeometry args={[1.05, 12, 12]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      <Html
        position={[0, 1.32, 0]}
        center
        distanceFactor={2.2}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div ref={labelFade}>
          <div
            className={`mini-label ${labelVisible ? 'visible' : ''} ${
              hovered || selection === 'selected' ? 'hot' : ''
            }`}
          >
            <span className="mini-name" style={{ color: node.color }}>
              {node.name}
            </span>
            <span className="mini-detail">
              {node.children.length > 0
                ? `${node.children.length} systems inside`
                : node.detail}
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
