import {createAlpha5,acceptAlpha5,inspectAlpha5,isAlpha5Command} from './alpha5';
import {ITEMS6,MONSTERS6,REGION6} from '../content/alpha6-catalog';
import {advance2} from './alpha2-clock';
import {condition2,near2,line2,log2,reveal2} from './alpha2-shared';
import {releaseEnemyLoot4} from './alpha4-map';
import type {World,Command,Outcome,PublicView} from './types';
export function isAlpha6Command(v:unknown):v is Command{return isAlpha5Command(v)||typeof v==='string'&&/^a6:feature:[1-9]\d{0,4}:(cover|silence)$/.test(v);}
export function createAlpha6(seed:number):World{
 const w=createAlpha5(seed),s=w.alpha2!;w.scenario='alpha6';w.alpha6={generation:1};
 for(const floor of [4,5]){
  const relay=s.facilities.find(f=>f.floor===floor&&f.kind==='relay')!;relay.kind='emberVent';
  const barrier=s.facilities.find(f=>f.floor===floor&&f.kind==='barricade')!;barrier.kind='boneChime';
  const previous=s.monsters.find(m=>m.definition==='repairSpider'&&w.enemies.find(e=>e.id===m.id)?.floor===floor)!;
  const d=MONSTERS6[floor-4]!;previous.definition=d.id;const e=w.enemies.find(e=>e.id===previous.id)!;
  Object.assign(e,{kind:d.kind,hp:d.hp,maxHp:d.hp,damage:d.damage,armor:d.armor,period:d.period,nextAt:d.period,venom:false});
  if(floor===5){const x=[barrier.x-1,barrier.x+1].find(x=>x>0&&x<29&&!w.enemies.some(o=>o.id!==e.id&&o.floor===floor&&o.x===x)&&!s.doors.some(o=>o.floor===floor&&o.x===x));if(x!==undefined)e.x=x;}
  const supply=s.items.filter(i=>(i.owner==='ground'||i.owner==='container')&&i.position.floor===floor&&!['renewal','ration'].includes(i.definition));
  const defs=floor===4?[ITEMS6[0]!,ITEMS6[1]!]:[ITEMS6[2]!];
  if(supply.length<defs.length)throw Error('Alpha6 resource budget unavailable');
  defs.forEach((d,n)=>{const i=supply[n]!;i.definition=d.id;i.charges=d.charges!;i.freshUntil=0;});
  for(const g of s.segments.filter(g=>g.floor===floor&&g.tag!=='merchant'&&g.tag!=='sanctuary'))g.tag='crypt';
 }
 reveal2(w);return w;
}
export function inspectAlpha6(w:World):PublicView{const v=inspectAlpha5(w);return{...v,alpha6:{generation:1},alpha5:{...v.alpha5!,region:w.player.floor>=4?{id:REGION6.id,name:{...REGION6.name}}:v.alpha5!.region}};}
export function acceptAlpha6(current:World,command:Command):Outcome{
 if(!isAlpha6Command(command))return{accepted:false,reason:'invalid'};
 if(!command.startsWith('a6:feature:'))return acceptAlpha5(current,command);
 if(current.status!=='playing')return{accepted:false,reason:'ended'};
 const [,,id,action]=command.split(':'),f=current.alpha2!.facilities.find(f=>f.id===Number(id));
 if(!f||f.used||!f.revealed||!near2(current,f)||!line2(current,current.player,f)||condition2(current,'sleep')||action!==(f.kind==='emberVent'?'cover':f.kind==='boneChime'?'silence':null))return{accepted:false,reason:'blocked'};
 const w=structuredClone(current);w.beats=[];w.alpha2!.chosen=true;w.alpha2!.facilities.find(g=>g.id===f.id)!.used=true;w.alpha3!.lastThrow=null;w.alpha5!.lastJump=null;
 log2(w,{key:'ecoCleared',target:`facility:${f.kind}`});advance2(w,(f.kind==='emberVent'?24:28)*(condition2(current,'slow')?2:1));releaseEnemyLoot4(w);reveal2(w);w.revision++;
 return{accepted:true,world:w,interrupt:true};
}
