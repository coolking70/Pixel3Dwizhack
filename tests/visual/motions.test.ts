import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { GameSession } from '../../src/session/session';
import type { Command } from '../../src/core/types';
import { interactionReceipt, MOTION_PROFILE, motionStage, type InteractionMotion } from '../../src/visual/motions/receipt';
import { doorGripZ, poseInteraction } from '../../src/visual/motions/pose';
import { BlockCharacter } from '../../src/character-lab/character';
import { parseRig } from '../../src/character-lab/assets';

const golden = JSON.parse(readFileSync('tests/fixtures/alpha2-v1.json', 'utf8')) as { seed: number; history: { command: Command; digest: string }[] };
const rig = parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json', 'utf8')));
describe('M16 public presentation receipts', () => {
  it('derives accepted interactions from the natural golden route without changing any historical digest', () => {
    const session = new GameSession(golden.seed, 'alpha2'), found = new Set<string>();
    for (const entry of golden.history) {
      const before = session.view();
      expect(session.submit(entry.command).accepted).toBe(true);
      const after = session.view(), snapshot = JSON.stringify([before, after]);
      const receipt = interactionReceipt(before, after, entry.command);
      if (receipt) {
        found.add(receipt.motion);
        expect(receipt.logicalTicks).toBe(after.tick - before.tick);
        expect(receipt.item?.definition === undefined || receipt.item?.definition === [...before.alpha2!.ground,...before.alpha2!.bag].find(i => i.id === receipt.item!.id)?.definition).toBe(true);
        for (const phase of [0, .2, .4, .6, .8, 1]) motionStage(receipt.motion, phase);
      }
      expect(JSON.stringify([before, after])).toBe(snapshot);
      expect(session.fingerprint()).toBe(entry.digest);
      expect(interactionReceipt(after, after, entry.command)).toBeNull();
    }
    expect(found.has('pickupLow')).toBe(true);
    expect(found.has('leverPull')).toBe(true);
    expect(found.has('doorPush') || found.has('doorPull')).toBe(true);
  });
  it('rejects rejected, stale and foreign session boundary pairs', () => {
    const a = new GameSession(42, 'alpha2'), before = a.view();
    expect(a.submit('take:99999').accepted).toBe(false);
    expect(interactionReceipt(before, a.view(), 'take:99999')).toBeNull();
    const b = new GameSession(43, 'alpha2'); b.submit('interact');
    expect(interactionReceipt(before, b.view(), 'interact')).toBeNull();
    expect(a.view().tick).toBe(before.tick);
  });
  it('has prepare/contact/effect/recover, and real palm contact in both directions with planted feet', () => {
    const actor = new BlockCharacter(rig);
    for (const motion of ['pickupLow','doorPush','doorPull','leverPull','chestOpen'] as InteractionMotion[]) for (const side of [-1, 1]) {
      const profile = MOTION_PROFILE[motion];
      expect([0, profile.contact, profile.effect, profile.recover].map(p => motionStage(motion, p))).toEqual(['prepare', 'contact', 'effect', 'recover']);
      actor.root.position.set(side * .32, 0, .14); actor.root.rotation.set(0, side * Math.PI / 2, 0); actor.sample('idle', 0);
      const target = new T.Vector3(side, motion === 'pickupLow' ? .2 : motion === 'chestOpen' ? .47 : 1.05, motion === 'pickupLow' ? .22 : .45);
      const feet = ['L', 'R'].map(s => actor.bone(`Foot${s}`).getWorldPosition(new T.Vector3()));
      const error = poseInteraction(actor, motion, profile.contact, target);
      expect(error, `${motion}/${side}`).toBeLessThan(.08);
      for (const [index, s] of ['L', 'R'].entries()) expect(actor.bone(`Foot${s}`).getWorldPosition(new T.Vector3()).distanceTo(feet[index]!), `${motion}/${side}/foot${s}`).toBeLessThan(.03);
    }
    actor.dispose();
  });
  it('reaches the near hinge stile of an already open gate when closing it', () => {
    const actor=new BlockCharacter(rig);
    actor.root.position.set(.32,0,.14);actor.root.rotation.y=Math.PI/2;actor.sample('idle',0);
    const error=poseInteraction(actor,'doorPull',MOTION_PROFILE.doorPull.contact,new T.Vector3(1.06,1.05,-.6));
    expect(error).toBeLessThan(.08);actor.dispose();
  });
  it('keeps the actual palm on the rotating door rail throughout the effect', () => {
    const actor=new BlockCharacter(rig);
    for(const wasOpen of [false,true])for(const effect of [0,.2,.5,.8,1]){
      actor.root.position.set(.32,0,.14);actor.root.rotation.y=Math.PI/2;actor.sample('idle',0);
      const angle=(wasOpen?1-effect:effect)*Math.PI/2;
      const target=new T.Vector3(0,1.05,doorGripZ(wasOpen,effect)).applyAxisAngle(new T.Vector3(0,1,0),angle).add(new T.Vector3(1,0,-.6));
      expect(poseInteraction(actor,wasOpen?'doorPull':'doorPush',.7,target),`${wasOpen}/${effect}`).toBeLessThan(.08);
    }
    actor.dispose();
  });
});
