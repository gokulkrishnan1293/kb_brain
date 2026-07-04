# Neural Knowledge Core

A premium enterprise hero animation that transforms a static 3D brain mesh
into a living AI knowledge platform — glowing particles, a travelling
neural network, an openable knowledge core and cinematic zoom navigation.

Built with **React Three Fiber**, **Three.js**, **drei**, **GSAP** and
custom GLSL shaders.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Interaction flow

| Stage | Trigger | What happens |
| --- | --- | --- |
| Idle | — | ±3° sway, breathing scale, particle float, pulsing connections, travelling light packets, bloom pulse |
| Hover | mouse over brain | glow, particle brightness/speed and line intensity rise; camera eases closer |
| Open | click brain | hemispheres slide apart over 1.5 s (GSAP), revealing the AI core |
| Core | — | six holographic knowledge clusters (Memory, Projects, Documents, AI Agents, Skills, Workflows) orbit the core, wired to it with animated neural pathways |
| Cluster | click a cluster | camera flies in; the blob unfolds into a knowledge tree: cluster → sub-clusters → documents → individual nodes |
| Back | Esc / empty click / buttons | steps back one level |

## Architecture

```
src/
├─ config.ts                  palette, quality tiers, cluster layout, camera poses
├─ state/useBrainStore.ts     zustand stage machine (idle → opening → open → cluster)
├─ lib/
│  ├─ sampleSurface.ts        MeshSurfaceSampler → ~180k particle attributes
│  ├─ buildGraph.ts           hub selection + kNN via spatial hash; light packets
│  └─ hierarchy.ts            blob ⇄ knowledge-tree layouts, AI core sphere
├─ three/
│  ├─ noise.glsl.ts           GPU simplex noise + shared hemisphere-split GLSL
│  ├─ shaders.ts              all vertex/fragment shaders
│  └─ uniforms.ts             uniforms shared across every brain material
├─ components/
│  ├─ Scene.tsx               Canvas, adaptive DPR, pointer-missed navigation
│  ├─ BrainAssembly.tsx       data pipeline, idle motion, split timeline, hit mesh
│  ├─ ParticleBrain.tsx       Stage 1 — 1 draw call, all motion in vertex shader
│  ├─ NeuralNetwork.tsx       Stage 2 — glowing edges + travelling packets
│  ├─ CoreScene.tsx           Stage 6 — AI core, pathways, cluster ring
│  ├─ KnowledgeCluster.tsx    Stage 6/7 — blob → tree morph, labels, hit target
│  ├─ CameraRig.tsx           GSAP camera flights + damped pointer parallax
│  ├─ Effects.tsx             mipmap bloom (animated) + vignette
│  └─ AmbientDust.tsx         distant depth-cue dust
└─ ui/Overlay.tsx             loading screen, HUD, breadcrumb, back navigation
```

### Performance notes

- The brain is **one `<points>` draw call**; float noise, brightness pulse,
  hover response and the hemisphere split all run in the vertex shader —
  no per-frame attribute uploads.
- The neural graph is built once with a spatial hash grid (O(n)); edges and
  packets are two more draw calls driven by the same shared uniforms.
- Particle counts, DPR and cluster density adapt to
  `navigator.hardwareConcurrency`; drei's `AdaptiveDpr` degrades resolution
  under load. Hard ceiling ~250k particles.
- Additive blending with `depthWrite: false`, no antialiasing (bloom
  smooths), `powerPreference: 'high-performance'`.

### Swapping the model

Drop any mesh at `public/models/brain.glb` — geometry is normalised
(centered + scaled) at load, and particles/graph are resampled from
whatever surface it finds. Palette and cluster definitions live in
`src/config.ts`.
