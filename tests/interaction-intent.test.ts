import {describe,expect,it} from 'vitest';
import {IntentExecutor,nextStep,ladderId} from '../src/interaction/intent';
import type {Command,PublicView} from '../src/core/types';
import type {PublicActionOffer,TargetRef} from '../src/core/action-types';
import {GameSession,runAlpha2} from './alpha2-route';

function controlled(){
 const v:PublicView=structuredClone(new GameSession(42,'alpha2').view());v.player.x=2;v.enemies=[];v.alpha2!.conditions=[];v.alpha2!.facilities=[];v.alpha2!.ground=[];v.alpha!.doors=[];v.map.ladders=[{floor:0,x:6}];v.explored=v.explored.map(()=>Array.from({length:12},(_,i)=>i+1));
 let busy=false;const commands:Command[]=[],contexts:TargetRef[]=[];
 const offers=(ref:TargetRef):PublicActionOffer[]=>{
  if(ref.type!=='world-entity')return[];const target=ref.kind==='door'?v.alpha!.doors.find(d=>d.id===ref.id):ref.kind==='enemy'?v.enemies.find(e=>e.id===ref.id):v.alpha2!.ground.find(i=>i.id===ref.id);
  const near=target?.floor===v.player.floor&&Math.abs(target.x-v.player.x)<=1;
  return[{actionId:'test',revision:v.revision,status:near?'enabled':'disabled',targetModes:[],requiresConfirmation:false,command:ref.kind==='door'?`door:${ref.id}`:ref.kind==='enemy'?'attack':`take:${ref.id}`}];
 };
 const executor=new IntentExecutor({view:()=>structuredClone(v),busy:()=>busy,context:r=>contexts.push(r),offers,submit:c=>{commands.push(c);v.tick+=c.startsWith('door:')?8:10;v.revision++;if(c==='right')v.player.x++;if(c==='left')v.player.x--;if(c==='down')v.player.floor++;if(c==='up')v.player.floor--;if(c.startsWith('door:'))v.alpha!.doors.find(d=>d.id===Number(c.slice(5)))!.open=true;busy=true;return{accepted:true,interrupt:false};}});
 return{v,commands,contexts,executor,complete:()=>{busy=false;executor.completed();},idle:()=>{busy=false;}};
}
describe('M22 controlled public projection boundaries',()=>{
 it('opens a door as its own command; released direction cannot walk after completion',()=>{
  const h=controlled();h.v.alpha!.doors=[{id:1,x:3,floor:0,open:false,locked:false}];h.executor.direction('KeyD','right');expect(h.commands).toEqual(['door:1']);expect(h.v.tick).toBe(8);h.executor.release('KeyD');h.complete();expect(h.commands).toEqual(['door:1']);expect(h.v.player.x).toBe(2);expect(h.executor.active).toBeNull();
 });
 it('click path is stepwise and cancellable; new click while busy cannot queue work',()=>{
  const h=controlled();h.v.alpha!.doors=[{id:1,x:3,floor:0,open:false,locked:false}];h.executor.start({type:'move-to',target:{floor:0,x:5}});expect(h.commands).toEqual(['door:1']);h.complete();expect(h.commands).toEqual(['door:1','right']);h.executor.start({type:'move-to',target:{floor:0,x:1}});h.complete();expect(h.commands).toHaveLength(2);
 });
 it('locked doors use cancellable context, never an automatic lever command',()=>{
  const h=controlled();h.v.alpha!.doors=[{id:7,x:3,floor:0,open:false,locked:true}];h.executor.start({type:'move-to',target:{floor:0,x:5}});expect(h.commands).toEqual([]);expect(h.contexts).toEqual([{type:'world-entity',kind:'door',id:7}]);h.complete();expect(h.commands).toEqual([]);
 });
 it('a known ladder route stops after the actual floor transition',()=>{
  const h=controlled();h.executor.start({type:'move-to',target:{floor:1,x:9}});for(let i=0;i<8;i++)h.complete();expect(h.commands).toEqual(['right','right','right','right','down']);expect(h.v.player).toMatchObject({floor:1,x:6});expect(h.executor.active).toBeNull();expect(ladderId(h.v,{floor:0,x:6})).toBe(6);
 });
 it('physical climbing authorizes one known ladder edge into an unexplored floor, never walks to a ladder',()=>{
  const h=controlled();h.v.explored[1]=[];h.executor.direction('KeyS','down');expect(h.commands).toEqual([]);h.v.player.x=6;h.executor.direction('KeyS','down');h.complete();expect(h.commands).toEqual(['down']);expect(h.executor.active).toBeNull();
 });
 it('unknown cells, absent ladders and visible hazards cannot authorize movement',()=>{
  const h=controlled();h.v.explored[0]=[2];expect(nextStep(h.v,{floor:0,x:3})).toBeUndefined();h.executor.start({type:'move-to',target:{floor:0,x:3}});expect(h.commands).toEqual([]);h.v.explored[0]=[1,2,3];h.v.map.ladders=[];expect(nextStep(h.v,{floor:1,x:3})).toBeUndefined();h.v.enemies=[{id:1,floor:0,x:4,hp:10,maxHp:10,period:10,nextAt:10}];h.executor.start({type:'move-to',target:{floor:0,x:3}});expect(h.commands).toEqual([]);
 });
 it('stale revision, explicit cancellation and failed submission stop future commands',()=>{
  const h=controlled();h.executor.start({type:'move-to',target:{floor:0,x:6}});h.v.revision++;h.complete();expect(h.commands).toEqual(['right']);h.executor.cancel();h.complete();expect(h.commands).toHaveLength(1);
  let count=0;const e=new IntentExecutor({view:()=>h.v,busy:()=>false,offers:()=>[],context:()=>{},submit:()=>{count++;return{accepted:false};}});e.start({type:'move-to',target:{floor:0,x:6}});e.completed();expect(count).toBe(1);expect(e.active).toBeNull();
 });
 it('damage, new enemy and condition change interrupt at the committed boundary',()=>{
  for(const change of [(v:PublicView)=>v.player.hp--,(v:PublicView)=>v.enemies.push({id:999,x:10,floor:0,hp:1,maxHp:1,period:10,nextAt:20}),(v:PublicView)=>v.alpha2!.conditions.push({kind:'poison',actor:0,nextAt:10,power:1,until:99,source:{zh:'测试',en:'test'}})]){
   const h=controlled();let count=0;const e=new IntentExecutor({view:()=>structuredClone(h.v),busy:()=>false,context:()=>{},offers:()=>[],submit:()=>{count++;h.v.revision++;h.v.tick+=10;h.v.player.x++;change(h.v);return{accepted:true};}});e.start({type:'move-to',target:{floor:0,x:6}});e.completed();expect(count).toBe(1);expect(e.active).toBeNull();
  }
 });
 it('approaches the selected public item, then submits exactly one take',()=>{
  const h=controlled(),item=structuredClone(h.v.alpha2!.bag[0]!);h.v.alpha2!.ground=[{...item,id:77,floor:0,x:5}];h.executor.start({type:'activate',target:{type:'world-entity',kind:'ground-item',id:77}});h.complete();h.complete();h.complete();expect(h.commands).toEqual(['right','right','take:77']);
 });
 it('approaches a selected enemy and attacks it once, without a repeated attack intention',()=>{
  const h=controlled();h.v.enemies=[{id:77,floor:0,x:5,hp:10,maxHp:10,period:10,nextAt:30}];h.executor.start({type:'activate',target:{type:'world-entity',kind:'enemy',id:77}});h.complete();h.complete();h.complete();expect(h.commands).toEqual(['right','right','attack']);expect(h.executor.active).toBeNull();
 });
 it('never attacks another enemy even if a stale or malformed offer claims it can',()=>{
  const h=controlled();h.v.enemies=[{id:1,floor:0,x:3,hp:10,maxHp:10,period:10,nextAt:20},{id:2,floor:0,x:1,hp:10,maxHp:10,period:10,nextAt:20}];h.executor.start({type:'activate',target:{type:'world-entity',kind:'enemy',id:2}});expect(h.commands).toEqual([]);expect(h.contexts[0]).toEqual({type:'world-entity',kind:'enemy',id:2});
 });
});

it('natural seed42 door boundary keeps exact formal command archive and release semantics',()=>{
 const route=runAlpha2(42,'channeler','items'),at=route.commands.findIndex(c=>c.startsWith('door:'));expect(at).toBeGreaterThan(0);
 const session=new GameSession(42,'alpha2');for(const c of route.commands.slice(0,at))session.submit(c);const before=session.view(),door=before.alpha!.doors.find(d=>`door:${d.id}`===route.commands[at])!;let busy=false;
 const e=new IntentExecutor({view:()=>session.view(),busy:()=>busy,context:()=>{},offers:r=>session.queryContextOffers(r),submit:c=>{const result=session.submit(c);busy=result.accepted;return result;}});
 const dir=door.x>before.player.x?'right':'left';e.direction('physical',dir);e.release('physical');busy=false;e.completed();expect(session.view().tick).toBe(before.tick+8);
 const reference=new GameSession(42,'alpha2');for(const c of route.commands.slice(0,at+1))reference.submit(c);expect(session.capture()).toBe(reference.capture());
});

it('natural first ladder exploration follows the formal down command and stops on the new floor',()=>{
 const route=runAlpha2(42,'channeler','items'),at=route.commands.findIndex(c=>c==='down'),s=new GameSession(42,'alpha2');for(const c of route.commands.slice(0,at))s.submit(c);const before=s.view();expect(before.explored[1]).toEqual([]);let busy=false;
 const e=new IntentExecutor({view:()=>s.view(),busy:()=>busy,context:()=>{},offers:r=>s.queryContextOffers(r),submit:c=>{const result=s.submit(c);busy=result.accepted;return result;}});e.direction('KeyS','down');busy=false;e.completed();expect(s.view().player.floor).toBe(1);expect(e.active).toBeNull();const reference=new GameSession(42,'alpha2');for(const c of route.commands.slice(0,at+1))reference.submit(c);expect(s.capture()).toBe(reference.capture());
});

