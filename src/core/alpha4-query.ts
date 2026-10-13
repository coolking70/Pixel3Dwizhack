import { queryActionOffers4Base, queryContextOffers4Base, queryTargets4Base } from './action-query4';
import { queryThrowTargets3 } from './alpha3-query';
import { inspectAlpha4 } from './alpha4';
import type { PublicActionOffer, PublicTargetOffer, TargetRef } from './action-types';
import type { World } from './types';

export function queryActionOffers4(world:World,itemId:number):PublicActionOffer[] {
  const offers=queryActionOffers4Base(world,itemId).filter(o=>o.actionId!=='throw');
  if(!inspectAlpha4(world).alpha2!.bag.some(i=>i.id===itemId))return offers;
  const targets=queryThrowTargets3(world,itemId),usable=targets.some(t=>t.status==='enabled');
  offers.push({actionId:'throw',revision:world.revision,status:usable?'enabled':'disabled',targetModes:['world-cell','world-entity'],requiresConfirmation:false,
    ...(!usable?{publicReason:targets[0]?.publicReason??'interaction.noTargets'}:{})});
  return offers;
}
export function queryTargets4(world:World,itemId:number,actionId:string):PublicTargetOffer[] {
  return actionId==='throw'?queryThrowTargets3(world,itemId):queryTargets4Base(world,itemId,actionId);
}
export function queryContextOffers4(world:World,target:TargetRef):PublicActionOffer[] {
  if(target.type==='inventory-item')return queryActionOffers4(world,target.itemId);
  if(target.type==='equipment-slot'){
    const id=inspectAlpha4(world).alpha2!.equipped[target.slot];return id?queryActionOffers4(world,id):[];
  }
  return queryContextOffers4Base(world,target);
}
