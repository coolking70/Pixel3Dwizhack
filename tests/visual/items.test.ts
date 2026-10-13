import { describe, it, expect, vi } from 'vitest';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveItemVisual } from '../../src/visual/items/appearance-resolver';
import { ITEM_VISUALS } from '../../src/visual/items/registry';
import { createItemModelCache, bindItemToSocket } from '../../src/visual/items/presenter';
import { GameSession } from '../../src/session/session';
import type { Item2View } from '../../src/core/alpha2-types';
import manifest from '../../public/assets/items/manifest.json';

const fixture = (category: Item2View['category'], appearance = 0, definition?: string): Item2View => ({id:1,name:{zh:'测试',en:'Test'},category,appearance,...(definition?{definition}:{}),durability:10,proof:false,actions:[],note:'',weight:1});

describe('M16 item visible identity', () => {
  it('secret identity cannot influence asset, URL, socket or serialized spec, including after identification', () => {
    for (const [category, count] of [['potion',8],['scroll',6],['wand',5],['accessory',2]] as const) for(let appearance=0;appearance<count;appearance++) {
      const unknown = fixture(category,appearance), known = {...unknown,definition:'hidden-effect-sentinel',name:{zh:'秘密',en:'Secret'},charges:999,enchantment:3};
      const spec = resolveItemVisual(unknown);
      expect(spec.status).toBe('ready'); expect(resolveItemVisual(known)).toEqual(spec);
      expect(JSON.stringify(spec)).not.toMatch(/hidden-effect|Secret|秘密/);
      expect(spec.assetId).toBe(`${category}-${appearance}`);
    }
  });
  it('fixed silhouettes are distinct and unfinished definitions do not masquerade as completed assets', () => {
    const ids=['sword','knife','maul','shield','helm','ration','lantern','kit'];
    const specs=ids.map(id=>resolveItemVisual(fixture('weapon',0,id)));
    expect(new Set(specs.map(s=>s.silhouetteTag)).size).toBe(8);
    expect(specs.every(s=>s.status==='ready')).toBe(true);
    expect(resolveItemVisual(fixture('weapon',0,'spear')).status).toBe('ready');
    expect(resolveItemVisual(fixture('weapon',0,'unregistered-future-item')).status).toBe('planned');
    expect(resolveItemVisual(fixture('potion',-1,'renewal')).status).toBe('planned');
  });
  it('natural public sessions shuffle appearance without any resolver mutation of state or history', () => {
    const variants=new Set<string>();
    for(const seed of [1,2,3,4,5,11,42,71,101]) {
      const session=new GameSession(seed,'alpha2');
      const before=JSON.stringify(session.view());
      const bag=session.view().alpha2!.bag;
      for(const item of bag) { const spec=resolveItemVisual(item); if(item.category==='potion')variants.add(spec.assetId); expect(resolveItemVisual(structuredClone(item))).toEqual(spec); }
      expect(JSON.stringify(session.view())).toBe(before);
    }
    expect(variants.size).toBeGreaterThan(1);
  });
});

describe('M16 GLB shared resources', () => {
  it('all real exported models parse, match source hashes, carry grip and bounded geometry', async () => {
    const loader=new GLTFLoader();
    for(const spec of manifest.assets) for(const level of spec.lod) {
      const bytes=readFileSync(`public${level.uri}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(level.sha256);
      const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      expect(gltf.scene.getObjectByName('grip')).toBeDefined();
      let triangles=0,meshes=0;
      gltf.scene.traverse(o=>{if(o instanceof T.Mesh){meshes++; triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
      expect(triangles).toBe(level.triangles);expect(meshes).toBe(level.drawCalls);
      expect(new T.Box3().setFromObject(gltf.scene).isEmpty()).toBe(false);
    }
  });
  it('deduplicates inflight loads and shares resources while preserving independent clone transforms',async()=>{
    const root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();root.add(new T.Mesh(geometry,material));
    const load=vi.fn(async()=>root),cache=createItemModelCache(load),spec=ITEM_VISUALS[0]!;
    const [a,b]=await Promise.all([cache.instantiate(spec),cache.instantiate(spec)]);
    expect(load).toHaveBeenCalledTimes(1);expect(a).not.toBe(b);expect(a!.children[0]).not.toBe(b!.children[0]);
    expect((a!.children[0] as T.Mesh).geometry).toBe((b!.children[0] as T.Mesh).geometry);
    a!.position.x=7;expect(b!.position.x).toBe(0);expect(cache.peek(spec)!.userData.itemAsset).toBe(true);
    const socket=new T.Group(); bindItemToSocket(a!,socket,spec);expect(a!.parent).toBe(socket);
    const dispose=vi.spyOn(geometry,'dispose');cache.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(cache.peek(spec)).toBeNull();expect(await cache.instantiate(spec)).toBeNull();
  });
  it('disposes late templates and never revives a closed cache',async()=>{
    let complete!:(root:T.Group)=>void;const cache=createItemModelCache(()=>new Promise(resolve=>{complete=resolve;}));
    const waiting=cache.instantiate(ITEM_VISUALS[0]!);cache.dispose();
    const root=new T.Group(),g=new T.BoxGeometry(),m=new T.MeshBasicMaterial();root.add(new T.Mesh(g,m));const dispose=vi.spyOn(g,'dispose');
    complete(root);expect(await waiting).toBeNull();expect(dispose).toHaveBeenCalledTimes(1);expect(cache.size).toBe(0);
  });
});
