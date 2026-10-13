import {ALPHA as C} from '../content/alpha';
import {generateExpedition,roll} from './expedition-map';
import type {World,Enemy,GearId} from './types';
import type {ExpeditionState} from './expedition-types';
export {roll} from './expedition-map';
export function generateAlpha(w:World):ExpeditionState{
 const s=generateExpedition(w);
 const links=Array.from({length:C.floors-1},(_,floor)=>[{floor,x:5+roll(w)%3},{floor,x:18+roll(w)%3}]).flat();
 w.alpha={loadout:'vanguard',chosen:false,mana:C.mana,manaAt:C.manaPeriod,links,doors:[],levers:[],caches:[]};
 for(const slot of ['chest','mainHand','offHand'] as const)s.items.find(i=>i.id===s.equipped[slot])!.gear=C.loadouts.vanguard[slot];
 s.map.ladders=links.filter((_,i)=>i%2===0).map(l=>l.x);
 s.map.relic={floor:5,x:23};s.items.find(i=>i.kind==='relic')!.position={...s.map.relic};
 w.enemies=[];
 const enemy=(floor:number,x:number,kind:NonNullable<Enemy['kind']>,elite=false)=>{
  const hp=elite?70:kind==='guard'?30+floor*3:kind==='hexer'?22+floor*2:18+floor*2;
  const period=kind==='skirmisher'?24:kind==='hexer'?30:kind==='guard'?32:26;
  w.enemies.push({id:w.enemies.length+1,floor,x,kind,hp,maxHp:hp,period,nextAt:period,damage:elite?15:kind==='guard'?10+floor:kind==='hexer'?9+floor:6+Math.floor(floor/2),armor:kind==='guard'?elite?5:3:kind==='crawler'?1:0,elite,venom:kind==='crawler'&&floor>2});
 };
 enemy(0,10,'crawler');
 for(let floor=1;floor<5;floor++){
  const left=roll(w)%2===0;
  enemy(floor,left?9:21,floor%2?'skirmisher':'guard');enemy(floor,left?21:4,'hexer');
  const locked=roll(w)%2===0;
  w.alpha.doors.push({id:floor,x:12,floor,open:false,locked});
  w.alpha.levers.push({id:floor,x:left?22:3,floor,door:floor,used:false});
  // New rewards already have identities. Opening moves them from spent to
  // ground; a full backpack cannot swallow or duplicate a cache reward.
  const rewards:number[]=[];
  const reward=(kind:'gear'|'flask',gear?:GearId)=>{const id=s.items.length+1;s.items.push({id,kind,quality:kind==='gear'?1:0,owner:'spent',position:{floor,x:left?3:22},...(gear?{gear}:{effect:'healing' as const})});rewards.push(id);};
  reward('flask');reward('gear',(['brigandine','wand','mace','towerShield'] as GearId[])[floor-1]);
  w.alpha.caches.push({id:floor,floor,x:left?3:22,used:false,rewards});
 }
 enemy(5,20,'guard',true);enemy(5,9,'crawler');
 for(const item of s.items.filter(i=>i.owner==='ground'&&i.kind!=='relic')){
  if(item.effect==='healing')item.position.x=item.position.floor?links.find(l=>l.floor===item.position.floor-1)!.x:3;
  else if(item.gear)item.position.x=roll(w)%2?3:22;
 }
 return s;
}
