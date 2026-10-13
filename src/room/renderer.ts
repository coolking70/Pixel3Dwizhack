import {nextInteractionPhase} from '../visual/motions/receipt';
import { jumpSample, poseJump, nextJumpPhase } from '../visual/motions/jump';
import type { JumpTarget5 } from '../core/alpha5-types';
import * as T from 'three';
import type { Command, PublicView } from '../core/types';
import type { RigData } from '../character-lab/types';
import { BlockCharacter, type BonePose } from '../character-lab/character';
import { poseOnLadder, RUNG } from '../character-lab/ladder';
import { actionMotion, appearance, floorY, FLOOR_HEIGHT } from './presentation';
import { EnemyActor, type EnemyPose } from './enemy-actor';
import { CONTACT, strikeAt, strikes } from './combat-timeline';
import { interactionReceipt, isItemMotion, MOTION_PROFILE, motionStage, type PresentationActionReceipt } from '../visual/motions/receipt';
import { sampleItemAction } from '../visual/motions/item-action';
import type { ItemLOD, ItemVisualSpec } from '../visual/items/types';
import { doorGripZ, effectProgress, FACILITY_SOCKETS, poseInteraction } from '../visual/motions/pose';
import { createItemModelCache } from '../visual/items/presenter';
import { resolveItemVisual } from '../visual/items/appearance-resolver';
import { ItemEquipment } from '../visual/items/equipment';
import { applyItemAppearance } from '../visual/items/appearance';
import type {PublicTargetOffer,TargetRef,WorldHit} from '../core/action-types';
import {SceneHitTest} from './scene-hit-test';
import {publicLadderEdges} from '../interaction/intent';
import type {LadderEdge,WorldHitCandidates} from '../interaction/ux-types';
import {groundLOD,groundPiles,pileMarkerPosition,placeGroundModel} from './ground-pile';

export class RoomRenderer {
  private hitScene:SceneHitTest;
  private targetMarkers=new T.Group();
  private climbDestination=new T.Mesh(new T.ConeGeometry(.14,.3,3),new T.MeshBasicMaterial({color:0x82ead0,depthTest:false}));
  private jumpArc=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x8ce6cc,depthTest:false}));
  private jumpShadow=new T.Mesh(new T.CircleGeometry(.3,20),new T.MeshBasicMaterial({color:0x122d36,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide}));
  setJumpPreview(target:JumpTarget5|null):void {
    this.jumpArc.visible=!!target;this.jumpShadow.visible=!!target;
    if(target){const from=this.view.player,to=target.position,points=Array.from({length:25},(_,i)=>{const u=i/24;return new T.Vector3(T.MathUtils.lerp(from.x,to.x,u),floorY(from.floor)+.12+Math.sin(u*Math.PI)*1.1,.45);});this.jumpArc.geometry.dispose();this.jumpArc.geometry=new T.BufferGeometry().setFromPoints(points);this.jumpArc.material.color.set(target.status==='enabled'?0x8ce6cc:0xf08065);this.jumpShadow.position.set(to.x,floorY(to.floor)+.025,.14);}
    this.canvas.dataset.jumpTarget=target?JSON.stringify(target):'';this.draw();
  }
  private targets:PublicTargetOffer[]=[];
  private aim = new T.Group();
  private targetFocus:{floor:number;x:number}|null=null;
  private groundHover:number|null=null;
  private hoverMaterials:Array<{mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]}>=[];
  hitTest(clientX:number,clientY:number):WorldHit|null{return this.disposed||this.graphicsLost||this.busy||this.overlay?.coversWorld?null:this.hitScene.hitTest(clientX,clientY);}
  hitCandidates(clientX:number,clientY:number):WorldHitCandidates{return this.disposed||this.graphicsLost||this.busy||this.overlay?.coversWorld?{hits:[],ladderEdges:[]}:this.hitScene.hitCandidates(clientX,clientY);}
  ladderScreenPoint(edge:LadderEdge):{x:number;y:number}|null{return this.hitScene.ladderScreenPoint(edge);}
  /** Highlights the actual visible asset. Material clones never mutate shared GLB templates. */
  setGroundHover(itemId:number|null):void{if(this.groundHover===itemId)return;this.groundHover=itemId;this.refreshGroundHover();this.draw();}
  private clearGroundHover():void{for(const row of this.hoverMaterials){row.mesh.material=row.original;for(const material of row.copies)material.dispose();}this.hoverMaterials=[];}
  private refreshGroundHover():void{
    this.clearGroundHover();if(this.groundHover===null)return;
    const item=this.things.getObjectByName(`GroundItem:${this.groundHover}`);if(!item)return;
    item.traverse(object=>{if(!(object instanceof T.Mesh))return;const original=object.material,copies=(Array.isArray(original)?original:[original]).map(material=>{const clone=material.clone();if(clone instanceof T.MeshStandardMaterial){clone.emissive.set(0xe9ba61);clone.emissiveIntensity=.6;}return clone;});object.material=Array.isArray(original)?copies:copies[0]!;this.hoverMaterials.push({mesh:object,original,copies});});
  }
  hudObstacles(){return this.hitScene.hudObstacles();}
  worldScreenPoint(ref:TargetRef):{x:number;y:number}|null{return this.hitScene.worldScreenPoint(ref);}
  setTargets(targets:PublicTargetOffer[]):void{this.targets=targets.map(t=>({...t,ref:{...t.ref}}));this.setAim(null);this.refreshTargets();this.draw();}
  setAim(ref:TargetRef|null,focus=true):void {
    for(const object of this.aim.children)if(object instanceof T.Line){object.geometry.dispose();(object.material as T.Material).dispose();}
    this.aim.clear();
    const offer=ref?this.targets.find(t=>t.status!=='disabled'&&t.revision===this.view.revision&&JSON.stringify(t.ref)===JSON.stringify(ref)):undefined;
    if(focus)this.targetFocus=offer?.position&&offer.position.floor===this.view.player.floor?{...offer.position}:null;
    if(ref){
      if(offer?.position&&offer.command?.startsWith('a3:throw:')){
        const origin=this.view.player,requested=offer.position,step=Math.sign(requested.x-origin.x);
        let x=origin.x;
        for(let cell=origin.x+step;step&&Math.abs(cell-origin.x)<=Math.abs(requested.x-origin.x);cell+=step){
          if(this.view.alpha?.doors.some(d=>!d.open&&d.floor===requested.floor&&d.x===cell))break;
          x=cell;if(this.view.enemies.some(e=>e.hp>0&&e.floor===requested.floor&&e.x===cell))break;
        }
        const enemy=this.view.enemies.find(e=>e.hp>0&&e.floor===requested.floor&&e.x===x);
        const from=new T.Vector3(origin.x,floorY(origin.floor)+1.1,.7),to=new T.Vector3(x,floorY(requested.floor)+(enemy?(enemy.kind==='crawler'?.5:1.15):.16),.7);
        const mid=from.clone().lerp(to,.5);mid.y+=1;
        const curve=new T.QuadraticBezierCurve3(from,mid,to);
        const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(24)),new T.LineDashedMaterial({color:0xe8d18b,dashSize:.12,gapSize:.08,transparent:true,opacity:.85,depthTest:false}));
        line.computeLineDistances();line.renderOrder=12;this.aim.add(line);
        const cross=new T.LineSegments(new T.BufferGeometry().setFromPoints([to.clone().add(new T.Vector3(-.18,0,0)),to.clone().add(new T.Vector3(.18,0,0)),to.clone().add(new T.Vector3(0,-.18,0)),to.clone().add(new T.Vector3(0,.18,0))]),new T.LineBasicMaterial({color:0xffe4a8,depthTest:false}));
        cross.renderOrder=12;this.aim.add(cross);
      }
    }
    this.draw();
  }
  private refreshTargets():void{this.targetMarkers.children.forEach(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.targetMarkers.clear();for(const offer of this.targets){if(offer.revision!==this.view.revision||offer.status==='disabled')continue;const p=this.hitScene.targetWorldPoint(offer.ref);if(!p)continue;const marker=new T.Mesh(new T.RingGeometry(.27,.32,24),new T.MeshBasicMaterial({color:offer.status==='uncertain'?0xf2ca87:0x82ead0,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));marker.position.copy(p);marker.position.z=1;marker.renderOrder=10;this.targetMarkers.add(marker);}}
  private overlay: { readonly coversWorld?: boolean; render(renderer: T.WebGLRenderer, width: number, height: number): void; dispose(): void } | null = null;
  setOverlay(overlay: typeof this.overlay): void { if (this.overlay !== overlay) this.overlay?.dispose(); this.overlay = overlay; this.draw(); }
  invalidate(): void { this.draw(); }
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera();
  readonly actor: BlockCharacter;
  private observer: ResizeObserver;
  private view: PublicView;
  private geometry = new T.Group();
  private things = new T.Group();
  private itemModels = createItemModelCache();
  private modelRequests = new Set<string>();
  private itemEquipment: ItemEquipment;
  private interaction: { receipt: PresentationActionReceipt; transferred: boolean; prop?: T.Group; spec?: ItemVisualSpec; targetProp?: T.Group; targetSpec?: ItemVisualSpec; equipmentApplied?: boolean; facilityApplied?:boolean } | null = null;
  private enemies = new Map<number, EnemyActor>();
  private textured = true;
  private lowQuality = false;
  private light = new T.DirectionalLight(0xffe1ae, 3.5);
  private sparks = new T.InstancedMesh(new T.BoxGeometry(.055, .055, .055), new T.MeshBasicMaterial({ color: 0xffd68b, transparent: true, depthWrite: false }), 8);
  private projectile = new T.Mesh(new T.OctahedronGeometry(.13),new T.MeshBasicMaterial({color:0x80dfda}));
  private itemBeam = new T.Mesh(new T.CylinderGeometry(.025,.025,1,6),new T.MeshBasicMaterial({color:0xe3e2bd,transparent:true,opacity:.75}));
  private animation: { from: PublicView; to: PublicView; motion: ReturnType<typeof actionMotion>['motion']; start: number; duration: number; jumpPhase?: number; interactionPhase?:number; idle: BonePose } | null = null;
  private raf = 0;
  private size = '';
  private mapKey = '';
  private equipmentKey = '';
  private stone = new T.MeshStandardMaterial({ color: 0x576263, roughness: 1 });
  private wood = new T.MeshStandardMaterial({ color: 0x947452, roughness: .95 });
  private dark = new T.MeshStandardMaterial({ color: 0x283438, roughness: 1 });
  private gold = new T.MeshStandardMaterial({ color: 0xc5a569, roughness: .45, metalness: .4 });
  private warning = new T.MeshStandardMaterial({ color: 0xf1894b, emissive: 0x983608, emissiveIntensity: .7 });
  private flaskMaterials = [0xd09b45, 0x4baf9a, 0xa38bcd, 0xd7d9c0].map(color => new T.MeshStandardMaterial({ color, roughness: .4, metalness: .1 }));
  private worldTexture: T.DataTexture;
  private disposed = false;
  private graphicsLost = false;
  private stopForContextLoss(): void {
    if (this.graphicsLost) return;
    this.graphicsLost = true; this.settle(false); this.failed();
  }
  private onLost = (event: Event): void => { event.preventDefault(); this.stopForContextLoss(); };
  private onRestored = (): void => {
    if (this.disposed || !this.graphicsLost) return;
    this.graphicsLost = false; this.size = ''; this.worldTexture.needsUpdate = true;
    this.sync(this.view); this.recovered?.();
  };
  constructor(readonly canvas: HTMLCanvasElement, private data: RigData, view: PublicView, private finished: () => void, private failed: () => void, private recovered?: () => void) {
    this.view = view;
    this.hitScene=new SceneHitTest(this.camera,()=>this.canvas.getBoundingClientRect(),()=>this.view,()=>this.lowQuality);this.scene.add(this.targetMarkers,this.aim,this.climbDestination);this.climbDestination.visible=false;this.scene.add(this.jumpArc,this.jumpShadow);this.jumpArc.visible=false;this.jumpShadow.visible=false;this.jumpShadow.rotation.x=-Math.PI/2;this.jumpShadow.scale.y=.55;this.climbDestination.renderOrder=12;this.climbDestination.name='ClimbDestination';
    const pixels = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < 64; i++) { const shade = 211 + (i * 17 % 5) * 10; pixels.set([shade, shade, shade, 255], i * 4); }
    this.worldTexture = new T.DataTexture(pixels, 8, 8); this.worldTexture.magFilter = T.NearestFilter; this.worldTexture.minFilter = T.NearestFilter; this.worldTexture.needsUpdate = true;
    for (const material of [this.stone, this.wood, this.dark]) material.map = this.worldTexture;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.scene.background = new T.Color(0x111d23);
    this.scene.add(new T.HemisphereLight(0xe4eef0, 0x645740, 2.5));
    const light = this.light; light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 }); light.shadow.normalBias = .035; this.scene.add(light, light.target);
    const rim = new T.DirectionalLight(0x91b9d6, 1.3); rim.position.set(8, 5, -4); this.scene.add(rim);
    this.actor = new BlockCharacter(data); this.actor.setTextured(true); this.scene.add(this.actor.root, this.geometry, this.things);
    this.itemEquipment = new ItemEquipment(this.actor, () => { this.itemEquipment.sample(this.animation?.motion==='climb'||!!this.interaction); this.draw(); });
    this.sparks.visible = false; this.sparks.frustumCulled = false; this.projectile.visible=false;this.scene.add(this.sparks,this.projectile);
    this.itemBeam.visible=false; this.scene.add(this.itemBeam);
    this.camera.near = .1; this.camera.far = 70;
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(canvas);
    this.sync(view);
  }
  private box(group: T.Group, size: number[], position: number[], material: T.Material): T.Mesh {
    const mesh = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), material); mesh.position.fromArray(position); mesh.receiveShadow = true; mesh.castShadow = true; group.add(mesh); return mesh;
  }
  private clear(group: T.Group): void {
    const release=(o:T.Object3D):void=>{if(o.userData.itemAsset)return;if(o instanceof T.Sprite&&o.userData.pileBadge){o.material.map?.dispose();o.material.dispose();}if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.InstancedMesh)o.dispose();o.children.forEach(release);};
    group.children.forEach(release);group.clear();
  }
  private batchRoom(): void {
    // Static stone/wood blocks share geometry and material. Keep the hatch
    // separate because it opens during traversal.
    for (const material of [this.stone, this.wood, this.dark, this.gold]) {
      const meshes = this.geometry.children.filter((o): o is T.Mesh<T.BoxGeometry> => o instanceof T.Mesh && o.material === material && o.name !== 'LadderHatch' && !o.name.startsWith('LadderDirection:'));
      if (!meshes.length) continue;
      const batch = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), material, meshes.length);
      batch.castShadow = true; batch.receiveShadow = true;
      meshes.forEach((mesh, i) => {
        const { width, height, depth } = mesh.geometry.parameters;
        const matrix = new T.Matrix4().compose(mesh.position, mesh.quaternion, new T.Vector3(width, height, depth));
        batch.setMatrixAt(i, matrix); batch.setColorAt(i, new T.Color(mesh.userData.tint ?? 0xffffff)); mesh.geometry.dispose(); mesh.removeFromParent();
      });
      batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); this.geometry.add(batch);
    }
  }
  private buildMap(view: PublicView): void {
    const key = JSON.stringify([view.explored, view.map.ladders, view.player.floor, view.alpha2?.segments]); if (key === this.mapKey) return; this.mapKey = key;
    this.clear(this.geometry);
    // Unknown contents remain hidden, but the known continuous corridor floor
    // must not look like a platforming gap at the edge of exploration.
    if(view.alpha)for(let x=1;x<view.map.width-1;x++)if(!view.explored[view.player.floor]!.includes(x))this.box(this.geometry,[.99,.2,1.7],[x,floorY(view.player.floor)-.16,.05],this.dark);
    for (let floor = 0; floor < view.map.floors; floor++) for (const x of view.explored[floor]!) {
      const first = this.geometry.children.length;
      const y = floorY(floor);
      const tile = this.box(this.geometry, [.99, .2, 1.7], [x, y - .16, .05], this.stone);
      if (view.map.ladders.some(l => l.floor === floor && l.x === x)) tile.name = 'LadderHatch';
      for (let row = 0; row < 6; row++) this.box(this.geometry, [.96, .43, .13], [x, y + row * .46 + .21, -.9], (x + row) % 3 ? this.dark : this.stone);
      if (x % 4 === 1) {
        this.box(this.geometry, [.13, 2.9, .17], [x - .45, y + 1.35, -.67], this.wood);
        this.box(this.geometry, [.14, .28, .14], [x, y + 2, -.63], this.gold);
      }
      this.box(this.geometry, [.99, .10, .13], [x, y + 2.85, -.66], this.wood);
      if (view.map.rooms) {
        if (view.map.rooms[floor] === 'armory' && x % 6 === 3) {
          this.box(this.geometry, [.68, .13, .25], [x, y + .6, -.47], this.wood);
          for (const dx of [-.22, 0, .22]) { this.box(this.geometry, [.05, .95, .07], [x + dx, y + 1.15, -.43], this.gold); this.box(this.geometry, [.19, .06, .07], [x + dx, y + .85, -.43], this.stone); }
        }
        if (view.map.rooms[floor] === 'crypt' && x % 5 === 0) {
          this.box(this.geometry, [.72, .62, .36], [x, y + .31, -.53], this.stone);
          this.box(this.geometry, [.85, .12, .45], [x, y + .68, -.51], this.gold);
        }
        const segment=view.alpha2?.segments.find(s=>s.floor===floor&&x>=s.start&&x<=s.end);
        const tint = segment?{mine:0xc6bdab,crypt:0xadb9c5,fungal:0xb1c396,sanctuary:0xbedbd0,merchant:0xebcd9a}[segment.tag]:{ gate: 0xd8e6ef, armory: 0xffddb4, crypt: 0xb5d0cc }[view.map.rooms[floor]!];
        for (const mesh of this.geometry.children.slice(first)) mesh.userData.tint = tint;
      }
    }
    for (const ladder of view.map.ladders) {
      const bottom = floorY(ladder.floor + 1);
      for (const side of [-1, 1]) this.box(this.geometry, [.10, FLOOR_HEIGHT + 2.1, .11], [ladder.x + side * .5, bottom + (FLOOR_HEIGHT + 2.1) / 2, -.28], this.wood);
      for (let y = bottom; y < bottom + FLOOR_HEIGHT + 2.1; y += RUNG) this.box(this.geometry, [.96, .065, .08], [ladder.x, y, -.28], this.gold);
    }
    for(const edge of publicLadderEdges(view)){
      const point=this.hitScene.ladderWorldPoint(edge);if(!point)continue;
      const arrow=new T.Mesh(new T.ConeGeometry(.11,.24,3),this.gold);arrow.position.copy(point);arrow.position.x+=.28;arrow.position.z=.18;arrow.rotation.z=edge.toFloor>edge.fromFloor?Math.PI:0;arrow.name=`LadderDirection:${edge.linkId}:${edge.toFloor}`;this.geometry.add(arrow);
    }
    const exit = view.map.exit!;
    if (view.explored[exit.floor]!.includes(exit.x)) {
      const y = floorY(exit.floor);
      this.box(this.geometry, [.92, 2.15, .10], [exit.x, y + 1.06, -.72], this.wood);
      this.box(this.geometry, [.76, 1.96, .11], [exit.x, y + 1.02, -.64], this.dark);
      this.box(this.geometry, [.12, .12, .12], [exit.x + .24, y + .95, -.53], this.gold);
      this.box(this.geometry, [.55, .14, .1], [exit.x, y + 2.28, -.6], this.gold);
    }
    this.batchRoom();
  }
  private buildThings(view: PublicView): void {
    this.clearGroundHover();
    this.clear(this.things);
    const pickupId=this.interaction?.receipt.motion==='pickupLow'?this.interaction.receipt.targetId:undefined;
    const piles=groundPiles(view,this.lowQuality,pickupId),members=new Map(piles.flatMap(p=>p.members.map(m=>[m.itemId,m] as const)));
    // Warm public overflow models as well; the selector may authorize any ID.
    for(const item of view.alpha2?.ground??[])if(!members.has(item.id))void this.itemModels.preload([resolveItemVisual(item)],groundLOD(view,item,this.lowQuality)).catch(()=>{});
    for(const pile of piles)if(pile.itemIds.length>pile.members.length){
      const surface=document.createElement('canvas');surface.width=128;surface.height=48;const ctx=surface.getContext('2d')!;ctx.fillStyle='#142a35';ctx.fillRect(0,0,128,48);ctx.strokeStyle='#e8c98e';ctx.strokeRect(1,1,126,46);ctx.fillStyle='#f2e6c8';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`×${pile.itemIds.length}`,64,24);
      const texture=new T.CanvasTexture(surface);texture.colorSpace=T.SRGBColorSpace;const badge=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));badge.userData.pileBadge=true;badge.position.copy(pileMarkerPosition(pile));badge.scale.set(.55,.25,1);badge.renderOrder=4;this.things.add(badge);
    }
    for (const [id, actor] of this.enemies) if (!view.enemies.some(e => e.id === id)) { actor.dispose(); this.enemies.delete(id); }
    for (const loot of view.loot) {
      const object=view.alpha2?.ground.find(i=>i.id===loot.id),member=members.get(loot.id);
      if(object&&!member)continue;
      const g = new T.Group(); this.things.add(g); g.position.set(loot.x, floorY(loot.floor), .22);
      g.name = `GroundItem:${loot.id}`;
      const item = view.expedition?.ground.find(i => i.id === loot.id);
      if(object){
        g.position.set(member!.pose.x,member!.pose.y,member!.pose.z);
        const level=groundLOD(view,loot,this.lowQuality);
        const spec=resolveItemVisual(object),model=this.itemModels.peek(spec,level),requestKey=`${spec.assetId}:${level}`;
        g.userData.assetId=spec.assetId;
        if(model){
          applyItemAppearance(model,object);
          placeGroundModel(model,member!,level);g.add(model);
          model.updateMatrix();g.userData.contactAnchor=new T.Vector3().fromArray(spec.grip).applyMatrix4(model.matrix).toArray();continue;
        }
        if(spec.status==='ready'&&!this.modelRequests.has(requestKey)){
          this.modelRequests.add(requestKey);
          void this.itemModels.preload([spec],level).then(()=>{
            if(this.disposed)return;
            if(!this.busy){this.buildThings(this.view);this.draw();}
            else if(this.interaction?.receipt.motion==='pickupLow'&&this.interaction.receipt.targetId===loot.id&&!this.interaction.transferred&&g.parent===this.things){
              const ready=this.itemModels.peek(spec,level);if(!ready)return;
              this.clearGroundHover();this.clear(g);applyItemAppearance(ready,object);placeGroundModel(ready,member!,level);g.add(ready);
              g.userData.contactAnchor=new T.Vector3().fromArray(spec.grip).applyMatrix4(ready.matrix).toArray();this.refreshGroundHover();
            }
          }).catch(()=>{if(!this.disposed)this.canvas.dataset.itemLoadError='true';});
        }
        const bounds=member!.selectableBounds;this.box(g,[bounds.width,bounds.height,bounds.depth],[0,0,0],this.flaskMaterials[object.appearance%4]!);g.userData.contactAnchor=[0,0,0];continue;
      }
      if (item?.kind === 'scroll') {
        this.box(g, [.32, .065, .18], [0, .12, 0], this.flaskMaterials[3]!);
        for (const x of [-.17, .17]) this.box(g, [.06, .13, .21], [x, .13, 0], this.wood);
        this.box(g, [.045, .07, .19], [0, .15, 0], this.warning); continue;
      }
      if (loot.kind === 'potion') {
        this.box(g, [.19, .27, .19], [0, .2, 0], item?.appearance === undefined ? this.warning : this.flaskMaterials[item.appearance]!); this.box(g, [.11, .10, .11], [0, .38, 0], this.gold); continue;
      }
      if (loot.kind === 'relic') {
        this.box(g, [.55, .3, .5], [0, .15, 0], this.stone);
        const gem = this.box(g, [.26, .34, .26], [0, .62, 0], this.gold); gem.rotation.z = Math.PI / 4; continue;
      }
      this.box(g, [.55, .25, .4], [0, .15, 0], this.wood);
      this.box(g, [.45, .32, .17], [0, .42, 0], this.stone);
      this.box(g, [.12, .38, .2], [0, .4, .02], this.gold);
    }
    for (const enemy of view.enemies) {
      let actor = this.enemies.get(enemy.id);
      const skin=view.alpha2?.monsters.find(m=>m.enemy===enemy.id);
      const actorSkin=skin??(enemy.hp===0?actor?.skin:undefined);
      // A restored seed can reuse an id for a different archetype.
      if (actor && (actor.kind !== (enemy.kind ?? 'crawler') || actor.elite !== !!enemy.elite || actor.skin?.id!==actorSkin?.id)) { actor.dispose(); this.enemies.delete(enemy.id); actor = undefined; }
      if (!actor) { actor = new EnemyActor(enemy.kind ?? 'crawler', this.data, enemy.elite,actorSkin); actor.setTexture(this.textured); this.enemies.set(enemy.id, actor); this.scene.add(actor.root); }
      actor.root.position.set(enemy.x, floorY(enemy.floor), .16);
      actor.sample(enemy.intent ? 'windup' : 'idle', 0, Math.sign(view.player.x - enemy.x) || 1, enemy.hp / enemy.maxHp);
      if (enemy.intent) {const radius=view.alpha2?(skin?.behavior==='guard'?1:0):enemy.kind==='hexer'?0:1;for (let x = enemy.intent.x - radius; x <= enemy.intent.x + radius; x++) this.box(this.things, [.86, .025, .7], [x, floorY(enemy.intent.floor) + .015, .2], this.warning);}
    }
    for(const f of view.alpha2?.facilities??[]){
      if(f.floor!==view.player.floor||!view.explored[f.floor]!.includes(f.x))continue;
      const g=new T.Group(),y=floorY(f.floor);this.things.add(g);g.position.set(f.x,y,-.3);
      const dull=f.used?this.dark:this.gold;
      if(f.kind==='merchant'){this.box(g,[1,.6,.5],[0,.3,0],this.wood);for(const x of [-.5,.5])this.box(g,[.08,1.8,.08],[x,.9,0],this.wood);this.box(g,[1.25,.12,.7],[0,1.8,0],this.gold);for(const x of [-.3,0,.3])this.box(g,[.16,.2,.16],[x,.76,0],this.flaskMaterials[1]!);}
      else if(f.kind==='altar'||f.kind==='fountain'){this.box(g,[.7,.5,.55],[0,.25,0],this.stone);this.box(g,[.8,.08,.65],[0,.52,0],f.kind==='fountain'&&!f.used?this.flaskMaterials[1]!:dull);if(f.kind==='altar'){const gem=this.box(g,[.22,.3,.22],[0,.76,0],dull);gem.rotation.z=.7;}}
      else if(f.kind==='chest'){
        this.box(g,[.65,.42,.45],[0,.21,0],this.wood);
        const hinge=new T.Group();hinge.name=`ChestLid:${f.id}`;hinge.position.set(0,.43,-.23);g.add(hinge);
        this.box(hinge,[.7,.08,.48],[0,.04,.24],dull);
        this.box(hinge,[.16,.10,.06],[0,.04,.49],this.gold);hinge.rotation.x=f.used?-1.35:0;
      }
      else if(f.kind==='trap'){for(const x of [-.25,0,.25])this.box(g,[.06,f.used?.02:.22,.06],[x,f.used?.02:.10,0],dull);}
      else if(f.kind==='sporeBed'){
        this.box(g,[.90,.08,.55],[0,.04,0],this.dark);
        for(const [x,h] of [[-.28,.30],[0,.52],[.28,.24]] as const){this.box(g,[.07,f.used?.08:h,.07],[x!,f.used?.09:h!/2,0],this.wood);this.box(g,[.28,.09,.28],[x!,f.used?.16:h!,0],f.used?this.dark:this.flaskMaterials[2]!);}
        if(f.used)this.box(g,[.85,.055,.10],[0,.20,.16],this.stone);
      }
      else if(f.kind==='relay'){
        this.box(g,[.58,.16,.48],[0,.08,0],this.stone);this.box(g,[.14,1.1,.15],[0,.68,0],this.dark);
        for(let n=0;n<5;n++)this.box(g,[.48,.075,.32],[0,.40+n*.12,0],f.used?this.dark:this.gold);
        const lever=this.box(g,[.08,.40,.09],[.30,.76,0],this.wood);lever.name=`RelayLever:${f.id}`;lever.rotation.z=f.used?1.2:-.5;
        this.box(g,[.12,.12,.12],[0,1.28,0],f.used?this.dark:this.flaskMaterials[1]!);
      }
      else if(f.kind==='barricade'){
        for(const x of [-.3,.3])this.box(g,[.09,f.used?.08:.38,.18],[x,f.used?.04:.19,0],this.dark);
        const beam=this.box(g,[.94,.13,.25],[0,f.used?.12:.37,0],this.wood);beam.rotation.z=f.used?.12:0;
        if(!f.used)for(const x of [-.26,0,.26])this.box(g,[.08,.15,.27],[x,.37,0],this.gold);
      }
      else if(f.kind==='emberVent'){
        for(const x of [-.32,.32])this.box(g,[.20,.22,.70],[x,.11,0],this.stone);
        for(const z of [-.22,0,.22])this.box(g,[.42,.045,.08],[0,.05,z],f.used?this.dark:this.warning);
        if(f.used)this.box(g,[.85,.06,.75],[0,.27,0],this.stone);else for(const x of [-.13,.13])this.box(g,[.09,.52,.09],[x,.30,0],this.warning);
      }
      else if(f.kind==='boneChime'){
        for(const x of [-.30,.30])this.box(g,[.12,1.16,.16],[x,.58,0],this.stone);
        this.box(g,[.84,.12,.25],[0,1.16,0],this.stone);
        for(const [x,h] of [[-.18,.65],[0,.86],[.18,.55]] as const)this.box(g,[.065,f.used?.10:h,.08],[x,f.used?.12:1.05-h/2,0],f.used?this.dark:this.gold);
      }
      else if(f.kind==='campfire'){
        for(const x of [-.3,.3])this.box(g,[.15,.13,.6],[x,.06,0],this.stone);
        this.box(g,[.50,.10,.22],[0,.08,0],this.wood);this.box(g,[.17,.26,.18],[0,.23,0],this.gold);
        this.box(g,[.72,.04,.08],[0,.58,0],this.dark);for(const x of [-.34,.34])this.box(g,[.05,.54,.06],[x,.30,0],this.dark);
      }
      else if(f.kind==='hazard'){
        this.box(g,[.90,.045,.66],[0,.025,0],this.dark);
        for(const x of [-.3,0,.3]){this.box(g,[.13,f.used?.03:.45,.13],[x,f.used?.04:.23,0],f.used?this.stone:this.warning);}
      }
      else if(f.kind==='garden'){for(const x of [-.25,.1,.35]){this.box(g,[.07,.3,.07],[x,.15,0],this.wood);this.box(g,[.24,.09,.22],[x,.34,0],f.used?this.dark:this.flaskMaterials[2]!);}}
      else{for(const x of [-.2,.2])this.box(g,[.5,.08,.12],[x,.05,0],this.wood);if(!f.used)for(const x of [-.18,0,.18])this.box(g,[.15,.25+Math.abs(x),.13],[x,.2,0],this.warning);}
    }
    for (const shrine of view.expedition?.shrines ?? []) {
      const y = floorY(shrine.floor), g = new T.Group(); this.things.add(g);
      this.box(g, [.7, .45, .55], [shrine.x, y + .22, -.38], this.stone);
      this.box(g, [.4, .09, .34], [shrine.x, y + .49, -.35], shrine.used ? this.dark : this.gold);
    }
    for(const door of view.alpha?.doors??[]){
      if(door.floor!==view.player.floor)continue;const y=floorY(door.floor),g=new T.Group();this.things.add(g);
      for(const z of [-.6,.65])this.box(g,[.20,2.6,.15],[door.x,y+1.25,z],this.stone);
      this.box(g,[.26,.18,1.5],[door.x,y+2.5,0],this.stone);
      if(view.alpha2){
        const leaf=new T.Group();leaf.name=`DoorLeaf:${door.id}`;leaf.position.set(door.x,y,-.6);g.add(leaf);
        for(const z of [.2,.6,1])this.box(leaf,[.10,2.3,.08],[0,1.1,z],door.locked?this.gold:this.wood);
        for(const h of [.3,1,1.7])this.box(leaf,[.12,.09,1.3],[0,h,.65],this.wood);
        this.box(leaf,[.16,.12,.15],[0,1.05,1.05],this.gold);leaf.rotation.y=door.open?Math.PI/2:0;
        // Alpha 2's lever command is an existing door latch, not a new rule entity.
        const latch=new T.Group();latch.name=`DoorLatch:${door.id}`;latch.position.set(door.x,y+.95,.46);g.add(latch);
        this.box(latch,[.12,.34,.09],[0,.10,0],this.gold);this.box(latch,[.24,.07,.10],[0,.26,0],this.wood);
        latch.rotation.z=door.locked?0:-1.1;
        continue;
      }
      if(!door.open){for(const z of [-.4,0,.4])this.box(g,[.10,2.3,.08],[door.x,y+1.1,z],door.locked?this.gold:this.wood);for(const h of [.3,1,1.7])this.box(g,[.12,.09,1.3],[door.x,y+h,0],this.wood);this.box(g,[.22,.24,.15],[door.x,y+1,.75],door.locked?this.warning:this.gold);}
    }
    for(const lever of view.alpha?.levers??[]){const y=floorY(lever.floor),g=new T.Group();this.things.add(g);this.box(g,[.35,.65,.24],[lever.x,y+.32,-.45],this.stone);const handle=this.box(g,[.09,.4,.09],[lever.x,y+.72,-.35],lever.used?this.dark:this.gold);handle.rotation.z=lever.used?-.5:.5;}
    for(const cache of view.alpha?.caches??[]){const y=floorY(cache.floor),g=new T.Group();this.things.add(g);this.box(g,[.62,.36,.44],[cache.x,y+.18,-.35],this.wood);const lid=this.box(g,[.68,.1,.47],[cache.x,y+.42,-.35],cache.used?this.dark:this.gold);lid.rotation.x=cache.used?-1:0;}
    this.refreshGroundHover();
  }
  sync(view: PublicView): void {
    this.climbDestination.visible=false;this.jumpArc.visible=false;this.jumpShadow.visible=false;this.canvas.dataset.jumpHeight='0';
    this.sparks.visible = false;this.projectile.visible=false;this.itemBeam.visible=false;
    this.view = view; this.buildMap(view); this.buildThings(view);
    this.refreshTargets();
    this.geometry.traverse(object => { if (object.name === 'LadderHatch') { object.rotation.z = 0; object.position.z = .05; } });
    const options = appearance(view), key = JSON.stringify(options);
    if (key !== this.equipmentKey) { this.equipmentKey = key; this.actor.setEquipment(options); }
    this.itemEquipment.update(view.alpha2?.bag??[]);
    void this.itemModels.preload((view.alpha2?.bag??[]).map(resolveItemVisual),this.lowQuality?2:0).catch(()=>{});
    this.actor.root.position.set(view.player.x, floorY(view.player.floor), .14);
    this.actor.root.rotation.set(0, view.player.face * Math.PI / 2, view.status === 'dead' ? -.95 : 0);
    this.actor.sample('idle', 0); this.itemEquipment.sample(); this.draw();
  }
  play(from: PublicView, to: PublicView, command: Command): void {
    this.settle(); this.sync(to);
    this.animation = { from, to, ...actionMotion(from, to, command), start: performance.now(), idle: this.actor.capturePose() };
    // This cue displays the already committed destination; it has no command capability.
    if(this.animation.motion==='climb'){this.climbDestination.position.set(to.player.x+.32,floorY(to.player.floor)+.8,.8);this.climbDestination.rotation.z=to.player.floor>from.player.floor?Math.PI:0;this.climbDestination.visible=true;}
    const receipt = interactionReceipt(from, to, command);
    if(receipt){
      this.interaction={receipt,transferred:false};
      this.animation.duration=MOTION_PROFILE[receipt.motion].durationMs;
      // Hold visual changes until contact/effect. Rules already contain `to`.
      this.buildThings({...to,loot:from.loot,alpha:from.alpha,alpha2:from.alpha2});
      if(isItemMotion(receipt.motion)&&receipt.item){
        const state=this.interaction, spec=resolveItemVisual(receipt.item);
        if(spec){
          state.spec=spec;
          const install=(prop:T.Group|null):void=>{if(!prop||this.disposed||this.interaction!==state)return;applyItemAppearance(prop,receipt.item!);state.prop=prop;this.scene.add(prop);};
          const level:ItemLOD=this.lowQuality?2:0,cached=this.itemModels.peek(spec,level);
          if(cached)install(cached);else void this.itemModels.instantiate(spec,level).then(install).catch(()=>{});
          if(receipt.motion==='apply'&&receipt.targetItem){
            const targetSpec=resolveItemVisual(receipt.targetItem);state.targetSpec=targetSpec;
            const installTarget=(prop:T.Group|null):void=>{if(!prop||this.disposed||this.interaction!==state)return;applyItemAppearance(prop,receipt.targetItem!);state.targetProp=prop;this.scene.add(prop);};
            const targetCached=this.itemModels.peek(targetSpec,level);
            if(targetCached)installTarget(targetCached);else void this.itemModels.instantiate(targetSpec,level).then(installTarget).catch(()=>{});
          }
        }
        if(receipt.motion==='equip'||receipt.motion==='unequip'){
          const base=receipt.motion==='unequip'?to:from;
          this.actor.setEquipment(appearance(base));this.equipmentKey=JSON.stringify(appearance(base));
          this.itemEquipment.update(receipt.motion==='unequip'?from.alpha2!.bag.map(i=>i.id===receipt.item!.id?{...i,equipped:undefined}:i):from.alpha2!.bag);
        }
      }
    }
    const attacks = strikes(to.beats ?? []).length;
    if (attacks) this.animation.duration = Math.max(this.animation.duration, Math.min(1800, attacks * 520));
    if (this.animation.motion === 'attack' && to.player.gold > from.player.gold) {
      const dying = from.enemies.find(e => !to.enemies.some(n => n.id === e.id));
      if (dying) this.buildThings({ ...to, enemies: [...to.enemies, { ...dying, hp: 0 }] });
    }
    this.frame(performance.now());
  }
  get busy(): boolean { return this.animation !== null; }
  get duration(): number { return this.animation?.duration ?? 0; }
  setQuality(low: boolean): void {
    this.lowQuality=low;this.itemEquipment.setLOD(low?2:0);this.buildThings(this.view);
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = !low; this.size = ''; this.draw();
  }
  settle(notify = true): void {
    cancelAnimationFrame(this.raf);
    this.clearInteraction();
    if (this.animation) { this.animation = null; this.sync(this.view); if(notify)this.finished(); }
  }
  setTexture(enabled: boolean): void {
    this.textured = enabled; this.enemies.forEach(e => e.setTexture(enabled));
    this.actor.setTextured(enabled);
    for (const material of [this.stone, this.wood, this.dark]) { material.map = enabled ? this.worldTexture : null; material.needsUpdate = true; }
    this.draw();
  }
  private frame = (time: number): void => {
    const a = this.animation; if (!a || this.disposed) return;
    // Context loss is synchronous, but its DOM event may arrive after this RAF.
    // Never report normal completion in that gap and authorize a held action.
    if (this.renderer.getContext().isContextLost()) { this.stopForContextLoss(); return; }
    const elapsed = T.MathUtils.clamp((time - a.start) / a.duration, 0, 1);
    const phase = a.motion==='jump' ? nextJumpPhase(a.jumpPhase??0,elapsed) : this.interaction&&a.to.alpha5?nextInteractionPhase(a.interactionPhase??0,elapsed,this.interaction.receipt.motion):elapsed;
    if(this.interaction&&a.to.alpha5){a.interactionPhase=phase;a.start=time-phase*a.duration;}
    if(a.motion==='jump'){a.jumpPhase=phase;a.start=time-phase*a.duration;}
    const p = a.from.player, q = a.to.player;
    if (phase >= 1) { this.animation = null; this.clearInteraction(); this.sync(a.to); this.finished(); return; }
    const interaction=this.interaction;
    if(interaction&&!interaction.equipmentApplied&&(interaction.receipt.motion==='equip'||interaction.receipt.motion==='unequip')&&phase>=MOTION_PROFILE[interaction.receipt.motion].effect){
      interaction.equipmentApplied=true;this.actor.setEquipment(appearance(a.to));this.equipmentKey=JSON.stringify(appearance(a.to));this.itemEquipment.update(a.to.alpha2!.bag);
    }
    const climbing = a.motion === 'climb';
    const jumping = a.motion==='jump', jump=jumpSample(phase);
    const travel = jumping ? jump.travel : climbing ? T.MathUtils.smoothstep(phase, .12, .88) : phase;
    this.actor.root.position.set(T.MathUtils.lerp(p.x, q.x, travel), T.MathUtils.lerp(floorY(p.floor), floorY(q.floor), travel)+(jumping?jump.height:0), .14);
    if(jumping){this.jumpShadow.visible=true;this.jumpShadow.position.set(this.actor.root.position.x,floorY(p.floor)+.025,.14);this.canvas.dataset.jumpHeight=jump.height.toFixed(3);this.canvas.dataset.interactionStage=jump.stage;}
    const attacks = strikes(a.to.beats ?? []), current = strikeAt(a.to.beats ?? [], phase);
    const playerStrike = current?.beat.actor === 0;
    const playerPhase = playerStrike ? current!.phase : phase;
    const playerTarget = current?.beat.actor === 0 ? a.from.enemies.find(e => e.id === current.beat.target) : undefined;
    if(jumping)poseJump(this.actor,phase);
    else if(a.motion==='walk')this.actor.sampleWalk(phase,Math.abs(q.x-p.x));
    else if(playerStrike&&a.to.alpha2?.bag.some(i=>i.equipped==='mainHand'&&i.definition==='bow'))this.actor.sampleBow(playerPhase);
    else if(playerStrike&&current?.beat.mode==='spell')this.actor.sampleSpell(playerPhase);
    else if (a.motion === 'attack' && (!attacks.length || playerStrike)) this.actor.sampleStrike(playerPhase, false, playerTarget?.kind === 'crawler' ? .55 : 1.2);
    else this.actor.sample(a.motion === 'attack' || a.motion === 'jump' ? 'idle' : a.motion, playerPhase);
    const turn = (from: number, to: number, weight: number): number => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * weight;
    this.actor.root.rotation.y = turn(p.face * Math.PI / 2, q.face * Math.PI / 2, T.MathUtils.smoothstep(phase, 0, .18));
    if (a.motion === 'attack') this.actor.blendFrom(a.idle, T.MathUtils.smoothstep(playerPhase, 0, .12) * (1 - T.MathUtils.smoothstep(playerPhase, .78, 1)));
    const playerImpact = current?.beat.target === 0 && current.phase >= CONTACT && current.beat.kind === 'attack';
    if (playerImpact && !climbing) { this.actor.bone('Chest').rotation.x -= Math.sin((current!.phase - CONTACT) / (1 - CONTACT) * Math.PI) * .17; this.actor.root.updateMatrixWorld(true); }
    this.actor.root.rotation.z = a.to.status === 'dead' ? -T.MathUtils.smoothstep(phase, .55, 1) * .95 : 0;
    let error = 0;
    if (a.motion === 'climb') {
      const approach = T.MathUtils.smoothstep(phase, 0, .12), leave = T.MathUtils.smoothstep(phase, .88, 1);
      const gripWeight = approach * (1 - leave);
      this.actor.root.rotation.y = leave > 0 ? turn(Math.PI, q.face * Math.PI / 2, leave) : turn(p.face * Math.PI / 2, Math.PI, approach);
      // Open the hatch for ascent/descent. It closes at the stable corridor
      // endpoint, so ordinary walking never needs a jump across an open gap.
      this.geometry.traverse(object => { if (object.name === 'LadderHatch' && object.position.x === q.x) { object.rotation.z = Math.PI / 2 * gripWeight; object.position.z = .05 - .75 * gripWeight; } });
      error = poseOnLadder(this.actor, q.x, this.actor.root.position.y);
      this.actor.blendFrom(a.idle, gripWeight);
      if (gripWeight < 1) error = 0; // Contact metric applies only to the attached traversal phase.
    }
    for (const [id, actor] of this.enemies) {
      const old = a.from.enemies.find(e => e.id === id), next = a.to.enemies.find(e => e.id === id);
      const enemy = next ?? old!;
      const face = Math.sign(q.x - enemy.x) || 1;
      let pose: EnemyPose = next?.intent ? 'windup' : 'idle', sample = phase;
      const receivedIndex = attacks.findIndex(b => b.target === id && b.kind === 'attack');
      const receivedPhase = receivedIndex < 0 ? -1 : phase * attacks.length - receivedIndex;
      if (old && next) {
        const ownAttack=attacks.findIndex(b=>b.actor===id);
        const retreat=enemy.kind==='skirmisher'&&ownAttack>=0?T.MathUtils.smoothstep(phase*attacks.length-ownAttack,CONTACT,1):phase;
        actor.root.position.x = T.MathUtils.lerp(old.x, next.x, retreat);
        if (next.x !== old.x) pose = 'walk';
        if (next.hp < old.hp && (attacks.length ? receivedPhase >= CONTACT && receivedPhase < 1 : phase < .5)) { pose = 'hurt'; sample = attacks.length ? (receivedPhase - CONTACT) / (1 - CONTACT) : phase * 2; }
        if (current?.beat.actor === id) { sample = current.phase; pose = 'attack'; }
        else if (!a.to.beats && ((old.intent && !next.intent) || q.hp < p.hp && Math.abs(next.x - q.x) <= 1)) pose = 'attack';
      } else if (old) { pose = receivedPhase >= CONTACT || !attacks.length ? 'death' : 'idle'; sample = attacks.length ? T.MathUtils.clamp((receivedPhase - CONTACT) / (1 - CONTACT), 0, 1) : phase; }
      const hp = old && receivedPhase >= 0 && receivedPhase < CONTACT ? old.hp : next?.hp ?? 0;
      actor.sample(pose, sample, face, hp / enemy.maxHp);
    }
    this.sparks.visible = !!current && current.beat.kind === 'attack' && current.phase >= CONTACT && current.phase < .9;
    this.projectile.visible=!!current&&current.beat.mode==='spell'&&current.phase>.08&&current.phase<CONTACT;
    if(this.projectile.visible){const b=current!.beat,to=b.targetPosition??b.position,f=(current!.phase-.08)/(CONTACT-.08);const targetEnemy=a.from.enemies.find(e=>e.id===b.target);this.projectile.position.set(T.MathUtils.lerp(b.position.x,to.x,f),T.MathUtils.lerp(floorY(b.position.floor)+1.25,floorY(to.floor)+(targetEnemy?.kind==='crawler'?.5:1.2),f),.9);this.projectile.rotation.z=phase*15;this.projectile.material.color.setHex(b.actor===0?0x80dfda:0xca99f2);}
    if (this.sparks.visible) {
      const impact = current!.beat.targetPosition ?? current!.beat.position, progress = (current!.phase - CONTACT) / (.9 - CONTACT), matrix = new T.Matrix4();
      const enemy = a.from.enemies.find(e => e.id === current!.beat.target), height = enemy?.kind === 'crawler' ? .5 : 1.15;
      for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4; matrix.makeTranslation(impact.x + Math.cos(angle) * (.12 + progress * .5), floorY(impact.floor) + height + Math.sin(angle) * (.12 + progress * .5) - progress * progress * .25, 1.15 + (i % 3) * .04); this.sparks.setMatrixAt(i, matrix); }
      this.sparks.material.opacity = 1 - progress; this.sparks.material.color.setHex(current!.beat.target === 0 ? 0xeb9778 : 0xffd68b); this.sparks.instanceMatrix.needsUpdate = true;
    }
    this.canvas.dataset.strikeActor = current ? String(current.beat.actor) : ''; this.canvas.dataset.strikeTarget = current?.beat.target === undefined ? '' : String(current.beat.target);
    this.canvas.dataset.impact = String(this.sparks.visible);
    this.canvas.dataset.projectile=String(this.projectile.visible);
    this.canvas.dataset.hurt = String(attacks.length ? playerImpact : q.hp < p.hp && phase > .2 && phase < .75);
    if(this.interaction)error=this.sampleInteraction(phase);
    this.itemEquipment.sample(climbing||!!this.interaction);
    this.canvas.dataset.limbError = error.toFixed(4); this.canvas.dataset.motion = this.interaction?.receipt.motion??a.motion; this.canvas.dataset.phase = phase.toFixed(3);
    this.draw(); this.raf = requestAnimationFrame(this.frame);
  };
  private clearInteraction(): void {
    this.interaction?.prop?.removeFromParent();this.interaction?.targetProp?.removeFromParent();this.itemBeam.visible=false;
    if(this.interaction?.transferred){
      const item=this.actor.root.getObjectByName(`GroundItem:${this.interaction.receipt.targetId}`);
      if(item)this.things.attach(item);
    }
    this.interaction=null;
    this.canvas.dataset.interactionStage='';this.canvas.dataset.contactError='';
    this.canvas.dataset.itemActionAsset='';this.canvas.dataset.mouthError='';this.canvas.dataset.itemFlight='false';
    this.canvas.dataset.applicationError='';
  }
  private sampleInteraction(phase:number):number {
    const state=this.interaction!,r=state.receipt,p=MOTION_PROFILE[r.motion],effect=effectProgress(r.motion,phase);
    const a=this.animation!,facilityId=r.targetKey?.startsWith('f')?Number(r.targetKey.slice(1)):!isItemMotion(r.motion)?r.targetId:undefined;
    const oldFacility=a.from.alpha2?.facilities.find(f=>f.id===facilityId),newFacility=a.to.alpha2?.facilities.find(f=>f.id===facilityId);
    if(a.to.alpha5&&oldFacility&&!oldFacility.used&&newFacility?.used&&['sporeBed','relay','barricade','emberVent','boneChime'].includes(oldFacility.kind)&&phase>=p.effect&&!state.facilityApplied){state.facilityApplied=true;this.buildThings(a.to);}
    if(isItemMotion(r.motion)){
      this.actor.stowHeld();
      this.canvas.dataset.interactionStage=motionStage(r.motion,phase);
      if(!state.prop||!state.spec||(r.motion==='apply'&&r.targetItem&&!state.targetProp)){this.canvas.dataset.itemActionAsset='pending';return 0;}
      const target=new T.Vector3(r.target.x,floorY(r.target.floor)+1.15,.14);
      if(r.motion==='throw'&&r.targetKey?.startsWith('cell:')){const hit=this.animation?.to.alpha3?.lastThrow,id=hit?.collision.kind==='enemy'?hit.collision.id:undefined;const enemy=id===undefined?undefined:this.animation?.from.enemies.find(e=>e.id===id);target.y=floorY(r.target.floor)+(enemy?(enemy.kind==='crawler'?.5:1.15):hit?.collision.kind==='facility'?.52:.16);}
      if(r.motion==='apply'&&(r.targetKey?.startsWith('f')||r.targetKey?.startsWith('d'))){
        const direction=Math.sign(r.target.x-this.actor.root.position.x)||this.view.player.face;
        const weight=T.MathUtils.smoothstep(phase,0,p.contact)*(1-T.MathUtils.smoothstep(phase,p.recover,1));
        this.actor.root.rotation.y=direction*Math.PI/2;this.actor.root.position.x+=direction*.32*weight;
        target.y=floorY(r.target.floor)+(r.targetKey.startsWith('d')?1.05:.52);
        if(!r.targetKey.startsWith('d'))poseInteraction(this.actor,'chestOpen',phase,target);
      }
      const result=sampleItemAction(this.actor,state.prop,state.spec,r,phase,target,state.targetProp&&state.targetSpec?{prop:state.targetProp,spec:state.targetSpec}:undefined);
      this.canvas.dataset.itemActionAsset=state.spec.assetId;
      this.canvas.dataset.contactError=result.error.toFixed(4);
      this.canvas.dataset.mouthError=result.mouthError?.toFixed(4)??'';
      this.canvas.dataset.applicationError=result.applicationError?.toFixed(4)??'';
      this.canvas.dataset.itemFlight=String(result.flight);
      this.itemBeam.visible=r.motion==='zap'&&phase>=p.effect&&phase<p.recover;
      if(this.itemBeam.visible){
        const delta=result.target.clone().sub(result.muzzle);this.itemBeam.position.copy(result.muzzle).addScaledVector(delta,.5);
        this.itemBeam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());this.itemBeam.scale.set(1,delta.length(),1);
      }
      // Item rays originate at their real muzzle. The generic spell projectile
      // is for actor spell attacks only, not item-use presentation.
      this.projectile.visible=false;
      return result.error;
    }
    const y=floorY(r.target.floor),target=new T.Vector3(r.target.x,y,.22);
    const body=this.actor.root;
    const weight=T.MathUtils.smoothstep(phase,0,p.contact)*(1-T.MathUtils.smoothstep(phase,p.recover,1));
    const direction=Math.sign(r.target.x-r.start.x)||this.view.player.face;
    body.rotation.y=T.MathUtils.lerp(this.view.player.face*Math.PI/2,direction*Math.PI/2,weight);
    // Tiny visual approach inside the current tile, never a rule move.
    body.position.x+=direction*Math.min(.32,Math.abs(r.target.x-r.start.x)*.32)*weight;
    this.actor.stowHeld();
    const leaf=this.things.getObjectByName(`DoorLeaf:${r.targetId}`);
    if(r.motion==='pickupLow'){
      const item=this.things.getObjectByName(`GroundItem:${r.targetId}`)??body.getObjectByName(`GroundItem:${r.targetId}`);
      target.y+=.20;
      if(item&&!state.transferred){
        const anchor=(item.userData.contactAnchor as number[]|undefined)??[0,.2,0];
        target.copy(item.localToWorld(new T.Vector3().fromArray(anchor)));
      }
      // Keep the palm at the ground contact briefly, then lift the same model.
      if(phase>=p.effect)target.lerp(new T.Vector3(body.position.x+direction*.32,body.position.y+1.05,.30),effect);
      const error=poseInteraction(this.actor,r.motion,phase,target);
      if(item&&phase>=p.effect&&!state.transferred){(direction<0?this.actor.leftGrip:this.actor.rightGrip).attach(item);state.transferred=true;}
      if(item&&state.transferred)item.scale.setScalar(1-T.MathUtils.smoothstep(phase,p.recover,1));
      this.canvas.dataset.interactionStage=motionStage(r.motion,phase);this.canvas.dataset.contactError=error.toFixed(4);
      return error;
    }
    if(r.motion==='chestOpen'){
      const lid=this.things.getObjectByName(`ChestLid:${r.targetId}`);
      if(lid){lid.rotation.x=-1.35*effect;target.copy(lid.localToWorld(new T.Vector3(0,.04,.49)));}
      else target.add(new T.Vector3().fromArray(FACILITY_SOCKETS.chestHandle));
      // New container loot is shown only once the lid has visibly opened.
      if(effect>.8&&!state.transferred){state.transferred=true;const a=this.animation!;this.buildThings({...a.to,alpha2:{...a.to.alpha2!,facilities:a.to.alpha2!.facilities}});}
    }else if(r.motion==='leverPull'){
      const relay=this.things.getObjectByName(`RelayLever:${r.targetId}`),latch=relay??this.things.getObjectByName(`DoorLatch:${r.targetId}`);
      if(latch){latch.rotation.z=relay?T.MathUtils.lerp(-.5,1.2,effect):-1.1*effect;target.copy(latch.localToWorld(new T.Vector3(0,.26,0)));}
      if(leaf)leaf.rotation.y=Math.PI/2*T.MathUtils.smoothstep(effect,.4,1);
    }else{
      if(leaf){
        leaf.rotation.y=T.MathUtils.lerp(r.wasOpen?Math.PI/2:0,r.open?Math.PI/2:0,effect);
        // Grip follows the reachable horizontal rail toward the hinge while
        // opening; an already-open leaf is gripped there from the start.
        target.copy(leaf.localToWorld(new T.Vector3(0,1.05,doorGripZ(!!r.wasOpen,effect))));
      }
    }
    const error=poseInteraction(this.actor,r.motion,phase,target);
    this.canvas.dataset.interactionStage=motionStage(r.motion,phase);this.canvas.dataset.contactError=error.toFixed(4);
    return error;
  }
  private drawing = false;
  private draw(): void {
    if (this.drawing) return;
    this.drawing = true;
    try { this.drawFrame(); } finally { this.drawing = false; }
  }
  private drawFrame(): void {
    this.canvas.dataset.busy = String(this.busy); if (!this.busy) { this.canvas.dataset.motion = 'idle'; this.canvas.dataset.phase = '0'; this.canvas.dataset.hurt = 'false'; this.canvas.dataset.impact = 'false'; this.canvas.dataset.projectile = 'false'; this.canvas.dataset.strikeActor = ''; this.canvas.dataset.strikeTarget = ''; }
    if (this.disposed || this.graphicsLost) return;
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight; if (!width || !height) return;
    const size = `${width}/${height}`; if (size !== this.size) { this.size = size; this.renderer.setSize(width, height, false); }
    const aspect = width / height;
    const span = Math.max(aspect > 1.35 ? 9.8 : 6.8,this.targetFocus?Math.abs(this.targetFocus.x-this.view.player.x)+1.6:0), vertical = span / aspect;
    const centre=this.targetFocus?(this.view.player.x+this.targetFocus.x)/2:this.actor.root.position.x+this.view.player.face*.8;
    const x = T.MathUtils.clamp(centre, span / 2 - .5, this.view.map.width - span / 2 - .5);
    const y = (this.animation?.motion==='jump'?floorY(this.view.player.floor):this.actor.root.position.y) + 1.15;
    this.light.position.set(x - 4, y + 8, 8); this.light.target.position.set(x, y, 0);
    this.camera.position.set(x + .65, y + 1.05, 15); this.camera.lookAt(x, y, 0);
    this.camera.left = -span / 2; this.camera.right = span / 2; this.camera.top = vertical / 2; this.camera.bottom = -vertical / 2; this.camera.updateProjectionMatrix();
    const start = performance.now();
    this.renderer.info.autoReset = false; this.renderer.info.reset();
    if(this.overlay?.coversWorld)this.renderer.clear();else this.renderer.render(this.scene, this.camera);
    if (this.overlay) {
      const autoClear = this.renderer.autoClear;
      this.renderer.autoClear = false; this.renderer.clearDepth();
      this.overlay.render(this.renderer, width, height);
      this.renderer.autoClear = autoClear;
    }
    this.canvas.dataset.renderMs = (performance.now() - start).toFixed(2);
    this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls); this.canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    this.canvas.dataset.geometries = String(this.renderer.info.memory.geometries);
    this.canvas.dataset.textures = String(this.renderer.info.memory.textures);
    this.canvas.dataset.climbDestination = this.climbDestination.visible?JSON.stringify({floor:this.animation?.to.player.floor,x:this.climbDestination.position.x,y:this.climbDestination.position.y}):'';
    this.canvas.dataset.actors = String(this.enemies.size);
    if(this.view.alpha2)this.canvas.dataset.groundAssets=JSON.stringify(this.things.children.filter(g=>g.userData.assetId).map(g=>({id:Number(g.name.split(':')[1]),assetId:g.userData.assetId})));
    if(this.view.alpha2)this.canvas.dataset.groundPiles=JSON.stringify(groundPiles(this.view,this.lowQuality));
    this.canvas.dataset.archetypes=[...this.enemies].map(([id,a])=>`${id}:${a.skin?.id??a.kind}`).join(',');
    this.canvas.dataset.actorTypes = [...this.enemies].map(([id, actor]) => `${id}:${actor.kind}:${actor.elite}`).join(',');
  }
  dispose(): void {
    this.clearGroundHover();
    this.jumpArc.geometry.dispose();this.jumpArc.material.dispose();this.jumpShadow.geometry.dispose();this.jumpShadow.material.dispose();
    this.climbDestination.geometry.dispose();this.climbDestination.material.dispose();
    this.setAim(null);
    this.targets=[];this.refreshTargets();
    this.overlay?.dispose(); this.overlay = null;
    this.disposed = true; cancelAnimationFrame(this.raf); this.observer.disconnect(); this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.clearInteraction();this.itemEquipment.dispose();this.itemModels.dispose();
    this.actor.dispose(); this.enemies.forEach(e => e.dispose()); this.enemies.clear(); this.clear(this.geometry); this.clear(this.things);
    this.sparks.geometry.dispose(); this.sparks.material.dispose(); this.sparks.dispose();
    this.projectile.geometry.dispose();this.projectile.material.dispose();
    this.itemBeam.geometry.dispose();this.itemBeam.material.dispose();
    for (const material of [this.stone, this.wood, this.dark, this.gold, this.warning]) material.dispose(); this.worldTexture.dispose();
    this.flaskMaterials.forEach(m => m.dispose());
    this.scene.traverse(o => { if (o instanceof T.DirectionalLight) o.shadow.dispose(); }); this.renderer.dispose();
  }
}


