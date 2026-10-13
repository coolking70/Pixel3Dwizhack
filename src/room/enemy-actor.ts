import * as T from 'three';
import type { RigData } from '../character-lab/types';
import { BlockCharacter } from '../character-lab/character';
import { RAISED_CHOP } from './combat-timeline';

export type EnemyPose = 'idle' | 'walk' | 'windup' | 'attack' | 'hurt' | 'death';
// Retained actor: poses mutate joints, never rebuild geometry or touch rules.
export class EnemyActor {
  readonly root = new T.Group();
  readonly body = new T.Group();
  readonly legs: T.Bone[] = [];
  readonly jaw = new T.Bone();
  readonly humanoid?: BlockCharacter;
  private health: T.Mesh;
  private materials: T.MeshStandardMaterial[] = [];
  constructor(readonly kind: 'crawler' | 'guard' | 'hexer' | 'skirmisher', rig: RigData, readonly elite = false,readonly skin?:{id:string;color:number;scale:number}) {
    this.root.add(this.body);
    const material = (color: number, metalness = 0) => { const m = new T.MeshStandardMaterial({ color, metalness, roughness: .7, flatShading: true }); this.materials.push(m); return m; };
    const shell = material(skin?.color ?? (elite ? 0x786249 : 0x6a7870), .25), dark = material(0x30352f), gold = material(0xc0a774, .4), eye = material(0xeb9d55);
    const box = (parent: T.Object3D, size: number[], p: number[], m: T.Material) => { const mesh = new T.Mesh(new T.BoxGeometry(...size as [number, number, number]), m); mesh.position.fromArray(p); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    if (kind !== 'crawler') {
      this.humanoid = new BlockCharacter(rig);
      this.humanoid.setEquipment({ outfit: kind === 'guard' ? 'plate' : kind === 'hexer' ? 'cloth' : 'brigandine', helmet: kind === 'guard', sword: true, shield: false, weaponStyle: kind === 'hexer' ? 'wand' : kind === 'skirmisher' ? 'sword' : 'mace' });
      if (kind === 'hexer') { box(this.humanoid.bone('Head'),[.49,.40,.43],[0,.34,-.03],material(0x544371)); box(this.humanoid.bone('Head'),[.31,.15,.04],[0,.28,.20],dark); }
      this.humanoid.setTextured(true); this.humanoid.root.scale.setScalar(elite ? 1.14 : 1.02); this.body.add(this.humanoid.root);
      if (elite) {
        for (const sign of [-1, 1]) box(this.humanoid.bone('Head'), [.09, .27, .09], [sign * .23, .67, -.06], gold);
      }
      if(skin?.id==='ossuaryGuard'){
        for(const x of [-.30,.30])box(this.humanoid.bone('Chest'),[.12,.60,.16],[x,.08,.22],gold);
        box(this.humanoid.bone('GripL'),[.56,.86,.13],[0,-.05,.04],shell);
        for(const x of [-.17,0,.17])box(this.humanoid.bone('GripL'),[.045,.72,.05],[x,-.05,.13],gold);
        for(const x of [-.22,.22])box(this.humanoid.bone('Head'),[.09,.48,.10],[x,.50,0],gold);
      }
    } else if(skin?.id==='cinderMourner'){
      box(this.body,[.44,.60,.34],[0,.48,0],dark);box(this.body,[.67,.10,.45],[0,.80,0],shell);
      for(const x of [-.28,-.14,0,.14,.28])box(this.body,[.07,.43,.09],[x,.49,.23],shell);
      box(this.body,[.31,.29,.28],[0,1.02,0],shell);box(this.body,[.21,.055,.04],[0,1.02,.16],eye);
      this.jaw.position.set(0,.88,.15);this.body.add(this.jaw);box(this.jaw,[.30,.07,.20],[0,0,.07],gold);
      for(const x of [-1,1]){const leg=new T.Bone();leg.position.set(x*.17,.28,0);this.body.add(leg);box(leg,[.13,.28,.40],[0,-.10,.07],dark);this.legs.push(leg);}
    } else if(skin?.id==='sporeTender') {
      box(this.body,[.28,.65,.26],[0,.48,0],dark);
      // Broad stepped cap, hanging gills and four root feet: not a crawler skin.
      box(this.body,[.94,.16,.72],[0,.92,0],shell);box(this.body,[.64,.18,.50],[0,1.07,0],shell);
      for(const x of [-.30,-.15,0,.15,.30])box(this.body,[.045,.20,.51],[x,.77,0],gold);
      this.jaw.position.set(0,.67,.17);this.body.add(this.jaw);box(this.jaw,[.20,.09,.12],[0,0,.08],eye);
      for(const x of [-1,1])for(const z of [-1,1]){const leg=new T.Bone();leg.position.set(x*.13,.23,z*.12);this.body.add(leg);box(leg,[.12,.32,.12],[x*.10,-.07,z*.07],shell);this.legs.push(leg);}
    } else if(skin?.id==='repairSpider') {
      box(this.body,[.46,.20,.46],[0,.48,0],dark);box(this.body,[.32,.19,.32],[0,.67,0],gold);
      for(const x of [-1,1])for(let row=0;row<4;row++){const leg=new T.Bone();leg.position.set(x*.20,.46,(row-1.5)*.14);this.body.add(leg);box(leg,[.35,.045,.055],[x*.16,-.03,0],shell);box(leg,[.06,.36,.06],[x*.32,-.19,0],gold);this.legs.push(leg);}
      this.jaw.position.set(0,.44,.25);this.body.add(this.jaw);box(this.jaw,[.28,.06,.24],[0,0,.10],shell);
      for(const x of [-1,1])box(this.jaw,[.065,.08,.20],[x*.105,0,.25],gold);
      box(this.body,[.12,.06,.04],[0,.62,.26],eye);
    } else {
      box(this.body, [.62, .3, .44], [0, .43, 0], shell);
      box(this.body, [.38, .26, .36], [0, .45, .36], shell);
      this.jaw.position.set(0, .33, .34); this.body.add(this.jaw);
      box(this.jaw, [.34, .1, .3], [0, -.03, .13], dark);
      for (const s of [-1, 1]) { box(this.body, [.06, .065, .07], [s * .13, .52, .57], eye); box(this.jaw, [.06, .12, .06], [s * .13, -.055, .22], gold); }
      for (let row = 0; row < 3; row++) for (const sign of [-1, 1]) {
        const leg = new T.Bone(), shin = new T.Bone(); leg.name = `leg-${row}-${sign}`; leg.position.set(sign * .24, .39, (row - 1) * .28); this.body.add(leg);
        box(leg, [.3, .09, .085], [sign * .13, -.015, 0], shell);
        shin.position.set(sign * .26, -.015, 0); leg.add(shin);
        box(shin, [.09, .3, .09], [sign * .025, -.13, 0], dark); shin.rotation.z = sign * -.22; this.legs.push(leg);
      }
    }
    if(skin){
      this.body.scale.setScalar(skin.scale);
      if(this.humanoid){const seen=new Set<T.Material>();this.humanoid.root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&!seen.has(m)){seen.add(m);m.color.lerp(new T.Color(skin.color),.24);}});}
      if(['emberling','brood','rimebeast','acidmaw'].includes(skin.id))for(const sign of [-1,1]){const size=skin.id==='brood'?.27:.15;box(this.body,[size,.22,size],[sign*.2,.70,0],material(skin.color));}
      if(skin.id==='shade')box(this.body,[.45,.08,.10],[0,1.72,.3],material(0xaee1cf));
    }
    const y = kind !== 'crawler'  ? elite ? 2.58 : 2.34 : ['sporeTender','cinderMourner'].includes(skin?.id??'')?1.40:.94;
    box(this.root, [.78, .052, .045], [0, y, 0], dark);
    this.health = box(this.root, [.78, .055, .05], [0, y, .01], gold);
    this.sample('idle', 0, 1, 1);
  }
  sample(pose: EnemyPose, phase: number, face: number, hpRatio: number): void {
    const p = T.MathUtils.clamp(phase, 0, 1), pulse = Math.sin(p * Math.PI);
    this.health.scale.x = Math.max(.001, hpRatio); this.health.position.x = -.39 * (1 - hpRatio);
    this.health.visible = pose !== 'death'; this.body.rotation.set(0, face * Math.PI / 2, 0); this.body.position.set(0, 0, 0);
    if (this.humanoid) {
      const motion = pose === 'walk' ? 'walk' : pose === 'windup' || pose === 'attack' ? 'attack' : 'idle';
      const sample = pose === 'windup' ? RAISED_CHOP : pose === 'walk' ? p : 0;
      if(pose==='walk')this.humanoid.sampleWalk(p);
      else if(this.kind==='hexer'&&(pose==='attack'||pose==='windup'))this.humanoid.sampleSpell(pose==='windup'?.35:p);
      else if (pose === 'attack') this.humanoid.sampleStrike(p, true);
      else this.humanoid.sample(motion, sample);
      if (pose === 'hurt') { this.humanoid.bone('Chest').rotation.x -= pulse * .18; this.body.position.x = -face * pulse * .1; }
      if (pose === 'death') { this.body.rotation.z = -face * T.MathUtils.smoothstep(p, 0, .9) * 1.45; this.body.position.y = -.1 * p; }
    } else {
      for (let i = 0; i < this.legs.length; i++) {
        const swing = pose === 'walk' ? Math.sin(p * Math.PI * 2 + i * Math.PI) : 0;
        this.legs[i]!.rotation.set(swing * .23, swing * .38, pose === 'death' ? (i % 2 ? -1 : 1) * p * 1.5 : 0);
      }
      this.jaw.rotation.x = pose === 'attack' ? -pulse * .75 : 0;
      if (pose === 'attack') { this.body.position.x = face * pulse * .36; this.body.position.y = pulse * .08; }
      if (pose === 'hurt') { this.body.position.x = -face * pulse * .15; this.body.rotation.z = face * pulse * .12; }
      if (pose === 'death') { this.body.rotation.z = face * p * 2.2; this.body.position.y = -.16 * p; }
    }
    this.root.updateMatrixWorld(true);
    this.root.userData.pose = pose;
  }
  setTexture(enabled: boolean): void { this.humanoid?.setTextured(enabled); }
  dispose(): void {
    this.humanoid?.dispose();
    this.root.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
    this.materials.forEach(m => m.dispose()); this.root.removeFromParent();
  }
}
