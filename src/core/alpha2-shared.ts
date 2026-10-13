import {itemDefinition,monsterDefinition,featureDefinition} from '../content/catalog-access';
import { ALPHA2 as C } from '../content/alpha2';
import type { World, Position, Enemy } from './types';
import type { Item2, Element, Condition, Condition2, Words, Journal2, MonsterDef, ItemSlot } from './alpha2-types';
import type { CombatBeat } from './expedition-types';
export const S2 = (w: World) => w.alpha2!;
export const pos2 = (p: Position): Position => ({ x: p.x, floor: p.floor });
export const def2 = (i: Item2) => itemDefinition(i.definition);
export const monster2 = (w: World, e: Enemy): MonsterDef => monsterDefinition(S2(w).monsters.find(m => m.id === e.id)!.definition);
export const near2 = (w: World, p: Position) => w.player.floor === p.floor && Math.abs(w.player.x - p.x) <= 1;
export const enemyAt2 = (w: World, p: Position) => w.enemies.find(e => e.hp > 0 && e.floor === p.floor && e.x === p.x);
export const line2 = (w: World, a: Position, b: Position) => a.floor === b.floor && !S2(w).doors.some(d => !d.open && d.floor === a.floor && d.x > Math.min(a.x, b.x) && d.x < Math.max(a.x, b.x));
export const condition2 = (w: World, kind: Condition, actor = 0) => S2(w).conditions.find(e => e.actor === actor && e.kind === kind);
export const sight2 = (w: World) => condition2(w, 'blind') ? 1 : C.sight + (condition2(w, 'light') ? 2 : 0) + (S2(w).loadout === 'channeler' ? 1 : 0);
export const visible2 = (w: World, p: Position) => p.floor === w.player.floor && Math.abs(p.x - w.player.x) <= sight2(w) && line2(w, w.player, p);
export const walk2 = (w: World, p: Position) => p.floor >= 0 && p.floor < C.floors && p.x >= 1 && p.x < C.width - 1 && !S2(w).doors.some(d => !d.open && d.floor === p.floor && d.x === p.x) && !(w.alpha5 && S2(w).facilities.some(f=>f.kind==='barricade'&&!f.used&&f.floor===p.floor&&f.x===p.x));
export const item2 = (w: World, id: number) => S2(w).items.find(i => i.id === id);
export const weapon2 = (w: World) => S2(w).items.find(i => i.id === S2(w).equipped.mainHand);
export const slots2: ItemSlot[] = ['head', 'chest', 'legs', 'mainHand', 'offHand', 'charm'];
export function log2(w: World, j: Journal2) { S2(w).journal.push(Object.fromEntries(Object.entries(j).filter(([, v]) => v !== undefined)) as unknown as Journal2); if (S2(w).journal.length > 24)
    S2(w).journal.shift(); }
export function beat2(w: World, b: Omit<CombatBeat, 'tick'>) { w.beats!.push({ ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)), tick: w.tick } as CombatBeat); }
export function reveal2(w: World) { const s = S2(w), known = w.explored[w.player.floor]!; for (let x = Math.max(0, w.player.x - sight2(w)); x <= Math.min(C.width - 1, w.player.x + sight2(w)); x++)
    if (!known.includes(x) && line2(w, w.player, { x, floor: w.player.floor }))
        known.push(x); known.sort((a, b) => a - b); for (const e of w.enemies.filter(e => e.hp > 0 && visible2(w, e))) {
    const id = monster2(w, e).id;
    if (!s.knowledge.monsters.includes(id))
        s.knowledge.monsters.push(id);
} for (const f of s.facilities) {
    if (visible2(w, f) && f.kind === 'trap' && (condition2(w, 'light') || s.loadout === 'vanguard' && near2(w, f)))
        f.revealed = true;
    if (f.revealed && visible2(w, f) && !s.knowledge.facilities.includes(f.kind))
        s.knowledge.facilities.push(f.kind);
} }
export function know2(w: World, i: Item2, full = false) { const k = S2(w).knowledge; if (!k.identified.includes(i.definition))
    k.identified.push(i.definition); if (full)
    for (const key of ['buc', 'enchantment', 'charges'] as const)
        if (!k[key].includes(i.id))
            k[key].push(i.id); }
export function display2(w: World, i: Item2): Words { const d = def2(i), s = S2(w); if (s.knowledge.identified.includes(i.definition) || !['potion', 'scroll', 'wand', 'accessory'].includes(d.category))
    return d.name; const n = s.assignment[i.definition]! + 1; const cats = { potion: ['药瓶', 'Flask'], scroll: ['符纸', 'Parchment'], wand: ['刻纹杖', 'Etched wand'], accessory: ['饰物', 'Trinket'] } as const; const label = cats[d.category as keyof typeof cats]; return { zh: `未知${label[0]} ${n}`, en: `Unknown ${label[1]} ${n}` }; }
export function source2(w: World, source: string): Words { const [kind, id] = source.split(':'); if (kind === 'item') {
    const i = item2(w, Number(id));
    return i ? display2(w, i) : { zh: '物品', en: 'Item' };
} if (kind === 'enemy')
    return monsterDefinition(id!)?.name ?? { zh: '敌人', en: 'Enemy' }; if (kind === 'facility')
    return featureDefinition(id!)?.name ?? { zh: '设施', en: 'Feature' }; return { zh: '环境 / 饱食', en: 'Environment / satiety' }; }
export function resist2(w: World, actor: number, element: Element): boolean { if (actor) {
    const e = w.enemies.find(e => e.id === actor)!;
    return monster2(w, e).resists.includes(element);
} return (element === 'fire' && !!condition2(w, 'ward')) || Object.values(S2(w).equipped).some(id => { const i = id ? item2(w, id) : undefined; return i && i.durability > 0 && def2(i).resists?.includes(element); }); }
export function stats2(w: World) { const s = S2(w); let damage = 3, armor = 0; for (const id of Object.values(s.equipped)) {
    if (!id)
        continue;
    const i = item2(w, id)!, d = def2(i), penalty = Math.floor((6 - i.durability) / 2);
    damage += Math.max(0, (d.damage ?? 0) + (d.damage ? i.enchantment - penalty : 0));
    armor += Math.max(0, (d.armor ?? 0) + (d.armor ? i.enchantment - penalty : 0));
} if (condition2(w, 'might'))
    damage += 4; if (condition2(w, 'ward'))
    armor += 4; return { damage: Math.max(1, damage), armor }; }
export function addCondition2(w: World, kind: Condition, actor: number, duration: number, power: number, source: string): boolean { if (kind === 'poison' && resist2(w, actor, 'poison') || kind === 'burn' && resist2(w, actor, 'fire')) {
    log2(w, { key: 'immune', target: actor ? `enemy:${monster2(w, w.enemies.find(e => e.id === actor)!).id}` : undefined });
    return false;
} const s = S2(w); s.conditions = s.conditions.filter(e => e.actor !== actor || e.kind !== kind); s.conditions.push({ kind, actor, until: w.tick + duration, nextAt: w.tick + 20, power, source }); if (kind === 'sleep' && actor) {
    const e = w.enemies.find(e => e.id === actor)!;
    delete e.intent;
} return true; }
export function conditionsView2(w: World, actor: number) { return S2(w).conditions.filter(c => c.actor === actor).map((c: Condition2) => ({ ...c, source: source2(w, c.source) })); }
export function quote2(w: World, i: Item2, buy: boolean): number { const d = def2(i), known = S2(w).knowledge.identified.includes(i.definition), blessing = i.blessing === 'blessed' ? 5 : i.blessing === 'cursed' ? -4 : 0; const base = Math.max(3, d.value + blessing + i.enchantment * 3 - (6 - i.durability) * 2 - (d.charges ? Math.max(0, d.charges - i.charges) * 2 : 0) + (known ? 2 : 0)); return buy ? Math.ceil(base * (S2(w).loadout === 'vanguard' ? 1.1 : 1.2)) : Math.max(1, Math.floor(base * .4)); }
