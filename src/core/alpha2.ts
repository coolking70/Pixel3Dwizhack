import { ALPHA2 as C } from '../content/alpha2';
import { COMMANDS, type World, type Command, type Outcome, type Enemy } from './types';
import type { ItemAction, ItemSlot } from './alpha2-types';
import type { Loadout } from './alpha-types';
import { createAlpha2Map, roll2 } from './alpha2-map';
import { advance2 } from './alpha2-clock';
import { damage2, heal2, useItem2, openContainer2, cook2, hazard2 } from './alpha2-effects';
import { S2, pos2, near2, visible2, line2, walk2, enemyAt2, item2, def2, weapon2, stats2, condition2, log2, beat2, reveal2, know2, quote2 } from './alpha2-shared';
export { inspectAlpha2 } from './alpha2-view';
export function isAlpha2Command(v: unknown): v is Command {
    if (typeof v !== 'string' || v.length > 1200)
        return false;
    if ((COMMANDS as readonly string[]).includes(v) || v === 'cast' || /^choose:(vanguard|breaker|channeler)$/.test(v) || /^(take|wear|drop|door|lever):[1-9]\d{0,4}$/.test(v) || /^unequip:(head|chest|legs|mainHand|offHand|charm)$/.test(v))
        return true;
    if (/^a2:use:[1-9]\d{0,4}:(drink|throw|apply|read|zap|eat):(self|[eifd][1-9]\d{0,4})$/.test(v) || /^a2:(search|rest)$/.test(v) || /^a2:feature:[1-9]\d{0,4}:(drink|pay|force|harvest|disarm)$/.test(v) || /^a2:(buy|sell|cleanse|cook|recharge):[1-9]\d{0,4}:[1-9]\d{0,4}$/.test(v))
        return true;
    const note = /^a2:note:([1-9]\d{0,4}):(.*)$/.exec(v);
    if (note) {
        try {
            const text = decodeURIComponent(note[2]!);
            return text.length <= 120 && !/[\u0000-\u001f\u007f]/.test(text);
        }
        catch {
            return false;
        }
    }
    return false;
}
export function createAlpha2(seed: number): World { if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
    throw new Error('seed'); const w: World = { scenario: 'alpha2', seed, rng: seed, tick: 0, revision: 0, status: 'playing', player: { x: 2, floor: 0, hp: C.hp, maxHp: C.hp, face: 1, potions: 0, gold: 22, relic: false }, enemies: [], loot: [], explored: Array.from({ length: C.floors }, () => []), events: [], beats: [] }; createAlpha2Map(w); reveal2(w); return w; }
const reject = (reason: 'invalid' | 'blocked' | 'empty' | 'wall' | 'ladder' | 'bagFull' | 'ended' | 'noPotion' = 'invalid'): Outcome => ({ accepted: false, reason });
function strike2(w: World, e: Enemy, spell = false) { const weapon = weapon2(w), d = weapon ? def2(weapon) : undefined; w.player.face = e.x < w.player.x ? -1 : 1; const amount = damage2(w, e.id, (spell ? C.spellDamage : stats2(w).damage) + roll2(w) % 3, spell ? 'shock' : d?.element ?? 'physical', 'system:player', spell ? 99 : d?.pierce ?? 0); beat2(w, { kind: 'attack', actor: 0, target: e.id, position: pos2(w.player), targetPosition: pos2(e), amount, ...(spell || (d?.range ?? 1) > 1 ? { mode: 'spell' as const } : {}) }); }
export function acceptAlpha2(current: World, command: Command): Outcome {
    if (!isAlpha2Command(command))
        return reject();
    if (current.status !== 'playing')
        return reject('ended');
    const w = structuredClone(current), s = S2(w), p = w.player;
    w.beats = [];
    let cost: number = C.wait;
    if (command.startsWith('choose:')) {
        if (w.revision !== 0 || s.chosen)
            return reject();
        const loadout = command.slice(7) as Loadout;
        s.loadout = loadout;
        s.chosen = true;
        const defs = loadout === 'breaker' ? ['plate', 'maul', 'tower'] : loadout === 'channeler' ? ['leather', 'staff', 'shield'] : ['brigandine', 'sword', 'shield'];
        for (const [n, slot] of (['chest', 'mainHand', 'offHand'] as const).entries()) {
            const i = item2(w, s.equipped[slot]!)!;
            i.definition = defs[n]!;
            know2(w, i, true);
        }
        w.revision++;
        return { accepted: true, world: w, interrupt: true };
    }
    if (command.startsWith('a2:note:')) {
        const [, , id, ...text] = command.split(':'), i = item2(w, Number(id));
        if (!i || i.owner !== 'bag')
            return reject();
        s.knowledge.notes[i.id] = decodeURIComponent(text.join(':'));
        w.revision++;
        return { accepted: true, world: w, interrupt: true };
    }
    s.chosen = true;
    if (condition2(w, 'sleep') && !['wait', 'a2:rest'].includes(command) && !command.startsWith('a2:use:'))
        return reject('blocked');
    if (command === 'potion') {
        const i = s.items.find(i => i.owner === 'bag' && i.definition === 'renewal' && s.knowledge.identified.includes(i.definition));
        if (!i)
            return reject('noPotion');
        command = `a2:use:${i.id}:drink:self`;
    }
    if (command === 'left' || command === 'right') {
        let dx = command === 'left' ? -1 : 1;
        if (condition2(w, 'confused') && roll2(w) % 2)
            dx = -dx;
        const destination = { x: p.x + dx, floor: p.floor };
        if (destination.x < 1 || destination.x >= C.width - 1)
            return reject('wall');
        if (!walk2(w, destination))
            return reject('blocked');
        p.face = dx as -1 | 1;
        const e = enemyAt2(w, destination);
        if (e) {
            strike2(w, e);
            cost = weapon2(w) ? def2(weapon2(w)!).time ?? 12 : 12;
        }
        else {
            const before = pos2(p);
            p.x = destination.x;
            cost = C.move;
            beat2(w, { kind: 'move', actor: 0, position: before, targetPosition: pos2(p) });
            hazard2(w, p);
        }
    }
    else if (command === 'up' || command === 'down') {
        const floor = p.floor + (command === 'up' ? -1 : 1);
        if (floor < 0 || floor >= C.floors || !s.links.some(l => l.floor === Math.min(p.floor, floor) && l.x === p.x))
            return reject('ladder');
        if (enemyAt2(w, { floor, x: p.x }))
            return reject('blocked');
        p.floor = floor;
        cost = C.climb;
        hazard2(w, p);
    }
    else if (command === 'attack' || command === 'cast') {
        const weapon = weapon2(w), range = command === 'cast' ? C.spellRange : weapon ? def2(weapon).range ?? 1 : 1;
        if (command === 'cast' && (!weapon || weapon.definition !== 'staff' || s.mana < C.spellMana))
            return reject();
        const e = w.enemies.filter(e => e.hp > 0 && visible2(w, e) && Math.abs(e.x - p.x) <= range).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x) || a.id - b.id)[0];
        if (command === 'cast') {
            if (!e)
                return reject('empty');
            s.mana -= C.spellMana;
            strike2(w, e, true);
            cost = C.cast;
        }
        else {
            cost = weapon ? def2(weapon).time ?? 12 : 12;
            if (e)
                strike2(w, e);
            else {
                beat2(w, { kind: 'miss', actor: 0, position: pos2(p) });
                log2(w, { key: 'miss' });
            }
        }
    }
    else if (command === 'interact' || command.startsWith('take:')) {
        if (command === 'interact' && near2(w, s.relic) && !p.relic) {
            if (w.enemies.some(e => e.elite && e.hp > 0))
                return reject('blocked');
            p.relic = true;
            log2(w, { key: 'relic' });
            cost = C.take;
        }
        else {
            const i = s.items.find(i => i.owner === 'ground' && near2(w, i.position) && line2(w, p, i.position) && (command === 'interact' || i.id === Number(command.slice(5))));
            if (!i)
                return reject('empty');
            if (s.items.filter(i => i.owner === 'bag').length >= C.capacity)
                return reject('bagFull');
            i.owner = 'bag';
            s.collected++;
            if (!['potion', 'scroll', 'wand', 'accessory'].includes(def2(i).category))
                know2(w, i);
            log2(w, { key: 'picked', name: `item:${i.id}` });
            beat2(w, { kind: 'pickup', actor: 0, position: pos2(p) });
            cost = C.take;
        }
    }
    else if (command.startsWith('wear:')) {
        const i = item2(w, Number(command.slice(5)));
        if (!i || i.owner !== 'bag' || !def2(i).slot)
            return reject();
        const slot = def2(i).slot!, old = s.equipped[slot] ? item2(w, s.equipped[slot]!) : undefined;
        if (old?.id === i.id || old?.blessing === 'cursed')
            return reject('blocked');
        s.equipped[slot] = i.id;
        know2(w, i);
        if (i.blessing === 'cursed') {
            if (!s.knowledge.buc.includes(i.id))
                s.knowledge.buc.push(i.id);
            log2(w, { key: 'bound', name: `item:${i.id}` });
        }
        else
            log2(w, { key: 'worn', name: `item:${i.id}` });
        cost = C.wear;
    }
    else if (command.startsWith('unequip:')) {
        const slot = command.slice(8) as ItemSlot, i = s.equipped[slot] ? item2(w, s.equipped[slot]!) : undefined;
        if (!i || i.blessing === 'cursed')
            return reject('blocked');
        s.equipped[slot] = null;
        cost = C.wear;
    }
    else if (command.startsWith('drop:')) {
        const i = item2(w, Number(command.slice(5)));
        if (!i || i.owner !== 'bag' || Object.values(s.equipped).includes(i.id))
            return reject('blocked');
        i.owner = 'ground';
        i.position = pos2(p);
        cost = 4;
    }
    else if (command.startsWith('door:') || command.startsWith('lever:')) {
        const d = s.doors.find(d => d.id === Number(command.split(':')[1]) && near2(w, d));
        if (!d || p.x === d.x || enemyAt2(w, d))
            return reject('blocked');
        if (command.startsWith('lever:')) {
            if (!d.locked)
                return reject();
            d.locked = false;
            d.open = true;
            cost = 16;
        }
        else {
            if (d.locked)
                return reject('blocked');
            d.open = !d.open;
            cost = 8;
        }
        log2(w, { key: d.open ? 'doorOpen' : 'doorClosed' });
    }
    else if (command.startsWith('a2:use:')) {
        const [, , id, action, target] = command.split(':');
        const result = useItem2(w, Number(id), action as ItemAction, target!);
        if (result === undefined)
            return reject();
        cost = result;
    }
    else if (command === 'a2:search') {
        for (const f of s.facilities.filter(f => f.kind === 'trap' && visible2(w, f) && Math.abs(f.x - p.x) <= 3))
            f.revealed = true;
        log2(w, { key: 'searched' });
        cost = 10;
    }
    else if (command.startsWith('a2:feature:')) {
        const [, , id, action] = command.split(':'), f = s.facilities.find(f => f.id === Number(id) && f.revealed && near2(w, f) && line2(w, p, f));
        if (!f || f.used)
            return reject('empty');
        if (f.kind === 'fountain' && action === 'drink') {
            f.used = true;
            heal2(w, 0, 25);
            s.conditions = s.conditions.filter(c => c.actor !== 0 || c.kind !== 'poison');
        }
        else if (f.kind === 'chest' && (action === 'pay' || action === 'force')) {
            if (action === 'pay') {
                if (p.gold < C.chestPrice)
                    return reject();
                p.gold -= C.chestPrice;
            }
            else {
                if (p.hp <= C.chestHp)
                    return reject();
                p.hp -= C.chestHp;
            }
            openContainer2(w, f);
        }
        else if (f.kind === 'garden' && action === 'harvest')
            openContainer2(w, f);
        else if (f.kind === 'trap' && action === 'disarm') {
            f.used = true;
            log2(w, { key: 'disarmed' });
        }
        else
            return reject();
        cost = 12;
    }
    else if (/^a2:(buy|sell|cleanse|cook|recharge):/.test(command)) {
        const [, action, fid, iid] = command.split(':'), f = s.facilities.find(f => f.id === Number(fid) && f.revealed && near2(w, f) && line2(w, p, f)), i = item2(w, Number(iid));
        if (!f || !i)
            return reject();
        if (action === 'buy') {
            if (f.kind !== 'merchant' || i.owner !== 'shop' || i.holder !== f.id || !f.stock.includes(i.id))
                return reject();
            if (s.items.filter(i => i.owner === 'bag').length >= C.capacity)
                return reject('bagFull');
            const price = quote2(w, i, true);
            if (p.gold < price)
                return reject();
            p.gold -= price;
            f.gold += price;
            i.owner = 'bag';
            i.holder = null;
            s.collected++;
            if (!['potion', 'scroll', 'wand', 'accessory'].includes(def2(i).category))
                know2(w, i);
            log2(w, { key: 'bought', name: `item:${i.id}`, amount: price });
        }
        else {
            if (i.owner !== 'bag')
                return reject();
            if (action === 'sell') {
                if (f.kind !== 'merchant' || Object.values(s.equipped).includes(i.id))
                    return reject();
                const price = quote2(w, i, false);
                if (f.gold < price)
                    return reject();
                p.gold += price;
                f.gold -= price;
                i.owner = 'shop';
                i.holder = f.id;
                i.position = pos2(f);
                if (!f.stock.includes(i.id))
                    f.stock.push(i.id);
                log2(w, { key: 'sold', name: `item:${i.id}`, amount: price });
            }
            else if (action === 'cleanse') {
                if (f.kind !== 'altar' || p.gold < C.altarPrice)
                    return reject();
                p.gold -= C.altarPrice;
                f.gold += C.altarPrice;
                i.blessing = 'uncursed';
                if (!s.knowledge.buc.includes(i.id))
                    s.knowledge.buc.push(i.id);
                log2(w, { key: 'released', name: `item:${i.id}` });
            }
            else if (action === 'cook') {
                if (f.kind !== 'campfire' || !cook2(w, i))
                    return reject();
            }
            else if (action === 'recharge') {
                const d = def2(i);
                if (f.kind !== 'merchant' || d.category !== 'wand' || i.charges >= d.charges! || p.gold < 8)
                    return reject();
                p.gold -= 8;
                f.gold += 8;
                i.charges++;
                if (!s.knowledge.charges.includes(i.id))
                    s.knowledge.charges.push(i.id);
                log2(w, { key: 'recharged', name: `item:${i.id}` });
            }
        }
        cost = 12;
    }
    else if (command === 'a2:rest' || command === 'wait') {
        log2(w, { key: 'wait' });
        cost = C.wait;
    }
    else
        return reject();
    if (condition2(w, 'slow'))
        cost *= 2;
    advance2(w, cost);
    if (w.status === 'playing' && p.relic && p.floor === 0 && p.x === 1) {
        w.status = 'won';
        log2(w, { key: 'won' });
    }
    reveal2(w);
    w.revision++;
    const newly = w.enemies.some(e => e.hp > 0 && visible2(w, e) && !current.enemies.some(old => old.id === e.id && old.hp > 0 && visible2(current, old)));
    return { accepted: true, world: w, interrupt: newly || p.hp < current.player.hp || w.status !== 'playing' || w.enemies.some(e => e.hp > 0 && near2(w, e)) };
}
