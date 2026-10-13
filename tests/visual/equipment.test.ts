import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { BlockCharacter } from '../../src/character-lab/character';
import { parseRig } from '../../src/character-lab/assets';
import { GameSession } from '../../src/session/session';
import { ItemEquipment } from '../../src/visual/items/equipment';
import { createItemModelCache } from '../../src/visual/items/presenter';
import { resolveItemVisual } from '../../src/visual/items/appearance-resolver';
const rig=parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8')));
describe('shared item equipment lifecycle',()=>{
  it('keeps the GLB shield on the back for bow poses and in the hand for a sword',async()=>{
    const view=new GameSession(42,'alpha2').view(),shield=view.alpha2!.bag.find(i=>i.equipped==='offHand')!;
    const cache=createItemModelCache(async()=>new T.Group());await cache.preload([resolveItemVisual(shield)]);
    const actor=new BlockCharacter(rig),equipment=new ItemEquipment(actor,()=>{},cache);
    const main=view.alpha2!.bag.find(i=>i.equipped==='mainHand')!;
    for(const side of [-1,1])for(const phase of [0,.5,1]){
      actor.setEquipment({outfit:'cloth',helmet:false,sword:true,shield:true,weaponVariant:'bow'});actor.root.rotation.y=side*Math.PI/2;
      equipment.update([{...main,definition:'bow'},shield]);actor.sampleBow(phase);equipment.sample();
      expect(actor.backShield.children.some(o=>o.userData.itemAsset)).toBe(true);
      expect(actor.leftGrip.children.some(o=>o.userData.itemAsset)).toBe(false);
    }
    equipment.update([main,shield]);actor.setEquipment({outfit:'cloth',helmet:false,sword:true,shield:true});actor.sample('idle',0);equipment.sample();
    expect(actor.leftGrip.children.some(o=>o.userData.itemAsset)).toBe(true);
    equipment.sample(true);expect(actor.backShield.children.some(o=>o.userData.itemAsset)).toBe(true);
    equipment.dispose();actor.dispose();
  });
  it('a late model completion cannot reattach removed equipment or redraw a disposed actor',async()=>{
    const item=new GameSession(42,'alpha2').view().alpha2!.bag.find(i=>i.equipped==='mainHand')!;
    let resolve!:(root:T.Group)=>void,redraw=0;
    const cache=createItemModelCache(()=>new Promise<T.Group>(r=>{resolve=r;}));
    const actor=new BlockCharacter(rig),equipment=new ItemEquipment(actor,()=>{redraw++;},cache);
    equipment.update([item]);equipment.update([]);equipment.dispose();actor.dispose();resolve(new T.Group());
    await new Promise(r=>setTimeout(r,0));expect(redraw).toBe(0);expect(cache.size).toBe(0);
  });
});
