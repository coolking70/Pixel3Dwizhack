import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import type { Command } from '../src/core/types';
import type { TargetRef } from '../src/core/action-types';
import { itemActionCases, itemTargetCases } from './m18-trace';
export interface DirectCase { name:string; before:string; after:string; command:Command; target:TargetRef; context?:string }
export function alpha3Prefix(raw:string):GameSession {
  const old=JSON.parse(raw) as {seed:number;history:{command:Command}[]},s=new GameSession(old.seed,'alpha3');
  for(const {command} of old.history)if(!s.submit(command).accepted)throw new Error(`Alpha3 prefix rejected ${command}`);
  return s;
}
/** All checkpoints originate in the formal golden new game and command stream. */
export function directWorldCases():DirectCase[] {
  const golden=JSON.parse(readFileSync('tests/fixtures/alpha2-v1.json','utf8')) as {seed:number;history:{command:Command}[]};
  const s=new GameSession(golden.seed,'alpha3'),out:DirectCase[]=[],seen=new Set<string>();
  const add=(name:string,command:Command,target:TargetRef,context?:string)=>{
    if(seen.has(name))return;const before=s.capture(),copy=GameSession.fromArchive(before);if(!copy.submit(command).accepted)return;
    seen.add(name);out.push({name,command,target,context,before,after:copy.capture()});
  };
  for(const {command} of golden.history){
    const v=s.view();
    if(v.revision>0){
      if(command==='right'&&!v.enemies.length&&!v.alpha2!.ground.some(i=>i.x===v.player.x+1&&i.floor===v.player.floor)&&!v.alpha2!.facilities.some(f=>f.x===v.player.x+1&&f.floor===v.player.floor)&&!v.alpha!.doors.some(d=>d.x===v.player.x+1&&d.floor===v.player.floor)&&!v.map.ladders.some(l=>l.x===v.player.x+1))add('groundMove',command,{type:'world-cell',floor:v.player.floor,x:v.player.x+1});
      if(command.startsWith('take:'))add('pickup',command,{type:'world-entity',kind:'ground-item',id:Number(command.slice(5))});
      if(command.startsWith('door:'))add('openDoor',command,{type:'world-entity',kind:'door',id:Number(command.slice(5))});
      if(command.startsWith('lever:'))add('lockedDoor',command,{type:'world-entity',kind:'door',id:Number(command.slice(6))},'lever');
      if(!seen.has('attack')){
        const e=v.enemies.find(e=>s.queryContextOffers({type:'world-entity',kind:'enemy',id:e.id}).some(o=>o.command==='attack'&&o.status==='enabled'));
        if(e)add('attack','attack',{type:'world-entity',kind:'enemy',id:e.id});
      }
      if(command==='down')add('ladder',command,{type:'world-entity',kind:'ladder',id:v.player.floor*v.map.width+v.player.x},'down');
      const door=v.alpha!.doors.find(d=>d.open&&d.floor===v.player.floor&&Math.abs(d.x-v.player.x)===1&&!v.enemies.some(e=>e.x===d.x&&e.floor===d.floor));
      if(door)add('closeDoor',`door:${door.id}`,{type:'world-entity',kind:'door',id:door.id});
      for(const f of v.alpha2!.facilities.filter(f=>f.near)){
        const target:TargetRef={type:'world-entity',kind:'facility',id:f.id};
        for(const offer of s.queryContextOffers(target).filter(o=>o.status==='enabled'&&o.command)){
          const name=offer.actionId==='drink'?'fountain':offer.actionId==='pay'?'paidChest':offer.actionId==='force'?'forcedChest':offer.actionId.startsWith('buy:')?'merchant':undefined;
          if(name)add(name,offer.command!,target,offer.actionId);
        }
      }
    }
    if(!s.submit(command).accepted)throw new Error(`Natural prefix failed ${command}`);
  }
  return out;
}
export function directItemCases(){
  const cases=itemActionCases();return [...cases,...itemTargetCases(cases)].map(c=>{
    const s=alpha3Prefix(c.before),v=s.view(),before=s.capture();let command=c.command;
    if(c.motion==='throw'){
      const id=Number(command.split(':')[2]),target=s.queryTargets(id,'throw').filter(t=>t.status==='enabled'&&t.ref.type==='world-cell'&&!v.alpha2!.ground.some(i=>i.floor===t.position?.floor&&i.x===t.position.x)).sort((a,b)=>Math.abs(a.position!.x-v.player.x)-Math.abs(b.position!.x-v.player.x))[0];
      if(!target?.command)throw new Error('No natural ground throw');command=target.command;
    }
    const source=command.startsWith('unequip:')?v.alpha2!.bag.find(i=>i.equipped===command.slice(8)):command==='potion'?v.alpha2!.bag.find(i=>i.definition==='renewal'):v.alpha2!.bag.find(i=>i.id===Number(command.split(':')[command.startsWith('wear:')?1:2]));
    if(command==='potion'&&source)command=`a2:use:${source.id}:drink:self`;
    if(!source||!s.submit(command).accepted)throw new Error(`Natural item case ${c.name}`);
    return {...c,before,after:s.capture(),command,sourceId:source.id};
  });
}
