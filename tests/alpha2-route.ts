import { GameSession } from '../src/session/session';
import type { Command, Position, PublicView } from '../src/core/types';
import type { Loadout } from '../src/core/alpha-types';
export { GameSession };
export function runAlpha2(seed: number, loadout: Loadout = 'vanguard', strategy: 'direct' | 'items' = 'direct') {
    const session = new GameSession(seed, 'alpha2'), commands: Command[] = [], states: PublicView[] = [session.view()], handled = new Set<number>();
    let itemActions = 0;
    const attempt = (command: Command) => { const result = session.submit(command); if (result.accepted) {
        commands.push(command);
        states.push(session.view());
        if (commands.length > 1800)
            throw new Error('route budget');
    } return result; };
    const act = (command: Command) => { const r = attempt(command); if (!r.accepted)
        throw new Error(`${command}: ${r.reason}; seed=${seed} ${loadout} ${strategy} @ ${JSON.stringify(session.view().player)}`); };
    act(`choose:${loadout}`);
    const care = () => {
        let v = session.view();
        if (v.status !== 'playing')
            throw new Error(`dead seed=${seed} ${loadout}/${strategy} step=${commands.length} @${JSON.stringify(v.player)} ${JSON.stringify(v.alpha2!.journal.slice(-5))}`);
        const cure = v.alpha2!.bag.find(i => i.definition === 'antidote');
        if (cure && v.alpha2!.conditions.some(c => c.kind === 'poison'))
            act(`a2:use:${cure.id}:drink:self`);
        v = session.view();
        if (v.player.hp < 48 && v.player.potions)
            act('potion');
        v = session.view();
        if (v.alpha2!.food < 110) {
            const food = v.alpha2!.bag.find(i => i.category === 'food' && i.freshness !== 'stale' && (i.definition !== 'mushroom' || i.proof));
            if (food)
                act(`a2:use:${food.id}:eat:self`);
        }
    };
    const collect = () => {
        for (const candidate of session.view().alpha2!.nearby.filter(i => !handled.has(i.id))) {
            const v = session.view();
            if (['armor', 'weapon', 'accessory'].includes(candidate.category))
                continue;
            if (strategy === 'direct' && !['renewal', 'ration', 'fruit'].includes(candidate.definition ?? ''))
                continue;
            if (v.alpha2!.bag.length >= 16) {
                const discard = v.alpha2!.bag.find(i => !i.equipped && ['release', 'insight'].includes(i.definition ?? ''));
                if (!discard)
                    continue;
                act(`drop:${discard.id}`);
                handled.add(discard.id);
            }
            care();
            act(`take:${candidate.id}`);
            handled.add(candidate.id);
            if (strategy === 'items' && !candidate.definition) {
                const scroll = session.view().alpha2!.bag.find(i => i.definition === 'insight');
                if (scroll) {
                    act(`a2:use:${scroll.id}:read:i${candidate.id}`);
                    itemActions++;
                }
            }
        }
    };
    const path = (target: Position) => {
        const v = session.view(), key = (p: Position) => `${p.floor}:${p.x}`, queue = [{ p: { x: v.player.x, floor: v.player.floor }, first: undefined as Command | undefined }], seen = new Set([key(v.player)]);
        for (let k = 0; k < queue.length; k++) {
            const { p, first } = queue[k]!;
            if (key(p) === key(target))
                return first;
            const moves: [
                Command,
                Position
            ][] = [['left', { ...p, x: p.x - 1 }], ['right', { ...p, x: p.x + 1 }]];
            for (const [c, f] of [['up', p.floor - 1], ['down', p.floor + 1]] as const)
                if (v.map.ladders.some(l => l.floor === Math.min(p.floor, f) && l.x === p.x))
                    moves.push([c, { floor: f, x: p.x }]);
            for (const [c, n] of moves) {
                if (n.floor < 0 || n.floor >= 6 || n.x < 1 || n.x >= v.map.width - 1 || seen.has(key(n)))
                    continue;
                seen.add(key(n));
                queue.push({ p: n, first: first ?? c });
            }
        }
    };
    const go = (target: Position) => {
        let budget = 900;
        while ((session.view().player.x !== target.x || session.view().player.floor !== target.floor) && budget-- > 0) {
            care();
            collect();
            let v = session.view();
            if (v.alpha2!.conditions.some(c => c.kind === 'sleep')) {
                act('wait');
                continue;
            }
            const threats = v.enemies.filter(e => Math.abs(e.x - v.player.x) <= 5);
            if (strategy === 'items' && threats.length) {
                const enemy = threats[0]!, item = v.alpha2!.bag.find(i => i.category === 'wand' && (i.charges === undefined || i.charges > 0) && i.definition !== 'mending');
                if (item) {
                    const r = attempt(`a2:use:${item.id}:zap:e${enemy.id}`);
                    if (r.accepted) {
                        itemActions++;
                        continue;
                    }
                }
                const potion = v.alpha2!.bag.find(i => ['venom', 'slumber', 'acid'].includes(i.definition ?? '') && i.actions.includes('throw'));
                if (potion) {
                    act(`a2:use:${potion.id}:throw:e${enemy.id}`);
                    itemActions++;
                    continue;
                }
            }
            if (loadout === 'channeler' && v.alpha2!.mana >= 3 && threats.length) {
                act('cast');
                continue;
            }
            const adjacent = v.enemies.find(e => Math.abs(e.x - v.player.x) <= v.alpha2!.attackRange);
            if (adjacent) {
                act('attack');
                continue;
            }
            const spring = v.alpha2!.facilities.find(f => f.near && f.kind === 'fountain' && !f.used);
            if (spring && v.player.hp < 60) {
                act(`a2:feature:${spring.id}:drink`);
                continue;
            }
            const trap = v.alpha2!.facilities.find(f => f.near && f.kind === 'trap' && !f.used);
            if (trap) {
                act(`a2:feature:${trap.id}:disarm`);
                continue;
            }
            const c = path(target);
            if (!c)
                throw new Error(`no public path ${JSON.stringify(target)}`);
            if (c === 'left' || c === 'right') {
                const x = v.player.x + (c === 'left' ? -1 : 1), door = v.alpha!.doors.find(d => d.floor === v.player.floor && d.x === x && !d.open);
                if (door) {
                    act(`${door.locked ? 'lever' : 'door'}:${door.id}`);
                    continue;
                }
                if (strategy === 'items') {
                    const fire = v.alpha2!.facilities.find(f => f.floor === v.player.floor && f.x === x && f.kind === 'hazard' && !f.used), water = v.alpha2!.bag.find(i => i.definition === 'water');
                    if (fire && water) {
                        act(`a2:use:${water.id}:throw:f${fire.id}`);
                        itemActions++;
                        continue;
                    }
                }
            }
            const r = attempt(c);
            if (!r.accepted)
                throw new Error(`step ${c}: ${r.reason} ${JSON.stringify(v.player)} seed${seed}`);
        }
        if (budget <= 0)
            throw new Error(`path budget seed${seed}`);
        if (session.view().status === 'playing') {
            care();
            collect();
        }
    };
    go({ floor: 0, x: 28 });
    for (let floor = 1; floor < 6; floor++) {
        const links = session.view().map.ladders.filter(l => l.floor === floor - 1).sort((a, b) => a.x - b.x);
        go({ floor: floor - 1, x: links[0]!.x });
        care();
        const r = attempt('down');
        if (!r.accepted) {
            if (r.reason !== 'blocked')
                throw new Error(r.reason);
            go({ floor: floor - 1, x: links[1]!.x });
            act('down');
        }
        go({ floor, x: 2 });
        go({ floor, x: 28 });
    }
    if (!session.view().player.relic)
        act('interact');
    go({ floor: 0, x: 1 });
    if (session.view().status !== 'won')
        throw new Error('not won');
    return { session, commands, states, itemActions };
}
