import {FACILITY_EFFECTS6} from '../content/alpha6-catalog';
import { FACILITY_EFFECTS5 } from '../content/alpha5-catalog';
import {itemDefinition,effectDefinition} from '../content/catalog-access';
// Alpha 4 query policy. Historical query semantics remain independently versioned.
import { ALPHA2 as C, ITEMS } from '../content/alpha2';
import { inspectAlpha4 } from './alpha4';
import type { World, PublicView, Command, Position } from './types';
import type { Item2View, ItemAction, ItemDef, EffectDef, Facility2View, TargetKind } from './alpha2-types';
import type { ActionId, PublicActionOffer, PublicTargetOffer, OfferStatus, TargetMode, TargetRef } from './action-types';

type Check = { status: OfferStatus; publicReason?: string };
type Candidate = { offer: PublicTargetOffer; kind: TargetKind; item?: Item2View; facility?: Facility2View; door?: NonNullable<PublicView['alpha']>['doors'][number] };
const yes = (): Check => ({ status: 'enabled' });
const no = (reason: string): Check => ({ status: 'disabled', publicReason: `interaction.${reason}` });
const maybe = (): Check => ({ status: 'uncertain', publicReason: 'interaction.unknown' });
const combine = (...checks: Check[]): Check => checks.find(c => c.status === 'disabled') ?? checks.find(c => c.status === 'uncertain') ?? yes();
const near = (v: PublicView, p: Position) => p.floor === v.player.floor && Math.abs(p.x - v.player.x) <= 1;
const same = (a: Position, b: Position) => a.floor === b.floor && a.x === b.x;
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) frozen(child); Object.freeze(value); }
  return value;
}
function view(world: World): PublicView | undefined { return world.alpha2 ? inspectAlpha4(world) : undefined; }
function state(v: PublicView, itemUse = false): Check {
  return v.status !== 'playing' ? no('ended') : !itemUse && v.alpha2!.conditions.some(c => c.kind === 'sleep') ? no('asleep') : yes();
}
// Never use the hidden item's definition or its definition-derived actions.
const definitions = (i: Item2View): ItemDef[] => i.definition ? [itemDefinition(i.definition)] : ITEMS.filter(d => d.category === i.category);
const actions = (i: Item2View): ItemAction[] => [...new Set(definitions(i).flatMap(d => Object.keys(d.actions) as ItemAction[]))];
const unbind = (i?: Item2View): Check => !i ? yes() : i.blessing === undefined ? maybe() : i.blessing === 'cursed' ? no('cursed') : yes();
function property(i: Item2View, test: (d: ItemDef) => boolean): Check {
  const values = definitions(i).map(test);
  return values.every(Boolean) ? yes() : values.every(v => !v) ? no('wrongTarget') : maybe();
}
function sourceCheck(v: PublicView, i: Item2View, action: ActionId): Check {
  if (action === 'unequip') return combine(state(v), i.equipped ? unbind(i) : no('notEquipped'), v.alpha2!.capacityUsed! >= C.capacity ? no('bagFull') : yes());
  if (action === 'drop') return combine(state(v), i.equipped ? no('equipped') : yes());
  if (!actions(i).includes(action)) return no('unsupported');
  if (action === 'equip') {
    if (i.equipped) return no('alreadyEquipped');
    const slots = [...new Set(definitions(i).map(d => d.slot))];
    if (slots.every(s => !s)) return no('wrongTarget');
    if (slots.length !== 1 || !slots[0]) return combine(state(v), maybe());
    const old = v.alpha2!.bag.find(b => b.equipped === slots[0]);
    return combine(state(v), unbind(old), i.definition ? yes() : maybe());
  }
  const hasCharges = definitions(i).some(d => !!d.charges) && action !== 'throw';
  return combine(state(v, true), i.equipped ? no('equipped') : yes(), hasCharges ? i.charges === undefined ? maybe() : i.charges <= 0 ? no('noCharges') : yes() : yes());
}
function candidates(v: PublicView): Candidate[] {
  const make = (ref: TargetRef, key: string, name: PublicTargetOffer['name'], kind: TargetKind, position?: Position): Candidate => ({
    kind, offer: { ref, key, name: { ...name }, revision: v.revision, status: 'enabled', ...(position ? { position: { floor: position.floor, x: position.x } } : {}) },
  });
  return [make({ type: 'self' }, 'self', { zh: '自己', en: 'Yourself' }, 'self'),
    ...v.alpha2!.bag.map(item => ({ ...make({ type: 'inventory-item', itemId: item.id }, `i${item.id}`, item.name, 'item'), item })),
    ...v.enemies.map(e => make({ type: 'world-entity', kind: 'enemy', id: e.id }, `e${e.id}`, v.alpha2!.monsters.find(m => m.enemy === e.id)!.name, 'enemy', e)),
    ...v.alpha2!.facilities.map(facility => ({ ...make({ type: 'world-entity', kind: 'facility', id: facility.id }, `f${facility.id}`, facility.name, 'facility', facility), facility })),
    ...(v.alpha?.doors ?? []).map(door => ({ ...make({ type: 'world-entity', kind: 'door', id: door.id }, `d${door.id}`, { zh: `通道门 ${door.id}`, en: `Gate ${door.id}` }, 'facility', door), door })),
  ];
}
function structural(v: PublicView, i: Item2View, action: ItemAction, t: Candidate): Check {
  if (t.item?.id === i.id) return no('sameItem');
  if ((action === 'drink' || action === 'eat') && t.kind !== 'self') return no('wrongTarget');
  if (action === 'throw' && t.kind !== 'enemy' && !(t.kind === 'facility' && i.category === 'potion')) return no('wrongTarget');
  if ((action === 'apply' || action === 'read') && t.kind === 'enemy') return no('wrongTarget');
  if (t.kind === 'enemy' && (!t.offer.position || t.offer.position.floor !== v.player.floor || Math.abs(t.offer.position.x - v.player.x) > 5)) return no('outOfRange');
  if (t.facility && !t.facility.near || t.door && !near(v, t.door)) return no('outOfRange');
  return yes();
}
/** Structural prerequisites only. No effect execution, clone-and-submit or RNG. */
function effectCheck(source: Item2View, effect: EffectDef, t: Candidate): Check {
  if (!effect.targets.includes(t.kind)) return no('wrongTarget');
  if(t.facility&&FACILITY_EFFECTS6[t.facility.kind])return !t.facility.used&&FACILITY_EFFECTS6[t.facility.kind]!.includes(effect.id)?yes():no(t.facility.used?'used':'wrongTarget');
  if(t.facility&&FACILITY_EFFECTS5[t.facility.kind])return !t.facility.used&&FACILITY_EFFECTS5[t.facility.kind]!.includes(effect.id)?yes():no(t.facility.used?'used':'wrongTarget');
  switch (effect.op) {
    case 'damage':
      // Legacy door targets accidentally fall through to actor 0. Preserve
      // old submit/replay behavior, but never recommend a false door effect.
      if (t.door) return no('wrongTarget');
      if (t.item) return combine(effect.element === 'acid' ? yes() : no('wrongTarget'), property(t.item, d => !!d.slot && d.material === 'metal'), t.item.proof ? no('protected') : yes(), t.item.durability > 0 ? yes() : no('broken'));
      if (t.facility) return t.facility.kind !== 'hazard' ? no('wrongTarget') : effect.element === 'cold' ? t.facility.used ? no('used') : yes() : effect.element === 'fire' ? t.facility.used ? yes() : no('active') : no('wrongTarget');
      return yes();
    case 'water':
      if (t.door) return no('wrongTarget');
      if (t.item) return source.blessing === undefined ? maybe() : source.blessing === 'uncursed' ? no('noEffect') : yes();
      if (t.facility) return t.facility.kind !== 'hazard' ? no('wrongTarget') : t.facility.used ? no('used') : yes();
      return yes();
    case 'enchant': return t.item ? property(t.item, d => !!d.slot) : no('wrongTarget');
    case 'repair': return t.item ? combine(property(t.item, d => !!d.slot), t.item.durability === 6 ? no('fullDurability') : yes()) : no('wrongTarget');
    case 'protect': return t.item ? combine(property(t.item, d => !!d.slot && d.material === 'metal'), t.item.proof ? no('protected') : yes()) : no('wrongTarget');
    case 'cook': return t.item?.category === 'food' ? yes() : no('wrongTarget');
    case 'open': return t.kind === 'enemy' ? yes() : t.door ? t.door.open ? no('alreadyOpen') : yes() : t.facility?.kind === 'chest' ? t.facility.used ? no('used') : yes() : no('wrongTarget');
    // These depend on undiscovered traps, occupants or the hidden entity cap.
    // Do not inspect those facts to refine a public hint.
    case 'blink': case 'summon': return maybe();
    default: return yes();
  }
}
function targetOffers(v: PublicView, itemId: number, action: ActionId): PublicTargetOffer[] {
  const i = v.alpha2!.bag.find(i => i.id === itemId);
  if (!i || ['equip', 'unequip', 'drop'].includes(action) || !actions(i).includes(action as ItemAction)) return [];
  return candidates(v).map(t => {
    const checks = definitions(i).map(d => { const fx = d.actions[action as ItemAction]; return fx ? effectCheck(i, effectDefinition(fx), t) : no('unsupported'); });
    const effect = i.definition ? checks[0]! : checks.every(c => c.status === 'disabled') ? no('wrongTarget') : maybe();
    return { ...t.offer, ...combine(sourceCheck(v, i, action), structural(v, i, action as ItemAction, t), effect), command: `a2:use:${i.id}:${action}:${t.offer.key}` as Command };
  });
}
export function queryTargets4Base(world: World, itemId: number, actionId: string): PublicTargetOffer[] {
  const v = view(world); return frozen(v ? targetOffers(v, itemId, actionId as ActionId) : []);
}
export function queryActionOffers4Base(world: World, itemId: number): PublicActionOffer[] {
  const v = view(world), i = v?.alpha2?.bag.find(i => i.id === itemId);
  if (!v || !i) return frozen([]);
  return frozen(( [...actions(i), 'unequip', 'drop'] as ActionId[]).map(actionId => {
    const direct = ['equip', 'unequip', 'drop'].includes(actionId), targets = direct ? [] : targetOffers(v, itemId, actionId);
    const usable = targets.filter(t => t.status !== 'disabled');
    const availability = direct ? sourceCheck(v, i, actionId) : usable.length ? usable.some(t => t.status === 'enabled') ? yes() : maybe() : combine(sourceCheck(v, i, actionId), no('noTargets'));
    const modes = [...new Set(usable.map(t => t.ref.type === 'self' ? 'self' : t.ref.type === 'inventory-item' ? 'bag-item' : 'world-entity'))] as TargetMode[];
    const command: Command | undefined = actionId === 'equip' ? `wear:${i.id}` : actionId === 'unequip' && i.equipped ? `unequip:${i.equipped}` : actionId === 'drop' ? `drop:${i.id}` : usable.length === 1 && usable[0]!.ref.type === 'self' ? usable[0]!.command : undefined;
    return { actionId, revision: v.revision, ...availability, targetModes: modes, requiresConfirmation: actionId === 'drop', ...(command ? { command } : {}) };
  }));
}
export function queryContextOffers4Base(world: World, target: TargetRef): PublicActionOffer[] {
  const v = view(world); if (!v) return frozen([]);
  if (target.type === 'inventory-item') return queryActionOffers4Base(world, target.itemId);
  if (target.type === 'equipment-slot') { const id = v.alpha2!.equipped[target.slot]; return id ? queryActionOffers4Base(world, id) : frozen([]); }
  if (target.type !== 'world-entity') return frozen([]);
  const result: PublicActionOffer[] = [];
  const offer = (actionId: string, command: Command, check: Check, confirm = false) => result.push({ actionId, command, revision: v.revision, ...combine(state(v), check), targetModes: [], requiresConfirmation: confirm });
  if (target.kind === 'ground-item') {
    const i = v.alpha2!.ground.find(i => i.id === target.id);
    if (i) offer('take', `take:${i.id}`, combine(v.alpha2!.nearby.some(n => n.id === i.id) ? yes() : no('outOfRange'), v.alpha2!.capacityUsed! >= C.capacity ? no('bagFull') : yes()));
  } else if (target.kind === 'relic') {
    const relic = v.loot.find(l => l.id === target.id && l.kind === 'relic');
    if (relic) offer('take', 'interact', combine(near(v, relic) ? yes() : no('outOfRange'), v.enemies.some(e => e.elite) ? no('guarded') : v.expedition?.bossDefeated ? yes() : maybe()));
  } else if (target.kind === 'door') {
    const d = v.alpha?.doors.find(d => d.id === target.id);
    if (d) { const check = combine(near(v, d) ? yes() : no('outOfRange'), same(v.player, d) || v.enemies.some(e => same(e, d)) ? no('occupied') : yes());
      offer(d.open ? 'close' : 'open', `door:${d.id}`, combine(check, d.locked ? no('locked') : yes()));
      offer('lever', `lever:${d.id}`, combine(check, d.locked ? yes() : no('alreadyUnlocked')));
    }
  } else if (target.kind === 'enemy') {
    const e = v.enemies.find(e => e.id === target.id);
    if (e) {
      const nearest = (range: number) => v.enemies.filter(e => Math.abs(e.x - v.player.x) <= range).sort((a,b) => Math.abs(a.x-v.player.x)-Math.abs(b.x-v.player.x)||a.id-b.id)[0];
      offer('attack', 'attack', nearest(v.alpha2!.attackRange)?.id === e.id ? yes() : no('outOfRange'));
      const staff = v.alpha2!.bag.find(i => i.equipped === 'mainHand')?.definition === 'staff';
      if (staff) offer('cast', 'cast', combine(nearest(C.spellRange)?.id === e.id ? yes() : no('outOfRange'), v.alpha2!.mana >= C.spellMana ? yes() : no('noMana')));
    }
  } else if (target.kind === 'ladder') {
    const l = v.map.ladders.find(l => l.floor * v.map.width + l.x === target.id);
    if (l) for (const [action, floor] of [['up',v.player.floor-1],['down',v.player.floor+1]] as const) {
      if (Math.min(v.player.floor,floor) !== l.floor) continue;
      offer(action, action, combine(v.player.x === l.x ? yes() : no('outOfRange'), floor >= 0 && floor < v.map.floors ? yes() : no('outOfRange'), v.enemies.some(e => e.floor === floor && e.x === l.x) ? no('occupied') : maybe()));
    }
  } else if (target.kind === 'facility') {
    const f = v.alpha2!.facilities.find(f => f.id === target.id);
    if (f) {
      const proximity = f.near ? yes() : no('outOfRange'), active = combine(proximity, f.used ? no('used') : yes());
      if (f.kind === 'chest') { offer('pay', `a2:feature:${f.id}:pay`, combine(active, v.player.gold >= C.chestPrice ? yes() : no('noGold')), true); offer('force', `a2:feature:${f.id}:force`, combine(active, v.player.hp > C.chestHp ? yes() : no('noHealth')), true); }
      const action = f.kind === 'fountain' ? 'drink' : f.kind === 'garden' ? 'harvest' : f.kind === 'trap' ? 'disarm' : undefined;
      if (action) offer(action, `a2:feature:${f.id}:${action}`, active);
      if (f.kind === 'merchant') for (const i of f.stock) offer(`buy:${i.id}`, `a2:buy:${f.id}:${i.id}`, combine(proximity, v.alpha2!.capacityUsed! >= C.capacity ? no('bagFull') : yes(), i.buy !== undefined && v.player.gold >= i.buy ? yes() : no('noGold')), true);
      for (const i of v.alpha2!.bag) {
        if (f.kind === 'merchant') {
          offer(`sell:${i.id}`, `a2:sell:${f.id}:${i.id}`, combine(proximity, i.equipped ? no('equipped') : yes(), f.gold !== undefined && i.sell !== undefined && f.gold >= i.sell ? yes() : no('merchantFunds')), true);
          if (i.category === 'wand') { const max = definitions(i).map(d => d.charges!); offer(`recharge:${i.id}`, `a2:recharge:${f.id}:${i.id}`, combine(proximity, v.player.gold >= 8 ? yes() : no('noGold'), i.charges === undefined ? maybe() : max.every(m => i.charges! >= m) ? no('fullCharges') : max.every(m => i.charges! < m) ? yes() : maybe()), true); }
        } else if (f.kind === 'altar') offer(`cleanse:${i.id}`, `a2:cleanse:${f.id}:${i.id}`, combine(proximity, v.player.gold >= C.altarPrice ? yes() : no('noGold')), true);
        else if (f.kind === 'campfire' && i.category === 'food') offer(`cook:${i.id}`, `a2:cook:${f.id}:${i.id}`, proximity);
      }
    }
  }
  return frozen(result);
}
