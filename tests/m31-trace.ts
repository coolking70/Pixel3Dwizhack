import {readFileSync} from 'node:fs';
import {GameSession} from '../src/session/session';
import type {Command} from '../src/core/types';
export function ecologyCases5(){
 const raw=JSON.parse(readFileSync('tests/fixtures/alpha5-v1.json','utf8')) as {seed:number;history:{command:Command}[]};
 const s=new GameSession(raw.seed,'alpha5'),out:{name:string;before:string;after:string;command:Command;facilityId:number;sourceId?:number}[]=[],seen=new Set<string>();
 for(const {command} of raw.history){
  const v=s.view(),manual=/^a5:feature:(\d+):(.+)$/.exec(command),use=/^a2:use:(\d+):apply:f(\d+)$/.exec(command);
  const f=v.alpha2!.facilities.find(f=>f.id===Number(manual?.[1]??use?.[2])),source=use?v.alpha2!.bag.find(i=>i.id===Number(use[1])):undefined;
  const name=f&&(manual?'manual-'+f.kind:source?'tool-'+source.definition:undefined);
  if(!seen.has('tool-sporeBell')&&v.revision>0){
   const owned=v.alpha2!.bag.find(i=>i.definition==='sporeBell'),loose=v.alpha2!.nearby.find(i=>i.definition==='sporeBell');
   if(owned||loose){const branch=GameSession.fromArchive(s.capture()),id=owned?.id??loose!.id;
    if(owned||branch.submit(`take:${id}`).accepted){const target=branch.queryTargets(id,'apply').find(t=>t.status!=='disabled'&&t.ref.type==='world-entity'&&t.ref.kind==='facility')??branch.queryTargets(id,'apply').find(t=>t.status!=='disabled'&&t.ref.type==='self');
     if(target?.command){const b=branch.capture();if(branch.submit(target.command).accepted){seen.add('tool-sporeBell');out.push({name:'tool-sporeBell',before:b,after:branch.capture(),command:target.command,facilityId:target.ref.type==='world-entity'?target.ref.id:0,sourceId:id});}}
    }
   }
  }
  const before=name&&!seen.has(name)?s.capture():undefined;
  if(!s.submit(command).accepted)throw Error('Golden rejected '+command);
  if(before&&name&&f){seen.add(name);out.push({name,before,after:s.capture(),command,facilityId:f.id,...(source?{sourceId:source.id}:{})});}
 }
 return out;
}

export function ecologyPortraits5(){
 const raw=JSON.parse(readFileSync('tests/fixtures/alpha5-v1.json','utf8')) as {seed:number;history:{command:Command}[]},s=new GameSession(raw.seed,'alpha5'),out:{name:string;archive:string}[]=[],seen=new Set<string>();
 for(const {command} of raw.history){const v=s.view();for(const m of v.alpha2!.monsters){if(['sporeTender','repairSpider'].includes(m.id)&&!seen.has(m.id)){seen.add(m.id);out.push({name:m.id,archive:s.capture()});}}if(seen.size===2)break;if(!s.submit(command).accepted)throw Error(command);}
 return out;
}
