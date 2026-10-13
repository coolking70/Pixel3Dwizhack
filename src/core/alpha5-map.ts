import { REGIONS5,MONSTERS5,ITEMS5 } from '../content/alpha5-catalog';
import type { World } from './types';

/** An optional, visible one-cell hazard. Walking/disarming remain valid routes. */
export function generateRegions5(w:World):void {
  const s=w.alpha2!;
  // Reserve the short teaching lane without creating a gap or platform.
  for(const e of w.enemies.filter(e=>e.floor===0&&e.x<=9)) {
    const x=Array.from({length:15},(_,n)=>n+12).find(x=>!w.enemies.some(other=>other.id!==e.id&&other.floor===0&&other.x===x)&&!s.doors.some(d=>d.floor===0&&d.x===x));
    if(x!==undefined)e.x=x;
  }
  const trap=s.facilities.find(f=>f.floor===0&&f.kind==='trap');
  if(trap){trap.x=7;trap.revealed=true;}else s.facilities.push({id:s.facilities.length+1,kind:'trap',x:7,floor:0,used:false,revealed:true,stock:[],gold:0});
  const reward=s.items.find(i=>i.owner==='ground'&&i.position.floor===0&&i.definition!=='renewal'&&i.position.x!==3);
  if(reward)reward.position={floor:0,x:8};
  for(let floor=0;floor<6;floor++){
    const region=REGIONS5[floor<3?0:1]!,definition=MONSTERS5.find(m=>m.id===region.monster)!;
    const enemy=w.enemies.find(e=>e.floor===floor&&!e.elite&&s.monsters.find(m=>m.id===e.id)?.definition!=='crawler');
    const free=(x:number)=>!s.facilities.some(f=>f.floor===floor&&f.x===x)&&!s.doors.some(d=>d.floor===floor&&d.x===x)&&!s.links.some(l=>(l.floor===floor||l.floor+1===floor)&&l.x===x);
    const cell=[18,19,20,21,22].find(free);
    if(cell===undefined)throw Error('Alpha5 reserved ecology cells unavailable');
    s.facilities.push({id:s.facilities.length+1,kind:region.feature,floor,x:cell,used:false,revealed:true,stock:[],gold:0});
    if(enemy){
      s.monsters.find(m=>m.id===enemy.id)!.definition=definition.id;
      Object.assign(enemy,{kind:definition.kind,hp:definition.hp,maxHp:definition.hp,damage:definition.damage,armor:definition.armor,period:definition.period,nextAt:definition.period,venom:definition.inflict==='poison'});
      const beside=[cell-1,cell+1].find(x=>free(x)&&!w.enemies.some(e=>e.id!==enemy.id&&e.floor===floor&&e.x===x));if(beside!==undefined)enemy.x=beside;
    }
    // Substitute one budgeted resource, retaining owner/holder/ID. No extra loot roll
    // and no additional loose pile are introduced by the ecology package.
    const supply=s.items.find(i=>(i.owner==='ground'||i.owner==='container')&&i.position.floor===floor&&!['renewal','ration'].includes(i.definition)&&!(floor===0&&[3,8].includes(i.position.x)));
    if(supply){supply.definition=region.item;supply.charges=ITEMS5.find(i=>i.id===region.item)!.charges!;supply.freshUntil=0;}
    if(floor>=3){const barrier=[9,8,11,12,13,15,16,17,23,24,25,27].find(x=>free(x)&&!w.enemies.some(e=>e.floor===floor&&e.x===x));if(barrier!==undefined)s.facilities.push({id:s.facilities.length+1,kind:'barricade',floor,x:barrier,used:false,revealed:true,stock:[],gold:0});}
    for(const segment of s.segments.filter(g=>g.floor===floor&&g.tag!=='merchant'&&g.tag!=='sanctuary'))segment.tag=floor<3?'fungal':'mine';
  }
}
