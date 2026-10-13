import { ALPHA3 } from '../content/alpha3';
import { inspectAlpha3 } from './alpha3';
import { queryActionOffers, queryTargets } from './action-query';
import type { PublicActionOffer, PublicTargetOffer } from './action-types';
import type { World } from './types';

/** Ground aiming uses public geometry only and never predicts hidden effects. */
export function queryThrowTargets3(world: World, itemId: number): PublicTargetOffer[] {
  const v = inspectAlpha3(world), item = v.alpha2!.bag.find(i => i.id === itemId);
  if (!item) return [];
  const reason = v.status !== 'playing' ? 'ended' : item.equipped ? 'equipped' : v.alpha2!.conditions.some(c => c.kind === 'sleep') ? 'asleep' : undefined;
  const targets: PublicTargetOffer[] = [];
  for (const x of v.explored[v.player.floor] ?? []) {
    const distance = Math.abs(x - v.player.x);
    if (x < 1 || x >= v.map.width - 1 || !distance || distance > ALPHA3.range || distance > v.map.sight
      || v.alpha!.doors.some(d => !d.open && d.floor === v.player.floor && d.x > Math.min(x,v.player.x) && d.x < Math.max(x,v.player.x))) continue;
    const position = { floor: v.player.floor, x };
    targets.push({ ref: { type: 'world-cell', ...position }, key: `cell:${position.floor}:${x}`, name: { zh: `地面 ${x}`, en: `Ground ${x}` },
      revision: v.revision, status: reason ? 'disabled' : 'enabled', ...(reason ? { publicReason: `interaction.${reason}` } : {}), position,
      command: `a3:throw:${itemId}:${position.floor}:${x}` });
  }
  // Entity aliases permit both pointer picking and keyboard target cycling.
  for (const e of [...v.enemies.map(e => ({ ...e, kind:'enemy' as const, name:v.alpha2!.monsters.find(m=>m.enemy===e.id)!.name })),
    ...v.alpha2!.facilities.map(f=>({...f,kind:'facility' as const})),
    ...v.alpha!.doors.map(d=>({...d,kind:'door' as const,name:{zh:`通道门 ${d.id}`,en:`Gate ${d.id}`}}))]) {
    const cell = targets.find(t=>t.position?.floor===e.floor&&t.position.x===e.x);
    if (cell) targets.push({...cell,ref:{type:'world-entity',kind:e.kind,id:e.id},key:`${e.kind}:${e.id}`,name:{...e.name}});
  }
  return targets;
}
export function queryActionOffers3(world: World, itemId: number): PublicActionOffer[] {
  const offers = queryActionOffers(world,itemId).filter(o=>o.actionId!=='throw');
  const item=inspectAlpha3(world).alpha2!.bag.find(i=>i.id===itemId);if(!item)return offers;
  const targets=queryThrowTargets3(world,itemId), usable=targets.some(t=>t.status==='enabled');
  offers.push({actionId:'throw',revision:world.revision,status:usable?'enabled':'disabled',targetModes:['world-cell','world-entity'],requiresConfirmation:false,
    ...(!usable?{publicReason:targets[0]?.publicReason??'interaction.noTargets'}:{})});
  return offers;
}
export function queryTargets3(world: World,itemId:number,actionId:string):PublicTargetOffer[] {
  return actionId==='throw'?queryThrowTargets3(world,itemId):queryTargets(world,itemId,actionId);
}
