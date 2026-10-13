import * as T from 'three';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GameSession} from '../src/session/session';
import {groundPiles,memberBounds,pileMarkerPosition,placeGroundModel,GROUND_CONTACT_Y} from '../src/room/ground-pile';
import {SceneHitTest} from '../src/room/scene-hit-test';
import {RoomRenderer} from '../src/room/renderer';
import {floorY} from '../src/room/presentation';
import {IntentExecutor,publicLadderEdges} from '../src/interaction/intent';
import {ITEM_VISUALS} from '../src/visual/items/registry';
import type {Item2View} from '../src/core/alpha2-types';
import type {Command,PublicView} from '../src/core/types';
const arena=()=>{const v=structuredClone(new GameSession(42,'alpha2').view());v.player.x=4;v.enemies=[];v.alpha!.doors=[];v.alpha2!.facilities=[];v.alpha2!.ground=[];v.map.ladders=[];v.loot=[];v.explored[0]=[1,2,3,4,5,6,7];return v;};
function pileView(count:number){const v=arena(),base=v.alpha2!.bag.find(i=>i.category==='potion')!;v.alpha2!.ground=Array.from({length:count},(_,n)=>({...base,id:n+101,floor:0,x:5}));return v;}
function projected(v:PublicView,width=1440,height=900){const camera=new T.OrthographicCamera(-4.9,4.9,4.9*height/width,-4.9*height/width,.1,70);camera.position.set(5.65,floorY(v.player.floor)+2.2,15);camera.lookAt(5,floorY(v.player.floor)+1.15,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);const rect={left:63,top:41,width,height};const screen=(p:T.Vector3)=>{p=p.clone().project(camera);return{x:63+(p.x+1)*width/2,y:41+(1-p.y)*height/2};};return{camera,screen,hit:new SceneHitTest(camera,()=>rect,()=>v)};}
it.each([1,2,4,8])('%i ground items are stable ID sorted, bounded, separate and grounded',count=>{
 const v=pileView(count),before=JSON.stringify(v),p=groundPiles(v)[0]!;expect(p.itemIds).toEqual(Array.from({length:count},(_,i)=>101+i));expect(p.members).toHaveLength(Math.min(count,4));
 v.alpha2!.ground.reverse();expect(groundPiles(v)[0]).toEqual(p);v.alpha2!.ground.reverse();expect(JSON.stringify(v)).toBe(before);
 for(const m of p.members){const b=memberBounds(m);expect(b.min.y).toBeCloseTo(floorY(0)+GROUND_CONTACT_Y,9);expect(b.min.x).toBeGreaterThan(4.5);expect(b.max.x).toBeLessThan(5.5);expect(b.min.z).toBeGreaterThan(.09);expect(b.max.z).toBeLessThan(.9);for(const n of p.members)if(m.itemId!==n.itemId)expect(b.intersectsBox(memberBounds(n))).toBe(false);}
 expect(groundPiles(structuredClone(v))).toEqual([p]);
});
it('secret definitions with the same public appearance cannot change pile pose',()=>{const a=pileView(4),b=structuredClone(a);b.alpha2!.ground.forEach(i=>{i.definition='venom';});expect(groundPiles(a)).toEqual(groundPiles(b));});
it('committed overflow pickup exposes the exact public ID in one of four physical slots',()=>{const v=pileView(8),before=JSON.stringify(v),normal=groundPiles(v)[0]!,active=groundPiles(v,false,108)[0]!;expect(active.itemIds).toEqual(normal.itemIds);expect(active.members.map(m=>m.itemId)).toEqual([101,102,103,108]);expect(active.members[3]!.pose).toEqual(normal.members[3]!.pose);expect(JSON.stringify(v)).toBe(before);expect(groundPiles(v,false,999)).toEqual([normal]);});
it('all public actual GLBs and their LODs use the same grounded transform and physical bounds',async()=>{
 const v=arena(),base=v.alpha2!.bag[0]!,loader=new GLTFLoader();
 for(const spec of ITEM_VISUALS){const id=spec.assetId,secret=!id.startsWith('fixed-');const item={...base,id:900,category:spec.family,definition:secret?undefined:id.slice(6),appearance:secret?Number(id.split('-').at(-1)):0,floor:0,x:5} as Item2View&{floor:number;x:number};v.alpha2!.ground=[item];const m=groundPiles(v)[0]!.members[0]!;
  if(spec.family==='weapon'||spec.family==='wand')expect(m.pose.angle).toBe(Math.PI/2);
  for(const level of spec.lod??[{level:0 as const,uri:spec.source.uri}]){
   v.player.x=level.level===1?1:4;const member=groundPiles(v,level.level===2)[0]!.members[0]!;
   const bytes=readFileSync('public'+level.uri),model=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,parent=new T.Group();placeGroundModel(model,member,level.level);parent.position.set(member.pose.x,member.pose.y,member.pose.z);parent.add(model);parent.updateMatrixWorld(true);
   const actual=new T.Box3().setFromObject(parent,true),expected=memberBounds(member);expect(actual.min.y,`${id}/${level.uri} contact`).toBeCloseTo(floorY(0)+GROUND_CONTACT_Y,5);expect(actual.min.distanceTo(expected.min),`${id}/${level.uri} minimum`).toBeLessThan(.0001);expect(actual.max.distanceTo(expected.max),`${id}/${level.uri} maximum`).toBeLessThan(.0001);
  }
 }
});
it.each([[1440,900],[844,390],[390,844]])('shared pile proxies allow each exposed ID and overflow chooser at %ix%i',(width,height)=>{
 const v=pileView(8),{hit,screen}=projected(v,width,height),p=groundPiles(v)[0]!;
 for(const m of p.members){const b=memberBounds(m),pts=[screen(b.min),screen(b.max)],minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));let unique=false;for(let x=0;x<9;x++)for(let y=0;y<9;y++){const c=hit.hitCandidates(minX+(maxX-minX)*(x+.5)/9,minY+(maxY-minY)*(y+.5)/9),items=c.hits.filter(h=>h.ref.type==='world-entity'&&h.ref.kind==='ground-item');if(items.length===1&&items[0]!.ref.type==='world-entity'&&items[0]!.ref.id===m.itemId){unique=true;expect(c.pile?.itemIds).toEqual(p.itemIds);}}expect(unique,`exposed item ${m.itemId}`).toBe(true);}
 const badge=screen(pileMarkerPosition(p)),choice=hit.hitCandidates(badge.x,badge.y);expect(choice.hits).toEqual([]);expect(choice.pile?.itemIds).toEqual(p.itemIds);expect(hit.worldScreenPoint({type:'world-entity',kind:'ground-item',id:108})).toBeNull();
});
it('public two-way ladder edges hit different actual segments and never disclose unrelated dark links',()=>{
 const v=arena();v.player.floor=1;v.explored[1]=[3,4,5,6];v.explored[2]=[];v.map.ladders=[{floor:0,x:5},{floor:1,x:5},{floor:3,x:8}];const {hit}=projected(v,390,844),edges=publicLadderEdges(v);expect(edges.map(e=>e.toFloor)).toEqual([0,2]);const points=edges.map(e=>hit.ladderScreenPoint(e)!);expect(points[0]!.y).toBeLessThan(points[1]!.y);edges.forEach((e,n)=>expect(hit.hitCandidates(points[n]!.x,points[n]!.y).ladderEdges).toEqual([e]));v.alpha!.doors=[{id:90,x:4.5,floor:1,open:false,locked:false}];expect(hit.ladderScreenPoint(edges[0]!)).toBeNull();
});
function climbing(){const v=arena();v.player.x=3;v.explored[1]=[];v.map.ladders=[{floor:0,x:5}];let busy=false;const commands:Command[]=[],offer=vi.fn(()=>[{actionId:'down',revision:v.revision,status:'uncertain' as const,targetModes:[],requiresConfirmation:true,command:'down' as const}]);const e=new IntentExecutor({view:()=>structuredClone(v),busy:()=>busy,context:()=>{},offers:offer,submit:command=>{commands.push(command);v.revision++;v.tick+=command==='down'?12:10;if(command==='right')v.player.x++;if(command==='down')v.player.floor++;busy=true;return{accepted:true};}});return{v,e,commands,offer,step:()=>{busy=false;e.completed();}};}
it('explicit ladder edge approaches the known entrance then explores exactly one unknown floor',()=>{const h=climbing();h.e.startClimb(publicLadderEdges(h.v)[0]!);h.step();h.step();h.step();expect(h.commands).toEqual(['right','right','down']);expect(h.offer).toHaveBeenCalledTimes(1);expect(h.e.active).toBeNull();});
it('climb cancellation, removed link, stale revision and danger never authorize a deferred floor change',()=>{for(const change of [(h:ReturnType<typeof climbing>)=>h.e.cancel(),(h:ReturnType<typeof climbing>)=>h.v.map.ladders=[],(h:ReturnType<typeof climbing>)=>h.v.revision++,(h:ReturnType<typeof climbing>)=>h.v.enemies.push({id:90,floor:0,x:5,hp:1,maxHp:1,period:10,nextAt:20})]){const h=climbing();h.e.startClimb(publicLadderEdges(h.v)[0]!);change(h);for(let i=0;i<4;i++)h.step();expect(h.commands).toEqual(['right']);expect(h.e.active).toBeNull();}});
it('forged edge or dark-cell move never inherits explicit ladder exploration authority',()=>{const h=climbing();h.e.startClimb({linkId:5,fromFloor:0,toFloor:2,x:5});expect(h.commands).toEqual([]);h.e.start({type:'move-to',target:{floor:1,x:5}});expect(h.commands).toEqual([]);});
it('hover highlights real model materials without changing camera or shared templates',()=>{const things=new T.Group(),item=new T.Group(),material=new T.MeshStandardMaterial({color:0x112233}),mesh=new T.Mesh(new T.BoxGeometry(),material);item.name='GroundItem:42';item.add(mesh);things.add(item);const camera=new T.OrthographicCamera(),before=camera.matrixWorld.clone(),draw=vi.fn();const renderer=Object.assign(Object.create(RoomRenderer.prototype),{things,groundHover:null,hoverMaterials:[],camera,draw}) as RoomRenderer;renderer.setGroundHover(42);expect(mesh.material).not.toBe(material);expect(mesh.material.emissiveIntensity).toBe(.6);expect(material.emissive.getHex()).toBe(0);expect(camera.matrixWorld).toEqual(before);renderer.setGroundHover(null);expect(mesh.material).toBe(material);expect(draw).toHaveBeenCalledTimes(2);});



it.each([[1440,900],[844,390],[390,844]])('ladder direction centers avoid the direct HUD at %i×%i',(width,height)=>{
 const v=arena();v.player.floor=1;v.explored[1]=[3,4,5,6];v.map.ladders=[{floor:0,x:5},{floor:1,x:5}];const {hit}=projected(v,width,height);
 for(const edge of publicLadderEdges(v)){const p=hit.ladderScreenPoint(edge)!;expect(p.y-41).toBeGreaterThan(64);expect(p.y-41).toBeLessThan(height-64);expect(hit.hitCandidates(p.x,p.y).ladderEdges).toContainEqual(edge);}
});
