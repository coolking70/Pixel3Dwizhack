import * as T from 'three';
import { CharacterStudy } from '../character-lab/scene';
import { EnemyActor } from '../room/enemy-actor';
import type { CharacterOptions, RigData } from '../character-lab/types';
import { CONTACT } from '../room/combat-timeline';
export interface Inspection extends CharacterOptions { phase: number; face: number; enemy: 'guard' | 'crawler'; action: 'strike' | 'incoming' | 'walk' | 'death'; monochrome: boolean }
export class CombatStudy {
  readonly stage: CharacterStudy;
  private enemy: EnemyActor;
  private equipmentKey = '';
  private flash = new T.Mesh(new T.OctahedronGeometry(.1), new T.MeshBasicMaterial({color:0xffdf9a}));
  constructor(readonly canvas: HTMLCanvasElement, private rig: RigData, failed: () => void) {
    this.stage = new CharacterStudy(canvas, rig, failed);
    this.stage.update({outfit:'cloth',helmet:false,sword:true,shield:false,motion:'idle',phase:0,angle:90,compare:true,monochrome:false,pixelHeight:0});
    this.stage.characters[1]!.root.visible = false;
    this.enemy = new EnemyActor('guard',rig); this.stage.scene.add(this.enemy.root, this.flash);
  }
  update(o: Inspection): void {
    const actor=this.stage.characters[0]!, key=JSON.stringify([o.model,o.outfit,o.weaponStyle,o.helmet,o.shield]);
    if(key!==this.equipmentKey){actor.setEquipment({...o,headStyle:o.outfit==='brigandine'?'leather':o.outfit,legsStyle:o.outfit==='brigandine'?'leather':o.outfit});this.equipmentKey=key;}
    if(this.enemy.kind!==o.enemy){this.enemy.dispose();this.enemy=new EnemyActor(o.enemy,this.rig);this.stage.scene.add(this.enemy.root);}
    actor.root.position.set(-.72*o.face,0,0);actor.root.rotation.set(0,o.face*Math.PI/2,0);
    this.enemy.root.position.set(.72*o.face,0,0);
    actor.setMonochrome(o.monochrome);this.enemy.humanoid?.setMonochrome(o.monochrome);
    const p=o.phase, impact=p>=CONTACT, reaction=(p-CONTACT)/(1-CONTACT);
    if(o.action==='walk')actor.sampleWalk(p);else actor.sample('idle',0);
    if(o.action==='strike')actor.sampleStrike(p,false,o.enemy==='crawler'?.55:1.2);
    if(o.action==='incoming'&&impact){actor.bone('Chest').rotation.x-=Math.sin(reaction*Math.PI)*.2;actor.root.position.x-=o.face*Math.sin(reaction*Math.PI)*.1;}
    if(o.action==='death')actor.root.rotation.z=-o.face*T.MathUtils.smoothstep(p,0,1)*1.45;
    this.enemy.sample(o.action==='incoming'?'attack':o.action==='strike'&&impact?'hurt':o.action==='walk'?'walk':o.action==='death'?'death':'idle',o.action==='strike'?Math.max(0,reaction):p,-o.face,1);
    this.flash.visible=(o.action==='strike'||o.action==='incoming')&&impact&&p<.66;
    this.flash.position.set((o.action==='strike'?.72:-.72)*o.face,o.action==='strike'&&o.enemy==='crawler'?.5:1.2,.9);
    this.flash.scale.setScalar(1+(p-CONTACT)*4);
    this.stage.render();
    Object.assign(this.canvas.dataset,{phase:String(p),action:o.action,weapon:o.weaponStyle??'sword',model:o.model??'classic',impact:String(this.flash.visible),gripError:String(actor.gripErrors().sword)});
  }
  dispose():void{this.enemy.dispose();this.stage.dispose();}
}
