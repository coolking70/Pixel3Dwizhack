import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BlockCharacter } from '../src/character-lab/character';
import type { RigData } from '../src/character-lab/types';
const data = JSON.parse(readFileSync('public/assets/character-study/motions.json', 'utf8')) as RigData;
it('Alpha 2 weapon silhouettes retain grips in both directions and stow on ladders', () => { const actor = new BlockCharacter(data); for (const variant of ['knife', 'spear', 'bow', 'fireblade', 'silverblade'] as const) {
    actor.setEquipment({ model: 'vanguard', outfit: 'brigandine', helmet: true, sword: true, shield: true, weaponStyle: variant === 'bow' ? 'wand' : 'sword', weaponVariant: variant });
    expect(actor.heldWeapon.root.name).toBe(`Alpha2-${variant}`);
    for (const face of [-1, 1])
        for (const phase of [0, .2, .45, .7, 1]) {
            actor.root.rotation.y = face * Math.PI / 2;
            if (variant === 'bow')
                actor.sampleBow(phase);
            else
                actor.sampleStrike(phase);
            expect(actor.gripErrors().sword).toBeLessThan(1e-6);
            expect(actor.gripErrors().shield).toBeLessThan(1e-6);
            actor.sample('climb', phase);
            expect(actor.gripErrors().sword).toBeLessThan(1e-6);
            expect(actor.gripErrors().shield).toBeLessThan(1e-6);
        }
} actor.dispose(); });
