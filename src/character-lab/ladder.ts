import * as T from 'three';
import type { BlockCharacter } from './character';

function worldRotation(bone: T.Object3D, rotation: T.Quaternion): void {
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));
  bone.updateWorldMatrix(false, true);
}
// Analytic two-segment solve with a pole vector. Rendering only; no collision,
// actor coordinates or rules are changed by a limb's solution.
export function solveLimb(upper: T.Bone, lower: T.Bone, end: T.Bone, target: T.Vector3, pole: T.Vector3): void {
  const a = upper.getWorldPosition(new T.Vector3()), b = lower.getWorldPosition(new T.Vector3()), c = end.getWorldPosition(new T.Vector3());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c), direction = target.clone().sub(a);
  const distance = T.MathUtils.clamp(direction.length(), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001); direction.normalize();
  const bend = pole.clone().sub(a); bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const middle = a.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  const rotate = (bone: T.Bone, from: T.Vector3, to: T.Vector3): void => {
    const delta = new T.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    worldRotation(bone, delta.multiply(bone.getWorldQuaternion(new T.Quaternion())));
  };
  rotate(upper, b.sub(a), middle.sub(a));
  const joint = lower.getWorldPosition(new T.Vector3());
  rotate(lower, end.getWorldPosition(new T.Vector3()).sub(joint), target.clone().sub(joint));
}
export const RUNG = .34;
// The first part of each cycle holds the rung while the body rises; the final
// part swings to the next rung. Descent traverses the same contacts in reverse.
function contact(travel: number, offset: number): number {
  const t = travel / RUNG + offset, index = Math.floor(t), phase = t - index;
  const swing = T.MathUtils.smoothstep(phase, .5, 1);
  return (index + swing) * RUNG;
}
export function poseOnLadder(character: BlockCharacter, ladderX: number, bodyY: number): number {
  character.fingersL.rotation.y = 0; character.fingersR.rotation.y = 0;
  character.root.updateMatrixWorld(true);
  let error = 0;
  for (const [side, sign, offset] of [['L', 1, 0], ['R', -1, .5]] as const) {
    const wrist = character.bone(`Wrist${side}`), grip = character.bone(`Grip${side}`);
    // Keep the hand-slot handle axis horizontal along the rung.
    const desiredGrip = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2));
    const relative = wrist.getWorldQuaternion(new T.Quaternion()).invert().multiply(grip.getWorldQuaternion(new T.Quaternion()));
    const wristRotation = desiredGrip.clone().multiply(relative.invert()); worldRotation(wrist, wristRotation);
    const handOffset = grip.getWorldPosition(new T.Vector3()).sub(wrist.getWorldPosition(new T.Vector3()));
    const target = new T.Vector3(ladderX - sign * .27, contact(bodyY + 1.70, offset), -.28);
    solveLimb(character.bone(`UpperArm${side}`), character.bone(`Forearm${side}`), wrist, target.clone().sub(handOffset), new T.Vector3(ladderX - sign * .65, bodyY + 1.1, .4));
    worldRotation(wrist, wristRotation);
    error = Math.max(error, grip.getWorldPosition(new T.Vector3()).distanceTo(target));
    const foot = character.bone(`Foot${side}`), toe = character.bone(`Toe${side}`);
    const rotation = foot.getWorldQuaternion(new T.Quaternion());
    const toeOffset = toe.getWorldPosition(new T.Vector3()).sub(foot.getWorldPosition(new T.Vector3()));
    const footTarget = new T.Vector3(ladderX - sign * .24, contact(bodyY + .24, 1 - offset), -.22);
    solveLimb(character.bone(`Thigh${side}`), character.bone(`Shin${side}`), foot, footTarget.clone().sub(toeOffset), new T.Vector3(ladderX - sign * .24, bodyY + .5, -.8));
    worldRotation(foot, rotation);
    error = Math.max(error, toe.getWorldPosition(new T.Vector3()).distanceTo(footTarget));
  }
  character.root.updateMatrixWorld(true);
  return error;
}
