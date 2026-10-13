import { ALPHA as C, ALPHA_GEAR as GEAR } from '../content/alpha';
import { COMMANDS, SLOTS, type Command, type Enemy, type Fact, type GearId, type Outcome, type Position, type PublicView, type Slot, type World } from './types';
import type { CombatBeat, ItemInstance, ItemView } from './expedition-types';
import { generateAlpha, roll } from './alpha-map';
import type { Loadout } from './alpha-types';
const state = (w: World) => w.expedition!;
const clearLine = (w: World, a: Position, b: Position): boolean => a.floor === b.floor && !w.alpha!.doors.some(d => !d.open && d.floor === a.floor && d.x > Math.min(a.x,b.x) && d.x < Math.max(a.x,b.x));
const visible = (w: World, p: Position): boolean => w.player.floor === p.floor && Math.abs(w.player.x - p.x) <= C.sight && clearLine(w,w.player,p);
const near = (w: World, p: Position): boolean => w.player.floor === p.floor && Math.abs(w.player.x - p.x) <= 1;
const walkable = (w: World, p: Position): boolean => p.x >= 1 && p.x < C.width-1 && !w.alpha!.doors.some(d=>!d.open&&d.floor===p.floor&&d.x===p.x);
const mainHand = (w: World): GearId | undefined => state(w).items.find(i=>i.id===state(w).equipped.mainHand)?.gear;
const attackCost = (w: World): number => mainHand(w)==='sword'?C.swordTime:mainHand(w)==='mace'?C.maceTime:C.unarmedTime;
const pos = (p: Position): Position => ({ x: p.x, floor: p.floor });
const enemyAt = (w: World, p: Position): Enemy | undefined => w.enemies.find(e => e.hp > 0 && e.floor === p.floor && e.x === p.x);
const emit = (w: World, f: Fact): void => { w.events.push(f); if (w.events.length > 24) w.events.shift(); };
const beat = (w: World, b: Omit<CombatBeat, 'tick'>): void => { w.beats!.push({ ...b, tick: w.tick }); };
export function isAlphaCommand(value: unknown): value is Command {
  return typeof value === 'string' && ((COMMANDS as readonly string[]).includes(value) || value === 'shrine' || value === 'cast' || /^choose:(vanguard|breaker|channeler)$/.test(value) || /^cache:[1-9]\d{0,3}:(pay|force)$/.test(value) || SLOTS.some(s => value === `unequip:${s}`) || /^(door|lever|take|wear|drop|use|identify):[1-9]\d{0,3}$/.test(value));
}
function itemStats(item: ItemInstance): { damage: number; armor: number } {
  const base = GEAR[item.gear!];
  return { damage: base.damage + (base.slot === 'mainHand' ? item.quality : 0), armor: base.armor + (base.slot !== 'mainHand' ? item.quality : 0) };
}
export function alphaStats(w: World): { damage: number; armor: number } {
  let damage: number = C.baseDamage, armor = 0;
  for (const id of Object.values(state(w).equipped)) if (id !== null) { const item = state(w).items.find(i => i.id === id)!; const stats = itemStats(item); damage += stats.damage; armor += stats.armor; }
  if (state(w).effects.some(e => e.kind === 'might')) damage += C.might;
  if (state(w).effects.some(e => e.kind === 'ward')) armor += C.ward;
  return { damage: Math.max(1, damage), armor };
}
function reveal(w: World): void {
  const known = w.explored[w.player.floor]!;
  for (let x = Math.max(0, w.player.x - C.sight); x <= Math.min(C.width - 1, w.player.x + C.sight); x++) if (!known.includes(x) && clearLine(w,w.player,{x,floor:w.player.floor})) known.push(x);
  known.sort((a,b) => a-b);
}
export function createAlpha(seed: number): World {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('seed');
  const w: World = { scenario: 'alpha', seed, rng: seed, tick: 0, revision: 0, status: 'playing', player: { x: 2, floor: 0, hp: C.hp, maxHp: C.hp, face: 1, potions: 2, gold: 0, relic: false }, enemies: [], loot: [], explored: Array.from({ length: C.floors }, () => []), events: [{ kind: 'start' }], beats: [] };
  w.expedition = generateAlpha(w); reveal(w); return w;
}
function itemView(w: World, item: ItemInstance): ItemView {
  const equipped = SLOTS.find(s => state(w).equipped[s] === item.id);
  return { id: item.id, kind: item.kind, quality: item.quality,
    ...(item.gear ? { gear: item.gear, ...itemStats(item) } : {}), ...(equipped ? { equipped } : {}),
    ...(item.effect ? { appearance: state(w).appearances[item.effect], ...(state(w).identified.includes(item.effect) ? { effect: item.effect } : {}) } : {}) };
}
export function inspectAlpha(w: World): PublicView {
  const s = state(w), owned = s.items.filter(i => i.owner === 'bag');
  const equipment = Object.fromEntries(SLOTS.map(slot => [slot, s.items.find(i => i.id === s.equipped[slot])?.gear ?? null])) as Record<Slot, GearId | null>;
  const ground = s.items.filter(i => i.owner === 'ground' && visible(w, i.position));
  return structuredClone({ seed: w.seed, tick: w.tick, revision: w.revision, status: w.status,
    player: { ...w.player, equipment, inventory: [...new Set(owned.flatMap(i => i.gear ? [i.gear] : []))], potions: owned.filter(i => i.effect === 'healing' && s.identified.includes('healing')).length },
    map: { width: C.width, floors: C.floors, sight: C.sight, exit: { floor: 0, x: 1 }, rooms: s.map.themes,
      ladders: w.alpha!.links.filter(l=>w.explored[l.floor]!.includes(l.x)||w.explored[l.floor+1]!.includes(l.x)) },
    gear: { catalog: Object.entries(GEAR).map(([id, spec]) => ({ id: id as GearId, ...spec })), ...alphaStats(w) },
    enemies: w.enemies.filter(e => e.hp > 0 && visible(w, e)),
    loot: ground.map(i => ({ ...i.position, id: i.id, kind: i.kind === 'flask' || i.kind === 'scroll' ? 'potion' as const : i.kind, ...(i.gear ? { gear: i.gear } : {}), amount: 1, taken: false })),
    explored: w.explored, events: w.events, beats: w.beats,
    alpha: {loadout:w.alpha!.loadout,chosen:w.alpha!.chosen,mana:w.alpha!.mana,maxMana:C.mana,nextMana:w.alpha!.manaAt-w.tick,attackCost:attackCost(w),range:mainHand(w)==='wand'?C.spellRange:1,spellCost:C.spellMana,spellTime:C.spellTime,
      doors:w.alpha!.doors.filter(d=>w.explored[d.floor]!.includes(d.x)),levers:w.alpha!.levers.filter(l=>visible(w,l)),caches:w.alpha!.caches.filter(c=>visible(w,c)).map(({rewards:_,...c})=>c)},
    expedition: { bag: owned.filter(i => i.kind !== 'relic').map(i => itemView(w, i)), nearby: ground.filter(i => near(w, i.position)).map(i => itemView(w, i)), ground: ground.map(i => ({ ...itemView(w, i), ...i.position })), capacity: C.capacity,
      effects: s.effects, shrines: s.map.shrines.filter(p => visible(w, p)), kills: s.kills, collected: s.collected,
      bossDefeated: w.enemies.some(e => e.elite && e.hp === 0), templates: s.map.templates.map((t,i) => w.explored[i]!.length ? t : null) },
  });
}
function hurt(w: World, amount: number, actor: number): void {
  const actual = Math.min(w.player.hp, amount); w.player.hp -= actual;
  emit(w, { kind: 'hurt', amount: actual }); beat(w, { kind: 'hurt', actor, target: 0, position: pos(w.player), amount: actual });
  if (!w.player.hp) { w.status = 'dead'; emit(w, { kind: 'dead' }); beat(w, { kind: 'death', actor: 0, position: pos(w.player) }); }
}
function hit(w: World, enemy: Enemy, spell = false): void {
  const defense=spell?0:Math.max(0,(enemy.armor??0)-(mainHand(w)==='mace'?C.macePierce:0));
  const amount = Math.min(enemy.hp, Math.max(1,(spell?C.spellDamage:alphaStats(w).damage) + roll(w) % 3 - defense)); enemy.hp -= amount;
  beat(w, { kind: 'attack', actor: 0, target: enemy.id, position: pos(w.player), targetPosition: pos(enemy), amount, ...(spell?{mode:'spell' as const}:{}) }); emit(w, { kind: 'hit', amount });
  if (!enemy.hp) { w.player.gold += enemy.elite ? 30 : 5; state(w).kills++; emit(w, { kind: 'defeat', amount: enemy.elite ? 30 : 5 }); beat(w, { kind: 'death', actor: enemy.id, position: pos(enemy) }); }
}
function enemyAttack(w: World, enemy: Enemy, target: Position): void {
  if (w.player.floor === target.floor && clearLine(w,enemy,w.player) && Math.abs(w.player.x - target.x) <= (enemy.kind === 'guard' ? 1 : 0)) {
    const damage = Math.max(1, enemy.damage! - Math.floor(alphaStats(w).armor*(enemy.kind==='hexer'?.5:1)));
    beat(w, { kind: 'attack', actor: enemy.id, target: 0, position: pos(enemy), targetPosition: pos(w.player), amount: Math.min(w.player.hp, damage),...(enemy.kind==='hexer'?{mode:'spell' as const}:{}) }); hurt(w, damage, enemy.id);
    if (enemy.venom && w.status === 'playing') {
      const poison = state(w).effects.find(e => e.kind === 'poison');
      if (poison) poison.until = w.tick + C.poisonDuration;
      else { state(w).effects.push({ kind: 'poison', nextAt: w.tick + C.poisonPeriod, until: w.tick + C.poisonDuration }); emit(w, { kind: 'danger', note: 'poison' }); }
    }
  } else if (visible(w, enemy)) { beat(w, { kind: 'miss', actor: enemy.id, position: pos(enemy), targetPosition: target,...(enemy.kind==='hexer'?{mode:'spell' as const}:{}) }); emit(w, { kind: 'evade' }); }
}
// This is the expedition clock owner. Effects expire before attacks at the
// same deadline; poison pulses before enemy id order. No wall-clock input.
function advance(w: World, cost: number): void {
  const target = w.tick + cost;
  while (w.status === 'playing') {
    const s = state(w);
    const deadline = Math.min(w.alpha!.manaAt,...w.enemies.filter(e => e.hp > 0).map(e => e.nextAt), ...s.effects.map(e => Math.min(e.until, e.kind === 'poison' ? e.nextAt : e.until)));
    if (deadline > target) { w.tick = target; break; }
    w.tick = deadline; s.effects = s.effects.filter(e => e.until > deadline);
    if(w.alpha!.manaAt===deadline){w.alpha!.mana=Math.min(C.mana,w.alpha!.mana+1);w.alpha!.manaAt+=C.manaPeriod;}
    const poison = s.effects.find(e => e.kind === 'poison' && e.nextAt === deadline);
    if (poison) { poison.nextAt += C.poisonPeriod; hurt(w, C.poisonDamage, -1); }
    for (const e of w.enemies.filter(e => e.hp > 0 && e.nextAt === deadline).sort((a,b) => a.id-b.id)) {
      if (w.status !== 'playing') break;
      e.nextAt += e.period;
      if (e.intent) { const locked = e.intent; delete e.intent; enemyAttack(w, e, locked); continue; }
      if (!visible(w, e)) continue;
      const distance = Math.abs(e.x - w.player.x);
      if (distance > (e.kind === 'guard' ? 4 : C.sight)) continue;
      if (distance <= (e.kind==='hexer'?C.spellRange:1)) {
        if (e.kind === 'guard'||e.kind==='hexer') { e.intent = pos(w.player); emit(w, { kind: 'windup' }); beat(w, { kind: 'windup', actor: e.id, position: pos(e), targetPosition: pos(w.player) }); }
        else {
          enemyAttack(w, e, pos(w.player));
          const retreat={floor:e.floor,x:e.x+Math.sign(e.x-w.player.x)};
          if(e.kind==='skirmisher'&&w.status==='playing'&&walkable(w,retreat)&&!enemyAt(w,retreat)){const before=pos(e);e.x=retreat.x;beat(w,{kind:'move',actor:e.id,position:before,targetPosition:retreat});}
        }
      } else {
        const destination = { x: e.x + Math.sign(w.player.x - e.x), floor: e.floor };
        if (walkable(w,destination) && !enemyAt(w, destination)) { const before = pos(e); e.x = destination.x; beat(w, { kind: 'move', actor: e.id, position: before, targetPosition: destination }); }
      }
    }
  }
}
export function acceptAlpha(current: World, command: Command): Outcome {
  if (!isAlphaCommand(command)) return { accepted: false, reason: 'invalid' };
  if (current.status !== 'playing') return { accepted: false, reason: 'ended' };
  const w = structuredClone(current), s = state(w), p = w.player; w.beats = [];
  let cost: number = C.costs.wait;
  if(command.startsWith('choose:')){
    if(w.revision!==0||w.alpha!.chosen)return{accepted:false,reason:'invalid'};
    const loadout=command.slice(7) as Loadout;w.alpha!.loadout=loadout;
    for(const slot of ['chest','mainHand','offHand'] as const)s.items.find(i=>i.id===s.equipped[slot])!.gear=C.loadouts[loadout][slot];
    w.alpha!.chosen=true;w.revision++;return{accepted:true,world:w,interrupt:true};
  }
  w.alpha!.chosen=true;
  if(command==='interact'&&!s.items.some(i=>i.owner==='ground'&&near(w,i.position))){
    const lever=w.alpha!.levers.find(l=>!l.used&&near(w,l)),door=w.alpha!.doors.find(d=>!d.open&&!d.locked&&near(w,d));
    if(lever)command=`lever:${lever.id}`;else if(door)command=`door:${door.id}`;
  }
  if(command==='cast'){
    if(mainHand(w)!=='wand'||w.alpha!.mana<C.spellMana)return{accepted:false,reason:'invalid'};
    const enemy=w.enemies.filter(e=>e.hp>0&&visible(w,e)&&Math.abs(e.x-p.x)<=C.spellRange).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)||a.id-b.id)[0];
    if(!enemy)return{accepted:false,reason:'empty'};
    w.alpha!.mana-=C.spellMana;p.face=enemy.x<p.x?-1:1;hit(w,enemy,true);cost=C.spellTime;
  } else if(command.startsWith('door:')){
    const door=w.alpha!.doors.find(d=>d.id===Number(command.slice(5))&&near(w,d));
    if(!door||door.locked||p.x===door.x||enemyAt(w,door))return{accepted:false,reason:'blocked'};
    door.open=!door.open;cost=C.doorTime;emit(w,{kind:'pickup',effect:door.open?'doorOpen':'doorClosed'});
  } else if(command.startsWith('lever:')){
    const lever=w.alpha!.levers.find(l=>l.id===Number(command.slice(6))&&!l.used&&near(w,l));
    if(!lever)return{accepted:false,reason:'empty'};lever.used=true;const door=w.alpha!.doors.find(d=>d.id===lever.door)!;door.locked=false;door.open=true;cost=C.leverTime;emit(w,{kind:'pickup',effect:'leverUsed'});
  } else if(command.startsWith('cache:')){
    const [,id,choice]=command.split(':'),cache=w.alpha!.caches.find(c=>c.id===Number(id)&&!c.used&&near(w,c));
    if(!cache)return{accepted:false,reason:'empty'};
    if(choice==='pay'){if(p.gold<C.cacheGold)return{accepted:false,reason:'invalid'};p.gold-=C.cacheGold;}
    else{if(p.hp<=C.cacheHp)return{accepted:false,reason:'invalid'};hurt(w,C.cacheHp,-2);}
    cache.used=true;for(const id of cache.rewards)s.items.find(i=>i.id===id)!.owner='ground';cost=C.cacheTime;emit(w,{kind:'pickup',effect:'cacheOpened'});
  } else if (command === 'left' || command === 'right') {
    const direction = command === 'left' ? -1 : 1, x = p.x + direction;
    if (x < 1 || x >= C.width - 1) return { accepted: false, reason: 'wall' };
    if(!walkable(w,{x,floor:p.floor}))return{accepted:false,reason:'blocked'};
    p.face = direction; const enemy = enemyAt(w, { x, floor: p.floor });
    if (enemy) { hit(w, enemy); cost = attackCost(w); }
    else { const before = pos(p); p.x = x; cost = C.costs.move; emit(w, { kind: 'move' }); beat(w, { kind: 'move', actor: 0, position: before, targetPosition: pos(p) }); }
  } else if (command === 'up' || command === 'down') {
    const floor = p.floor + (command === 'up' ? -1 : 1);
    if (floor < 0 || floor >= C.floors || !w.alpha!.links.some(l=>l.floor===Math.min(p.floor,floor)&&l.x===p.x)) return { accepted: false, reason: 'ladder' };
    if (enemyAt(w, { x: p.x, floor })) return { accepted: false, reason: 'blocked' };
    p.floor = floor; cost = C.costs.climb; emit(w, { kind: 'climb' });
  } else if (command === 'attack') {
    const enemy = w.enemies.filter(e => e.hp > 0 && near(w, e)).sort((a,b) => Math.abs(a.x-p.x)-Math.abs(b.x-p.x) || a.id-b.id)[0];
    if (enemy) { p.face = enemy.x < p.x ? -1 : 1; hit(w, enemy); }
    else { emit(w, { kind: 'miss' }); beat(w, { kind: 'miss', actor: 0, position: pos(p) }); }
    cost = attackCost(w);
  } else if (command === 'interact' || command.startsWith('take:')) {
    const item = s.items.find(i => i.owner === 'ground' && near(w, i.position) && (command === 'interact' || i.id === Number(command.slice(5))));
    if (!item) return { accepted: false, reason: 'empty' };
    if (item.kind === 'relic' && w.enemies.some(e => e.elite && e.hp > 0)) return { accepted: false, reason: 'blocked' };
    if (item.kind !== 'relic' && s.items.filter(i => i.owner === 'bag' && i.kind !== 'relic').length >= C.capacity) return { accepted: false, reason: 'bagFull' };
    item.owner = 'bag'; s.collected++; if (item.kind === 'relic') p.relic = true;
    emit(w, { kind: 'pickup', amount: 1, item: item.kind === 'flask' || item.kind === 'scroll' ? 'potion' : item.kind, ...(item.gear ? { gear: item.gear } : {}), ...(item.kind === 'flask' || item.kind === 'scroll' ? { note: 'collect' as const } : {}) });
    beat(w, { kind: 'pickup', actor: 0, position: pos(p) }); cost = C.costs.take;
  } else if (command.startsWith('wear:')) {
    const item = s.items.find(i => i.id === Number(command.slice(5)) && i.owner === 'bag' && i.kind === 'gear');
    if (!item) return { accepted: false, reason: 'invalid' };
    const slot = GEAR[item.gear!].slot; if (s.equipped[slot] === item.id) return { accepted: false, reason: 'invalid' };
    s.equipped[slot] = item.id; cost = C.costs.wear; emit(w, { kind: 'equip', gear: item.gear });
  } else if (command.startsWith('unequip:')) {
    const slot = command.slice(8) as Slot; if (s.equipped[slot] === null) return { accepted: false, reason: 'invalid' };
    s.equipped[slot] = null; cost = C.costs.wear; emit(w, { kind: 'equip', amount: 0 });
  } else if (command.startsWith('drop:')) {
    const item = s.items.find(i => i.id === Number(command.slice(5)) && i.owner === 'bag' && i.kind !== 'relic');
    if (!item || Object.values(s.equipped).includes(item.id)) return { accepted: false, reason: 'invalid' };
    item.owner = 'ground'; item.position = pos(p); cost = C.costs.drop; emit(w, { kind: 'pickup', note: 'drop' });
  } else if (command.startsWith('identify:')) {
    const item = s.items.find(i => i.id === Number(command.slice(9)) && i.owner === 'bag' && i.effect && !s.identified.includes(i.effect));
    const scroll = s.items.find(i => i.kind === 'scroll' && i.owner === 'bag');
    if (!item || !scroll) return { accepted: false, reason: 'invalid' };
    scroll.owner = 'spent'; s.identified.push(item.effect!); cost = C.costs.identify; emit(w, { kind: 'heal', note: 'identify', effect: item.effect });
  } else if (command.startsWith('use:') || command === 'potion') {
    const item = s.items.find(i => i.owner === 'bag' && i.kind === 'flask' && (command === 'potion' ? i.effect === 'healing' && s.identified.includes('healing') : i.id === Number(command.slice(4))));
    if (!item) return { accepted: false, reason: 'noPotion' };
    if (item.effect === 'healing' && p.hp === p.maxHp && s.identified.includes('healing')) return { accepted: false, reason: 'fullHp' };
    item.owner = 'spent'; cost = C.costs.use;
    if (!s.identified.includes(item.effect!)) { s.identified.push(item.effect!); emit(w, { kind: 'heal', note: 'identify', effect: item.effect }); }
    if (item.effect === 'healing') { const amount = Math.min(C.healing, p.maxHp-p.hp); p.hp += amount; emit(w, { kind: 'heal', amount }); beat(w, { kind: 'heal', actor: 0, position: pos(p), amount }); }
    else if (item.effect === 'antidote') { s.effects = s.effects.filter(e => e.kind !== 'poison'); emit(w, { kind: 'heal', note: 'cure' }); }
    else { const kind = item.effect!; s.effects = s.effects.filter(e => e.kind !== kind); s.effects.push({ kind, nextAt: w.tick + C.buffDuration, until: w.tick + C.buffDuration }); emit(w, { kind: 'heal', note: kind }); }
  } else if (command === 'shrine') {
    const shrine = s.map.shrines.find(r => !r.used && near(w, r));
    if (!shrine) return { accepted: false, reason: 'empty' };
    if (p.hp === p.maxHp && !s.effects.some(e => e.kind === 'poison')) return { accepted: false, reason: 'fullHp' };
    shrine.used = true; p.hp = p.maxHp; s.effects = s.effects.filter(e => e.kind !== 'poison'); cost = C.costs.shrine; emit(w, { kind: 'heal', note: 'shrine' });
  } else emit(w, { kind: 'wait' });
  advance(w, cost);
  if (w.status === 'playing' && p.relic && p.floor === 0 && p.x === 1) { w.status = 'won'; emit(w, { kind: 'won' }); }
  reveal(w); w.revision++;
  const newlyVisible = w.enemies.some(e => e.hp > 0 && visible(w, e) && !current.enemies.some(old => old.id === e.id && old.hp > 0 && visible(current, old)));
  if (newlyVisible) emit(w, { kind: 'danger' });
  const interrupt = newlyVisible || p.hp < current.player.hp || w.status !== 'playing' || w.enemies.some(e => e.hp > 0 && near(w, e));
  return { accepted: true, world: w, interrupt };
}
