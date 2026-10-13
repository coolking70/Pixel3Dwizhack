import {ALPHA2} from '../content/alpha2';
import { queryContextOffers4 } from './alpha4-query';
import { inspectAlpha5 } from './alpha5';
import type { PublicActionOffer,TargetRef } from './action-types';
import type { World,Command } from './types';
function contextOffers5(w:World,target:TargetRef):PublicActionOffer[]{
 if(target.type!=='world-entity'||target.kind!=='facility')return queryContextOffers4(w,target);
 const v=inspectAlpha5(w),f=v.alpha2!.facilities.find(f=>f.id===target.id);
 const action=f?.kind==='sporeBed'?'seal':f?.kind==='relay'?'isolate':f?.kind==='barricade'?'clear':null;
 if(!f||!action)return queryContextOffers4(w,target).filter(o=>!o.actionId.startsWith('cook:')||v.alpha2!.bag.some(i=>i.id===Number(o.actionId.split(':')[1])&&(!i.proof||i.freshness==='stale'))).map(o=>({...o,requiresConfirmation:true}));
 const reason=v.status!=='playing'?'ended':v.alpha2!.conditions.some(c=>c.kind==='sleep')?'asleep':!f.near?'outOfRange':f.used?'used':undefined;
 return[{actionId:action,revision:v.revision,status:reason?'disabled':'enabled',targetModes:[],requiresConfirmation:false,command:`a5:feature:${f.id}:${action}` as Command,...(reason?{publicReason:`interaction.${reason}`}:{})}];
}

export function queryContextOffers5(w:World,target:TargetRef):PublicActionOffer[]{
 const v=inspectAlpha5(w),slow=v.alpha2!.conditions.some(c=>c.kind==='slow')?2:1;
 return contextOffers5(w,target).map(o=>{const parts=o.command?.split(':')??[],action=parts[1]==='feature'?parts[3]:parts[1];
 if(parts[0]==='a5')return{...o,cost:{ticks:(action==='clear'?18:24)*slow}};
 if(parts[0]!=='a2')return o;
 const f=v.alpha2!.facilities.find(f=>f.id===Number(parts[2])),i=[...v.alpha2!.bag,...(f?.stock??[])].find(i=>i.id===Number(parts[3]));
 return{...o,cost:{ticks:12*slow,...(action==='pay'?{gold:ALPHA2.chestPrice}:action==='force'?{hp:ALPHA2.chestHp}:action==='cleanse'?{gold:ALPHA2.altarPrice}:action==='recharge'?{gold:8}:action==='buy'&&i?.buy!==undefined?{gold:i.buy}:action==='sell'&&i?.sell!==undefined?{gold:-i.sell}:{})}};
 });
}
