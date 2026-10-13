import * as T from 'three';
import type {PublicView} from '../core/types';
import type {GroundPileVisual} from '../interaction/ux-types';
import manifest from './ground-pile-bounds.json' with {type:'json'};
import type {ItemLOD} from '../visual/items/types';
import {resolveItemVisual} from '../visual/items/appearance-resolver';
import {floorY} from './presentation';

export const GROUND_CONTACT_Y=-.05;
export const MAX_PILE_MODELS=4;
const boundsByAsset:Readonly<Record<string,readonly {min:number[];max:number[]}[]>>=manifest.assets;
export type GroundMember=GroundPileVisual['members'][number];
/** Public asset bounds, rotated exactly as the displayed model; independent of LOD/cache. */
export function rotatedItemBounds(assetId:string,angle:number,level:ItemLOD=0):T.Box3 {
 const b=boundsByAsset[assetId]?.[level],box=b?new T.Box3(new T.Vector3(...b.min as [number,number,number]),new T.Vector3(...b.max as [number,number,number])):new T.Box3(new T.Vector3(-.15,0,-.1),new T.Vector3(.15,.3,.1));
 return box.applyMatrix4(new T.Matrix4().makeRotationZ(angle));
}
export function memberBounds(member:GroundMember):T.Box3 {
 return new T.Box3().setFromCenterAndSize(new T.Vector3(member.pose.x,member.pose.y,member.pose.z),new T.Vector3(member.selectableBounds.width,member.selectableBounds.height,member.selectableBounds.depth));
}
/** A shared local transform. Parent is at pose.xyz; the model's bounds are centered on it. */
export function placeGroundModel(model:T.Object3D,member:GroundMember,level:ItemLOD=0):void {
 const center=rotatedItemBounds(member.assetId,member.pose.angle,level).getCenter(new T.Vector3());
 model.rotation.set(0,0,member.pose.angle);model.scale.setScalar(member.pose.scale);model.position.copy(center).multiplyScalar(-member.pose.scale);model.updateMatrix();
}
export function pileMarkerPosition(pile:GroundPileVisual):T.Vector3{return new T.Vector3(pile.cell.x,floorY(pile.cell.floor)+.76,.62);}
export function pileMarkerBounds(pile:GroundPileVisual):T.Box3{return new T.Box3().setFromCenterAndSize(pileMarkerPosition(pile),new T.Vector3(.55,.25,.18));}
/** Stable public-ID layout: no definition lookup, RNG, simulation write or animation clock. */
export const groundLOD=(view:PublicView,position:{floor:number;x:number},low=false):ItemLOD=>low?2:position.floor!==view.player.floor||Math.abs(position.x-view.player.x)>3?1:0;
export function groundPiles(view:PublicView,lowQuality=false,pickupId?:number):GroundPileVisual[]{
 const cells=new Map<string,NonNullable<PublicView['alpha2']>['ground']>();
 for(const item of view.alpha2?.ground??[]){const key=`${item.floor}/${item.x}`,items=cells.get(key)??[];items.push(item);cells.set(key,items);}
 return [...cells.values()].sort((a,b)=>a[0]!.floor-b[0]!.floor||a[0]!.x-b[0]!.x).map(items=>{
  const sorted=[...items].sort((a,b)=>a.id-b.id),cell={floor:sorted[0]!.floor,x:sorted[0]!.x},count=Math.min(MAX_PILE_MODELS,sorted.length);
  // A committed pickup may expose its hidden member in the last physical slot.
  // This presentation-only promotion never changes the complete chooser ID list.
  const shown=sorted.slice(0,MAX_PILE_MODELS),pickup=sorted.find(i=>i.id===pickupId);
  if(pickup&&!shown.some(i=>i.id===pickup.id))shown[shown.length-1]=pickup;
  const members=shown.map((item,index)=>{
   const spec=resolveItemVisual(item),flat=item.category==='weapon'||item.category==='wand',angle=flat?Math.PI/2:0;
   const bounds=rotatedItemBounds(spec.assetId,angle,groundLOD(view,item,lowQuality)),size=bounds.getSize(new T.Vector3()),width=count===1?.84:count<=2?.40:.30,depth=count<=2?.60:.28;
   const scale=Math.min(spec.ground.scale,width/Math.max(.01,size.x),depth/Math.max(.01,size.z),.58/Math.max(.01,size.y));size.multiplyScalar(scale);
   const offset=count<=2?.23:index<2?.28:.16,x=cell.x+(count===1?0:index%2===0?-offset:offset),z=count<=2?.42:index<2?.26:.62;
   return{itemId:item.id,assetId:spec.assetId,pose:{x,y:floorY(cell.floor)+GROUND_CONTACT_Y+size.y/2,z,angle,scale},selectableBounds:{width:size.x,height:size.y,depth:size.z}};
  });return{cell,itemIds:sorted.map(i=>i.id),members};
 });
}
