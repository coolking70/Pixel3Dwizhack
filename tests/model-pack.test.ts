import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Vector3,Mesh} from 'three';
import {BlockCharacter} from '../src/character-lab/character';
import {parseRig} from '../src/character-lab/assets';
import {parseModelPack,VANGUARD} from '../src/character-lab/model-assets';
import {GameSession} from '../src/session/session';
const rig=()=>parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8')));
it('validates actual mesh, skeleton, mask and grip data before use',()=>{
 expect(VANGUARD.body.length).toBeGreaterThan(20);
 const mutations:((p:typeof VANGUARD)=>unknown)[]=[p=>p.body[0]!.bone='Missing',p=>p.body[0]!.size[0]=Infinity,p=>p.armor.masks.push('unknown'),p=>p.weapons[0]!.grip=[0,0],p=>p.weapons[1]!.id='sword'];
 for(const mutate of mutations) {
  const candidate=structuredClone(VANGUARD);mutate(candidate);expect(()=>parseModelPack(candidate)).toThrow();
 }
 const isolated=parseModelPack(VANGUARD);isolated.body[0]!.position[0]=2;expect(VANGUARD.body[0]!.position[0]).toBe(0);
});
it('loads actual alternate body, armor and both weapons with grips fixed and grounded attack contacts',()=>{
 const actor=new BlockCharacter(rig());const contacts:Vector3[]=[];
 for(const model of ['classic','vanguard'] as const)for(const weaponStyle of ['sword','mace'] as const) {
  actor.setEquipment({model,weaponStyle,outfit:'brigandine',headStyle:'leather',legsStyle:'leather',helmet:false,sword:true,shield:true});
  for(const face of [-1,1])for(const p of [0,.15,.28,.45,.7,1]) {
   actor.root.rotation.y=face*Math.PI/2;actor.sampleStrike(p);
   expect(actor.gripErrors().sword).toBeLessThan(1e-10);
   let lowest=Infinity;actor.root.traverse(o=>{if(o instanceof Mesh&&o.visible&&['FootL','FootR','ToeL','ToeR'].includes(o.parent?.name??'')){const pos=o.geometry.getAttribute('position');for(let i=0;i<pos.count;i++)lowest=Math.min(lowest,actor.root.worldToLocal(o.localToWorld(new Vector3().fromBufferAttribute(pos,i))).y);}});
   expect(Math.abs(lowest)).toBeLessThan(1e-6);
   if(p===.45){const tip=actor.heldWeapon.root.localToWorld(new Vector3(0,.8,0));expect(face*tip.x).toBeGreaterThan(.8);expect(tip.y).toBeGreaterThan(.65);expect(tip.y).toBeLessThan(1.6);if(model==='vanguard'&&face===1)contacts.push(tip);}
  }
 }
 expect(contacts[0]!.distanceTo(contacts[1]!)).toBeGreaterThan(.05);
 actor.dispose();
});
it('repeated asset swaps restore visibility, do not accumulate parts, and replay poses exactly',()=>{
 const actor=new BlockCharacter(rig());const options={model:'vanguard',weaponStyle:'sword',outfit:'brigandine',helmet:false,sword:true,shield:false} as const;
 const visible=()=>{let count=0;actor.root.traverse(o=>{if(o instanceof Mesh&&o.visible)count++;});return count;};
 actor.setEquipment(options);actor.sampleStrike(.45);const first=actor.heldWeapon.root.matrixWorld.toArray(),count=visible();
 for(let i=0;i<20;i++){actor.setEquipment({...options,model:'classic',outfit:'plate'});actor.setEquipment(options);actor.sampleStrike(.45);}
 expect(visible()).toBe(count);expect(actor.heldWeapon.root.matrixWorld.toArray()).toEqual(first);
 actor.setEquipment({...options,model:'classic',outfit:'cloth'});expect(actor.root.getObjectByName('SkinnedUndertunic')!.visible).toBe(true);
 actor.dispose();
});
it('low targets receive a lowered weapon trajectory instead of a chest-height strike',()=>{
 const actor=new BlockCharacter(rig());
 for(const weaponStyle of ['sword','mace'] as const){
  actor.setEquipment({model:'vanguard',weaponStyle,outfit:'leather',helmet:false,sword:true,shield:false});
  actor.root.rotation.y=Math.PI/2;actor.sampleStrike(.45,false,.55);
  const tip=actor.heldWeapon.root.localToWorld(new Vector3(0,.8,0));expect(tip.x).toBeGreaterThan(.8);expect(tip.y).toBeGreaterThan(.2);expect(tip.y,weaponStyle).toBeLessThan(.8);
 }
 actor.dispose();
});
it('plants each stance foot while the character travels, without horizontal foot sliding',()=>{
 const actor=new BlockCharacter(rig());actor.root.rotation.y=Math.PI/2;
 for(const [side,phases] of [['L',[.05,.15,.25]],['R',[.55,.65,.75]]] as const){
  const points=[];for(const p of phases){actor.root.position.x=p;actor.sampleWalk(p);points.push(actor.bone(`Foot${side}`).getWorldPosition(new Vector3()));}
  expect(points[0]!.distanceTo(points[1]!)).toBeLessThan(1e-5);expect(points[1]!.distanceTo(points[2]!)).toBeLessThan(1e-5);
 }
 actor.dispose();
});
it('preserves the frozen M06 complete natural expedition archive byte-for-byte',()=>{
 const raw=readFileSync('tests/fixtures/expedition-v1.json','utf8').trim();const session=GameSession.fromArchive(raw);
 expect(session.length).toBe(341);expect(session.view().status).toBe('won');expect(session.capture()).toBe(raw);
});
