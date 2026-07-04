import { useMemo } from 'react'
import * as THREE from 'three'
import { PortfolioNode } from '../data/portfolio'
import { ChildLayout } from '../lib/layout'
import { pathwayVert, pathwayFrag } from '../three/shaders'
import { SharedUniforms } from '../three/uniforms'

interface Props {
  node: PortfolioNode
  layout: ChildLayout[]
  shared: SharedUniforms
  opacity: { value: number }
}

/**
 * Neural traffic between sibling mini-brains — curved pathways with a
 * travelling energy pulse, built from each child's `dependencies`.
 */
export function DependencyLinks({ node, layout, shared, opacity }: Props) {
  const lines = useMemo(() => {
    const seen = new Set<string>()
    const objects: THREE.Line[] = []
    const indexOf = new Map(node.children.map((c, i) => [c.id, i]))

    node.children.forEach((child, i) => {
      for (const dep of child.dependencies ?? []) {
        const j = indexOf.get(dep)
        if (j === undefined) continue
        const key = i < j ? `${i}:${j}` : `${j}:${i}`
        if (seen.has(key)) continue
        seen.add(key)

        const a = new THREE.Vector3(...layout[i].position)
        const b = new THREE.Vector3(...layout[j].position)
        // bow the pathway outward so it clears the core
        const mid = a
          .clone()
          .add(b)
          .multiplyScalar(0.5)
        const out = mid.lengthSq() > 1e-6 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0)
        mid.add(out.multiplyScalar(0.16)).add(new THREE.Vector3(0, 0.04, 0.06))

        const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
        const points = curve.getPoints(36)
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const ts = new Float32Array(points.length)
        for (let k = 0; k < points.length; k++) ts[k] = k / (points.length - 1)
        geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1))

        const material = new THREE.ShaderMaterial({
          vertexShader: pathwayVert,
          fragmentShader: pathwayFrag,
          uniforms: {
            uTime: shared.uTime,
            uOpacity: opacity,
            uColor: { value: new THREE.Color(child.color) },
            uFlowSpeed: { value: 0.3 + (i % 3) * 0.09 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })

        const line = new THREE.Line(geometry, material)
        line.frustumCulled = false
        objects.push(line)
      }
    })
    return objects
  }, [node, layout, shared, opacity])

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  )
}
