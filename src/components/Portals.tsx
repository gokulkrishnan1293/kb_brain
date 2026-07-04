import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import { nodeById, parentIdOf, pathOf, PortfolioNode } from '../data/portfolio'
import { ChildLayout } from '../lib/layout'
import { ViewPortal } from '../lib/linkView'
import { pathwayVert, pathwayFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { useNavStore } from '../state/useNavStore'
import { navMotion } from '../state/navMotion'
import { travelTo } from '../lib/travel'

interface Props {
  node: PortfolioNode
  layout: ChildLayout[]
  view: { portals: ViewPortal[] }
  shared: SharedUniforms
  base: { value: number }
  interactive: boolean
}

const ss = THREE.MathUtils.smoothstep
const PORTAL_RADIUS = 0.86

/**
 * Knowledge links whose far end lives outside the current brain end at
 * glowing portal rings on the inner shell, pointing toward their
 * destination branch. Click = inspect; double-click = travel the link
 * (out over the hierarchy and back in).
 */
export function Portals({ node, layout, view, shared, base, interactive }: Props) {
  return (
    <group>
      {view.portals.map((portal) => (
        <Portal
          key={portal.key}
          node={node}
          layout={layout}
          portal={portal}
          shared={shared}
          base={base}
          interactive={interactive}
        />
      ))}
    </group>
  )
}

function Portal({
  node,
  layout,
  portal,
  shared,
  base,
  interactive,
}: {
  node: PortfolioNode
  layout: ChildLayout[]
  portal: ViewPortal
  shared: SharedUniforms
  base: { value: number }
  interactive: boolean
}) {
  const ring = useRef<THREE.Mesh>(null!)
  const labelFade = useRef<HTMLDivElement>(null)
  const gl = useThree((s) => s.gl)
  const select = useNavStore((s) => s.select)
  const deselect = useNavStore((s) => s.deselect)
  const selectedId = useNavStore((s) => s.selectedId)
  const isSelected = selectedId === portal.key

  const branch = nodeById(portal.branchId)
  const position = useMemo(
    () =>
      new THREE.Vector3(...portal.direction).multiplyScalar(PORTAL_RADIUS),
    [portal],
  )

  /* stub pathways from each inside endpoint out to the portal */
  const stubs = useMemo(() => {
    return portal.via.map((via, i) => {
      const from =
        via === 'self'
          ? new THREE.Vector3(0, 0, 0)
          : new THREE.Vector3(
              ...(layout[node.children.findIndex((c) => c.id === via)]?.position ?? [0, 0, 0]),
            )
      const mid = from.clone().add(position).multiplyScalar(0.5)
      mid.add(new THREE.Vector3(0, 0.06, 0.04))
      const curve = new THREE.QuadraticBezierCurve3(from, mid, position)
      const points = curve.getPoints(30)
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const ts = new Float32Array(points.length)
      for (let k = 0; k < points.length; k++) ts[k] = k / (points.length - 1)
      geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1))
      const material = new THREE.ShaderMaterial({
        vertexShader: pathwayVert,
        fragmentShader: pathwayFrag,
        uniforms: {
          uTime: shared.uTime,
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color(branch.color) },
          uFlowSpeed: { value: 0.34 + i * 0.07 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const line = new THREE.Line(geometry, material)
      line.frustumCulled = false
      return { line, material }
    })
  }, [portal, layout, node, position, shared, branch.color])

  useFrame((state, dt) => {
    const zoomFade = 1 - ss(navMotion.eased, 0.15, 0.5)
    const touchesSelection =
      selectedId !== null &&
      (isSelected || portal.via.some((v) => v === selectedId))
    const selFactor = selectedId === null ? 1 : touchesSelection ? 1.5 : 0.08

    for (const { material } of stubs) {
      material.uniforms.uOpacity.value = 0.55 * base.value * zoomFade * selFactor
    }
    if (ring.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12
      ring.current.scale.setScalar(pulse * (isSelected ? 1.35 : 1))
      const m = ring.current.material as THREE.MeshBasicMaterial
      m.opacity = THREE.MathUtils.damp(
        m.opacity,
        0.85 * base.value * zoomFade * selFactor,
        6,
        dt,
      )
    }
    if (labelFade.current) {
      labelFade.current.style.opacity = String(
        base.value * zoomFade * (selectedId === null || touchesSelection ? 1 : 0.15),
      )
    }
  })

  const travel = () => {
    const target = portal.links[0]
    // travel to the far endpoint's parent view and select it there
    const far = pathOf(target.from).includes(node.id) ? target.to : target.from
    const parent = parentIdOf(far)
    if (parent) void travelTo(pathOf(parent), far)
  }

  return (
    <group position={position}>
      <Billboard>
        <mesh ref={ring}>
          <ringGeometry args={[0.035, 0.047, 40]} />
          <meshBasicMaterial
            color={branch.color}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      {stubs.map(({ line }, i) => (
        <primitive key={i} object={line} position={position.clone().negate()} />
      ))}

      {/* hit target */}
      <mesh
        raycast={interactive ? THREE.Mesh.prototype.raycast : () => null}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          if (isSelected) deselect()
          else select(portal.key)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return
          travel()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          gl.domElement.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          const s = useNavStore.getState()
          gl.domElement.style.cursor =
            s.phase === 'explore' && !s.traveling ? 'grab' : 'auto'
        }}
      >
        <sphereGeometry args={[0.085, 10, 10]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      <Html
        position={[0, 0.085, 0]}
        center
        distanceFactor={2.2}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div ref={labelFade}>
          <div className="portal-label">
            <span className="portal-name" style={{ color: branch.color }}>
              ⇄ {branch.name}
            </span>
            <span className="portal-count">
              {portal.links.length} link{portal.links.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
