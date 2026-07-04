import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { PortfolioNode } from '../data/portfolio'
import { ChildLayout } from '../lib/layout'
import { ViewEdge } from '../lib/linkView'
import { pathwayVert, pathwayFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'
import { DEP_OPACITY } from '../config'
import { useNavStore } from '../state/useNavStore'
import { navMotion } from '../state/navMotion'

interface Props {
  node: PortfolioNode
  layout: ChildLayout[]
  view: { edges: ViewEdge[] }
  shared: SharedUniforms
  /** entrance base (gsap-driven by BrainVerse) */
  base: { value: number }
}

const ss = THREE.MathUtils.smoothstep

/**
 * Aggregated knowledge pathways between the current level's endpoints.
 * Link count sets intensity; selecting a node makes its linkage glow
 * while unrelated pathways recede.
 */
export function KnowledgeLinks({ node, layout, view, shared, base }: Props) {
  const selectedId = useNavStore((s) => s.selectedId)

  const built = useMemo(() => {
    const posOf = (end: string | 'self'): THREE.Vector3 => {
      if (end === 'self') return new THREE.Vector3(0, 0, 0)
      const i = node.children.findIndex((c) => c.id === end)
      return new THREE.Vector3(...(layout[i]?.position ?? [0, 0, 0]))
    }

    return view.edges.map((edge, idx) => {
      const a = posOf(edge.a)
      const b = posOf(edge.b)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const out =
        mid.lengthSq() > 1e-6 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0)
      mid.add(out.multiplyScalar(0.16)).add(new THREE.Vector3(0, 0.04, 0.06))

      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      const points = curve.getPoints(36)
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const ts = new Float32Array(points.length)
      for (let k = 0; k < points.length; k++) ts[k] = k / (points.length - 1)
      geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1))

      const color =
        edge.a !== 'self'
          ? node.children.find((c) => c.id === edge.a)?.color ?? '#62F5FF'
          : '#62F5FF'

      const material = new THREE.ShaderMaterial({
        vertexShader: pathwayVert,
        fragmentShader: pathwayFrag,
        uniforms: {
          uTime: shared.uTime,
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uFlowSpeed: { value: 0.3 + (idx % 3) * 0.09 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })

      const line = new THREE.Line(geometry, material)
      line.frustumCulled = false
      const labelPos = curve.getPoint(0.5)
      return { edge, line, material, labelPos }
    })
  }, [node, layout, view, shared])

  /* per-frame: entrance × zoom fade × selection factor × link intensity */
  useFrame(() => {
    const zoomFade = 1 - ss(navMotion.eased, 0.15, 0.5)
    for (const { edge, material } of built) {
      const touches =
        selectedId !== null && (edge.a === selectedId || edge.b === selectedId)
      const selFactor =
        selectedId === null || selectedId.startsWith('portal:')
          ? 1
          : touches
            ? 1.5
            : 0.06
      const intensity = Math.min(1, 0.5 + edge.links.length * 0.25)
      material.uniforms.uOpacity.value =
        DEP_OPACITY * base.value * zoomFade * selFactor * intensity
    }
  })

  /* labels on the selected node's linkage — "show me that connection" */
  const labelled = selectedId
    ? built.filter(
        ({ edge }) => edge.a === selectedId || edge.b === selectedId,
      )
    : []

  return (
    <group>
      {built.map(({ line }, i) => (
        <primitive key={i} object={line} />
      ))}
      {labelled.map(({ edge, labelPos }, i) => (
        <Html
          key={`label-${i}`}
          position={labelPos}
          center
          distanceFactor={2.2}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[10, 0]}
        >
          <div className="link-label">
            {edge.links[0].label ?? 'knowledge link'}
            {edge.links.length > 1 ? ` +${edge.links.length - 1}` : ''}
          </div>
        </Html>
      ))}
    </group>
  )
}
