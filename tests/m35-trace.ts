import {readFileSync} from 'node:fs';
import {GameSession} from '../src/session/session';
import type {Command} from '../src/core/types';
export function cases6(){
 const raw=JSON.parse(readFileSync('tests/fixtures/alpha6-v1.json','utf8')) as {seed:number;history:{command:Command}[]},s=new GameSession(raw.seed,'alpha6');
 const cases:{name:string;before:string;after:string;command:Command;sourceId?:number;facilityId?:number}[]=[],seen=new Set<string>(),portraits:{name:string;archive:string}[]=[];let ladder:string|undefined;const opened=new Set<number>();
 const capture=(branch:GameSession,name:string,command:Command,sourceId?:number,facilityId?:number)=>{if(seen.has(name))return;const before=branch.capture();if(branch.submit(command).accepted){seen.add(name);cases.push({name,before,after:branch.capture(),command,sourceId,facilityId});}};
 for(const entry of raw.history){const v=s.view();
  for(const m of v.alpha2!.monsters)if(['cinderMourner','ossuaryGuard'].includes(m.id)&&!portraits.some(p=>p.name===m.id))portraits.push({name:m.id,archive:s.capture()});
  if(!ladder&&entry.command==='up'&&!v.enemies.length)ladder=s.capture();
  if(entry.command.startsWith('a6:feature:')){const f=v.alpha2!.facilities.find(f=>f.id===Number(entry.command.split(':')[2]))!;capture(GameSession.fromArchive(s.capture()),'manual-'+f.kind,entry.command,undefined,f.id);}
  if(!seen.has('campfire')){const f=v.alpha2!.facilities.find(f=>f.near&&f.kind==='campfire');if(f){const o=s.queryContextOffers({type:'world-entity',kind:'facility',id:f.id}).find(o=>o.status!=='disabled'&&o.command);if(o?.command)capture(GameSession.fromArchive(s.capture()),'campfire',o.command,undefined,f.id);}}
  const branches=[s];
  for(const f of v.alpha2!.facilities.filter(f=>f.near&&f.kind==='chest'&&!f.used&&f.floor>=4&&!opened.has(f.id))){opened.add(f.id);const offer=s.queryContextOffers({type:'world-entity',kind:'facility',id:f.id}).find(o=>o.status!=='disabled'&&o.actionId==='pay');if(offer?.command){const branch=GameSession.fromArchive(s.capture());if(branch.submit(offer.command).accepted)branches.push(branch);}}
  for(const route of branches)for(const definition of ['rimeUrn','silverCenser','vigilMirror'])if(!seen.has('tool-'+definition)){
   const rv=route.view(),owned=rv.alpha2!.bag.find(i=>i.definition===definition),loose=rv.alpha2!.nearby.find(i=>i.definition===definition);
   if(owned||loose){if(owned&&!route.queryTargets(owned.id,definition==='silverCenser'?'zap':'apply').some(t=>t.status!=='disabled'&&(t.ref.type==='self'||t.ref.type==='world-entity')))continue;const branch=GameSession.fromArchive(route.capture()),id=owned?.id??loose!.id;
    if(!owned&&branch.view().alpha2!.capacityUsed!>=16){const extra=branch.view().alpha2!.bag.find(i=>!i.equipped&&i.category==='food');if(extra)branch.submit(`drop:${extra.id}`);}
    if(owned||branch.submit(`take:${id}`).accepted){const targets=branch.queryTargets(id,definition==='silverCenser'?'zap':'apply').filter(t=>t.status!=='disabled'),t=targets.find(t=>t.ref.type==='world-entity'&&t.ref.kind==='facility')??targets.find(t=>t.ref.type==='world-entity'&&t.ref.kind==='enemy')??targets.find(t=>t.ref.type==='self');if(t?.command)capture(branch,'tool-'+definition,t.command,id,t.ref.type==='world-entity'&&t.ref.kind==='facility'?t.ref.id:undefined);}}
  }
  if(!s.submit(entry.command).accepted)throw Error('Natural golden rejected '+entry.command);
 }
 return{cases,portraits,ladder};
}
