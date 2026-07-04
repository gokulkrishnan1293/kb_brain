import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { PortfolioNode } from '../data/portfolio'
import { ChildLayout } from '../lib/layout'
import { SharedUniforms, createShellControls } from '../three/uniforms'
import { BrainShell, ShellBuffers } from './BrainShell'
import { QUALITY } from '../config'
import { useNavStore } from '../state/useNavStore'

interface Props {
  node: PortfolioNode
  index: number
  layout: ChildLayout
  buffers: ShellBuffers
  shared: SharedUniforms
  /** delay before this mini fades in (staggered entrances) */
  appearDelay: number
  /** true while another sibling is being dived into */
  dimmed: boolean
  /** true while the camera is flying into this mini */
  target: boolean
  interactive: boolean
}

/**
 * A child node rendered as a miniature brain floating inside its
 * parent — same shared particle buffers at a reduced drawRange, tinted
 * with the node's brand colour. Click to dive in.
 */
export function MiniBrain({
  node,
  index,
  layout,
  buffers,
  shared,
  appearDelay,
  dimmed,
  target,
  interactive,
}: Props) {
  const group = useRef<THREE.Group>(null!)
  const bobAmp = useRef(0)
  const dive = useNavStore((s) => s.dive)
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

  // capture the mount-time delay; later re-renders must not re-trigger it
  const mountDelay = useRef(appearDelay)

  /* staggered entrance */
  useEffect(() => {
    const g = group.current
    const delay = mountDelay.current
    g.scale.setScalar(layout.scale * 0.55)
    gsap.to(controls.uFade, { value: 1, duration: 0.9, delay, ease: 'power2.out' })
    gsap.to(controls.uLineOpacity, { value: 0.1, duration: 0.9, delay: delay + 0.25 })
    gsap.to(g.scale, {
      x: layout.scale,
      y: layout.scale,
      z: layout.scale,
      duration: 1.1,
      delay,
      ease: 'back.out(1.3)',
    })
    return () => {
      gsap.killTweensOf([controls.uFade, controls.uLineOpacity, g.scale])
    }
  }, [controls, layout.scale])

  /* dim while a sibling is entered; brighten when hovered or targeted */
  useEffect(() => {
    gsap.to(controls.uFade, {
      value: dimmed ? 0.04 : 1,
      duration: 0.7,
      ease: 'power2.inOut',
      overwrite: 'auto',
    })
    gsap.to(controls.uLineOpacity, {
      value: dimmed ? 0 : 0.1,
      duration: 0.7,
      overwrite: 'auto',
    })
  }, [dimmed, controls])

  useEffect(() => {
    // resting glow keeps minis legible through the parent shell
    gsap.to(controls.uFocus, {
      value: hovered || target ? 1 : 0.25,
      duration: 0.6,
      overwrite: 'auto',
    })
  }, [hovered, target, controls])

  /* gentle bob — damped to zero during dives so the camera swap is exact */
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    bobAmp.current = THREE.MathUtils.damp(bobAmp.current, interactive ? 1 : 0, 3, dt)
    const g = group.current
    g.position.set(
      layout.position[0],
      layout.position[1] + Math.sin(t * 0.8 + index * 2.1) * 0.014 * bobAmp.current,
      layout.position[2],
    )
  })

  const labelVisible = interactive && !dimmed

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

      {/* hit target */}
      <mesh
        // never pass undefined here — R3F would overwrite the method with it
        raycast={interactive && !dimmed ? THREE.Mesh.prototype.raycast : () => null}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'auto'
          dive(node.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHoveredChild(node.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHoveredChild(null)
          document.body.style.cursor = 'auto'
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
        <div
          className={`mini-label ${labelVisible ? 'visible' : ''} ${
            hovered || target ? 'hot' : ''
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
      </Html>
    </group>
  )
}
