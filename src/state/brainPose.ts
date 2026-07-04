import * as THREE from 'three'

/**
 * Mutable (non-reactive) pose of the brain group, shared between the
 * drag/spin controller in BrainVerse and the camera rig — the rig must
 * apply this rotation when computing dive targets so you can dive into
 * a mini-brain from any angle.
 */
export const brainPose = {
  /** YXZ: yaw (drag/spin) then pitch (vertical tilt) */
  euler: new THREE.Euler(0, 0, 0, 'YXZ'),
  /** total pointer travel of the last press in px — distinguishes drags from clicks */
  lastDragTravel: 0,
}
