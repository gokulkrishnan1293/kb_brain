# Neural Knowledge Core

A premium enterprise hero animation that turns a static 3D brain mesh into a
recursively explorable **portfolio brain**: the root brain assembles from
dust, mini-brains (programs / applications) float inside it, and you dive
through the shell into any of them — brains within brains, unlimited depth.

Built with **React Three Fiber**, **Three.js**, **drei**, **GSAP** and
custom GLSL shaders.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Experience flow

| Moment | What happens |
| --- | --- |
| Load | scattered nebula dust assembles into the brain, stem-up, connections then light packets come online |
| Idle | ±3° sway, breathing, particle float, pulsing connections, packets, bloom pulse; mini-brains glow inside with dependency traffic between them |
| Hover a mini-brain | it brightens, label lights up |
| Click a mini-brain | camera dives through the parent shell (which parts slightly and fades like a veil); the mini seamlessly becomes the new full-size brain |
| Repeat | every level is another brain — depth is unlimited |
| Esc / empty click / breadcrumb / Surface button | pulls back out one level (breadcrumb jumps multiple) |

## How the infinite zoom works (scale-and-swap)

Diving flies the camera to `childPosition + childScale × idlePose`. At that
point the mini-brain fills the frame *exactly* as a full-size brain does from
the idle pose, so the scene re-roots on the child and the camera snaps to the
idle pose — visually seamless. Only two levels (current root + its children)
ever render, so performance is flat at any depth, and floating-point
precision never degrades.

All mini-brains share the root's GPU buffers: each one is a `BufferGeometry`
referencing the **same attribute arrays** with a smaller `drawRange` —
free LOD, no extra memory.

## Architecture

```
src/
├─ config.ts                  palette, quality tiers, camera poses
├─ data/portfolio.ts          the knowledge hierarchy (swap in real data here)
├─ state/useNavStore.ts       zustand nav machine (boot→forming→idle⇄diving/surfacing)
├─ lib/
│  ├─ sampleSurface.ts        MeshSurfaceSampler → particle attrs + scatter positions
│  ├─ buildGraph.ts           hub selection + kNN via spatial hash; light packets
│  ├─ layout.ts               deterministic placement of children inside the parent
│  └─ coreParticles.ts        fibonacci-sphere node cores
├─ three/
│  ├─ noise.glsl.ts           GPU simplex noise + hemisphere-split GLSL
│  ├─ shaders.ts              all vertex/fragment shaders
│  └─ uniforms.ts             shared uniforms + per-shell animation controls
├─ components/
│  ├─ Scene.tsx               Canvas, adaptive DPR, pointer-missed = surface
│  ├─ BrainVerse.tsx          recursive orchestrator: data pipeline, phase GSAP
│  ├─ BrainShell.tsx          one brain rendering unit (points + lines + packets)
│  ├─ MiniBrain.tsx           child node: shared buffers at reduced drawRange
│  ├─ NodeCore.tsx            glowing heart of the current brain
│  ├─ DependencyLinks.tsx     neural traffic between sibling mini-brains
│  ├─ CameraRig.tsx           GSAP dive/surface flights + scale-and-swap maths
│  ├─ Effects.tsx             animated mipmap bloom + vignette
│  └─ AmbientDust.tsx         distant depth-cue dust
└─ ui/Overlay.tsx             loading, HUD, clickable breadcrumb, node card
```

### Performance notes

- The root brain is **one `<points>` draw call** (~180k particles); dust
  assembly, noise float, pulse, tint and dive-fade all run in the vertex
  shader — no per-frame attribute uploads.
- Particles right in front of the camera fade out (near-veil), so flying
  through a shell feels like passing mist instead of hitting a wall.
- Counts and DPR adapt to `navigator.hardwareConcurrency`; drei's
  `AdaptiveDpr` degrades resolution under load.
- Additive blending, `depthWrite: false`, no MSAA (bloom smooths).

### Plugging in your data

Edit `src/data/portfolio.ts` — any tree of `{ id, name, detail, color,
children, dependencies }` works. Node `dependencies` (sibling ids) render as
animated neural pathways. The model is swappable too: drop any mesh at
`public/models/brain.glb`; it is normalised and resampled at load.
