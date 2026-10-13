import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import * as T from 'three';
import { GameSession } from '../../src/session/session';
import { parseRig } from '../../src/character-lab/assets';
import { BlockCharacter } from '../../src/character-lab/character';
import { interactionReceipt,MOTION_PROFILE,motionStage } from '../../src/visual/motions/receipt';
import { sampleItemAction } from '../../src/visual/motions/item-action';
import { poseInteraction } from '../../src/visual/motions/pose';
import type { Command } from '../../src/core/types';
import { resolveItemVisual } from '../../src/visual/items/appearance-resolver';
import { floorY } from '../../src/room/presentation';
import { itemActionCases } from '../m18-trace';

const rig=parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8')));
describe('M18 public item action presentation',()=>{
  it('uses accepted natural branches, preserves archives and contact sockets in both directions',()=>{
    const cases=itemActionCases();
    expect(cases.map(c=>c.motion).sort()).toEqual(['apply','drink','eat','equip','read','throw','unequip','zap'].sort());
    const actor=new BlockCharacter(rig), prop=new T.Group();
    for(const c of cases){
      const session=GameSession.fromArchive(c.before), before=session.view();
      expect(session.submit(c.command).accepted).toBe(true);
      const after=session.view(), receipt=interactionReceipt(before,after,c.command)!;
      expect(session.capture()).toBe(c.after);
      const spec=resolveItemVisual(receipt.item!);expect(spec.status).toBe('ready');
      expect(receipt.item).toEqual(before.alpha2!.bag.find(i=>i.id===receipt.item!.id));
      const p=MOTION_PROFILE[receipt.motion];
      expect([0,p.contact,p.effect,p.recover].map(phase=>motionStage(receipt.motion,phase))).toEqual(['prepare','contact','effect','recover']);
      for(const face of [-1,1])for(const phase of [p.contact,p.effect-.001]){
        actor.root.position.set(before.player.x,floorY(before.player.floor),.14);actor.root.rotation.set(0,face*Math.PI/2,0);actor.sample('idle',0);
        const target=new T.Vector3(receipt.target.x,floorY(receipt.target.floor)+1.15,.14);
        const sample=sampleItemAction(actor,prop,spec,receipt,phase,target);
        expect(sample.error,`${c.name}/${face}/${phase}`).toBeLessThan(.08);
        if(sample.mouthError!==undefined)expect(sample.mouthError,`${c.name}/mouth`).toBeLessThan(.01);
        if(sample.applicationError!==undefined)expect(sample.applicationError,`${c.name}/application`).toBeLessThan(.01);
      }
      expect(session.capture()).toBe(c.after);
      expect(interactionReceipt(after,after,c.command)).toBeNull();
    }
    actor.dispose();
  },60000);
  it('applies to the actual public target item with both hands, preserving rejection and full archives',()=>{
    const c=itemActionCases().find(c=>c.motion==='apply')!, actor=new BlockCharacter(rig);
    let accepted=0;
    const source=GameSession.fromArchive(c.before), sourceItem=Number(c.command.split(':')[2]);
    for(const item of source.view().alpha2!.bag){
      const session=GameSession.fromArchive(c.before),before=session.view(),command=`a2:use:${sourceItem}:apply:i${item.id}` as const;
      const result=session.submit(command),after=session.view(),receipt=interactionReceipt(before,after,command);
      if(!result.accepted){expect(receipt).toBeNull();expect(session.capture()).toBe(c.before);continue;}
      accepted++;expect(receipt!.targetItem).toEqual(item);
      const prop=new T.Group(),targetProp=new T.Group(),spec=resolveItemVisual(receipt!.item!),targetSpec=resolveItemVisual(item),archive=session.capture();
      for(const face of [-1,1])for(const phase of [.38,.5,.65]){
        actor.sample('idle',0);actor.root.position.set(before.player.x,floorY(before.player.floor),.14);actor.root.rotation.set(0,face*Math.PI/2,0);
        const sample=sampleItemAction(actor,prop,spec,receipt!,phase,new T.Vector3(),{prop:targetProp,spec:targetSpec});
        expect(sample.error,`${item.id}/${face}/${phase}`).toBeLessThan(.08);expect(sample.applicationError).toBeLessThan(.01);
      }
      expect(session.capture()).toBe(archive);
    }
    expect(accepted).toBeGreaterThan(0);actor.dispose();
  },60000);
  it('contacts a public environmental target through an accepted natural application branch',()=>{
    const c=itemActionCases().find(c=>c.motion==='throw')!,session=GameSession.fromArchive(c.before),before=session.view();
    const command=c.command.replace(':throw:',':apply:') as Command;
    expect(session.submit(command).accepted).toBe(true);
    const receipt=interactionReceipt(before,session.view(),command)!,spec=resolveItemVisual(receipt.item!),actor=new BlockCharacter(rig),prop=new T.Group();
    const archive=session.capture();
    for(const face of [-1,1]){
      actor.sample('idle',0);actor.root.position.set(receipt.target.x-face*.68,floorY(before.player.floor),.14);actor.root.rotation.set(0,face*Math.PI/2,0);
      const target=new T.Vector3(receipt.target.x,floorY(receipt.target.floor)+.52,.14);
      poseInteraction(actor,'chestOpen',.5,target);
      const sample=sampleItemAction(actor,prop,spec,receipt,.5,target);
      expect(sample.error,`facility/${face}/player ${before.player.x}/target ${receipt.target.x}`).toBeLessThan(.08);expect(sample.applicationError).toBeLessThan(.01);
    }
    expect(session.capture()).toBe(archive);actor.dispose();
  },60000);
});
