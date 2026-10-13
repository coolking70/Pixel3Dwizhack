import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ITEMS, EFFECTS, MONSTERS, FACILITIES, ALPHA2 as C } from '../src/content/alpha2';
import { createAlpha2, acceptAlpha2, inspectAlpha2, isAlpha2Command } from '../src/core/alpha2';
import { addItem2, spawnMonster2 } from '../src/core/alpha2-map';
import { GameSession } from '../src/session/session';
import { canonical } from '../src/core/digest';
import { advance2 } from '../src/core/alpha2-clock';
import { damage2 } from '../src/core/alpha2-effects';
import { addCondition2 } from '../src/core/alpha2-shared';
import type { World, Command } from '../src/core/types';
// Controlled fixtures isolate interactions; natural routes are tested separately.
function arena() { const w = createAlpha2(42); w.enemies = []; w.alpha2!.monsters = []; w.alpha2!.facilities = []; w.player.x = 6; w.player.hp = 40; spawnMonster2(w, 'crawler', { floor: 0, x: 8 }); w.enemies[0]!.hp = 10; return w; }
function act(w: World, c: Command) { const r = acceptAlpha2(w, c); expect(r.accepted, c).toBe(true); if (!r.accepted)
    throw new Error(r.reason); return r.world; }
describe('Alpha 2 content and contracts', () => {
    it('has 45 implemented definitions, twelve archetypes and eight facilities, all effect references bounded', () => { expect(ITEMS).toHaveLength(45); expect(MONSTERS).toHaveLength(12); expect(Object.keys(FACILITIES)).toHaveLength(8); expect(new Set(ITEMS.map(i => i.id)).size).toBe(45); for (const i of ITEMS) {
        expect(i.name.zh).toBeTruthy();
        expect(i.name.en).toBeTruthy();
        expect(i.description.en).toBeTruthy();
        expect(i.sourceKey).toBe('original-alpha2');
        for (const fx of Object.values(i.actions))
            expect(EFFECTS[fx]).toBeDefined();
    } expect(new Set(MONSTERS.map(m => m.behavior)).size).toBe(6); });
    it('every declared item action has a real successful transition and rejects an unavailable source atomically', () => {
        for (const d of ITEMS)
            for (const action of Object.keys(d.actions)) {
                let w = arena();
                const source = addItem2(w, d.id, 'bag', w.player);
                source.blessing = 'blessed';
                const effect = EFFECTS[d.actions[action as keyof typeof d.actions]!]!;
                let target = 'self';
                if (effect.targets.includes('enemy') && !['drink', 'eat', 'apply'].includes(action))
                    target = 'e1';
                if (effect.targets.includes('item') && ['read', 'apply'].includes(action)) {
                    const targetItem = addItem2(w, effect.op === 'cook' ? 'fruit' : 'sword', 'bag', w.player);
                    targetItem.durability = 2;
                    targetItem.blessing = 'cursed';
                    target = `i${targetItem.id}`;
                }
                const command: Command = action === 'equip' ? `wear:${source.id}` : `a2:use:${source.id}:${action}:${target}`;
                const before = canonical(w), next = act(w, command);
                expect(next.revision).toBe(w.revision + 1);
                expect(next.tick).toBeGreaterThan(w.tick);
                expect(canonical(w)).toBe(before);
                expect(canonical(JSON.parse(JSON.stringify(next)))).toBe(canonical(next));
                source.owner = 'spent';
                const failed = acceptAlpha2(w, command);
                expect(failed.accepted).toBe(false);
                expect(w.alpha2!.items.find(i => i.id === source.id)!.owner).toBe('spent');
            }
    });
    it('unknown projection hides true identity, BUC, enchantment and charges; notes and replay do not reveal future knowledge', () => {
        const w = arena(), i = addItem2(w, 'arc', 'bag', w.player), v = inspectAlpha2(w), shown = v.alpha2!.bag.find(x => x.id === i.id)!;
        expect(shown.definition).toBeUndefined();
        expect(shown.blessing).toBeUndefined();
        expect(shown.charges).toBeUndefined();
        expect(shown.enchantment).toBeUndefined();
        expect(shown.name.en).toContain('Unknown');
        expect(JSON.stringify(v)).not.toContain('assignment');
        const session = new GameSession(42, 'alpha2');
        const id = session.view().alpha2!.bag[0]!.id;
        const before = session.capture();
        expect(session.submit(`a2:note:${id}:${encodeURIComponent('<b>guess: cursed</b>')}`).accepted).toBe(true);
        expect(session.view().tick).toBe(0);
        expect(session.replay(0).alpha2!.bag[0]!.note).toBe('');
        expect(session.view().alpha2!.bag[0]!.note).toContain('<b>');
        expect(GameSession.fromArchive(session.capture()).capture()).toBe(session.capture());
        expect(before).not.toBe(session.capture());
    });
    it('identifies potion use, preserves unidentified thrown wand charges and unique ground ownership', () => {
        let w = arena();
        const i = addItem2(w, 'venom', 'bag', w.player);
        w = act(w, `a2:use:${i.id}:throw:e1`);
        expect(w.alpha2!.knowledge.identified).toContain('venom');
        expect(w.alpha2!.conditions.some(e => e.actor === 1 && e.kind === 'poison')).toBe(true);
        expect(w.alpha2!.items.find(x => x.id === i.id)!.owner).toBe('spent');
        w = arena();
        const wand = addItem2(w, 'cinder', 'bag', w.player);
        const charge = wand.charges;
        w = act(w, `a2:use:${wand.id}:throw:e1`);
        const after = w.alpha2!.items.find(x => x.id === wand.id)!;
        expect(after.owner).toBe('ground');
        expect(after.charges).toBe(charge);
        expect(w.alpha2!.knowledge.identified).not.toContain('cinder');
    });
    it('cursed equipment binds; scroll, blessed water and altar each release it; failed removal changes nothing', () => {
        for (const method of ['scroll', 'water', 'altar']) {
            let w = arena();
            const sword = addItem2(w, 'knife', 'bag', w.player);
            sword.blessing = 'cursed';
            w = act(w, `wear:${sword.id}`);
            const before = canonical(w);
            expect(acceptAlpha2(w, 'unequip:mainHand').accepted).toBe(false);
            expect(canonical(w)).toBe(before);
            if (method === 'altar') {
                w.alpha2!.facilities.push({ id: 1, kind: 'altar', x: w.player.x, floor: 0, used: false, revealed: true, stock: [], gold: 0 });
                w = act(w, `a2:cleanse:1:${sword.id}`);
            }
            else {
                const source = addItem2(w, method === 'water' ? 'water' : 'release', 'bag', w.player);
                source.blessing = 'blessed';
                w = act(w, `a2:use:${source.id}:${method === 'water' ? 'apply' : 'read'}:i${sword.id}`);
            }
            w = act(w, 'unequip:mainHand');
            expect(w.alpha2!.equipped.mainHand).toBeNull();
        }
    });
    it('element immunity, water/fire, wet lightning, armor corrosion and proofing are independent interactions', () => {
        let w = arena();
        w.enemies = [];
        w.alpha2!.monsters = [];
        spawnMonster2(w, 'emberling', { floor: 0, x: 8 });
        const hp = w.enemies[0]!.hp;
        expect(damage2(w, 1, 20, 'fire', 'system:test')).toBe(0);
        expect(w.enemies[0]!.hp).toBe(hp);
        const water = addItem2(w, 'water', 'bag', w.player);
        w = act(w, `a2:use:${water.id}:throw:e1`);
        expect(w.enemies[0]!.hp).toBeLessThan(hp);
        w = arena();
        const chest = w.alpha2!.items.find(i => i.id === w.alpha2!.equipped.chest)!;
        const hp0 = w.player.hp;
        damage2(w, 0, 4, 'acid', 'system:test');
        expect(w.player.hp).toBe(hp0 - 4);
        expect(chest.durability).toBe(5);
        chest.proof = true;
        damage2(w, 0, 4, 'acid', 'system:test');
        expect(chest.durability).toBe(5);
        w = arena();
        w.enemies[0]!.hp = w.enemies[0]!.maxHp = 100;
        addCondition2(w, 'wet', 1, 80, 0, 'system:test');
        expect(damage2(w, 1, 10, 'shock', 'system:test')).toBe(15);
    });
    it('sleep interrupts intent and expiration precedes pulses at the same tick', () => { const w = arena(); w.enemies[0]!.intent = { ...w.player }; addCondition2(w, 'sleep', 1, 20, 0, 'system:test'); expect(w.enemies[0]!.intent).toBeUndefined(); addCondition2(w, 'poison', 0, 20, 3, 'system:test'); const hp = w.player.hp; advance2(w, 20); expect(w.player.hp).toBe(hp); expect(w.alpha2!.conditions).toHaveLength(0); });
    it('spoiled food poisons while cooking removes raw fungus confusion and extends freshness', () => { let w = arena(); const food = addItem2(w, 'fruit', 'bag', w.player); food.freshUntil = 1; w.tick = 2; w = act(w, `a2:use:${food.id}:eat:self`); expect(w.alpha2!.conditions.some(c => c.kind === 'poison')).toBe(true); w = arena(); const fungus = addItem2(w, 'mushroom', 'bag', w.player), pot = addItem2(w, 'pot', 'bag', w.player); w = act(w, `a2:use:${pot.id}:apply:i${fungus.id}`); w = act(w, `a2:use:${fungus.id}:eat:self`); expect(w.alpha2!.conditions.some(c => c.kind === 'confused')).toBe(false); });
    it('shop conserves coins, spread prevents arbitrage, container releases to ground even when bag full', () => {
        let w = createAlpha2(42);
        w.enemies = [];
        const f = w.alpha2!.facilities.find(f => f.kind === 'merchant')!, i = w.alpha2!.items.find(i => i.holder === f.id)!;
        w.player.gold = 200;
        const sum = w.player.gold + f.gold, price = inspectAlpha2(w).alpha2!.facilities.find(x => x.id === f.id)!.stock.find(x => x.id === i.id)!.buy!;
        w = act(w, `a2:buy:${f.id}:${i.id}`);
        expect(w.player.gold + w.alpha2!.facilities.find(x => x.id === f.id)!.gold).toBe(sum);
        w = act(w, `a2:sell:${f.id}:${i.id}`);
        expect(w.player.gold).toBeLessThan(200);
        expect(200 - w.player.gold).toBeLessThan(price);
        expect(w.player.gold + w.alpha2!.facilities.find(x => x.id === f.id)!.gold).toBe(sum);
        const chest = w.alpha2!.facilities.find(x => x.kind === 'chest')!;
        w.player.x = chest.x;
        w.player.floor = chest.floor;
        while (w.alpha2!.items.filter(i => i.owner === 'bag').length < 16)
            addItem2(w, 'ration', 'bag', w.player);
        w = act(w, `a2:feature:${chest.id}:force`);
        for (const id of chest.stock) {
            const i = w.alpha2!.items.find(i => i.id === id)!;
            expect(i.owner).toBe('ground');
            expect(i.holder).toBeNull();
        }
        expect(w.alpha2!.items.filter(i => i.owner === 'bag')).toHaveLength(16);
    });
    it('rejects malformed commands, unknown targets, empty charges and duplicate payments without state changes', () => { const w = arena(), i = addItem2(w, 'cinder', 'bag', w.player); i.charges = 0; const before = canonical(w); for (const c of [`a2:use:${i.id}:zap:e1`, 'a2:use:1:drink:e999', 'a2:note:1:%ZZ', 'a2:note:1:%00', 'a2:buy:0:1', 'a2:use:1:eval:self']) {
        expect(acceptAlpha2(w, c as Command).accepted, c).toBe(false);
        expect(canonical(w)).toBe(before);
    } expect(isAlpha2Command('a2:note:1:' + encodeURIComponent('x'.repeat(121)))).toBe(false); });
    it('seed generation is deterministic, all segments connect without jumping or rare items, ten consecutive seeds differ', () => {
        const signatures = new Set<string>(), seen = new Set<string>();
        for (let seed = 1; seed <= 100; seed++) {
            const a = createAlpha2(seed), b = createAlpha2(seed);
            expect(canonical(a)).toBe(canonical(b));
            for (const item of a.alpha2!.items)
                expect(Object.keys(item.position).sort()).toEqual(['floor', 'x']);
            expect(a.alpha2!.segments).toHaveLength(18);
            expect(a.alpha2!.links).toHaveLength(10);
            for (let f = 0; f < 6; f++) {
                const segments = a.alpha2!.segments.filter(n => n.floor === f);
                expect(segments[0]!.start).toBe(1);
                expect(segments[2]!.end).toBe(C.width - 2);
                for (let n = 1; n < 3; n++)
                    expect(segments[n]!.start).toBe(segments[n - 1]!.end + 1);
            }
            for (const m of a.alpha2!.monsters)
                seen.add(m.definition);
            if (seed <= 10)
                signatures.add(canonical([a.alpha2!.segments, a.alpha2!.facilities.map(f => [f.kind, f.floor, f.x]), a.alpha2!.monsters]));
        }
        expect(signatures.size).toBe(10);
        expect(seen.size).toBe(12);
    });
    it('ranged locks are defeated by a closed door, raiders retreat, scavengers flee and broods summon at most twice', () => {
        let w = arena();
        w.enemies = [];
        w.alpha2!.monsters = [];
        spawnMonster2(w, 'hexer', { floor: 0, x: 8 });
        w.enemies[0]!.nextAt = 8;
        w.enemies[0]!.intent = { x: 6, floor: 0 };
        w.alpha2!.doors = [{ id: 1, x: 7, floor: 0, open: true, locked: false }];
        const hp = w.player.hp;
        w = act(w, 'door:1');
        expect(w.player.hp).toBe(hp);
        expect(w.enemies[0]!.intent).toBeUndefined();
        expect(w.alpha2!.journal.some(j => j.key === 'evaded')).toBe(true);
        for (const kind of ['raider', 'scavenger']) {
            w = arena();
            w.enemies = [];
            w.alpha2!.monsters = [];
            spawnMonster2(w, kind, { floor: 0, x: 7 });
            w.enemies[0]!.nextAt = 1;
            if (kind === 'scavenger')
                w.enemies[0]!.hp = 2;
            advance2(w, 1);
            expect(w.enemies[0]!.x).toBe(8);
        }
        w = arena();
        w.player.hp = 80;
        w.enemies = [];
        w.alpha2!.monsters = [];
        spawnMonster2(w, 'brood', { floor: 0, x: 10 });
        w.enemies[0]!.nextAt = 1;
        advance2(w, 1);
        expect(w.enemies[0]!.intent).toEqual({ x: 6, floor: 0 });
        advance2(w, 220);
        expect(w.alpha2!.monsters[0]!.summons).toBe(2);
        expect(w.enemies.length).toBe(3);
    });
    it('search and light reveal hidden traps, starved poison-resistant characters still lose health', () => { let w = arena(); w.alpha2!.loadout = 'breaker'; w.alpha2!.facilities = [{ id: 1, kind: 'trap', x: 8, floor: 0, used: false, revealed: false, stock: [], gold: 0 }]; expect(inspectAlpha2(w).alpha2!.facilities).toHaveLength(0); w = act(w, 'a2:search'); expect(inspectAlpha2(w).alpha2!.facilities[0]!.kind).toBe('trap'); w.player.x = 7; w = act(w, 'a2:feature:1:disarm'); expect(w.alpha2!.facilities[0]!.used).toBe(true); w=arena(); w.alpha2!.loadout='breaker';w.alpha2!.facilities=[{id:1,kind:'trap',x:9,floor:0,used:false,revealed:false,stock:[],gold:0}];const lamp=addItem2(w,'lantern','bag',w.player);w=act(w,`a2:use:${lamp.id}:apply:self`);expect(inspectAlpha2(w).alpha2!.facilities[0]!.kind).toBe('trap'); w = arena(); w.enemies = []; w.alpha2!.monsters = []; const i = addItem2(w, 'leather', 'bag', w.player); w.alpha2!.equipped.chest = i.id; w.alpha2!.food = 0; w.alpha2!.foodAt = 1; const hp = w.player.hp; advance2(w, 1); expect(w.player.hp).toBe(hp - 2); });
    it('all five historical golden archives remain byte-exact and cross-scenario restore is rejected', () => { for (const name of ['mine', 'room', 'dungeon', 'expedition', 'alpha']) {
        const raw = readFileSync(`tests/fixtures/${name}-v1.json`, 'utf8').trim();
        const s = GameSession.fromArchive(raw);
        expect(s.capture()).toBe(raw);
        const fresh = new GameSession(42, 'alpha2'), before = fresh.capture();
        expect(() => fresh.restore(raw)).toThrow();
        expect(fresh.capture()).toBe(before);
    } const alpha2=readFileSync('tests/fixtures/alpha2-v1.json','utf8').trim();expect(GameSession.fromArchive(alpha2).capture()).toBe(alpha2); });
});
