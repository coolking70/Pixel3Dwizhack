import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BlockCharacter } from '../../src/character-lab/character';
import { parseRig } from '../../src/character-lab/assets';
import { ItemEquipment } from '../../src/visual/items/equipment';
import { createItemModelCache } from '../../src/visual/items/presenter';
import { ITEM_VISUALS } from '../../src/visual/items/registry';
import { resolveItemVisual } from '../../src/visual/items/appearance-resolver';
import { applyItemAppearance, itemAppearanceKey } from '../../src/visual/items/appearance';
import type { Item2View } from '../../src/core/alpha2-types';

const load = async (uri:string) => { const b=readFileSync(`public${uri}`);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene; };
const actor = () => new BlockCharacter(parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8'))));
const item = (definition:string, equipped:Item2View['equipped']):Item2View=>({id:1,definition,category:equipped==='charm'?'accessory':equipped==='mainHand'?'weapon':'armor',appearance:0,name:{zh:definition,en:definition},durability:10,proof:false,actions:[],note:'',weight:1,equipped});
const items = ['sword','shield','helm','plate','boots','secret'].map((id,n)=>item(id,(['mainHand','offHand','head','chest','legs','charm'] as const)[n]));

describe('M18 actual item equipment',()=>{
  it('public food condition changes only the clone overlay and cannot change secret appearances',async()=>{
    const cache=createItemModelCache(load);
    for(const spec of ITEM_VISUALS.filter(s=>s.family==='food'))for(const level of [0,1,2] as const){
      const fresh:Item2View={...item(spec.assetId.slice(6),undefined),category:'food',freshness:'fresh'},stale={...fresh,freshness:'stale'} as Item2View;
      const a=(await cache.instantiate(spec,level))!,b=cache.peek(spec,level)!;
      expect(a.getObjectByName('FreshnessOverlay')!.scale.length()).toBe(0);
      applyItemAppearance(a,fresh);applyItemAppearance(b,stale);expect(a.getObjectByName('FreshnessOverlay')!.visible).toBe(false);expect(b.getObjectByName('FreshnessOverlay')!.visible).toBe(true);
      expect(a.getObjectByName('FreshnessOverlay')!.scale.length()).toBe(0);expect(b.getObjectByName('FreshnessOverlay')!.scale.toArray()).toEqual([1,1,1]);
      expect((a.getObjectByName('FreshnessOverlay')!.children[0] as T.Mesh).material).toBe((b.getObjectByName('FreshnessOverlay')!.children[0] as T.Mesh).material);
      expect(resolveItemVisual(fresh)).toBe(resolveItemVisual(stale));expect(itemAppearanceKey(fresh)).not.toBe(itemAppearanceKey(stale));
      applyItemAppearance(b,fresh);expect(b.getObjectByName('FreshnessOverlay')!.visible).toBe(false);
    }
    const secret={...item('hidden-effect',undefined),category:'potion'} as Item2View;expect(itemAppearanceKey({...secret,freshness:'fresh'})).toBe(itemAppearanceKey({...secret,freshness:'stale'}));cache.dispose();
  });
  it('loads separate LOD templates and preserves exact action sockets on every level',async()=>{
    const loader=vi.fn(load),cache=createItemModelCache(loader);
    for(const spec of ITEM_VISUALS){
      expect(spec.lod).toHaveLength(3);
      expect(spec.lod![0]!.triangles).toBeGreaterThan(spec.lod![1]!.triangles);
      expect(spec.lod![1]!.triangles).toBeGreaterThan(spec.lod![2]!.triangles);
      for(const level of [0,1,2] as const){
        const root=(await cache.instantiate(spec,level))!;
        for(const socket of ['grip','muzzle','contact','supportGrip'] as const)if(spec[socket])expect(root.getObjectByName(socket)?.position.toArray()).toEqual([...spec[socket]!]);
        for(const binding of spec.worn?.bindings??[])expect(root.getObjectByName(binding.node)).toBeDefined();
        if(spec.family==='scroll') { const sheet=root.getObjectByName('ReadingSheet')!;expect(sheet.scale.x).toBe(.001);const closed=new T.Box3().setFromObject(sheet).getSize(new T.Vector3());sheet.scale.x=1;const open=new T.Box3().setFromObject(sheet).getSize(new T.Vector3());expect(open.x).toBeGreaterThan(closed.x*900);expect(spec.supportGrip).toBeDefined(); }
        expect(root.userData.itemLOD).toBe(level);
      }
    }
    expect(loader).toHaveBeenCalledTimes(150);expect(cache.size).toBe(150);cache.dispose();
  });
  it('replaces all six slots with articulated pieces, restores masks, and swaps LOD without disposing shared geometry',async()=>{
    const a=actor(),cache=createItemModelCache(load),specs=items.map(resolveItemVisual);
    a.setEquipment({model:'vanguard',outfit:'brigandine',helmet:true,sword:true,shield:true});
    const baseline=new Map<T.Object3D,boolean>();a.root.traverse(o=>baseline.set(o,o.visible));
    await cache.preload(specs);await cache.preload(specs,2);
    const equipment=new ItemEquipment(a,()=>{},cache,false);equipment.update(items);
    expect(equipment.inspect()).toHaveLength(6);expect(a.heldWeapon.root.visible).toBe(false);expect(a.shield.root.visible).toBe(false);
    const worn:T.Object3D[]=[];a.root.traverse(o=>{if(o.userData.itemAsset)worn.push(o);});
    expect(worn.some(o=>o.parent?.name==='ShinL')).toBe(true);expect(worn.some(o=>o.parent?.name==='UpperArmR')).toBe(true);
    const torso=worn.find(o=>o.name==='piece_torso')!;expect(torso.parent?.name).toBe('Chest');
    const mesh=torso.children.find(o=>o instanceof T.Mesh) as T.Mesh,dispose=vi.spyOn(mesh.geometry,'dispose');
    equipment.setLOD(2);expect(equipment.inspect().every(e=>e.level===2)).toBe(true);expect(torso.parent).toBeNull();expect(dispose).not.toHaveBeenCalled();
    equipment.update([]);expect(equipment.inspect()).toEqual([]);
    for(const [o,visible] of baseline)expect(o.visible,`restore ${o.name}`).toBe(visible);
    equipment.update(items);equipment.dispose();expect(a.heldWeapon.root.visible).toBe(true);expect(a.shield.root.visible).toBe(true);expect(dispose).not.toHaveBeenCalled();
    cache.dispose();expect(dispose).toHaveBeenCalledOnce();a.dispose();
  });
  it('late loading an old weapon cannot replace the current item or revive disposed equipment',async()=>{
    const templates=new Map<string,T.Group>();for(const id of ['sword','knife']){const s=resolveItemVisual(item(id,'mainHand'));templates.set(s.source.uri,await load(s.source.uri));}
    const pending=new Map<string,(v:T.Group)=>void>(),cache=createItemModelCache(uri=>new Promise(resolve=>pending.set(uri,resolve))),a=actor(),redraw=vi.fn(),equipment=new ItemEquipment(a,redraw,cache);
    const sword=item('sword','mainHand'),knife=item('knife','mainHand');equipment.update([sword]);equipment.update([knife]);
    const swordUri=resolveItemVisual(sword).source.uri,knifeUri=resolveItemVisual(knife).source.uri;
    pending.get(swordUri)!(templates.get(swordUri)!);await vi.waitFor(()=>expect(redraw).toHaveBeenCalledOnce());expect(equipment.inspect()).toEqual([]);
    equipment.dispose();pending.get(knifeUri)!(templates.get(knifeUri)!);await new Promise(resolve=>setTimeout(resolve,0));expect(equipment.inspect()).toEqual([]);expect(redraw).toHaveBeenCalledOnce();expect(cache.size).toBe(0);a.dispose();
  });
});
