/** Fibonacci-sphere particle shells for a node's glowing core. */
export function buildCoreParticles(count: number, radius: number) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    const shell = radius * (0.55 + 0.45 * Math.pow(Math.random(), 0.5))
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * shell
    positions[i * 3 + 1] = Math.cos(phi) * shell
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell
    seeds[i] = Math.random()
    sizes[i] = 0.003 + Math.random() * 0.005
  }
  return { positions, seeds, sizes }
}
