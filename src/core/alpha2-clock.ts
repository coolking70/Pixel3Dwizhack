import {ecologyEnemyTurn6} from './alpha6-ecology';
import {ecologyEnemyTurn5} from './alpha5-ecology';
import { ALPHA2 as C } from '../content/alpha2';
import type { World, Enemy, Position } from './types';
import { S2, pos2, monster2, line2, walk2, enemyAt2, condition2, def2, item2, log2, beat2, addCondition2 } from './alpha2-shared';
import { damage2 } from './alpha2-effects';
import { spawnMonster2 } from './alpha2-map';
function enemyAttack2(w: World, e: Enemy, target: Position) { const d = monster2(w, e), radius = d.behavior === 'guard' ? 1 : 0; if (w.player.floor === target.floor && Math.abs(w.player.x - target.x) <= radius && line2(w, e, w.player)) {
    const amount = damage2(w, 0, d.damage, d.element, `enemy:${d.id}`);
    beat2(w, { kind: 'attack', actor: e.id, target: 0, position: pos2(e), targetPosition: pos2(w.player), amount, ...(d.behavior === 'ranged' ? { mode: 'spell' as const } : {}) });
    if (amount && d.inflict && w.status === 'playing')
        addCondition2(w, d.inflict, 0, 60, 2, `enemy:${d.id}`);
}
else {
    beat2(w, { kind: 'miss', actor: e.id, position: pos2(e), targetPosition: target, ...(d.behavior === 'ranged' ? { mode: 'spell' as const } : {}) });
    log2(w, { key: 'evaded' });
} }
function moveEnemy2(w: World, e: Enemy, dx: number) { const p = { x: e.x + dx, floor: e.floor }; if (!walk2(w, p) || enemyAt2(w, p) || p.floor === w.player.floor && p.x === w.player.x)
    return false; const before = pos2(e); e.x = p.x; beat2(w, { kind: 'move', actor: e.id, position: before, targetPosition: p }); return true; }
function enemyTurn2(w: World, e: Enemy) {
    const d = monster2(w, e);
    if (condition2(w, 'sleep', e.id)) {
        delete e.intent;
        return;
    }
    if(w.alpha6)ecologyEnemyTurn6(w,e);
    if(w.alpha5&&ecologyEnemyTurn5(w,e))return;
    if (e.intent) {
        const target = e.intent;
        delete e.intent;
        if (d.behavior === 'summon') {
            const m = S2(w).monsters.find(m => m.id === e.id)!;
            if (m.summons < 2 && w.enemies.length < 40 && w.player.floor === e.floor && line2(w, e, w.player)) {
                const p = [-1, 1].map(dx => ({ floor: e.floor, x: e.x + dx })).find(p => walk2(w, p) && !enemyAt2(w, p) && p.x !== w.player.x);
                if (p) {
                    spawnMonster2(w, 'crawler', p, true);
                    m.summons++;
                    log2(w, { key: 'summoned' });
                }
            }
        }
        else
            enemyAttack2(w, e, target);
        return;
    }
    if (e.floor !== w.player.floor || !line2(w, e, w.player) || Math.abs(e.x - w.player.x) > C.sight || condition2(w, 'invisible') && Math.abs(e.x - w.player.x) > 1)
        return;
    const distance = Math.abs(e.x - w.player.x), direction = Math.sign(w.player.x - e.x);
    if (d.behavior === 'flee' && e.hp * 2 < e.maxHp && moveEnemy2(w, e, -direction))
        return;
    if (distance <= d.range) {
        if (['guard', 'ranged', 'summon'].includes(d.behavior)) {
            const m = S2(w).monsters.find(m => m.id === e.id)!;
            if (d.behavior === 'summon' && m.summons >= 2) {
                if (distance <= 1)
                    enemyAttack2(w, e, pos2(w.player));
                else
                    moveEnemy2(w, e, direction);
                return;
            }
            e.intent = pos2(w.player);
            log2(w, { key: 'windup', name: `enemy:${d.id}` });
            beat2(w, { kind: 'windup', actor: e.id, position: pos2(e), targetPosition: pos2(w.player) });
        }
        else {
            enemyAttack2(w, e, pos2(w.player));
            if (d.behavior === 'retreat' && w.status === 'playing')
                moveEnemy2(w, e, -direction);
        }
    }
    else
        moveEnemy2(w, e, direction);
}
// One logical clock; no rendering or elapsed real time enters this scheduler.
// At equal tick: expiration, mana/satiety, condition pulses, enemy id order.
export function advance2(w: World, cost: number) {
    const s = S2(w), target = w.tick + cost;
    while (w.status === 'playing') {
        const due = Math.min(s.manaAt, s.foodAt, ...w.enemies.filter(e => e.hp > 0).map(e => e.nextAt), ...s.conditions.map(c => Math.min(c.until, ['poison', 'burn'].includes(c.kind) ? c.nextAt : c.until)));
        if (due > target) {
            w.tick = target;
            break;
        }
        w.tick = due;
        s.conditions = s.conditions.filter(c => c.until > due);
        if (s.manaAt === due) {
            s.mana = Math.min(C.mana, s.mana + 1);
            s.manaAt += C.manaPeriod;
        }
        if (s.foodAt === due) {
            const charm = s.equipped.charm ? item2(w, s.equipped.charm) : undefined;
            const hunger = charm && (def2(charm).id === 'hungerCharm' || charm.blessing === 'cursed') ? charm.blessing === 'cursed' ? 3 : 2 : 1;
            s.food = Math.max(0, s.food - hunger);
            s.foodAt += C.foodPeriod;
            if (!s.food)
                damage2(w, 0, 2, 'physical', 'system:hunger', 99);
        }
        for (const c of [...s.conditions].filter(c => ['poison', 'burn'].includes(c.kind) && c.nextAt === due).sort((a, b) => a.actor - b.actor || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0))) {
            if (w.status !== 'playing')
                break;
            c.nextAt += 20;
            damage2(w, c.actor, c.power, c.kind === 'poison' ? 'poison' : 'fire', c.source);
        }
        for (const e of w.enemies.filter(e => e.hp > 0 && e.nextAt === due).sort((a, b) => a.id - b.id)) {
            if (w.status !== 'playing')
                break;
            e.nextAt += e.period * (condition2(w, 'slow', e.id) ? 2 : 1);
            enemyTurn2(w, e);
        }
    }
}
