import * as T from 'three';
import type {Position,PublicView} from '../core/types';
import type {TargetRef,WorldHit} from '../core/action-types';
import {ladderId,publicLadderEdges,targetPosition} from '../interaction/intent';
import type {LadderEdge,WorldHitCandidates} from '../interaction/ux-types';
import {groundPiles,memberBounds,pileMarkerBounds} from './ground-pile';
import {floorY,FLOOR_HEIGHT} from './presentation';

export interface ClientRect {left:number;top:number;width:number;height:number}
interface Proxy {ref:TargetRef;position:Position;center:T.Vector3;box:T.Box3;priority:number}
const key=(ref:TargetRef)=>JSON.stringify(ref);
/** Purely public proxy geometry; neither the scene graph nor hidden world is inspected. */
export class SceneHitTest {
 private ray=new T.Raycaster();
 constructor(private camera:T.Camera,private rect:()=>ClientRect,private view:()=>PublicView,private lowQuality:()=>boolean=()=>false){}
 private visible(v:PublicView,p:Position){return v.explored[p.floor]?.includes(p.x)&&p.floor===v.player.floor&&Math.abs(p.x-v.player.x)<=v.map.sight&&!v.alpha?.doors.some(d=>!d.open&&d.floor===p.floor&&d.x>Math.min(p.x,v.player.x)&&d.x<Math.max(p.x,v.player.x));}
 private proxies():Proxy[]{
  const v=this.view(),out:Proxy[]=[];
  const add=(ref:TargetRef,p:Position,height:number,width:number,priority:number,y=height/2)=>{if(!this.visible(v,p))return;const center=new T.Vector3(p.x,floorY(p.floor)+y,.2);out.push({ref,position:{x:p.x,floor:p.floor},center,box:new T.Box3().setFromCenterAndSize(center,new T.Vector3(width,height,1.3)),priority});};
  for(const e of v.enemies)if(e.hp>0)add({type:'world-entity',kind:'enemy',id:e.id},e,e.kind==='crawler'?.75:1.8,.72,0);
  for(const pile of groundPiles(v,this.lowQuality()))if(this.visible(v,pile.cell))for(const item of pile.members){const box=memberBounds(item);out.push({ref:{type:'world-entity',kind:'ground-item',id:item.itemId},position:{...pile.cell},center:box.getCenter(new T.Vector3()),box,priority:1});}
  for(const i of v.loot.filter(i=>!i.taken&&i.kind==='relic'))add({type:'world-entity',kind:'relic',id:i.id},i,.65,.65,1);
  for(const f of v.alpha2?.facilities??[])add({type:'world-entity',kind:'facility',id:f.id},f,1,.8,2);
  for(const d of v.alpha?.doors??[])add({type:'world-entity',kind:'door',id:d.id},d,2.25,.5,3);
  for(const l of v.map.ladders){const p={x:l.x,floor:v.player.floor};if(p.floor===l.floor||p.floor===l.floor+1)add({type:'world-entity',kind:'ladder',id:ladderId(v,l)},p,2.2,.5,4);}
  return out;
 }
 private setRay(clientX:number,clientY:number):boolean{
  const r=this.rect();if(r.width<=0||r.height<=0||clientX<r.left||clientX>=r.left+r.width||clientY<r.top||clientY>=r.top+r.height)return false;
  this.camera.updateMatrixWorld(true);this.ray.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),this.camera);return true;
 }
 /** Direction segment on the physical link, not an alias of the current-floor center. */
 ladderWorldPoint(edge:LadderEdge):T.Vector3|null{
  const v=this.view();if(!publicLadderEdges(v).some(e=>keyEdge(e)===keyEdge(edge))||!this.visible(v,{floor:edge.fromFloor,x:edge.x}))return null;
  return new T.Vector3(edge.x,floorY(edge.fromFloor)+(edge.toFloor>edge.fromFloor?-.25:2.15),.12);
 }
 ladderScreenPoint(edge:LadderEdge):{x:number;y:number}|null{const p=this.ladderWorldPoint(edge);return p?this.project(p):null;}
 /** Public projected object bounds, in client coordinates, for local HUD avoidance. */
 hudObstacles():{x:number;y:number;width:number;height:number}[]{
  const boxes=this.proxies().filter(p=>p.ref.type==='world-entity'&&['enemy','facility','ladder'].includes(p.ref.kind)).map(p=>p.box);
  for(const edge of publicLadderEdges(this.view())){const p=this.ladderWorldPoint(edge);if(p)boxes.push(new T.Box3().setFromCenterAndSize(p,new T.Vector3(.68,.72,.6)));}
  return boxes.flatMap(b=>{const points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const p=this.project(new T.Vector3(x,y,.2));if(p)points.push(p);}if(!points.length)return[];const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return[{x:x-4,y:y-4,width:Math.max(...points.map(p=>p.x))-x+8,height:Math.max(...points.map(p=>p.y))-y+8}];});
 }
 hitCandidates(clientX:number,clientY:number):WorldHitCandidates{
  if(!this.setRay(clientX,clientY))return{hits:[],ladderEdges:[]};
  const v=this.view(),piles=groundPiles(v,this.lowQuality()).filter(p=>this.visible(v,p.cell));
  // The count badge is an explicit selector affordance, never a default take of its first member.
  const marker=piles.find(p=>p.itemIds.length>p.members.length&&this.ray.ray.intersectsBox(pileMarkerBounds(p)));
  if(marker)return{hits:[],ladderEdges:[],pile:{cell:{...marker.cell},itemIds:[...marker.itemIds]}};
  const proxies=this.proxies().filter(p=>!(p.ref.type==='world-entity'&&p.ref.kind==='ladder')&&this.ray.ray.intersectsBox(p.box)).sort((a,b)=>a.priority-b.priority||this.ray.ray.origin.distanceToSquared(a.center)-this.ray.ray.origin.distanceToSquared(b.center));
  const hits=proxies.map(p=>({ref:p.ref,position:p.position})),ladderEdges=publicLadderEdges(v).filter(edge=>{const point=this.ladderWorldPoint(edge);return point&&this.ray.ray.intersectsBox(new T.Box3().setFromCenterAndSize(point,new T.Vector3(.68,.72,.6)));});
  const item=proxies.find(p=>p.ref.type==='world-entity'&&p.ref.kind==='ground-item'),pile=item?piles.find(p=>p.cell.floor===item.position.floor&&p.cell.x===item.position.x):undefined;
  if(!hits.length&&!ladderEdges.length&&v.alpha5){const point=this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-.2),new T.Vector3());if(point&&point.y-floorY(v.player.floor)>.85&&point.y-floorY(v.player.floor)<2.5){const x=Math.round(point.x);if(this.visible(v,{floor:v.player.floor,x})&&Math.abs(x-v.player.x)>0&&Math.abs(x-v.player.x)<=2)return{hits,ladderEdges,jump:{floor:v.player.floor,x}};}}
  if(!hits.length&&!ladderEdges.length){const cell=this.groundHit();if(cell)hits.push(cell);}
  return{hits,ladderEdges,...(pile?{pile:{cell:{...pile.cell},itemIds:[...pile.itemIds]}}:{})};
 }
 hitTest(clientX:number,clientY:number):WorldHit|null{
  if(!this.setRay(clientX,clientY))return null;
  const hits=this.proxies().filter(p=>this.ray.ray.intersectsBox(p.box)).sort((a,b)=>a.priority-b.priority||this.ray.ray.origin.distanceToSquared(a.center)-this.ray.ray.origin.distanceToSquared(b.center));
  if(hits[0])return{ref:hits[0].ref,position:hits[0].position};
  return this.groundHit();
 }
 private groundHit():WorldHit|null{
  const point=this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-.2),new T.Vector3());if(!point)return null;
  const v=this.view(),floor=v.alpha5?v.player.floor:Math.round(1-point.y/FLOOR_HEIGHT)||0,x=Math.round(point.x);
  // Ground and Alpha5 air targets have separate hit regions.
  if((v.alpha5?(point.y-floorY(floor)<-.8||point.y-floorY(floor)>2.5):Math.abs(point.y-floorY(floor))>.55)||x<1||x>=v.map.width-1||!v.explored[floor]?.includes(x))return null;
  return{ref:{type:'world-cell',floor,x},position:{floor,x}};
 }
 worldScreenPoint(ref:TargetRef):{x:number;y:number}|null{
  let world:T.Vector3|undefined;
  if(ref.type==='world-cell'){const v=this.view();if(!v.explored[ref.floor]?.includes(ref.x))return null;world=new T.Vector3(ref.x,floorY(ref.floor)+.06,.2);}
  else if(ref.type==='self'){const p=this.view().player;world=new T.Vector3(p.x,floorY(p.floor)+1,.2);}
  else world=this.proxies().find(p=>key(p.ref)===key(ref))?.center.clone();
  return world?this.project(world):null;
 }
 private project(world:T.Vector3):{x:number;y:number}|null{this.camera.updateMatrixWorld(true);world.project(this.camera);if(Math.abs(world.x)>1||Math.abs(world.y)>1||Math.abs(world.z)>1)return null;const r=this.rect();return{x:r.left+(world.x+1)*r.width/2,y:r.top+(1-world.y)*r.height/2};}
 targetWorldPoint(ref:TargetRef):T.Vector3|null{
  if(ref.type==='world-cell'){const p=targetPosition(this.view(),ref);return p?new T.Vector3(p.x,floorY(p.floor)+.08,.3):null;}
  if(ref.type==='self'){const p=this.view().player;return new T.Vector3(p.x,floorY(p.floor)+1,.3);}
  return this.proxies().find(p=>key(p.ref)===key(ref))?.center.clone()??null;
 }
}
const keyEdge=(edge:LadderEdge)=>`${edge.linkId}/${edge.fromFloor}/${edge.toFloor}/${edge.x}`;
