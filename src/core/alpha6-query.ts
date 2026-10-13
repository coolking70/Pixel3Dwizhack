import {queryContextOffers5} from './alpha5-query';
import {inspectAlpha6} from './alpha6';
import type {World,Command} from './types';
import type {TargetRef,PublicActionOffer} from './action-types';
export function queryContextOffers6(w:World,target:TargetRef):PublicActionOffer[]{
 if(target.type!=='world-entity'||target.kind!=='facility')return queryContextOffers5(w,target);
 const v=inspectAlpha6(w),f=v.alpha2!.facilities.find(f=>f.id===target.id),action=f?.kind==='emberVent'?'cover':f?.kind==='boneChime'?'silence':null;
 if(!action||!f)return queryContextOffers5(w,target);
 const reason=v.status!=='playing'?'ended':v.alpha2!.conditions.some(c=>c.kind==='sleep')?'asleep':!f.near?'outOfRange':f.used?'used':undefined;
 return[{cost:{ticks:(action==='cover'?24:28)*(v.alpha2!.conditions.some(c=>c.kind==='slow')?2:1)},actionId:action,revision:v.revision,status:reason?'disabled':'enabled',targetModes:[],requiresConfirmation:true,command:`a6:feature:${f.id}:${action}` as Command,...(reason?{publicReason:'interaction.'+reason}:{})}];
}
