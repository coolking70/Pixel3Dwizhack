import {itemDefinition,monsterDefinition} from '../content/catalog-access';
import { ALPHA2 as C, ITEMS, ITEM_BY_ID, MONSTERS } from '../content/alpha2';
import type { World, Position } from './types';
import type { Alpha2State, Item2, Facility2, FacilityKind, Segment2 } from './alpha2-types';
export function roll2(w: World): number { let x = w.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return w.rng = x >>> 0; }
export function addItem2(w: World, definition: string, owner: Item2['owner'], position: Position, holder: number | null = null, known = false): Item2 {
    const s = w.alpha2!, d = itemDefinition(definition);
    const item: Item2 = { id: s.items.length + 1, definition, owner, position: { x: position.x, floor: position.floor }, holder, blessing: known ? 'uncursed' : (['uncursed', 'uncursed', 'uncursed', 'blessed', 'cursed'] as const)[roll2(w) % 5]!, enchantment: known ? 0 : roll2(w) % 3 === 0 ? 1 : 0, charges: d.charges ?? 0, durability: 6, proof: false, freshUntil: d.perishes ? w.tick + 1000 : 0 };
    s.items.push(item);
    if (known) {
        if (!s.knowledge.identified.includes(definition))
            s.knowledge.identified.push(definition);
        s.knowledge.buc.push(item.id);
        s.knowledge.enchantment.push(item.id);
        s.knowledge.charges.push(item.id);
    }
    return item;
}
export function spawnMonster2(w: World, definition: string, p: Position, spawned = false): void {
    const d = monsterDefinition(definition), id = w.enemies.length + 1, hp = d.hp + (spawned ? 0 : Math.max(0, p.floor - d.minDepth) * 2);
    w.enemies.push({ id, ...p, hp, maxHp: hp, kind: d.kind, damage: d.damage, armor: d.armor, period: d.period, nextAt: w.tick + d.period, elite: definition === 'warden', venom: d.inflict === 'poison' });
    w.alpha2!.monsters.push({ id, definition, spawned, summons: 0 });
}
export function createAlpha2Map(w: World): Alpha2State {
    const s: Alpha2State = { loadout: 'vanguard', chosen: false, mana: C.mana, manaAt: C.manaPeriod, food: C.maxFood, foodAt: C.foodPeriod, items: [], equipped: { head: null, chest: null, legs: null, mainHand: null, offHand: null, charm: null }, assignment: {}, knowledge: { identified: [], buc: [], enchantment: [], charges: [], notes: {}, monsters: [], facilities: [] }, conditions: [], monsters: [], facilities: [], links: [], doors: [], segments: [], kills: 0, collected: 0, relic: { floor: 5, x: 28 }, journal: [{ key: 'start' }] };
    w.alpha2 = s;
    for (const category of ['potion', 'scroll', 'wand', 'accessory'] as const) {
        const group = ITEMS.filter(i => i.category === category), pool = group.map((_, i) => i);
        for (let n = pool.length - 1; n > 0; n--) {
            const j = roll2(w) % (n + 1);
            [pool[n], pool[j]] = [pool[j]!, pool[n]!];
        }
        group.forEach((d, i) => s.assignment[d.id] = pool[i]!);
    }
    for (const def of ['cap', 'brigandine', 'boots', 'sword', 'shield', 'renewal', 'renewal', 'ration', 'ration', 'insight', 'release']) {
        const i = addItem2(w, def, 'bag', { x: 2, floor: 0 }, null, true);
        const slot = ITEM_BY_ID[def]!.slot;
        if (slot)
            s.equipped[slot] = i.id;
    }
    const facility = (kind: FacilityKind, p: Position): Facility2 => { const f: Facility2 = { id: s.facilities.length + 1, kind, ...p, used: false, revealed: kind !== 'trap', stock: [], gold: kind === 'merchant' ? 65 : 0 }; s.facilities.push(f); return f; };
    const stock = (f: Facility2, def: string) => f.stock.push(addItem2(w, def, f.kind === 'merchant' ? 'shop' : 'container', f, f.id).id);
    for (let floor = 0; floor < C.floors; floor++) {
        const bounds = [1, 9 + roll2(w) % 3, 18 + roll2(w) % 3, 29];
        const tags: Segment2['tag'][] = ['mine', 'fungal', 'crypt', 'sanctuary', 'merchant'];
        for (let n = 0; n < 3; n++)
            s.segments.push({ id: s.segments.length + 1, floor, start: bounds[n]!, end: bounds[n + 1]! - 1, tag: floor === 0 && n === 0 ? 'sanctuary' : tags[roll2(w) % tags.length]!, risk: floor + (n === 1 ? 1 : 0) });
        if (floor < C.floors - 1)
            s.links.push({ floor, x: 4 + roll2(w) % 4 }, { floor, x: 23 + roll2(w) % 4 });
        if (floor > 0)
            for (const x of bounds.slice(1, 3))
                s.doors.push({ id: s.doors.length + 1, floor, x, open: false, locked: roll2(w) % 2 === 0 });
        // Guaranteed supplies are separate from optional room loot and never require a random rare item.
        addItem2(w, 'renewal', 'ground', { floor, x: 3 }, null, true);
        addItem2(w, 'ration', 'ground', { floor, x: 4 }, null, true);
        const eligible = ITEMS.filter(i => i.minDepth <= floor);
        for (const x of [8, 16, 27]) {
            const d = eligible[roll2(w) % eligible.length]!;
            addItem2(w, d.id, 'ground', { floor, x });
        }
        const selected: FacilityKind[] = floor === 0 ? ['merchant', 'altar', 'garden'] : floor === 5 ? ['fountain', 'campfire', 'chest'] : ['fountain', 'campfire', 'merchant', 'altar', 'garden', 'chest'];
        const kinds = floor === 0 || floor === 5 ? selected : [selected[roll2(w) % selected.length]!, selected[(floor + 2) % selected.length]!, 'chest' as const];
        for (let n = 0; n < 3; n++) {
            const f = facility(kinds[n]!, { floor, x: [2, 14, 27][n]! });
            if (f.kind === 'merchant') {
                stock(f, 'renewal');
                stock(f, 'ration');
                stock(f, 'release');
                for (let k = 0; k < 3; k++)
                    stock(f, eligible[roll2(w) % eligible.length]!.id);
            }
            if (f.kind === 'chest') {
                stock(f, 'renewal');
                stock(f, eligible[roll2(w) % eligible.length]!.id);
            }
            if (f.kind === 'garden') {
                stock(f, 'fruit');
                stock(f, 'mushroom');
            }
        }
        if (floor > 0) {
            facility('trap', { floor, x: 11 + roll2(w) % 3 });
            facility('hazard', { floor, x: 21 + roll2(w) % 2 });
        }
        if (floor === 0) {
            spawnMonster2(w, 'crawler', { floor, x: 13 });
            spawnMonster2(w, 'scavenger', { floor, x: 25 });
        }
        else if (floor === 5) {
            spawnMonster2(w, 'warden', { floor, x: 26 });
            spawnMonster2(w, 'shade', { floor, x: 16 });
        }
        else {
            const candidates = MONSTERS.filter(m => m.minDepth <= floor && m.id !== 'warden');
            for (const x of [8, 17, 27])
                spawnMonster2(w, candidates[roll2(w) % candidates.length]!.id, { floor, x });
        }
    }
    // A small, real first-floor discovery set exercises the M11 interaction loop.
    for (const def of ['water', 'venom', 'cinder', 'latch'])
        addItem2(w, def, 'ground', { floor: 0, x: 6 });
    return s;
}
