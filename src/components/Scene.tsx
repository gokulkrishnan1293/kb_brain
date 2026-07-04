import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { CAMERA, COLORS, QUALITY } from '../config'
import { useNavStore } from '../state/useNavStore'
import { brainPose } from '../state/brainPose'
import { BrainVerse } from './BrainVerse'
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
        position: [...CAMERA.formingStart.pos],
      }}
      onPointerMissed={() => {
        // click on empty space surfaces one level — but not after a drag
        if (brainPose.lastDragTravel > 6) return
        useNavStore.getState().surface()
      }}
    >
      <color attach="background" args={[COLORS.background]} />
      <Suspense fallback={null}>
        <BrainVerse />
      </Suspense>
      <AmbientDust />
      <CameraRig />
      <Effects />
      <AdaptiveDpr pixelated />
    </Canvas>
  )
}
