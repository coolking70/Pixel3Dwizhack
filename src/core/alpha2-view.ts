import {ITEMS6,MONSTERS6} from '../content/alpha6-catalog';
import { monsterDefinition,featureDefinition } from '../content/catalog-access';
import {ITEMS5,MONSTERS5} from '../content/alpha5-catalog';
import { publicSlot } from './item-slot-view';
import { ALPHA2 as C, ITEMS, MONSTERS } from '../content/alpha2';
import { SLOTS, type World, type PublicView, type Equipment, type Loot, type Slot } from './types';
import type { Item2, Item2View, Target2, FacilityKind, Words, Element } from './alpha2-types';
import type { ItemView } from './expedition-types';
import { S2, near2, visible2, line2, def2, item2, weapon2, stats2, sight2, display2, quote2, source2, conditionsView2, condition2 } from './alpha2-shared';
export function publicItem2(w: World, i: Item2, shop = false): Item2View { const s = S2(w), d = def2(i), known = s.knowledge.identified.includes(d.id) || !['potion', 'scroll', 'wand', 'accessory'].includes(d.category), equipped = (Object.keys(s.equipped) as (Slot | 'charm')[]).find(slot => s.equipped[slot] === i.id); return { id: i.id, name: display2(w, i), category: d.category, ...(known ? { definition: d.id, description: d.description, ...(d.damage === undefined ? {} : { damage: d.damage }), ...(d.armor === undefined ? {} : { armor: d.armor }), ...(d.time === undefined ? {} : { time: d.time }), ...(d.range === undefined ? {} : { range: d.range }) } : {}), appearance: s.assignment[d.id] ?? 0, ...(s.knowledge.buc.includes(i.id) ? { blessing: i.blessing } : {}), ...(s.knowledge.enchantment.includes(i.id) ? { enchantment: i.enchantment } : {}), ...(s.knowledge.charges.includes(i.id) && d.charges ? { charges: i.charges } : {}), durability: i.durability, proof: i.proof, ...(d.perishes ? { freshness: i.freshUntil > w.tick ? 'fresh' as const : 'stale' as const } : {}), ...(equipped ? { equipped } : {}), ...publicSlot(d.category, known ? d.id : undefined, equipped), actions: Object.keys(d.actions) as Item2View['actions'], note: s.knowledge.notes[i.id] ?? '', weight: d.weight, ...(shop ? { buy: quote2(w, i, true) } : { sell: quote2(w, i, false) }) }; }
export function inspectAlpha2(w: World): PublicView {
    const s = S2(w), owned = s.items.filter(i => i.owner === 'bag'), ground = s.items.filter(i => i.owner === 'ground' && visible2(w, i.position)), enemies = w.enemies.filter(e => e.hp > 0 && visible2(w, e)), weapon = weapon2(w), weaponDef = weapon ? def2(weapon) : undefined;
    const equipment = Object.fromEntries(SLOTS.map(slot => [slot, s.equipped[slot] ? def2(item2(w, s.equipped[slot]!)!).visual ?? null : null])) as Equipment;
    const adapter = (i: Item2): ItemView => ({ id: i.id, kind: def2(i).slot ? 'gear' : def2(i).category === 'scroll' ? 'scroll' : 'flask', quality: s.knowledge.enchantment.includes(i.id) ? i.enchantment : 0, ...(def2(i).visual ? { gear: def2(i).visual } : {}), appearance: (s.assignment[i.definition] ?? 0) % 4 });
    const publicGround = ground.map(i => ({ ...publicItem2(w, i), ...i.position }));
    const loot: Loot[] = ground.map(i => ({ ...i.position, id: i.id, kind: def2(i).slot ? 'gear' : 'potion', ...(def2(i).visual ? { gear: def2(i).visual } : {}), amount: 1, taken: false }));
    if (!w.player.relic && visible2(w, s.relic))
        loot.push({ ...s.relic, id: 9999, kind: 'relic', amount: 1, taken: false });
    const features = s.facilities.filter(f => f.revealed && w.explored[f.floor]!.includes(f.x)).map(f => ({ ...f, stock: f.kind === 'merchant' && near2(w, f) && line2(w, w.player, f) ? s.items.filter(i => i.owner === 'shop' && i.holder === f.id).map(i => publicItem2(w, i, true)) : [], ...featureDefinition(f.kind), near: near2(w, f) && line2(w, w.player, f), cost: f.kind === 'altar' ? C.altarPrice : f.kind === 'chest' ? C.chestPrice : 0 }));
    const targets: Target2[] = [{ key: 'self', kind: 'self', name: { zh: '自己', en: 'Yourself' } }, ...enemies.filter(e => Math.abs(e.x - w.player.x) <= 5).map(e => ({ key: `e${e.id}`, kind: 'enemy' as const, name: monsterDefinition(s.monsters.find(m => m.id === e.id)!.definition).name })), ...owned.map(i => ({ key: `i${i.id}`, kind: 'item' as const, name: display2(w, i) })), ...features.filter(f => f.near).map(f => ({ key: `f${f.id}`, kind: 'facility' as const, name: f.name })), ...s.doors.filter(d => near2(w, d)).map(d => ({ key: `d${d.id}`, kind: 'facility' as const, name: { zh: `通道门 ${d.id}`, en: `Gate ${d.id}` } }))];
    const resists: {
        element: Element;
        source: Words;
    }[] = [];
    for (const id of Object.values(s.equipped)) {
        if (!id)
            continue;
        const i = item2(w, id)!;
        if (i.durability > 0)
            for (const element of def2(i).resists ?? [])
                resists.push({ element, source: display2(w, i) });
    }
    if (condition2(w, 'ward'))
        resists.push({ element: 'fire', source: { zh: '石肤状态', en: 'Stone skin' } });
    return structuredClone({ seed: w.seed, tick: w.tick, revision: w.revision, status: w.status, player: { ...w.player, equipment, inventory: [...new Set(owned.flatMap(i => def2(i).visual ? [def2(i).visual!] : []))], potions: owned.filter(i => i.definition === 'renewal' && s.knowledge.identified.includes(i.definition)).length },
        map: { width: C.width, floors: C.floors, sight: sight2(w), exit: { floor: 0, x: 1 }, rooms: ['gate', 'gate', 'armory', 'armory', 'crypt', 'crypt'], ladders: s.links.filter(l => w.explored[l.floor]!.includes(l.x) || w.explored[l.floor + 1]!.includes(l.x)) }, gear: { catalog: [], ...stats2(w) }, enemies, loot, explored: w.explored, events: [], beats: w.beats,
        alpha: { loadout: s.loadout, chosen: s.chosen, mana: s.mana, maxMana: C.mana, nextMana: s.manaAt - w.tick, attackCost: weaponDef?.time ?? 12, range: weapon?.definition === 'staff' ? C.spellRange : weaponDef?.range ?? 1, spellCost: C.spellMana, spellTime: C.cast, doors: s.doors.filter(d => w.explored[d.floor]!.includes(d.x)), levers: [], caches: [] },
        expedition: { bag: owned.map(adapter), nearby: ground.filter(i => near2(w, i.position)).map(adapter), ground: ground.map(i => ({ ...adapter(i), ...i.position })), capacity: C.capacity, effects: [], shrines: [], kills: s.kills, collected: s.collected, bossDefeated: w.enemies.some(e => e.elite && e.hp === 0), templates: Array.from({ length: C.floors }, () => null) },
        alpha2: { actionCosts:{drink:C.action*(condition2(w,'slow')?2:1),throw:C.throw*(condition2(w,'slow')?2:1),apply:C.action*(condition2(w,'slow')?2:1),read:C.action*(condition2(w,'slow')?2:1),zap:C.zap*(condition2(w,'slow')?2:1),eat:C.action*(condition2(w,'slow')?2:1),equip:C.wear*(condition2(w,'slow')?2:1)}, bag: owned.map(i => publicItem2(w, i)), nearby: ground.filter(i => near2(w, i.position) && line2(w, w.player, i.position)).map(i => publicItem2(w, i)), ground: publicGround, facilities: features, segments: s.segments.filter(n => w.explored[n.floor]!.some(x => x >= n.start && x <= n.end)), conditions: conditionsView2(w, 0), monsters: enemies.map(e => ({ ...monsterDefinition(s.monsters.find(m => m.id === e.id)!.definition), enemy: e.id, conditions: conditionsView2(w, e.id) })),
            codex: { items: [...ITEMS,...(w.alpha5?ITEMS5:[]),...(w.alpha6?ITEMS6:[])].filter(i => s.knowledge.identified.includes(i.id)).map(({ id, name, description, category }) => ({ id, name, description, category })), monsters: [...MONSTERS,...(w.alpha5?MONSTERS5:[]),...(w.alpha6?MONSTERS6:[])].filter(m => s.knowledge.monsters.includes(m.id)), facilities: s.knowledge.facilities.map(id => ({ id: id as FacilityKind, ...featureDefinition(id) })) }, targets, journal: s.journal.map(j => ({ key: j.key, ...(j.amount === undefined ? {} : { amount: j.amount }), ...(j.name ? { name: source2(w, j.name) } : {}), ...(j.target ? { target: source2(w, j.target) } : {}) })), food: s.food, maxFood: C.maxFood, weight: owned.reduce((n, i) => n + def2(i).weight, 0), capacity: C.capacity, attackCost: weaponDef?.time ?? 12, attackRange: weaponDef?.range ?? 1, resists, knownCount: s.knowledge.identified.length, loadout: s.loadout, mana: s.mana, maxMana: C.mana, equipped: s.equipped }
    });
}
