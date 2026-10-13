import { REGIONS5 } from '../content/alpha5-catalog';
import { generateRegions5 } from './alpha5-map';
import { ALPHA5 as C } from '../content/alpha5';
import { acceptAlpha4, createAlpha4, inspectAlpha4, isAlpha4Command } from './alpha4';
import { advance2 } from './alpha2-clock';
import { hazard2 } from './alpha2-effects';
import { condition2, near2, line2, log2, pos2, reveal2 } from './alpha2-shared';
import { releaseEnemyLoot4 } from './alpha4-map';
import type { JumpReason5, JumpTarget5 } from './alpha5-types';
import type { Command, Outcome, PublicView, World } from './types';

export function isAlpha5Command(value: unknown): value is Command {
  return isAlpha4Command(value) || typeof value === 'string' && /^(?:a5:jump:(?:[1-9]|1\d|2[0-8])|a5:feature:[1-9]\d{0,4}:(?:seal|isolate|clear))$/.test(value);
}
export function createAlpha5(seed: number): World {
  const w = createAlpha4(seed); w.scenario = 'alpha5'; w.alpha5 = { lastJump: null }; generateRegions5(w); reveal2(w); return w;
}
/** Only public facts decide previews. Hidden traps never change target availability. */
export function jumpTarget5(v: PublicView, x: number): JumpTarget5 {
  const p = v.player, distance = Math.abs(x - p.x), a = v.alpha2!;
  const cost = (distance === 1 ? C.jump.shortCost : C.jump.longCost) * (a.conditions.some(c => c.kind === 'slow') ? 2 : 1);
  let reason: JumpReason5 | undefined;
  if (v.status !== 'playing') reason = 'ended';
  else if (a.conditions.some(c => c.kind === 'sleep' || c.kind === 'confused')) reason = 'state';
  else if (a.weight > C.jump.maxWeight) reason = 'burden';
  else if (!Number.isInteger(x) || x < 1 || x >= v.map.width - 1 || distance < 1 || distance > C.jump.range) reason = 'range';
  else if (!v.explored[p.floor]?.includes(x) || distance > v.map.sight) reason = 'unseen';
  else {
    const between = (q: { floor: number; x: number }) => q.floor === p.floor && q.x >= Math.min(p.x, x) && q.x <= Math.max(p.x, x) && q.x !== p.x;
    if (a.facilities.some(f=>f.kind==='barricade'&&!f.used&&f.floor===p.floor&&f.x===x)) reason = 'obstacle';
    else if (v.alpha!.doors.some(d => !d.open && between(d)) || v.enemies.some(between)) reason = 'obstacle';
  }
  return { revision: v.revision, position: { floor: p.floor, x }, cost, command: `a5:jump:${x}`, status: reason ? 'disabled' : 'enabled', ...(reason ? { reason } : {}) };
}
export function inspectAlpha5(w: World): PublicView {
  const v = inspectAlpha4(w);
  return { ...v, alpha5: { region: { id: REGIONS5[w.player.floor<3?0:1]!.id, name: {...REGIONS5[w.player.floor<3?0:1]!.name} }, lastJump: structuredClone(w.alpha5!.lastJump), jumpTargets: [-2,-1,1,2].map(dx => jumpTarget5(v, v.player.x + dx)) } };
}
export function acceptAlpha5(current: World, command: Command): Outcome {
  if (!isAlpha5Command(command)) return { accepted: false, reason: 'invalid' };
  if(command.startsWith('a5:feature:')){
    if(current.status!=='playing')return{accepted:false,reason:'ended'};
    const [, , id, action]=command.split(':'),f=current.alpha2!.facilities.find(f=>f.id===Number(id));
    const expected=f?.kind==='sporeBed'?'seal':f?.kind==='relay'?'isolate':f?.kind==='barricade'?'clear':null;
    if(!f||f.used||!f.revealed||action!==expected||!near2(current,f)||!line2(current,current.player,f)||condition2(current,'sleep'))return{accepted:false,reason:'blocked'};
    const w=structuredClone(current);w.beats=[];w.alpha2!.chosen=true;w.alpha2!.facilities.find(g=>g.id===f.id)!.used=true;w.alpha3!.lastThrow=null;w.alpha5!.lastJump=null;
    log2(w,{key:'ecoCleared',target:`facility:${f.kind}`});advance2(w,(f.kind==='barricade'?18:24)*(condition2(current,'slow')?2:1));releaseEnemyLoot4(w);reveal2(w);w.revision++;
    return{accepted:true,world:w,interrupt:true};
  }
  if (!command.startsWith('a5:jump:')) {
    const r = acceptAlpha4(current, command);
    if (r.accepted) r.world.alpha5!.lastJump = null;
    return r;
  }
  const target = jumpTarget5(inspectAlpha4(current), Number(command.slice(8)));
  if (target.status !== 'enabled') return { accepted: false, reason: current.status === 'playing' ? 'blocked' : 'ended' };
  const w = structuredClone(current), from = pos2(w.player);
  w.beats = []; w.alpha2!.chosen = true;
  w.player.face = Math.sign(target.position.x - from.x) as -1 | 1;
  w.player.x = target.position.x;
  w.alpha3!.lastThrow = null;
  w.alpha5!.lastJump = { revision: w.revision + 1, from, to: pos2(w.player), cost: target.cost };
  // Arrival is atomic. Only the landing cell contacts terrain; enemies then act
  // over the complete cost through the same historical scheduler.
  hazard2(w, w.player);
  advance2(w, target.cost);
  releaseEnemyLoot4(w);
  if (w.status === 'playing' && w.player.relic && w.player.floor === 0 && w.player.x === 1) { w.status = 'won'; log2(w, { key: 'won' }); }
  reveal2(w); w.revision++;
  return { accepted: true, world: w, interrupt: true };
}
