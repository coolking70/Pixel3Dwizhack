import {ecologyEffect6,hazard6} from './alpha6-ecology';
import {effectDefinition} from '../content/catalog-access';
import {ecologyEffect5} from './alpha5-ecology';
import { ALPHA2 as C } from '../content/alpha2';
import type { World, Enemy, Position } from './types';
import type { Element, Item2, TargetKind, ItemAction, Facility2 } from './alpha2-types';
import { S2, pos2, near2, visible2, line2, enemyAt2, walk2, item2, def2, monster2, log2, beat2, addCondition2, resist2, stats2, know2, condition2 } from './alpha2-shared';
import { roll2, addItem2, spawnMonster2 } from './alpha2-map';
export type ResolvedTarget2 = {
    kind: TargetKind;
    actor?: number;
    enemy?: Enemy;
    item?: Item2;
    facility?: Facility2;
    door?: number;
};
export function target2(w: World, key: string): ResolvedTarget2 | undefined {
    if (key === 'self')
        return { kind: 'self', actor: 0 };
    const n = Number(key.slice(1));
    if (key[0] === 'e') {
        const e = w.enemies.find(e => e.id === n && e.hp > 0 && visible2(w, e) && Math.abs(e.x - w.player.x) <= 5);
        if (e)
            return { kind: 'enemy', actor: e.id, enemy: e };
    }
    if (key[0] === 'i') {
        const i = item2(w, n);
        if (i?.owner === 'bag')
            return { kind: 'item', item: i };
    }
    if (key[0] === 'f') {
        const f = S2(w).facilities.find(f => f.id === n && f.revealed && near2(w, f) && line2(w, w.player, f));
        if (f)
            return { kind: 'facility', facility: f };
    }
    if (key[0] === 'd') {
        const d = S2(w).doors.find(d => d.id === n && near2(w, d));
        if (d)
            return { kind: 'facility', door: d.id };
    }
    return undefined;
}
export function corrosion2(w: World, i: Item2): boolean { if (def2(i).material !== 'metal' || !def2(i).slot || i.proof || !i.durability)
    return false; i.durability--; log2(w, { key: 'corrode', name: `item:${i.id}` }); return true; }
export function damage2(w: World, actor: number, power: number, element: Element, source: string, pierce = 0): number {
    const entity = actor ? w.enemies.find(e => e.id === actor)! : w.player;
    if (entity.hp <= 0)
        return 0;
    let amount = power;
    if (element === 'physical' || element === 'silver')
        amount = Math.max(1, amount - Math.max(0, (actor ? entity === w.player ? 0 : (entity as Enemy).armor ?? 0 : stats2(w).armor) - pierce));
    if(w.alpha6&&actor&&element==='physical'&&monster2(w,entity as Enemy).id==='ossuaryGuard'&&S2(w).facilities.some(f=>f.kind==='boneChime'&&!f.used&&f.floor===entity.floor&&Math.abs(f.x-entity.x)<=2))amount=Math.max(1,amount-3);
    if (resist2(w, actor, element)) {
        amount = element === 'physical' ? Math.max(1, Math.floor(amount / 2)) : 0;
        log2(w, { key: 'immune', target: actor ? `enemy:${monster2(w, entity as Enemy).id}` : undefined });
    }
    if (actor && monster2(w, entity as Enemy).weak.includes(element))
        amount *= 2;
    if (element === 'shock' && condition2(w, 'wet', actor))
        amount += Math.ceil(amount / 2);
    amount = Math.min(entity.hp, Math.max(0, amount));
    entity.hp -= amount;
    if (amount) {
        S2(w).conditions = S2(w).conditions.filter(e => e.actor !== actor || e.kind !== 'sleep');
        log2(w, { key: actor ? 'hit' : 'hurt', amount, target: actor ? `enemy:${monster2(w, entity as Enemy).id}` : source });
        beat2(w, { kind: 'hurt', actor: actor ? 0 : -1, target: actor, position: pos2(entity), amount });
    }
    if (element === 'acid' && amount && actor === 0) {
        for (const id of Object.values(S2(w).equipped)) {
            if (id && corrosion2(w, item2(w, id)!))
                break;
        }
    }
    if (!entity.hp) {
        beat2(w, { kind: 'death', actor, position: pos2(entity) });
        if (!actor) {
            w.status = 'dead';
            log2(w, { key: 'dead' });
        }
        else {
            const m = S2(w).monsters.find(m => m.id === actor)!, d = monster2(w, entity as Enemy);
            w.player.gold += m.spawned ? 1 : d.id === 'warden' ? 35 : 7;
            S2(w).kills++;
            delete (entity as Enemy).intent;
            S2(w).conditions = S2(w).conditions.filter(c => c.actor !== actor);
            log2(w, { key: 'defeat', name: `enemy:${d.id}` });
            if (!m.spawned && ['crawler', 'venomfang', 'rimebeast'].includes(d.id))
                addItem2(w, 'meat', 'ground', entity, null, true);
        }
    }
    return amount;
}
export function heal2(w: World, actor: number, power: number) { const e = actor ? w.enemies.find(e => e.id === actor)! : w.player; const amount = Math.min(power, e.maxHp - e.hp); e.hp += amount; beat2(w, { kind: 'heal', actor, position: pos2(e), amount }); log2(w, { key: 'heal', amount }); }
export function openContainer2(w: World, f: Facility2) { f.used = true; for (const id of f.stock) {
    const i = item2(w, id)!;
    if (i.owner === 'container') {
        i.owner = 'ground';
        i.holder = null;
        i.position = pos2(f);
    }
} log2(w, { key: 'opened', name: `facility:${f.kind}` }); }
export function cook2(w: World, i: Item2): boolean { if (def2(i).category !== 'food')
    return false; i.proof = true; if (def2(i).perishes)
    i.freshUntil = w.tick + 1800; log2(w, { key: 'cooked', name: `item:${i.id}` }); return true; }
export function effect2(w: World, effectId: string, t: ResolvedTarget2, source: Item2): boolean {
    const e = effectDefinition(effectId);
    if (!e.targets.includes(t.kind))
        return false;
    if(w.alpha6){const result=ecologyEffect6(w,effectId,t,source);if(result!==undefined)return result;}
    if(w.alpha5){const result=ecologyEffect5(w,effectId,t,source);if(result!==undefined)return result;}
    const strength = source.blessing === 'blessed' ? 1.5 : source.blessing === 'cursed' ? .6 : 1, power = Math.floor(e.power * strength), actor = t.actor ?? 0, tag = `item:${source.id}`;
    switch (e.op) {
        case 'heal':
            heal2(w, actor, power);
            break;
        case 'cure': {
            const kinds = e.power ? ['blind', 'confused', 'sleep'] : ['poison', 'burn'];
            S2(w).conditions = S2(w).conditions.filter(c => c.actor !== actor || !kinds.includes(c.kind));
            log2(w, { key: 'cured' });
            break;
        }
        case 'status':
            addCondition2(w, e.condition!, actor, Math.max(10, Math.floor(e.duration! * strength)), e.power, tag);
            break;
        case 'damage': {
            if (t.item) {
                if (e.element !== 'acid' || !corrosion2(w, t.item))
                    return false;
                break;
            }
            if (t.facility) {
                if (t.facility.kind !== 'hazard')
                    return false;
                if (e.element === 'cold') {
                    if (t.facility.used)
                        return false;
                    t.facility.used = true;
                }
                else if (e.element === 'fire') {
                    if (!t.facility.used)
                        return false;
                    t.facility.used = false;
                }
                else
                    return false;
                break;
            }
            const amount = damage2(w, actor, power, e.element!, tag);
            if (amount && (!t.enemy || t.enemy.hp > 0) && e.element === 'cold')
                addCondition2(w, 'slow', actor, 60, 0, tag);
            if (amount && (!t.enemy || t.enemy.hp > 0) && e.element === 'fire')
                addCondition2(w, 'burn', actor, 60, 2, tag);
            break;
        }
        case 'water': {
            if (t.item) {
                if (source.blessing === 'uncursed')
                    return false;
                t.item.blessing = source.blessing === 'blessed' ? 'uncursed' : 'cursed';
                if (!S2(w).knowledge.buc.includes(t.item.id))
                    S2(w).knowledge.buc.push(t.item.id);
                log2(w, { key: 'blessing', name: `item:${t.item.id}` });
                break;
            }
            if (t.facility) {
                if (t.facility.kind !== 'hazard' || t.facility.used)
                    return false;
                t.facility.used = true;
                log2(w, { key: 'extinguished' });
                break;
            }
            S2(w).conditions = S2(w).conditions.filter(c => c.actor !== actor || c.kind !== 'burn');
            addCondition2(w, 'wet', actor, 80, 0, tag);
            if (t.enemy && monster2(w, t.enemy).element === 'fire')
                damage2(w, actor, power * 2, 'cold', tag);
            else if (t.kind === 'self')
                S2(w).food = Math.min(C.maxFood, S2(w).food + 10);
            break;
        }
        case 'identify':
            know2(w, t.item!, true);
            log2(w, { key: 'identified', name: `item:${t.item!.id}` });
            break;
        case 'uncurse':
            t.item!.blessing = 'uncursed';
            if (!S2(w).knowledge.buc.includes(t.item!.id))
                S2(w).knowledge.buc.push(t.item!.id);
            log2(w, { key: 'released', name: `item:${t.item!.id}` });
            break;
        case 'map':
            w.explored[w.player.floor] = Array.from({ length: C.width }, (_, i) => i);
            for (const f of S2(w).facilities.filter(f => f.floor === w.player.floor))
                f.revealed = true;
            log2(w, { key: 'mapped' });
            break;
        case 'enchant':
            if (!def2(t.item!).slot)
                return false;
            t.item!.enchantment = Math.min(3, Math.max(-2, t.item!.enchantment + (source.blessing === 'cursed' ? -1 : 1)));
            if (!S2(w).knowledge.enchantment.includes(t.item!.id))
                S2(w).knowledge.enchantment.push(t.item!.id);
            break;
        case 'blink': {
            const positions = Array.from({ length: C.width - 2 }, (_, i) => ({ x: i + 1, floor: w.player.floor })).filter(p => p.x !== w.player.x && walk2(w, p) && !enemyAt2(w, p) && !S2(w).facilities.some(f => !f.used && (f.kind === 'trap' || f.kind === 'hazard') && f.floor === p.floor && f.x === p.x));
            if (!positions.length)
                return false;
            const selected = source.blessing === 'cursed' ? positions.sort((a, b) => Math.abs(b.x - w.player.x) - Math.abs(a.x - w.player.x) || a.x - b.x)[0]! : positions[roll2(w) % positions.length]!;
            w.player.x = selected.x;
            log2(w, { key: 'blink' });
            break;
        }
        case 'summon': {
            if (w.enemies.length >= 40)
                return false;
            const p = [-2, 2, -1, 1].map(dx => ({ floor: w.player.floor, x: w.player.x + dx })).find(p => walk2(w, p) && !enemyAt2(w, p));
            if (!p)
                return false;
            spawnMonster2(w, 'crawler', p, true);
            log2(w, { key: 'summoned' });
            break;
        }
        case 'open':
            if (t.enemy) {
                addCondition2(w, 'slow', actor, 80, 0, tag);
                break;
            }
            if (t.door) {
                const d = S2(w).doors.find(d => d.id === t.door)!;
                if (d.open)
                    return false;
                d.open = true;
                d.locked = false;
            }
            else if (t.facility?.kind === 'chest' && !t.facility.used)
                openContainer2(w, t.facility);
            else
                return false;
            break;
        case 'food': {
            S2(w).food = Math.min(C.maxFood, S2(w).food + power);
            if (source.freshUntil && source.freshUntil <= w.tick) {
                addCondition2(w, 'poison', 0, 80, 3, tag);
                log2(w, { key: 'spoiled' });
            }
            if (source.definition === 'mushroom' && !source.proof)
                addCondition2(w, 'confused', 0, 60, 0, tag);
            if (source.blessing === 'cursed')
                addCondition2(w, 'blind', 0, 40, 0, tag);
            heal2(w, 0, source.proof ? 8 : 3);
            break;
        }
        case 'repair':
            if (!def2(t.item!).slot || t.item!.durability === 6)
                return false;
            t.item!.durability = Math.min(6, t.item!.durability + 3 + (S2(w).loadout === 'breaker' ? 1 : 0));
            break;
        case 'cook':
            if (!cook2(w, t.item!))
                return false;
            break;
        case 'protect':
            if (!def2(t.item!).slot || def2(t.item!).material !== 'metal' || t.item!.proof)
                return false;
            t.item!.proof = true;
            break;
    }
    return true;
}
export function useItem2(w: World, id: number, action: ItemAction, key: string): number | undefined {
    const i = item2(w, id);
    if (!i || i.owner !== 'bag' || Object.values(S2(w).equipped).includes(id))
        return;
    const d = def2(i), fx = d.actions[action], t = target2(w, key);
    if (!fx || !t || action === 'equip')
        return;
    if ((action === 'drink' || action === 'eat') && t.kind !== 'self')
        return;
    if (action === 'throw' && t.kind !== 'enemy' && !(t.kind === 'facility' && d.category === 'potion'))
        return;
    if ((action === 'apply' || action === 'read') && t.kind === 'enemy')
        return;
    if (t.item?.id === id)
        return;
    if (d.charges && action !== 'throw' && i.charges <= 0)
        return;
    if (!effect2(w, fx, t, i))
        return;
    if (d.category !== 'wand' || action !== 'throw')
        know2(w, i);
    if (d.charges && action !== 'throw') {
        i.charges--;
        if (!S2(w).knowledge.charges.includes(id))
            S2(w).knowledge.charges.push(id);
    }
    if (['potion', 'scroll', 'food'].includes(d.category))
        i.owner = 'spent';
    else if (action === 'throw') {
        i.owner = 'ground';
        i.position = t.enemy ? pos2(t.enemy) : pos2(w.player);
    }
    if (action === 'throw' || action === 'zap')
        beat2(w, { kind: 'attack', actor: 0, target: t.actor, position: pos2(w.player), targetPosition: t.enemy ? pos2(t.enemy) : t.facility ? pos2(t.facility) : pos2(w.player), mode: 'spell' });
    log2(w, { key: 'used', name: `item:${id}` });
    return action === 'throw' ? C.throw : action === 'zap' ? C.zap : C.action;
}
export function hazard2(w: World, p: Position) { for (const f of S2(w).facilities.filter(f => !f.used && f.floor === p.floor && f.x === p.x)) {
    if(w.alpha6)hazard6(w,f.kind);
    if(w.alpha5&&f.kind==='sporeBed')addCondition2(w,'poison',0,60,2,'facility:sporeBed');
    if(w.alpha5&&f.kind==='relay')damage2(w,0,6,'shock','facility:relay');
    if (f.kind === 'hazard') {
        damage2(w, 0, 8, 'fire', 'facility:hazard');
        if (w.status === 'playing')
            addCondition2(w, 'burn', 0, 40, 2, 'facility:hazard');
    }
    if (f.kind === 'trap') {
        f.revealed = true;
        f.used = true;
        damage2(w, 0, 6, 'physical', 'facility:trap');
        if (w.status === 'playing')
            addCondition2(w, 'poison', 0, 60, 2, 'facility:trap');
    }
} }
