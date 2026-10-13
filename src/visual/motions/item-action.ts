import * as T from 'three';
import type { BlockCharacter } from '../../character-lab/character';
import type { ItemVisualSpec } from '../items/types';
import { MOTION_PROFILE, type PresentationActionReceipt } from './receipt';
import { reachPalm } from './pose';

export interface ItemActionSample { error: number; mouthError?: number; applicationError?: number; muzzle: T.Vector3; target: T.Vector3; flight: boolean; }
const v = (point: readonly number[]): T.Vector3 => new T.Vector3().fromArray(point);

/** The prop is a cache clone. This function has no session or command capability. */
export function sampleItemAction(actor: BlockCharacter, prop: T.Group, spec: ItemVisualSpec, receipt: PresentationActionReceipt, phase: number, target: T.Vector3, applied?: {prop:T.Group;spec:ItemVisualSpec}): ItemActionSample {
  const profile = MOTION_PROFILE[receipt.motion], motion = receipt.motion;
  const prepare = T.MathUtils.smoothstep(phase, .04, profile.contact), recover = T.MathUtils.smoothstep(phase, profile.recover, 1);
  const effect = T.MathUtils.smoothstep(phase, profile.effect, profile.recover);
  actor.root.updateMatrixWorld(true);
  const storage = actor.root.localToWorld(new T.Vector3(-.28, .87, .18));
  let grip = actor.root.localToWorld(new T.Vector3(-.25, 1.25, .48));
  const rotation = actor.root.getWorldQuaternion(new T.Quaternion());
  const sockets = spec as ItemVisualSpec & { contact?: readonly number[]; supportGrip?: readonly number[] };
  const contact = v(sockets.contact ?? spec.grip);
  let mouth: T.Vector3 | undefined;
  let application: T.Vector3 | undefined, support: T.Vector3 | undefined;
  if (motion === 'drink' || motion === 'eat') {
    rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), motion === 'drink' ? -1.85 : -.4));
    mouth = actor.bone('Head').localToWorld(new T.Vector3(0,.04,.235));
    grip = mouth.clone().sub(contact.clone().sub(v(spec.grip)).applyQuaternion(rotation));
  } else if (motion === 'read') {
    rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-.8));
    rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1), -Math.PI / 2));
  } else if (motion === 'apply') {
    const environment=receipt.targetKey?.startsWith('f')||receipt.targetKey?.startsWith('d');
    rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),environment?Math.PI/2:-Math.PI/2));
    if(applied){
      const {prop:other,spec:otherSpec}=applied;
      support=actor.root.localToWorld(new T.Vector3(.2,1.12,.40));
      other.quaternion.copy(actor.root.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-Math.PI/2));
      other.position.copy(storage).lerp(support,prepare*(1-recover)).sub(v(otherSpec.grip).applyQuaternion(other.quaternion));
      other.updateMatrixWorld(true);application=other.localToWorld(v(otherSpec.grip));
    }else if(receipt.targetKey==='self')application=actor.bone('Chest').localToWorld(new T.Vector3(-.14,-.06,.23));
    else application=target.clone();
    // Small visible application stroke during the effect, with the model's
    // actual application tip in contact; it never calls an effect callback.
    const stroke=phase>=profile.effect&&phase<profile.recover?Math.sin(effect*Math.PI*4)*.025:0;
    application.y+=stroke;
    grip=application.clone().sub(contact.clone().sub(v(spec.grip)).applyQuaternion(rotation));
  } else if(motion==='drop'){grip=target.clone();grip.y-=.98;
  } else if (motion === 'zap') {
    const aim = target.clone().sub(grip).normalize();
    rotation.setFromUnitVectors(v(spec.muzzle ?? [0,1,0]).sub(v(spec.grip)).normalize(), aim);
  } else if (motion === 'throw') {
    grip = actor.root.localToWorld(new T.Vector3(-.25,1.5,.15 + .36 * T.MathUtils.smoothstep(phase,profile.contact,profile.effect)));
  } else if (motion === 'equip' || motion === 'unequip') {
    const point = receipt.slot === 'head' ? [0,1.8,.22] : receipt.slot === 'legs' ? [-.25,.8,.25] : receipt.slot === 'charm' ? [-.05,1.25,.3] : [-.25,1.18,.35];
    grip = actor.root.localToWorld(v(point));
  }
  const at = motion === 'unequip' ? grip.clone().lerp(storage,T.MathUtils.smoothstep(phase,profile.contact,profile.recover)) : storage.clone().lerp(grip, prepare).lerp(storage,recover);
  prop.quaternion.copy(rotation); prop.scale.setScalar(1);
  const sheet=prop.getObjectByName('ReadingSheet');
  if(sheet)sheet.scale.x=motion==='read'?T.MathUtils.lerp(.001,1,prepare*(1-recover)):.001;
  prop.position.copy(at).sub(v(spec.grip).applyQuaternion(rotation));
  prop.updateMatrixWorld(true);
  let error = reachPalm(actor, 'R', at, prepare * (1-recover));
  if(support)error=Math.max(error,reachPalm(actor,'L',support,prepare*(1-recover)));
  if (motion === 'read') {
    const support = prop.localToWorld(v(sockets.supportGrip ?? [0,.4,0]));
    error = Math.max(error, reachPalm(actor,'L',support,prepare * (1-recover)));
  }
  actor.fingersR.rotation.y = -.35 * prepare * (1-recover);
  actor.fingersL.rotation.y = motion === 'read' ? .35 * prepare * (1-recover) : 0;
  const flight = motion === 'throw' && phase >= profile.effect;
  if (flight) {
    const end = target.clone();
    const point = grip.clone().lerp(end,effect); point.y += Math.sin(effect*Math.PI)*.45;
    prop.position.copy(point).sub(v(spec.grip).applyQuaternion(rotation));
    prop.rotateY(effect*Math.PI*2);
    prop.visible = phase < profile.recover;
  } else prop.visible = !(['equip','drop'].includes(motion) && phase >= profile.effect);
  if (['drink','eat','read'].includes(motion) && phase > profile.recover) prop.scale.setScalar(1-recover);
  if (motion === 'unequip') prop.scale.setScalar(1-recover);
  prop.updateMatrixWorld(true);
  return { error, ...(mouth ? {mouthError: prop.localToWorld(contact).distanceTo(mouth)} : {}), ...(application?{applicationError:prop.localToWorld(contact).distanceTo(application)}:{}), muzzle: prop.localToWorld(v(spec.muzzle ?? spec.grip)), target, flight };
}
