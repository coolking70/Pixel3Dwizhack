import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { BlockCharacter } from '../src/character-lab/character';
import { parseRig } from '../src/character-lab/assets';
import type { RigData, Motion } from '../src/character-lab/types';
const data = JSON.parse(readFileSync(new URL('../public/assets/character-study/motions.json', import.meta.url), 'utf8')) as RigData;
const outfit = { outfit: 'plate', helmet: true, sword: true, shield: true } as const;
const pose = (character: BlockCharacter): number[] => [...character.bones.values()].flatMap(b => [...b.position.toArray(), ...b.quaternion.toArray()]);

describe('imported character presentation', () => {
  it('rejects cyclic rigs, non-finite keys and tracks outside the presentation contract', () => {
    expect(parseRig(data)).toBe(data);
    const cycle = structuredClone(data); cycle.bones.find(b => b.name === 'Chest')!.parent = 'Head';
    expect(() => parseRig(cycle)).toThrow();
    const malformed = structuredClone(data); malformed.clips[0]!.tracks[0]!.values[0] = NaN;
    expect(() => parseRig(malformed)).toThrow();
    const track = structuredClone(data); track.clips[0]!.tracks[0]!.name = 'Root.position';
    expect(() => parseRig(track)).toThrow();
  });
  it('ships only the licensed selected clips and no mechanical displacement', () => {
    expect(data.source.license).toBe('CC0-1.0'); expect(data.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(data.clips.map(c => c.name)).toEqual(['idle', 'walk', 'attack', 'block']);
    const pelvis = data.bones.find(b => b.name === 'Pelvis')!;
    for (const clip of data.clips) for (const track of clip.tracks) {
      expect(track.name).not.toMatch(/^Root\./);
      expect(track.values.every(Number.isFinite)).toBe(true);
      if (track.name === 'Pelvis.position') for (let i = 0; i < track.values.length; i += 3) {
        expect(track.values[i]).toBe(pelvis.position[0]); expect(track.values[i + 2]).toBe(pelvis.position[2]);
      }
    }
  });
  it('keeps weapon grip position AND orientation at the hand or stowed socket across motion and facing', () => {
    const character = new BlockCharacter(data); character.setEquipment(outfit);
    const a = new T.Quaternion(), b = new T.Quaternion();
    for (const motion of ['idle', 'walk', 'attack', 'block', 'climb'] as Motion[]) for (const phase of [0, .15, .35, .5, .7, .9, 1]) for (const facing of [0, Math.PI]) {
      character.root.rotation.y = facing; character.sample(motion, phase);
      expect(character.gripErrors().sword).toBeLessThan(1e-6); expect(character.gripErrors().shield).toBeLessThan(1e-6);
      for (const [asset, socket] of [[character.sword, motion === 'climb' ? character.backSword : character.rightGrip], [character.shield, motion === 'climb' ? character.backShield : character.leftGrip]] as const) {
        asset.grip.getWorldQuaternion(a); socket.getWorldQuaternion(b);
        expect(Math.abs(a.dot(b))).toBeCloseTo(1, 6);
      }
    }
    character.dispose();
  });
  it('supports reverse seek and outfit replacement without stale animation or duplicate equipment', () => {
    const character = new BlockCharacter(data); character.sample('attack', .35); const before = pose(character);
    character.sample('walk', .9); character.sample('attack', .35); expect(pose(character)).toEqual(before);
    character.setEquipment(outfit); expect(pose(character)).toEqual(before);
    const meshes = (): number => { let count = 0; character.root.traverse(o => { if (o instanceof T.Mesh) count++; }); return count; };
    const originalCount = meshes();
    for (let i = 0; i < 20; i++) { character.setEquipment({ ...outfit, outfit: 'leather' }); character.setEquipment(outfit); }
    expect(meshes()).toBe(originalCount); expect(pose(character)).toEqual(before);
    const torso = character.root.getObjectByName('SkinnedUndertunic') as T.SkinnedMesh;
    expect(torso.isSkinnedMesh).toBe(true); expect(torso.skeleton).toBe(character.skeleton);
    let disposed = false; torso.geometry.addEventListener('dispose', () => { disposed = true; }); character.dispose(); expect(disposed).toBe(true);
  });
  it('an imported action visibly changes pose, then a paused sample remains stable', () => {
    const character = new BlockCharacter(data); character.sample('attack', .1); const first = pose(character);
    character.sample('attack', .55); expect(pose(character)).not.toEqual(first);
    const later = pose(character); character.sample('attack', .55); expect(pose(character)).toEqual(later);
    character.dispose();
  });
});
