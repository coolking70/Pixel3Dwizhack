import * as T from 'three';
import type { BlockCharacter } from '../../character-lab/character';
import { solveLimb } from '../../character-lab/ladder';
import { MOTION_PROFILE, type InteractionMotion } from './receipt';

// Authored target sockets live with the facility presentation, in metres.
// Door is hinged at z=-.6. The latch and handle are deliberately on the near
// edge so the arm can visibly touch them in the side-on camera.
export const FACILITY_SOCKETS = {
  doorHinge: [0, 0, -.6], doorHandle: [0, 1.05, .45],
  latchPivot: [0, .95, .46], latchHandle: [0, 1.21, .46],
  chestHinge: [0, .43, -.53], chestHandle: [0, .47, -.03],
} as const;

export function effectProgress(motion: InteractionMotion, phase: number): number {
  const p = MOTION_PROFILE[motion];
  return T.MathUtils.smoothstep(phase, p.effect, p.recover);
}

/** Slide along the same horizontal rail as an opening leaf swings away. */
export function doorGripZ(wasOpen: boolean, effect: number): number {
  return wasOpen ? .06 : T.MathUtils.lerp(1.05, .06, T.MathUtils.smoothstep(effect, 0, .5));
}

/** Solve a specified hand against a public presentation socket. */
export function reachPalm(actor: BlockCharacter, side: 'L' | 'R', target: T.Vector3, weight = 1): number {
  actor.root.updateMatrixWorld(true);
  const wrist = actor.bone(`Wrist${side}`), palm = side === 'R' ? actor.rightGrip : actor.leftGrip;
  const start = palm.getWorldPosition(new T.Vector3()), desired = start.clone().lerp(target, weight);
  const rotation = wrist.getWorldQuaternion(new T.Quaternion());
  const axis = start.clone().sub(wrist.getWorldPosition(new T.Vector3())).normalize();
  const direction = desired.clone().sub(actor.bone(`UpperArm${side}`).getWorldPosition(new T.Vector3())).normalize();
  rotation.premultiply(new T.Quaternion().setFromUnitVectors(axis, direction));
  for (let n = 0; n < 4; n++) {
    wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
    actor.root.updateMatrixWorld(true);
    const offset = palm.getWorldPosition(new T.Vector3()).sub(wrist.getWorldPosition(new T.Vector3()));
    solveLimb(actor.bone(`UpperArm${side}`), actor.bone(`Forearm${side}`), wrist, desired.clone().sub(offset), actor.root.localToWorld(new T.Vector3(side === 'R' ? -.65 : .65, .85, -.15)));
  }
  wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  actor.root.updateMatrixWorld(true);
  return palm.getWorldPosition(new T.Vector3()).distanceTo(target);
}

// Purely visual pose with planted feet and a palm-space target. Neither this
// function nor its caller owns a GameSession/submit capability.
export function poseInteraction(actor: BlockCharacter, motion: InteractionMotion, phase: number, target: T.Vector3): number {
  const p = MOTION_PROFILE[motion], active = T.MathUtils.smoothstep(phase, .04, p.contact) * (1 - T.MathUtils.smoothstep(phase, p.recover, 1));
  actor.root.updateMatrixWorld(true);
  const feet = ['L', 'R'].map(side => ({ side, position: actor.bone(`Foot${side}`).getWorldPosition(new T.Vector3()), rotation: actor.bone(`Foot${side}`).getWorldQuaternion(new T.Quaternion()) }));
  const low = motion === 'pickupLow' || motion === 'chestOpen';
  // A substantial bent-knee stance, spine bend and arm reach, not a root dip.
  if (low) {
    actor.bone('Pelvis').position.y -= (motion === 'pickupLow' ? .48 : .4) * active;
    actor.bone('Spine').rotation.x += .65 * active;
    actor.bone('Chest').rotation.x += .45 * active;
  } else {
    actor.bone('Spine').rotation.x += .24 * active;
    actor.bone('Chest').rotation.x += .12 * active;
  }
  actor.root.updateMatrixWorld(true);
  for (const { side, position, rotation } of feet) {
    const foot = actor.bone(`Foot${side}`);
    solveLimb(actor.bone(`Thigh${side}`), actor.bone(`Shin${side}`), foot, position, actor.root.localToWorld(new T.Vector3(side === 'L' ? .32 : -.32, .4, .85)));
    foot.quaternion.copy(foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  }
  actor.root.updateMatrixWorld(true);
  // Use the shoulder that can actually reach this socket. A closing gate may
  // expose its hinge-side edge on the far side of the character.
  const side = actor.bone('UpperArmL').getWorldPosition(new T.Vector3()).distanceToSquared(target) < actor.bone('UpperArmR').getWorldPosition(new T.Vector3()).distanceToSquared(target) ? 'L' : 'R';
  const wrist = actor.bone(`Wrist${side}`), palm = side === 'R' ? actor.rightGrip : actor.leftGrip;
  const start = palm.getWorldPosition(new T.Vector3()), desired = start.clone().lerp(target, active);
  // Iterative offset refinement maintains the actual palm socket after solving
  // the wrist; reach/contact is measured against that socket, not the elbow.
  const wristWorld = wrist.getWorldQuaternion(new T.Quaternion());
  const handAxis = start.clone().sub(wrist.getWorldPosition(new T.Vector3())).normalize();
  const reachAxis = desired.clone().sub(actor.bone(`UpperArm${side}`).getWorldPosition(new T.Vector3())).normalize();
  wristWorld.premultiply(new T.Quaternion().setFromUnitVectors(handAxis, reachAxis));
  wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(wristWorld));
  actor.root.updateMatrixWorld(true);
  for (let i = 0; i < 3; i++) {
    const offset = palm.getWorldPosition(new T.Vector3()).sub(wrist.getWorldPosition(new T.Vector3()));
    solveLimb(actor.bone(`UpperArm${side}`), actor.bone(`Forearm${side}`), wrist, desired.clone().sub(offset), actor.root.localToWorld(new T.Vector3(side === 'R' ? -.65 : .65, .8, -.15)));
    wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(wristWorld));
    actor.root.updateMatrixWorld(true);
  }
  actor.fingersR.rotation.y = -.45 * (1 - T.MathUtils.smoothstep(phase, p.contact - .04, p.contact + .04));
  return palm.getWorldPosition(new T.Vector3()).distanceTo(target);
}
