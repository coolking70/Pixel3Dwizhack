import * as T from 'three';
import {expect,it} from 'vitest';
import {SceneHitTest} from '../src/room/scene-hit-test';
import {floorY} from '../src/room/presentation';
import {GameSession} from '../src/session/session';

it.each([[1440,900],[844,390],[390,844]])('actual orthographic CSS projection hits public entities before ground at %ix%i',(width,height)=>{
 const v=structuredClone(new GameSession(42,'alpha2').view());v.player.x=3;v.enemies=[{id:901,x:5,floor:0,hp:5,maxHp:5,period:10,nextAt:10}];v.alpha!.doors=[];v.alpha2!.facilities=[];v.alpha2!.ground=[];v.map.ladders=[];v.explored[0]=[1,2,3,4,5,6,7];
 const camera=new T.OrthographicCamera(-5,5,5*height/width,-5*height/width,.1,70);camera.position.set(5.65,floorY(0)+2.2,15);camera.lookAt(5,floorY(0)+1.15,0);camera.updateProjectionMatrix();
 const hit=new SceneHitTest(camera,()=>({left:63,top:41,width,height}),()=>v),ref={type:'world-entity',kind:'enemy',id:901} as const,p=hit.worldScreenPoint(ref)!;expect(p).not.toBeNull();expect(hit.hitTest(p.x,p.y)?.ref).toEqual(ref);
 const cell={type:'world-cell',x:4,floor:0} as const,ground=hit.worldScreenPoint(cell)!;expect(hit.hitTest(ground.x,ground.y)?.ref).toEqual(cell);expect(hit.hitTest(62,42)).toBeNull();expect(hit.worldScreenPoint({type:'world-cell',x:20,floor:0})).toBeNull();
 const before=JSON.stringify(v);for(let i=0;i<30;i++)hit.hitTest(p.x,p.y);expect(JSON.stringify(v)).toBe(before);
});
it('unexplored, fog-occluded and off-floor public remembered entities have no hit proxy',()=>{
 const v=structuredClone(new GameSession(42,'alpha2').view());v.player.x=2;v.explored[0]=[1,2,3,4,5,6];v.alpha!.doors=[{id:1,floor:0,x:3,open:false,locked:false}];v.enemies=[{id:9,floor:0,x:5,hp:10,maxHp:10,period:10,nextAt:10}];
 const camera=new T.OrthographicCamera(-5,5,5,-5,.1,70);camera.position.set(5,5,15);camera.lookAt(5,5,0);camera.updateProjectionMatrix();const hit=new SceneHitTest(camera,()=>({left:0,top:0,width:800,height:800}),()=>v);
 expect(hit.worldScreenPoint({type:'world-entity',kind:'enemy',id:9})).toBeNull();v.alpha!.doors[0]!.open=true;expect(hit.worldScreenPoint({type:'world-entity',kind:'enemy',id:9})).not.toBeNull();v.explored[0]=[1,2,3];expect(hit.worldScreenPoint({type:'world-entity',kind:'enemy',id:9})).toBeNull();
});
it('relic and ladder ids are stable public refs, never bag item aliases',()=>{
 const v=structuredClone(new GameSession(42,'alpha2').view());v.player.x=2;v.alpha!.doors=[];v.alpha2!.ground=[];v.enemies=[];v.alpha2!.facilities=[];v.map.ladders=[{floor:0,x:4}];v.loot=[{id:9999,x:3,floor:0,kind:'relic',amount:1,taken:false}];v.explored[0]=[1,2,3,4,5];
 const camera=new T.OrthographicCamera(-5,5,5,-5,.1,70);camera.position.set(4,5,15);camera.lookAt(4,5,0);camera.updateProjectionMatrix();const hit=new SceneHitTest(camera,()=>({left:0,top:0,width:800,height:800}),()=>v);
 for(const ref of [{type:'world-entity',kind:'relic',id:9999},{type:'world-entity',kind:'ladder',id:4}] as const){const p=hit.worldScreenPoint(ref)!;expect(hit.hitTest(p.x,p.y)?.ref).toEqual(ref);}
 expect(hit.worldScreenPoint({type:'world-entity',kind:'ground-item',id:9999})).toBeNull();
});
