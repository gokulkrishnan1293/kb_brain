import { SIMPLEX_3D, SPLIT_GLSL } from './noise.glsl'

/* ------------------------------------------------------------------ */
/* Brain shell particles (root brain and mini-brains share this)       */
/* ------------------------------------------------------------------ */

export const brainParticleVert = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aSide;
attribute vec3 aColor;
attribute vec3 aScatter;

uniform float uTime;
uniform float uScale;        // projection scale: px per world unit at z=1
uniform float uSplit;        // "doors" flourish while diving
uniform float uSplitDistance;
uniform float uMinY;         // geometry bounds for the stem-up assembly
uniform float uYRange;

uniform float uForm;         // 0 scattered dust .. 1 assembled brain
uniform float uFade;         // shell opacity (dive-through veil)
uniform float uFocus;        // hover / dive-target boost
uniform vec3 uTint;          // node brand colour
uniform float uTintAmount;   // 0 = full palette, 1 = fully tinted
uniform float uSizeMul;      // matches the group scale so point sizes track

varying vec3 vColor;
varying float vBrightness;
varying float vFade;

${SIMPLEX_3D}
${SPLIT_GLSL}

void main() {
  // dust -> form: assemble from the brain stem upward, per-particle jitter
  float delay = clamp((position.y - uMinY) / uYRange, 0.0, 1.0) * 0.5
              + fract(aSeed * 3.37) * 0.32;
  float f = clamp((uForm * 1.5 - delay) / 0.68, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 p = mix(aScatter, position, f);

  // organic float — decorrelated noise fields, calmer while still dust
  float t = uTime * (0.32 + uFocus * 0.45);
  float amp = (0.013 + uFocus * 0.008) * (0.35 + 0.65 * f);
  p.x += snoise(position * 2.2 + vec3(t, t * 0.7, -t * 0.5) + aSeed * 10.0) * amp;
  p.y += snoise(position * 3.1 + vec3(-t * 0.6, t, t * 0.4) + aSeed * 20.0) * amp;
  p.z += snoise(position * 2.6 + vec3(t * 0.5, -t * 0.8, t) + aSeed * 30.0) * amp;

  p = applySplit(p, aSide, uSplit, uSplitDistance);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float pulse = 0.68 + 0.42 * sin(uTime * (0.9 + fract(aSeed * 7.31) * 1.4) + aSeed * 6.2831);
  vBrightness = pulse * (1.0 + uFocus * 0.4);
  // shimmer while a particle is mid-flight during assembly
  vBrightness *= 1.0 + f * (1.0 - f) * 2.2;

  vColor = mix(aColor, uTint * (0.9 + fract(aSeed * 5.1) * 0.45), uTintAmount);

  // veil: particles right in front of the camera fade so dive-throughs
  // feel like passing through mist instead of hitting a wall
  float dist = -mv.z;
  vFade = uFade * smoothstep(0.14, 0.5, dist);

  gl_PointSize = aSize * uSizeMul * (1.0 + 0.2 * pulse) * uScale / max(dist, 0.0001);
}
`

export const brainParticleFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vBrightness;
varying float vFade;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, d);
  float core = smoothstep(0.16, 0.0, d);
  vec3 col = vColor * vBrightness + vec3(1.0) * core * vBrightness * 0.35;
  gl_FragColor = vec4(col, alpha * uOpacity * vFade);
}
`

/* ------------------------------------------------------------------ */
/* Neural connections                                                  */
/* ------------------------------------------------------------------ */

export const neuralLineVert = /* glsl */ `
attribute float aSide;
attribute float aSeed;

uniform float uTime;
uniform float uSplit;
uniform float uSplitDistance;
uniform vec3 uTint;
uniform float uTintAmount;

varying float vPulse;
varying float vSeed;
varying float vSide;

${SPLIT_GLSL}

void main() {
  vec3 p = applySplit(position, aSide, uSplit, uSplitDistance);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vPulse = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 6.2831);
  vSeed = aSeed;
  // interpolates below 1.0 only along edges bridging the hemispheres
  vSide = aSide;
}
`

export const neuralLineFrag = /* glsl */ `
precision highp float;
uniform float uSplit;
uniform float uOpacity;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uTint;
uniform float uTintAmount;

varying float vPulse;
varying float vSeed;
varying float vSide;

void main() {
  vec3 col = mix(uColorA, uColorB, fract(vSeed * 3.7));
  col = mix(col, uTint, uTintAmount * 0.7);
  float alpha = uOpacity * vPulse;
  float cross = 1.0 - abs(vSide);
  alpha *= 1.0 - uSplit * cross * 0.85;
  gl_FragColor = vec4(col, alpha);
}
`

/* ------------------------------------------------------------------ */
/* Travelling light packets                                            */
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
uniform float uSizeMul;

varying float vSeed;
varying float vGlow;

${SPLIT_GLSL}

void main() {
  float t = fract(uTime * aSpeed * 0.6 + aOffset);
  vec3 p = mix(position, aEnd, t);
  float side = mix(aSideStart, aSideEnd, t);
  p = applySplit(p, side, uSplit, uSplitDistance);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // flare on launch, fade on arrival; dim mid-gap while hemispheres part
  vGlow = sin(t * 3.14159265) * (1.0 - uSplit * (1.0 - abs(side)) * 0.8);
  vSeed = aSeed;
  float dist = max(-mv.z, 0.0001);
  gl_PointSize = (0.009 + 0.005 * fract(aSeed * 5.13)) * uSizeMul * uScale / dist;
}
`

export const packetFrag = /* glsl */ `
precision highp float;
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
  gl_FragColor = vec4(col * 1.7, alpha);
}
`

/* ------------------------------------------------------------------ */
/* Node core (the glowing heart at each brain's centre)                */
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
  gl_PointSize = aSize * uScale / max(-mv.z, 0.0001);
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
/* Dependency pathways (neural traffic between sibling mini-brains)    */
/* ------------------------------------------------------------------ */

export const pathwayVert = /* glsl */ `
attribute float aT;   // 0..1 along the curve

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
  float flow = pow(0.5 + 0.5 * sin((vT - uTime * uFlowSpeed) * 16.0), 4.0);
  float alpha = (0.08 + flow * 0.9) * uOpacity;
  gl_FragColor = vec4(uColor * (0.8 + flow * 1.6), alpha);
}
`
