import * as T from 'three';
import type { CharacterOptions, Motion, RigData } from './types';
import { VANGUARD, type ModelPart } from './model-assets';
import { solveLimb } from './ladder';

export interface HeldAsset { root: T.Group; grip: T.Object3D }
export type BonePose = Map<string, { position: T.Vector3; quaternion: T.Quaternion }>;
export function alignGrip(socket: T.Object3D, asset: HeldAsset): void {
  asset.grip.updateMatrix();
  socket.add(asset.root);
  asset.grip.matrix.clone().invert().decompose(asset.root.position, asset.root.quaternion, asset.root.scale);
}

export class BlockCharacter {
  readonly root = new T.Group();
  readonly bones = new Map<string, T.Bone>();
  readonly mixer: T.AnimationMixer;
  readonly clips = new Map<Motion, T.AnimationClip>();
  readonly skeleton: T.Skeleton;
  readonly equipment = new T.Group();
  readonly rightGrip = new T.Group();
  readonly leftGrip = new T.Group();
  readonly sword: HeldAsset;
  readonly shield: HeldAsset;
  readonly backSword = new T.Group();
  readonly backShield = new T.Group();
  readonly fingersR = new T.Group();
  readonly fingersL = new T.Group();
  private gear: T.Object3D[] = [];
  private rest = new Map<string, { position: T.Vector3; quaternion: T.Quaternion }>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private options: CharacterOptions = { outfit: 'leather', helmet: true, sword: true, shield: true };
  private phase = 0;
  private motion: Motion = 'idle';
  private monochrome = false;
  private textured = false;
  private texture: T.DataTexture | undefined;
  private hidden = new T.MeshBasicMaterial({ visible: false });
  private bodyRegions = new Map<string, T.Mesh[]>();
  private itemMasks = new Set<string>();
  private itemSlots = new Set<string>();
  private itemVisibility = new Map<T.Object3D, boolean>();
  private torso!: T.SkinnedMesh;
  private classicBody: T.Object3D[] = [];
  private packBody: T.Mesh[] = [];
  private packWeapons = new Map<string, HeldAsset>();
  private variants = new Map<string,HeldAsset>();
  private feet = new Map<string,{position:T.Vector3;quaternion:T.Quaternion}>();
  readonly dimensions = { profile: 'block-humanoid-kay-v1', restHeight: 2.08 };

  constructor(readonly data: RigData) {
    this.root.name = 'BlockHumanoid';
    for (const definition of data.bones) {
      const bone = new T.Bone(); bone.name = definition.name;
      bone.position.fromArray(definition.position); bone.quaternion.fromArray(definition.quaternion).normalize();
      this.bones.set(bone.name, bone);
      this.rest.set(bone.name, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });
    }
    for (const definition of data.bones) (definition.parent ? this.bone(definition.parent) : this.root).add(this.bone(definition.name));
    this.root.updateMatrixWorld(true);
    for(const side of ['L','R'])this.feet.set(side,{position:this.bone(`Foot${side}`).getWorldPosition(new T.Vector3()),quaternion:this.bone(`Foot${side}`).getWorldQuaternion(new T.Quaternion())});
    this.skeleton = new T.Skeleton([...this.bones.values()]);
    this.root.add(this.equipment);
    this.createBody();
    this.root.traverse(object => { if (object instanceof T.Mesh) this.classicBody.push(object); });
    for (const part of VANGUARD.body) this.packBody.push(this.modelPart(part, this.bone(part.bone)));
    // Imported hand slots already supply the bone-local grip basis. Never offset a
    // weapon in screen/world coordinates to conceal a mismatched wrist axis.
    this.rightGrip.name = 'PalmGripR'; this.leftGrip.name = 'PalmGripL';
    this.bone('GripR').add(this.rightGrip); this.bone('GripL').add(this.leftGrip);
    this.createHand(this.rightGrip, this.fingersR, 1);
    this.createHand(this.leftGrip, this.fingersL, -1);
    this.bone('Chest').add(this.backSword, this.backShield);
    this.backSword.position.set(-.2, -.1, -.32); this.backSword.rotation.set(0, 0, -.35);
    this.backShield.position.set(.02, -.12, -.43); this.backShield.rotation.set(0, Math.PI, Math.PI / 2);
    this.sword = this.createSword(); this.shield = this.createShield();
    for (const weapon of VANGUARD.weapons) {
      const root = new T.Group(), grip = new T.Object3D(); root.name = `Vanguard-${weapon.id}`;
      grip.position.fromArray(weapon.grip); root.add(grip);
      for (const part of weapon.parts) this.modelPart(part, root);
      this.packWeapons.set(weapon.id, { root, grip }); this.root.add(root);
    }
    this.mixer = new T.AnimationMixer(this.root);
    for (const clip of data.clips) this.clips.set(clip.name as Motion, T.AnimationClip.parse({ ...clip, uuid: T.MathUtils.generateUUID(), blendMode: T.NormalAnimationBlendMode }));
    this.setEquipment(this.options);
  }
  bone(name: string): T.Bone {
    const bone = this.bones.get(name); if (!bone) throw new Error(`Missing project bone ${name}`); return bone;
  }
  private material(color: number, metal = 0, roughness = .88): T.MeshStandardMaterial {
    const key = `${color}/${metal}/${roughness}`;
    if (!this.materials.has(key)) {
      const material = new T.MeshStandardMaterial({ color, metalness: metal, roughness, flatShading: true });
      material.userData.originalColor = color; this.materials.set(key, material);
    }
    return this.materials.get(key)!;
  }
  private mesh(parent: T.Object3D, geometry: T.BufferGeometry, position: readonly number[], color: number, metal = 0, roughness = .88): T.Mesh {
    const mesh = new T.Mesh(geometry, this.material(color, metal, roughness)); mesh.position.fromArray(position);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: T.Object3D, size: readonly number[], position: readonly number[], color: number, metal = 0, roughness = .88): T.Mesh {
    return this.mesh(parent, new T.BoxGeometry(size[0], size[1], size[2]), position, color, metal, roughness);
  }
  private atRest(parent: T.Object3D, size: readonly number[], position: readonly number[], color: number, metal = 0): T.Mesh {
    const mesh = this.box(this.root, size, position, color, metal, metal ? .48 : .9);
    parent.attach(mesh); return mesh;
  }
  private createBody(): void {
    // A real skinned torso shared by all outfits. Waist/spine flex instead of
    // moving an entire torso as one rigid box. Armor plates remain rigid pieces.
    const geometry = new T.BoxGeometry(.53, .69, .32, 1, 5, 1); geometry.translate(0, 1.08, 0);
    const positions = geometry.getAttribute('position'); const indices: number[] = [], weights: number[] = [];
    const spine = [...this.bones.keys()].indexOf('Spine'), chest = [...this.bones.keys()].indexOf('Chest');
    for (let i = 0; i < positions.count; i++) {
      const blend = T.MathUtils.clamp((positions.getY(i) - .9) / .46, 0, 1);
      indices.push(spine, chest, 0, 0); weights.push(1 - blend, blend, 0, 0);
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    const torso = new T.SkinnedMesh(geometry, this.material(0x425c60));
    this.torso = torso;
    this.root.add(torso); torso.bind(this.skeleton); torso.name = 'SkinnedUndertunic'; torso.castShadow = true; torso.receiveShadow = true;
    this.box(this.bone('Pelvis'), [.47, .24, .32], [0, .15, 0], 0x364446);
    this.box(this.bone('Head'), [.22, .20, .23], [0, -.06, 0], 0x947452);
    this.box(this.bone('Head'), [.43, .43, .4], [0, .2, 0], 0xc09b78);
    this.bodyRegions.set('hair', [this.box(this.bone('Head'), [.45, .11, .41], [0, .43, -.01], 0x47382e)]);
    this.box(this.bone('Head'), [.13, .07, .075], [0, .19, .225], 0xcda77e);
    for (const side of [-1, 1]) this.box(this.bone('Head'), [.055, .032, .014], [side * .108, .27, .208], 0x1f292c);
    this.box(this.bone('Head'), [.25, .07, .045], [0, .03, .205], 0x644a35);
    for (const suffix of ['L', 'R']) {
      this.box(this.bone(`UpperArm${suffix}`), [.19, .29, .21], [0, .145, 0], 0x425c60);
      this.bodyRegions.set(`arm${suffix}`, [this.box(this.bone(`Forearm${suffix}`), [.17, .31, .19], [0, .155, 0], 0x425c60)]);
      this.box(this.bone(`Wrist${suffix}`), [.17, .10, .16], [0, .05, 0], 0x916a4e);
      const handVector = this.bone(`Grip${suffix}`).position.clone();
      const hand = this.box(this.bone(`Hand${suffix}`), [.13, handVector.length() + .04, .14], handVector.clone().multiplyScalar(.5).toArray(), 0x947452);
      hand.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), handVector.normalize());
      this.box(this.bone(`Thigh${suffix}`), [.23, .35, .25], [0, .17, 0], 0x39484a);
      this.bodyRegions.set(`shin${suffix}`, [this.box(this.bone(`Shin${suffix}`), [.2, .23, .22], [0, .11, 0], 0x425457)]);
      const ankleVector = this.bone(`Toe${suffix}`).position.clone();
      const ankle = this.box(this.bone(`Foot${suffix}`), [.21, ankleVector.length(), .20], ankleVector.clone().multiplyScalar(.5).toArray(), 0x423d35);
      ankle.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), ankleVector.normalize());
      const x = this.bone(`Foot${suffix}`).getWorldPosition(new T.Vector3()).x;
      this.atRest(this.bone(`Foot${suffix}`), [.25, .12, .37], [x, .06, .055], 0x423d35);
    }
  }
  private createHand(socket: T.Object3D, fingers: T.Group, side: number): void {
    // Grip passes through a deliberately open mitten, never through a solid fist.
    this.box(socket, [.055, .17, .13], [side * .079, 0, -.009], 0x947452);
    socket.add(fingers);
    for (const y of [-.052, 0, .052]) {
      this.box(fingers, [.13, .045, .035], [side * .005, y, -.062], 0xb18d64);
      this.box(fingers, [.04, .045, .105], [-side * .058, y, -.017], 0xb18d64);
    }
    this.box(socket, [.058, .1, .048], [side * .059, .016, .058], 0xb99a73);
  }
  private createSword(): HeldAsset {
    const root = new T.Group(), grip = new T.Object3D(); root.name = 'Sword'; grip.name = 'SwordGrip'; grip.position.y = .08; root.add(grip);
    this.box(root, [.065, .19, .07], [0, .08, 0], 0x57412c);
    for (let i = 0; i < 4; i++) this.box(root, [.072, .012, .077], [0, .014 + i * .04, 0], 0x9a7448);
    this.box(root, [.12, .085, .1], [0, -.055, 0], 0xa59c7a, .65, .42);
    const bladeParts = new T.Group(); bladeParts.name = 'BladeParts'; root.add(bladeParts);
    this.box(bladeParts, [.34, .065, .095], [0, .215, 0], 0xb0ad91, .65, .38);
    // Faceted blade with an actual point and ridge, not a featureless stick.
    const shape = new T.Shape(); shape.moveTo(-.064, 0); shape.lineTo(.064, 0); shape.lineTo(.052, .64); shape.lineTo(0, .80); shape.lineTo(-.052, .64); shape.closePath();
    const blade = new T.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false });
    this.mesh(bladeParts, blade, [0, .245, -.0125], 0xc6d6d9, .68, .32);
    this.box(bladeParts, [.019, .61, .035], [0, .56, 0], 0xe1e5da, .65, .35);
    const mace = new T.Group(); mace.name = 'MaceParts'; root.add(mace);
    this.box(mace, [.075, .53, .075], [0, .42, 0], 0x826344);
    this.box(mace, [.21, .25, .21], [0, .76, 0], 0x829da6, .6);
    for (const angle of [0, Math.PI / 2]) { const flange = this.box(mace, [.38, .27, .065], [0, .76, 0], 0xb6c9cb, .6); flange.rotation.y = angle; }
    const wand = new T.Group(); wand.name = 'WandParts'; root.add(wand);
    this.box(wand,[.065,.57,.065],[0,.41,0],0x76618e);
    this.box(wand,[.20,.10,.12],[0,.69,0],0xb7a06a,.5);
    this.mesh(wand,new T.OctahedronGeometry(.14),[0,.83,0],0x78cecc,.25,.25);
    return { root, grip };
  }
  private variant(id:NonNullable<CharacterOptions['weaponVariant']>):HeldAsset {
    const cached=this.variants.get(id);if(cached)return cached;
    const root=new T.Group(),grip=new T.Object3D();root.name=`Alpha2-${id}`;grip.position.y=.08;root.add(grip);
    this.box(root,[.07,.2,.075],[0,.08,0],0x705132);
    if(id==='bow'){
      this.box(root,[.065,.68,.07],[0,.08,0],0x816540);
      for(const sign of [-1,1]){const limb=this.box(root,[.065,.38,.07],[0,.08+sign*.48,.07],0x9e7947);limb.rotation.x=sign*.4;}
      this.box(root,[.012,1.32,.012],[0,.08,.15],0xded7ba);
    }else if(id==='spear'){
      this.box(root,[.07,1.6,.07],[0,.26,0],0x98734a);this.box(root,[.14,.32,.04],[0,1.1,0],0xbfcfd0,.6);this.mesh(root,new T.ConeGeometry(.09,.19,4),[0,1.35,0],0xd7e0d8,.6);
    }else{
      const length=id==='knife'?.42:.84,color=id==='fireblade'?0xe7a35d:id==='silverblade'?0xe2eaf0:0xaec1c2;
      this.box(root,[id==='knife'?.2:.32,.06,.09],[0,.22,0],0xb39f76,.4);this.box(root,[.10,length,.045],[0,.27+length/2,0],color,.6);
      this.mesh(root,new T.ConeGeometry(.072,.14,4),[0,.34+length,0],color,.6);
      if(id==='fireblade')for(const sign of [-1,1])this.box(root,[.04,.3,.04],[sign*.07,.66,0],0xd86c35);
    }
    const asset={root,grip};this.variants.set(id,asset);this.root.add(root);return asset;
  }
  private createShield(): HeldAsset {
    const root = new T.Group(), grip = new T.Object3D(); root.name = 'Shield'; grip.name = 'ShieldGrip'; root.add(grip);
    // The left source socket points +Z outwards when blocking. Keep the board
    // in front of the knuckles, not behind the hand on the forearm side.
    this.box(root, [.065, .16, .062], [0, 0, 0], 0x604b34);
    for (const y of [-.095, .095]) this.box(root, [.065, .045, .17], [0, y, .095], 0x826344);
    const shape = new T.Shape(); shape.moveTo(-.24, .28); shape.lineTo(.24, .28); shape.lineTo(.24, -.12); shape.lineTo(0, -.37); shape.lineTo(-.24, -.12); shape.closePath();
    const board = new T.ExtrudeGeometry(shape, { depth: .065, bevelEnabled: false });
    // Source left grip +X is upright in idle; +Y runs along the horizontal
    // handle. Rotate only the board profile, preserving the authored grasp.
    const small = new T.Group(); small.name = 'SmallShield'; small.rotation.z = -Math.PI / 2; root.add(small);
    const shield = this.mesh(small, board, [0, 0, .17], 0x405966, .2, .75); shield.name = 'ShieldBoard';
    this.box(small, [.055, .51, .025], [0, -.005, .25], 0xc4b584, .4, .55);
    this.box(small, [.45, .055, .025], [0, .095, .25], 0xc4b584, .4, .55);
    this.box(small, [.11, .11, .045], [0, .08, .27], 0xe0c89b, .5, .4);
    const tower = new T.Group(); tower.name = 'TowerShield'; tower.rotation.z = -Math.PI / 2; root.add(tower);
    this.box(tower, [.62, .94, .085], [0, -.12, .19], 0x644a35);
    for (const x of [-.3, 0, .3]) this.box(tower, [.05, .99, .045], [x, -.12, .25], 0x9eb3b8, .6);
    for (const y of [-.6, .36]) this.box(tower, [.64, .06, .05], [0, y, .25], 0x9eb3b8, .6);
    this.box(tower, [.17, .19, .09], [0, -.08, .29], 0xc4b584, .5);
    return { root, grip };
  }
  private gearBox(parent: T.Object3D, size: number[], position: number[], color: number, metal = 0): T.Mesh {
    const mesh = this.box(parent, size, position, color, metal, metal ? .42 : .94); this.gear.push(mesh); return mesh;
  }
  private modelPart(part: ModelPart, parent: T.Object3D): T.Mesh {
    const mesh = this.box(part.space === 'bind' ? this.root : parent, part.size, part.position, part.color, part.metal);
    mesh.rotation.fromArray([...part.rotation, 'XYZ'] as [number, number, number, T.EulerOrder]);
    if (part.space === 'bind') parent.attach(mesh);
    mesh.userData.region = part.region; mesh.userData.asset = VANGUARD.id; return mesh;
  }
  private restoreBindPose(): void {
    for (const [name, rest] of this.rest) { this.bone(name).position.copy(rest.position); this.bone(name).quaternion.copy(rest.quaternion); }
    this.root.updateMatrixWorld(true);
  }
  setEquipment(options: CharacterOptions): void {
    this.options = { ...options };
    if(options.weaponVariant)this.variant(options.weaponVariant);
    this.sword.root.getObjectByName('BladeParts')!.visible = !options.weaponStyle || options.weaponStyle === 'sword';
    this.sword.root.getObjectByName('MaceParts')!.visible = options.weaponStyle === 'mace';
    this.sword.root.getObjectByName('WandParts')!.visible = options.weaponStyle === 'wand';
    this.shield.root.getObjectByName('SmallShield')!.visible = options.shieldStyle !== 'tower';
    this.shield.root.getObjectByName('TowerShield')!.visible = options.shieldStyle === 'tower';
    this.mixer?.stopAllAction(); this.restoreBindPose();
    for (const object of this.gear) { object.removeFromParent(); (object as T.Mesh).geometry.dispose(); } this.gear = [];
    const helmet = true; // Build slot variants, then apply the selected region mask.
    const chest = this.bone('Chest'), pelvis = this.bone('Pelvis'), head = this.bone('Head');
    for (const outfit of ['leather', 'plate'] as const) {
    const first = this.gear.length;
    if (outfit === 'leather') {
      this.gearBox(chest, [.57, .48, .085], [0, -.08, .195], 0x73492f);
      this.gearBox(chest, [.57, .48, .06], [0, -.08, -.19], 0x68422e);
      // Crossing leather straps and copper buckles instead of wood-like horizontal bars.
      for (const sign of [-1, 1]) {
        const strap = this.gearBox(chest, [.062, .55, .028], [0, -.07, .252], 0xbc9262); strap.rotation.z = sign * .78;
        this.gearBox(pelvis, [.2, .24, .10], [sign * .17, -.01, .19], 0x694630);
        this.gearBox(pelvis, [.12, .14, .1], [sign * .24, .14, .2], 0x9c7044);
        if (helmet) this.gearBox(head, [.085, .18, .36], [sign * .215, .27, -.025], 0x705036);
      }
      for (const s of ['L', 'R']) {
        this.gearBox(this.bone(`UpperArm${s}`), [.225, .16, .27], [0, .08, 0], 0x825737);
        this.gearBox(this.bone(`Forearm${s}`), [.205, .17, .23], [0, .19, 0], 0x684631);
        this.gearBox(this.bone(`Shin${s}`), [.24, .12, .265], [0, .018, -.01], 0x825c3d);
      }
      if (helmet) this.gearBox(head, [.47, .18, .44], [0, .42, -.018], 0x765039);
    } else if (outfit === 'plate') {
      const shape = new T.Shape(); shape.moveTo(-.30, .17); shape.lineTo(.30, .17); shape.lineTo(.28, -.12); shape.lineTo(.17, -.34); shape.lineTo(0, -.39); shape.lineTo(-.17, -.34); shape.lineTo(-.28, -.12); shape.closePath();
      const breast = this.mesh(chest, new T.ExtrudeGeometry(shape, { depth: .105, bevelEnabled: false }), [0, 0, .19], 0x8fabb5, .55, .43); this.gear.push(breast);
      // A central ridge, gorget and side flanges make plate recognizable in profile.
      this.gearBox(chest, [.055, .46, .075], [0, -.085, .319], 0xc5d2d1, .65);
      this.gearBox(chest, [.50, .14, .43], [0, .195, 0], 0x77949c, .5);
      this.gearBox(chest, [.59, .4, .10], [0, -.08, -.205], 0x6d8891, .5);
      for (let i = 0; i < 3; i++) this.gearBox(chest, [.53 - i * .045, .085, .41], [0, -.32 - i * .062, .018], 0x7d979e, .5);
      for (const sign of [-1, 1]) {
        this.gearBox(pelvis, [.205, .30, .085], [sign * .15, -.025, .243], 0x94aab0, .55);
        this.gearBox(pelvis, [.09, .28, .35], [sign * .3, -.01, 0], 0x778f97, .45);
      }
      for (const s of ['L', 'R']) {
        const arm = this.bone(`UpperArm${s}`);
        this.gearBox(arm, [.31, .19, .38], [0, .035, 0], 0x9eb3b8, .6);
        this.gearBox(arm, [.275, .11, .33], [0, .185, 0], 0x7e99a3, .55);
        this.gearBox(this.bone(`Forearm${s}`), [.25, .245, .285], [0, .16, 0], 0x829ca3, .6);
        this.gearBox(this.bone(`Shin${s}`), [.27, .24, .295], [0, .11, 0], 0x89a3ac, .6);
        this.gearBox(this.bone(`Shin${s}`), [.28, .11, .33], [0, -.007, -.02], 0xb1c1c0, .6);
      }
      if (helmet) {
        this.gearBox(head, [.51, .30, .46], [0, .405, -.014], 0x829da6, .6);
        this.gearBox(head, [.49, .068, .095], [0, .32, .215], 0xb6c9cb, .6);
        this.gearBox(head, [.51, .16, .075], [0, .13, .229], 0x8fa9b1, .6);
        this.gearBox(head, [.05, .145, .08], [0, .24, .235], 0xaac1c4, .55);
        for (const side of [-1, 1]) this.gearBox(head, [.07, .36, .44], [side * .243, .22, -.01], 0x728e99, .6);
        this.gearBox(head, [.11, .17, .4], [0, .6, -.02], 0x854b3b);
      }
    }
    for (const object of this.gear.slice(first)) {
      const parent = object.parent!.name;
      const slot = parent === 'Head' ? 'head' : parent === 'Pelvis' || parent.startsWith('Shin') ? 'legs' : 'chest';
      const selected = slot === 'head' ? options.helmet ? options.headStyle ?? options.outfit : 'cloth' : slot === 'legs' ? options.legsStyle ?? options.outfit : options.outfit;
      object.visible = selected === outfit; object.userData.slot = slot; object.userData.style = outfit;
    }
    }
    const cloth = this.material(0x425c60);
    this.torso.material = [cloth, cloth, cloth, cloth, options.outfit === 'cloth' ? cloth : this.hidden, options.outfit === 'cloth' ? cloth : this.hidden];
    for (const [region, meshes] of this.bodyRegions) for (const mesh of meshes) {
      mesh.visible = region === 'hair' ? !options.helmet || (options.headStyle ?? options.outfit) === 'cloth' : region.startsWith('shin') ? (options.legsStyle ?? options.outfit) !== 'plate' : options.outfit !== 'plate';
    }
    if (options.outfit === 'brigandine') for (const part of VANGUARD.armor.parts) {
      const mesh=this.modelPart(part,this.bone(part.bone));mesh.userData.slot=part.bone==='Pelvis'||part.bone.startsWith('Shin')?'legs':'chest';this.gear.push(mesh);
    }
    const pack = options.model === 'vanguard';
    if (pack) this.classicBody.forEach(mesh => { mesh.visible = false; });
    else {
      // The old model may have been hidden by a previous asset selection.
      this.classicBody.forEach(mesh => { mesh.visible = true; });
      for (const [region, meshes] of this.bodyRegions) for (const mesh of meshes) mesh.visible = region === 'hair' ? !options.helmet || (options.headStyle ?? options.outfit) === 'cloth' : region.startsWith('shin') ? (options.legsStyle ?? options.outfit) !== 'plate' : options.outfit !== 'plate' && options.outfit !== 'brigandine';
    }
    for (const mesh of this.packBody) {
      const region = mesh.userData.region as string;
      const covered = region === 'hair' && options.helmet || options.outfit === 'brigandine' && VANGUARD.armor.masks.includes(region) || options.outfit !== 'cloth' && region === 'torso' || options.outfit === 'plate' && region.startsWith('arm') || (options.legsStyle ?? options.outfit) === 'plate' && region.startsWith('shin');
      mesh.visible = pack && !covered;
    }
    this.gearBox(pelvis, [.60, .078, .41], [0, .19, 0], 0x453c31);
    this.gearBox(pelvis, [.105, .105, .035], [0, .19, .224], 0xbda66e, .35);
    this.itemVisibility.clear();
    for (const object of [...this.gear, ...this.packBody, ...[...this.bodyRegions.values()].flat()]) this.itemVisibility.set(object, object.visible);
    this.applyItemVisibility();
    this.setMonochrome(this.monochrome); this.setTextured(this.textured); this.sample(this.motion, this.phase);
  }
  /** Presentation-only replacement masks; clearing restores the selected base outfit. */
  setItemMasks(regions: readonly string[]): void { this.itemMasks = new Set(regions); this.applyItemVisibility(); }
  setItemSlots(slots: readonly string[]): void { this.itemSlots = new Set(slots); this.applyItemVisibility(); }
  private applyItemVisibility(): void {
    for (const [object, visible] of this.itemVisibility) object.visible = visible;
    for (const [region, meshes] of this.bodyRegions) if (this.itemMasks.has(region)) meshes.forEach(mesh => { mesh.visible = false; });
    for (const mesh of this.packBody) if (this.itemMasks.has(mesh.userData.region)) mesh.visible = false;
    for (const object of this.gear) if (this.itemSlots.has(object.userData.slot)) object.visible = false;
    const main=this.options.sword&&!this.itemSlots.has('mainHand');
    this.sword.root.visible=main&&!this.options.weaponVariant&&(this.options.model!=='vanguard'||this.options.weaponStyle==='wand');
    this.shield.root.visible=this.options.shield&&!this.itemSlots.has('offHand');
    for(const [id,asset] of this.packWeapons)asset.root.visible=main&&!this.options.weaponVariant&&this.options.model==='vanguard'&&id===(this.options.weaponStyle??'sword');
    for(const [id,asset] of this.variants)asset.root.visible=main&&this.options.weaponVariant===id;
  }
  setTextured(enabled: boolean): void {
    this.textured = enabled;
    if (enabled && !this.texture) {
      const pixels = new Uint8Array(8 * 8 * 4);
      for (let i = 0; i < 64; i++) { const shade = 210 + ((i * 17 + Math.floor(i / 8) * 23) % 5) * 10; pixels.set([shade, shade, shade, 255], i * 4); }
      this.texture = new T.DataTexture(pixels, 8, 8); this.texture.magFilter = T.NearestFilter; this.texture.minFilter = T.NearestFilter; this.texture.needsUpdate = true;
    }
    for (const material of this.materials.values()) { const map = enabled ? this.texture! : null; if (material.map !== map) { material.map = map; material.needsUpdate = true; } }
  }
  setMonochrome(enabled: boolean): void {
    this.monochrome = enabled;
    for (const material of this.materials.values()) material.color.setHex(enabled ? 0xaaa9a0 : material.userData.originalColor as number);
  }
  sample(motion: Motion, phase: number): void {
    this.motion = motion; this.phase = T.MathUtils.clamp(phase, 0, 1);
    this.mixer.stopAllAction(); this.restoreBindPose();
    if (motion === 'climb') {
      // Source pack has no climb clip; this authored pose is explicitly labeled.
      const idle = this.clips.get('idle')!; this.mixer.clipAction(idle).play(); this.mixer.setTime(0);
      const wave = Math.sin(this.phase * Math.PI * 2);
      for (const [s, sign] of [['L', 1], ['R', -1]] as const) {
        for (const [name, direction] of [[`UpperArm${s}`, new T.Vector3(sign * .1, .55 + sign * wave * .25, .35)], [`Forearm${s}`, new T.Vector3(0, .45 - sign * wave * .2, .3)]] as const) {
          this.root.updateMatrixWorld(true);
          const bone = this.bone(name);
          const parent = bone.parent!.getWorldQuaternion(new T.Quaternion()).invert();
          const target = this.root.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()));
          bone.quaternion.copy(parent.multiply(target));
        }
      }
    } else {
      const clip = this.clips.get(motion)!;
      const action = this.mixer.clipAction(clip); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      this.mixer.setTime(this.phase * clip.duration);
    }
    const climbing = motion === 'climb';
    alignGrip(climbing ? this.backSword : this.rightGrip, this.sword);
    alignGrip(climbing ? this.backShield : this.leftGrip, this.shield);
    this.sword.root.visible = !this.options.weaponVariant && this.options.sword && (this.options.model !== 'vanguard' || this.options.weaponStyle === 'wand'); this.shield.root.visible = this.options.shield;
    for (const [id, asset] of this.packWeapons) {
      alignGrip(climbing ? this.backSword : this.rightGrip, asset);
      asset.root.visible = !this.options.weaponVariant && this.options.model === 'vanguard' && this.options.sword && id === (this.options.weaponStyle ?? 'sword');
    }
    for(const [id,asset] of this.variants){alignGrip(climbing?this.backSword:this.rightGrip,asset);asset.root.visible=this.options.sword&&this.options.weaponVariant===id;}
    if(this.options.weaponVariant==='bow'&&!climbing){alignGrip(this.backShield,this.shield);}
    this.fingersR.rotation.y = climbing || !this.options.sword ? -.4 : 0;
    this.fingersL.rotation.y = climbing || !this.options.shield ? .4 : 0;
    this.applyItemVisibility();
    this.root.updateMatrixWorld(true);
  }
  gripErrors(): { sword: number; shield: number } {
    this.root.updateMatrixWorld(true);
    const a = new T.Vector3(), b = new T.Vector3();
    return {
      sword: this.heldWeapon.grip.getWorldPosition(a).distanceTo((this.motion === 'climb' ? this.backSword : this.rightGrip).getWorldPosition(b)),
      shield: this.shield.grip.getWorldPosition(a).distanceTo((this.motion === 'climb' || this.options.weaponVariant==='bow' ? this.backShield : this.leftGrip).getWorldPosition(b)),
    };
  }
  get heldWeapon(): HeldAsset { if(this.options.weaponVariant)return this.variants.get(this.options.weaponVariant)!;return this.options.model === 'vanguard' && this.options.weaponStyle !== 'wand' ? this.packWeapons.get(this.options.weaponStyle ?? 'sword')! : this.sword; }
  // Presentation-only interaction support; sampled idle restores hand sockets.
  stowHeld(): void {
    alignGrip(this.backSword, this.sword);
    for (const asset of this.packWeapons.values()) alignGrip(this.backSword, asset);
    for (const asset of this.variants.values()) alignGrip(this.backSword, asset);
    alignGrip(this.backShield, this.shield);
  }
  sampleBow(phase:number):void {
    this.sampleSpell(phase);const pull=Math.sin(Math.min(1,Math.max(0,phase))*Math.PI);
    const target=this.heldWeapon.root.localToWorld(new T.Vector3(0,.08,.15+pull*.18));
    const wrist=this.bone('WristL'),grip=this.bone('GripL');const offset=grip.getWorldPosition(new T.Vector3()).sub(wrist.getWorldPosition(new T.Vector3()));
    solveLimb(this.bone('UpperArmL'),this.bone('ForearmL'),wrist,target.sub(offset),new T.Vector3(-1,.1,0));this.root.updateMatrixWorld(true);
  }
  sampleSpell(phase: number): void {
    this.sample('block', .35);
    const pulse=Math.sin(T.MathUtils.clamp(phase,0,1)*Math.PI);
    this.bone('UpperArmR').rotation.z-=pulse*.3;this.bone('ForearmR').rotation.x-=pulse*.2;this.plantFeet();
  }
  sampleWalk(phase:number,stride=1):void{
    this.sample('walk',phase);
    for(const [side,offset] of [['L',0],['R',.5]] as const){
      const rest=this.feet.get(side)!,u=(phase+offset)%1,stance=u<.5;
      const z=stance?.25-u:-.25+.5*T.MathUtils.smoothstep(u,.5,1);
      const position=rest.position.clone();position.z+=z*stride;position.y+=stance?0:.10*Math.sin((u-.5)*Math.PI*2);
      const target=this.root.localToWorld(position),foot=this.bone(`Foot${side}`);
      solveLimb(this.bone(`Thigh${side}`),this.bone(`Shin${side}`),foot,target,this.root.localToWorld(new T.Vector3(rest.position.x,.5,.9)));
      const orientation=this.root.getWorldQuaternion(new T.Quaternion()).multiply(rest.quaternion);
      foot.quaternion.copy(foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(orientation));
      this.root.updateMatrixWorld(true);
    }
  }
  // Independent, deterministic presentation sampling. Neither IK nor the
  // planted feet publish coordinates back to the game world.
  sampleStrike(phase: number, raised = false, targetHeight = 1.2): void {
    const p = T.MathUtils.clamp(phase, 0, 1);
    if (this.options.weaponStyle === 'mace') {
      const contact = targetHeight < .8 ? .625 : .575;
      const clip = raised && p <= .45 ? .45 + (contact - .45) * p / .45 : p < .28 ? .45 * p / .28 : p <= .45 ? .45 + (contact - .45) * (p - .28) / .17 : contact + (1 - contact) * (p - .45) / .55;
      this.sample('attack', clip);
      if (targetHeight < .8) this.bone('Chest').rotation.x += .35 * Math.sin(p * Math.PI);
      this.plantFeet(); return;
    }
    this.sample('idle', 0);
    // Sword thrust: pull to the hip, extend along the opponent's chest, recover.
    const reach = p <= .45 ? T.MathUtils.smoothstep(p, .18, .45) : 1 - T.MathUtils.smoothstep(p, .52, .9);
    const ready = T.MathUtils.smoothstep(p, 0, .16) * (1 - T.MathUtils.smoothstep(p, .86, 1));
    const wrist = this.bone('WristR'), grip = this.bone('GripR');
    const original = this.capturePose();
    const gripHeight = Math.max(.98, targetHeight);
    const pitch = Math.asin(T.MathUtils.clamp((gripHeight - targetHeight) / .72, 0, .8));
    const orientation = this.root.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2 + pitch, 0, 0)));
    const relative = wrist.getWorldQuaternion(new T.Quaternion()).invert().multiply(grip.getWorldQuaternion(new T.Quaternion()));
    const rotation = orientation.clone().multiply(relative.invert());
    const orient = (): void => { wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation)); this.root.updateMatrixWorld(true); };
    orient();
    const offset = grip.getWorldPosition(new T.Vector3()).sub(wrist.getWorldPosition(new T.Vector3()));
    const target = this.root.localToWorld(new T.Vector3(-.34, gripHeight, .12 + .40 * reach));
    solveLimb(this.bone('UpperArmR'), this.bone('ForearmR'), wrist, target.sub(offset), this.root.localToWorld(new T.Vector3(-.95, 1.10, -.2)));
    orient(); this.blendFrom(original, ready); this.plantFeet();
  }
  private plantFeet(): void {
    // Retain the source's leg pose, remove airborne root bob during a grounded
    // strike. The lowest foot-sole vertex, not an arbitrary ankle, sets support.
    this.root.updateMatrixWorld(true);
    let lowest = Infinity;
    this.root.traverse(object => {
      if (!(object instanceof T.Mesh) || !object.visible || !['FootL','FootR','ToeL','ToeR'].includes(object.parent?.name ?? '')) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) lowest = Math.min(lowest, this.root.worldToLocal(object.localToWorld(new T.Vector3().fromBufferAttribute(positions, i))).y);
    });
    if (Number.isFinite(lowest)) this.bone('Pelvis').position.y -= lowest;
    this.root.updateMatrixWorld(true);
  }
  capturePose(): BonePose {
    return new Map([...this.bones].map(([name, bone]) => [name, { position: bone.position.clone(), quaternion: bone.quaternion.clone() }]));
  }
  blendFrom(pose: BonePose, weight: number): void {
    for (const [name, from] of pose) {
      const bone = this.bone(name);
      bone.position.lerp(from.position, 1 - weight); bone.quaternion.slerp(from.quaternion, 1 - weight);
    }
    this.root.updateMatrixWorld(true);
  }
  dispose(): void {
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root);
    this.root.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
    for (const material of this.materials.values()) material.dispose();
    this.hidden.dispose(); this.texture?.dispose();
    this.skeleton.dispose(); this.root.removeFromParent();
  }
}
