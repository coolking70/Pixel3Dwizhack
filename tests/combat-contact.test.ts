import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { BlockCharacter } from '../src/character-lab/character';
import { parseRig } from '../src/character-lab/assets';
import { chopPhase, CONTACT, RAISED_CHOP } from '../src/room/combat-timeline';
it('aligns the source chop contact with the forward strike rather than the raised hand', () => {
  const actor = new BlockCharacter(parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json', 'utf8'))));
  actor.root.rotation.y = Math.PI / 2;
  actor.sample('attack', RAISED_CHOP); const raised = actor.sword.root.localToWorld(new Vector3(0, .8, 0));
  expect(raised.y).toBeGreaterThan(1.8); expect(raised.x).toBeLessThan(.6);
  for (const fromWindup of [false, true]) {
    actor.sample('attack', chopPhase(CONTACT, fromWindup)); const tip = actor.sword.root.localToWorld(new Vector3(0, .8, 0));
    expect(tip.x).toBeGreaterThan(1); expect(tip.y).toBeGreaterThan(.8); expect(tip.y).toBeLessThan(1.5);
    expect(actor.gripErrors().sword).toBeLessThan(1e-10);
  }
  actor.dispose();
});
