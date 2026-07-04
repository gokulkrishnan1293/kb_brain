import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { CAMERA, COLORS, QUALITY } from '../config'
import { useBrainStore } from '../state/useBrainStore'
import { BrainAssembly } from './BrainAssembly'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { AmbientDust } from './AmbientDust'

export function Scene() {
  return (
    <Canvas
      dpr={QUALITY.dpr}
      gl={{
        antialias: false, // bloom already smooths; keeps fill rate for particles
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      }}
      camera={{
        fov: CAMERA.fov,
        near: 0.05,
        far: 60,
        position: [...CAMERA.idle.pos],
      }}
      onPointerMissed={() => {
        // click on empty space steps back one level
        const { stage, leaveCluster, closeBrain } = useBrainStore.getState()
        if (stage === 'cluster') leaveCluster()
        else if (stage === 'open') closeBrain()
      }}
    >
      <color attach="background" args={[COLORS.background]} />
      <Suspense fallback={null}>
        <BrainAssembly />
      </Suspense>
      <AmbientDust />
      <CameraRig />
      <Effects />
      <AdaptiveDpr pixelated />
    </Canvas>
  )
}
