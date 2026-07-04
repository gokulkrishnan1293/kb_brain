import { SIMPLEX_3D, SPLIT_GLSL } from './noise.glsl'

/* ------------------------------------------------------------------ */
/* Stage 1 — brain surface particles                                   */
/* ------------------------------------------------------------------ */

export const brainParticleVert = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aSide;
attribute vec3 aColor;

uniform float uTime;
uniform float uScale;        // projection scale: px per world unit at z=1
uniform float uSplit;        // 0 closed .. 1 hemispheres apart
uniform float uSplitDistance;
uniform float uHover;        // 0 idle .. 1 hovered

varying vec3 vColor;
varying float vBrightness;

${SIMPLEX_3D}
${SPLIT_GLSL}

void main() {
  vec3 p = position;

  // organic float — three decorrelated noise fields (Stage 1 + 3)
  float t = uTime * (0.32 + uHover * 0.55);
  float amp = 0.013 + uHover * 0.008;
  p.x += snoise(position * 2.2 + vec3(t, t * 0.7, -t * 0.5) + aSeed * 10.0) * amp;
  p.y += snoise(position * 3.1 + vec3(-t * 0.6, t, t * 0.4) + aSeed * 20.0) * amp;
  p.z += snoise(position * 2.6 + vec3(t * 0.5, -t * 0.8, t) + aSeed * 30.0) * amp;

  p = applySplit(p, aSide, uSplit, uSplitDistance);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // brightness pulse, decorrelated per particle (Stage 1 + 3)
  float pulse = 0.68 + 0.42 * sin(uTime * (0.9 + fract(aSeed * 7.31) * 1.4) + aSeed * 6.2831);
  vBrightness = pulse * (1.0 + uHover * 0.38);
  vColor = aColor;

  gl_PointSize = aSize * (1.0 + 0.2 * pulse) * uScale / -mv.z;
}
`

export const brainParticleFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vBrightness;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, d);
  float core = smoothstep(0.16, 0.0, d);
  vec3 col = vColor * vBrightness + vec3(1.0) * core * vBrightness * 0.35;
  gl_FragColor = vec4(col, alpha * uOpacity);
}
`

/* ------------------------------------------------------------------ */
/* Stage 2 — neural connections                                        */
/* ------------------------------------------------------------------ */

export const neuralLineVert = /* glsl */ `
attribute float aSide;
attribute float aSeed;

uniform float uTime;
uniform float uSplit;
uniform float uSplitDistance;

varying float vPulse;
varying float vSeed;
varying float vSide;

${SPLIT_GLSL}

void main() {
  vec3 p = applySplit(position, aSide, uSplit, uSplitDistance);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  // connection pulse (Stage 3)
  vPulse = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 6.2831);
  vSeed = aSeed;
  // interpolates below 1.0 only along edges that bridge the hemispheres
  vSide = aSide;
}
`

export const neuralLineFrag = /* glsl */ `
precision highp float;
uniform float uHover;
uniform float uSplit;
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying float vPulse;
varying float vSeed;
varying float vSide;

void main() {
  vec3 col = mix(uColorA, uColorB, fract(vSeed * 3.7));
  float alpha = uOpacity * vPulse * (0.55 + uHover * 0.8);
  // fade the long strands stretched across the opened hemispheres
  float cross = 1.0 - abs(vSide);
  alpha *= 1.0 - uSplit * cross * 0.85;
  gl_FragColor = vec4(col * (1.0 + uHover * 0.6), alpha);
}
`

/* ------------------------------------------------------------------ */
/* Stage 2 — travelling light packets                                  */
/* ------------------------------------------------------------------ */

export const packetVert = /* glsl */ `
// 'position' holds the edge start point
attribute vec3 aEnd;
attribute float aSideStart;
attribute float aSideEnd;
attribute float aSpeed;
attribute float aOffset;
attribute float aSeed;

uniform float uTime;
uniform float uScale;
uniform float uSplit;
uniform float uSplitDistance;
uniform float uHover;

varying float vSeed;
varying float vGlow;

${SPLIT_GLSL}

void main() {
  float t = fract(uTime * aSpeed * (0.55 + uHover * 0.5) + aOffset);
  vec3 p = mix(position, aEnd, t);
  float side = mix(aSideStart, aSideEnd, t);
  p = applySplit(p, side, uSplit, uSplitDistance);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // packets flare as they launch and fade as they arrive;
  // packets bridging the opened hemispheres dim mid-gap
  vGlow = sin(t * 3.14159265) * (1.0 - uSplit * (1.0 - abs(side)) * 0.8);
  vSeed = aSeed;
  gl_PointSize = (0.009 + 0.005 * fract(aSeed * 5.13)) * uScale / -mv.z;
}
`

export const packetFrag = /* glsl */ `
precision highp float;
uniform float uHover;
uniform float uOpacity;
uniform vec3 uColorA;   // cyan-white
uniform vec3 uColorB;   // gold accent

varying float vSeed;
varying float vGlow;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.05, d) * vGlow * uOpacity;
  vec3 col = mix(uColorA, uColorB, step(0.92, fract(vSeed * 7.77)));
  // HDR-ish push so the bloom pass picks packets up
  gl_FragColor = vec4(col * (1.6 + uHover * 0.8), alpha);
}
`

/* ------------------------------------------------------------------ */
/* Stage 6 — AI core                                                   */
/* ------------------------------------------------------------------ */

export const coreVert = /* glsl */ `
attribute float aSeed;
attribute float aSize;

uniform float uTime;
uniform float uScale;
uniform float uReveal;

varying float vBrightness;
varying float vSeed;

${SIMPLEX_3D}

void main() {
  vec3 p = position;
  float swirl = uTime * 0.35;
  // slow orbital swirl
  float ca = cos(swirl + aSeed * 6.2831 * 0.02);
  float sa = sin(swirl + aSeed * 6.2831 * 0.02);
  p = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
  p += vec3(
    snoise(position * 6.0 + uTime * 0.4),
    snoise(position * 6.0 + 40.0 + uTime * 0.4),
    snoise(position * 6.0 + 80.0 + uTime * 0.4)
  ) * 0.012;
  p *= uReveal;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  vBrightness = (0.75 + 0.45 * sin(uTime * 2.2 + aSeed * 6.2831)) * uReveal;
  vSeed = aSeed;
  gl_PointSize = aSize * uScale / -mv.z;
}
`

export const coreFrag = /* glsl */ `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vBrightness;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.08, d) * vBrightness;
  vec3 col = mix(uColorA, uColorB, fract(vSeed * 4.3)) * (1.2 + vBrightness);
  gl_FragColor = vec4(col, alpha);
}
`

/* ------------------------------------------------------------------ */
/* Stage 6/7 — knowledge cluster particles (blob ⇄ knowledge tree)     */
/* ------------------------------------------------------------------ */

export const clusterVert = /* glsl */ `
attribute vec3 aTree;    // expanded hierarchy position
attribute float aSeed;
attribute float aSize;
attribute vec3 aColor;

uniform float uTime;
uniform float uScale;
uniform float uReveal;   // 0 hidden .. 1 revealed (Stage 6)
uniform float uExpand;   // 0 blob .. 1 knowledge tree (Stage 7)
uniform float uFocus;    // extra shimmer when this cluster is focused

varying vec3 vColor;
varying float vBrightness;

${SIMPLEX_3D}

void main() {
  // staggered per-particle morph makes the expansion feel cinematic
  float d = clamp((uExpand - aSeed * 0.4) / 0.6, 0.0, 1.0);
  d = d * d * (3.0 - 2.0 * d);
  vec3 p = mix(position, aTree, d);

  float amp = 0.004 + uFocus * 0.003;
  p += vec3(
    snoise(position * 9.0 + uTime * 0.5 + aSeed * 10.0),
    snoise(position * 9.0 + 33.0 + uTime * 0.5),
    snoise(position * 9.0 + 66.0 + uTime * 0.5)
  ) * amp;
  p *= uReveal;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  vBrightness = (0.7 + 0.4 * sin(uTime * (1.1 + fract(aSeed * 3.7)) + aSeed * 6.2831))
              * uReveal * (1.0 + uFocus * 0.6);
  vColor = aColor;
  gl_PointSize = aSize * (1.0 + uFocus * 0.35) * uScale / -mv.z;
}
`

export const clusterFrag = /* glsl */ `
precision highp float;
uniform float uOpacity;
varying vec3 vColor;
varying float vBrightness;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, d) * uOpacity;
  vec3 col = vColor * vBrightness + vec3(1.0) * smoothstep(0.14, 0.0, d) * 0.3 * vBrightness;
  gl_FragColor = vec4(col, alpha);
}
`

/* ------------------------------------------------------------------ */
/* Stage 6 — animated neural pathways (core → cluster bezier)          */
/* ------------------------------------------------------------------ */

export const pathwayVert = /* glsl */ `
attribute float aT;   // 0..1 along the curve

uniform float uTime;

varying float vT;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vT = aT;
}
`

export const pathwayFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
uniform float uFlowSpeed;

varying float vT;

void main() {
  // travelling energy pulse
  float flow = pow(0.5 + 0.5 * sin((vT - uTime * uFlowSpeed) * 18.0), 4.0);
  float alpha = (0.10 + flow * 0.9) * uOpacity;
  gl_FragColor = vec4(uColor * (0.8 + flow * 1.6), alpha);
}
`

/* ------------------------------------------------------------------ */
/* Stage 7 — hierarchy tree lines                                      */
/* ------------------------------------------------------------------ */

export const treeLineVert = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const treeLineFrag = /* glsl */ `
precision highp float;
uniform float uOpacity;  // cluster-level opacity (dimming)
uniform float uExpand;   // lines appear only once the tree unfolds
uniform vec3 uColor;
varying vec3 vPos;
void main() {
  gl_FragColor = vec4(uColor, 0.5 * uOpacity * uExpand);
}
`
