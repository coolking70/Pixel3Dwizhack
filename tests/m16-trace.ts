import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import type { Command } from '../src/core/types';
import { interactionReceipt } from '../src/visual/motions/receipt';
export { GameSession };
export interface InteractionCase { name: string; before: string; after: string; command: Command; motion: string }
/** Every checkpoint is a prefix/branch of the public-command M15 natural run. */
export function interactionCases(): InteractionCase[] {
  const golden = JSON.parse(readFileSync('tests/fixtures/alpha2-v1.json','utf8')) as {seed:number;history:{command:Command}[]};
  const session = new GameSession(golden.seed,'alpha2'), cases:InteractionCase[]=[],seen=new Set<string>();
  const add=(s:GameSession,command:Command,name?:string)=>{
    if(!/^(take:|door:|lever:|a2:feature:|interact$)/.test(command))return;
    if(command.startsWith('take:')&&seen.has('pickupLow')||command.startsWith('lever:')&&seen.has('leverPull')||command.startsWith('door:')&&!name&&seen.has('doorPush')&&seen.has('doorPull'))return;
    const before=s.capture(),a=s.view(),clone=GameSession.fromArchive(before);
    if(!clone.submit(command).accepted)return;
    const receipt=interactionReceipt(a,clone.view(),command);if(!receipt)return;
    const key=name??receipt.motion;if(seen.has(key))return;seen.add(key);
    cases.push({name:key,before,after:clone.capture(),command,motion:receipt.motion});
  };
  for(const {command} of golden.history){
    const v=session.view();
    if(!seen.has('chestOpen')){const chest=v.alpha2!.facilities.find(f=>f.near&&f.kind==='chest'&&!f.used);if(chest&&v.player.hp>7)add(session,`a2:feature:${chest.id}:force`);}
    add(session,command);session.submit(command);
    const now=session.view();
    if(!seen.has('doorClose')){const door=now.alpha!.doors.find(d=>d.open&&d.floor===now.player.floor&&Math.abs(d.x-now.player.x)===1);if(door)add(session,`door:${door.id}`,'doorClose');}
  }
  return cases;
}
