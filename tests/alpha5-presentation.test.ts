import { expect,it } from 'vitest';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { jumpSample,poseJump,nextJumpPhase } from '../src/visual/motions/jump';
import { BlockCharacter } from '../src/character-lab/character';
import { parseRig } from '../src/character-lab/assets';
import { SceneHitTest } from '../src/room/scene-hit-test';
import { GameSession } from '../src/session/session';
import { floorY } from '../src/room/presentation';
it('jump has grounded prepare/contact-air/effect/recover, real knee pose and exact visual endpoints',()=>{
 const rig=parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8'))),actor=new BlockCharacter(rig);
 expect(jumpSample(0)).toMatchObject({travel:0,height:0,stage:'prepare'});expect(jumpSample(.5).height).toBeGreaterThan(1);expect(jumpSample(.8).stage).toBe('effect');expect(jumpSample(.95).stage).toBe('recover');expect(jumpSample(1).travel).toBe(1);expect(jumpSample(1).height).toBeCloseTo(0);
 poseJump(actor,0);const before=actor.bone('ShinL').quaternion.clone();poseJump(actor,.5);expect(before.angleTo(actor.bone('ShinL').quaternion)).toBeGreaterThan(.7);actor.dispose();
});
it('air targets are separate from ground and are absent on old Alpha4',()=>{
 const s=new GameSession(1,'alpha5'),v=s.view(),camera=new T.OrthographicCamera(-5,5,3,-3,.1,70),rect={left:0,top:0,width:1000,height:600};camera.position.set(5,4.4,15);camera.lookAt(5,4.4,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const hit=new SceneHitTest(camera,()=>rect,()=>v),point=(x:number,y:number)=>{const p=new T.Vector3(x,y,.2).project(camera);return{x:(p.x+1)*500,y:(1-p.y)*300};};
 const air=point(3,floorY(0)+1.6),ground=point(3,floorY(0)+.03);expect(hit.hitCandidates(air.x,air.y).jump).toEqual({x:3,floor:0});expect(hit.hitCandidates(ground.x,ground.y).jump).toBeUndefined();
 delete v.alpha5;expect(hit.hitCandidates(air.x,air.y).jump).toBeUndefined();
});
it('four seeded teaching lanes provide a visible hazard, a valid jump and non-jump disarm path',()=>{
 for(const seed of [1,2,42,24681]){
  const s=new GameSession(seed,'alpha5');s.submit('choose:vanguard');for(let i=0;i<4;i++)expect(s.submit('right').accepted).toBe(true);
  const trap=s.view().alpha2!.facilities.find(f=>f.kind==='trap'&&f.x===7)!;expect(trap).toBeTruthy();expect(s.queryJumpTargets().find(t=>t.position.x===8)?.status).toBe('enabled');
  expect(s.submit(`a2:feature:${trap.id}:disarm`).accepted).toBe(true);expect(s.submit('right').accepted).toBe(true);expect(s.view().player.x).toBe(7);
 }
});

it('slow display frames preserve the apex and recover without advancing a rule clock',()=>{let p=0;const seen=[];while(p<1){p=nextJumpPhase(p,1);seen.push(jumpSample(p));}expect(seen.some(s=>s.height>1)).toBe(true);expect(seen.some(s=>s.stage==='recover')).toBe(true);expect(seen.length).toBeLessThanOrEqual(11);});
