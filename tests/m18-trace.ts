import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import type { Command } from '../src/core/types';
import { interactionReceipt, isItemMotion } from '../src/visual/motions/receipt';
import type { InteractionCase } from './m16-trace';

/** Natural golden prefixes and accepted branches; never injects inventory/state. */
export function itemActionCases(): InteractionCase[] {
  const golden=JSON.parse(readFileSync('tests/fixtures/alpha2-v1.json','utf8')) as {seed:number;history:{command:Command}[]};
  const session=new GameSession(golden.seed,'alpha2'), cases:InteractionCase[]=[], seen=new Set<string>();
  const add=(command:Command, source=session):void=>{
    const before=source.capture(), clone=GameSession.fromArchive(before), view=clone.view();
    if(!clone.submit(command).accepted)return;
    const receipt=interactionReceipt(view,clone.view(),command);
    if(!receipt||!isItemMotion(receipt.motion)||seen.has(receipt.motion))return;
    seen.add(receipt.motion);cases.push({name:receipt.motion,motion:receipt.motion,command,before,after:clone.capture()});
  };
  for(const {command} of golden.history){
    const view=session.view();
    if(!seen.has('equip'))for(const item of view.alpha2!.bag.filter(i=>!i.equipped&&i.actions.includes('equip')))add(`wear:${item.id}`);
    if(!seen.has('unequip')||!seen.has('equip')){
      const item=view.alpha2!.bag.find(i=>i.equipped);
      if(item?.equipped){
        add(`unequip:${item.equipped}`);
        const branch=GameSession.fromArchive(session.capture());
        if(branch.submit(`unequip:${item.equipped}`).accepted)add(`wear:${item.id}`,branch);
      }
    }
    if(!seen.has('apply'))for(const item of view.alpha2!.bag.filter(i=>i.actions.includes('apply')))for(const target of view.alpha2!.targets)add(`a2:use:${item.id}:apply:${target.key}` as Command);
    if(/^(a2:use:|potion$)/.test(command))add(command);
    session.submit(command);
  }
  return cases;
}

/** Distinct public targets supplement the eight action semantics. */
export function itemTargetCases(cases=itemActionCases()): InteractionCase[] {
  const result:InteractionCase[]=[];
  for(const motion of ['read','apply'] as const){
    const source=cases.find(c=>c.motion===motion)!;
    for(const item of GameSession.fromArchive(source.before).view().alpha2!.bag){
      const session=GameSession.fromArchive(source.before),command=`a2:use:${source.command.split(':')[2]}:${motion}:i${item.id}` as Command;
      if(session.submit(command).accepted){result.push({name:`${motion}Item`,motion,command,before:source.before,after:session.capture()});break;}
    }
  }
  const source=cases.find(c=>c.motion==='throw')!,session=GameSession.fromArchive(source.before),command=source.command.replace(':throw:',':apply:') as Command;
  if(session.submit(command).accepted)result.push({name:'applyEnvironment',motion:'apply',command,before:source.before,after:session.capture()});
  return result;
}
