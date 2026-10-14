import * as T from 'three';
import { BlockCharacter } from '../../character-lab/character';
import { parseRig } from '../../character-lab/assets';
import { ITEM_VISUALS } from './registry';
import { createItemModelCache } from './presenter';
import { ItemEquipment } from './equipment';
import type { ItemLOD } from './types';
import type { Item2View } from '../../core/alpha2-types';

/** Isolated art inspection fixture, no session and no mechanical state. */
export async function inspectItemScene(mode: 'ground' | 'equipment' | 'reading', level: ItemLOD = 0, batch = 0): Promise<{ canvas: HTMLCanvasElement; calls: number; triangles: number; equipped: ReturnType<ItemEquipment['inspect']>[]; dispose(): void }> {
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: false }); renderer.setSize(1200, mode === 'ground' ? 900 : 700); renderer.setPixelRatio(1);
  renderer.setClearColor(0x222c32); const scene = new T.Scene(), cache = createItemModelCache();
  scene.add(new T.HemisphereLight(0xcbdced, 0x4c382c, 2));
  const light = new T.DirectionalLight(0xffd59d, 3.5); light.position.set(-4, 4, 2); scene.add(light);
  const rim = new T.DirectionalLight(0xf3964e, 2); rim.position.set(2, 2, -4); scene.add(rim);
  const camera = new T.OrthographicCamera(), characters: BlockCharacter[] = [], equipment: ItemEquipment[] = [];
  await cache.preload(ITEM_VISUALS, level);
  if (mode === 'ground') {
    ITEM_VISUALS.forEach((spec, n) => { const root = cache.peek(spec, level)!; root.position.set(n % 9 * 1.25 - 5, spec.ground.anchor[1], Math.floor(n / 9) * 1.35 - 2.7); scene.add(root); });
    camera.left = -6.9; camera.right = 6.9; camera.top = 5.175; camera.bottom = -5.175; camera.position.set(3, 7, 10); camera.lookAt(0, .3, 0);
  } else if(mode === 'reading') {
    ITEM_VISUALS.filter(s=>s.family==='scroll').forEach((spec,n)=>{for(const expanded of [false,true]){const root=cache.peek(spec,level)!;root.position.set(n*.85-2.25,expanded?.20:1.05,0);root.getObjectByName('ReadingSheet')!.scale.x=expanded?1:.001;scene.add(root);}});
    camera.left=-3.1;camera.right=3.1;camera.top=2.25;camera.bottom=-1.36;camera.position.set(0,2.4,7);camera.lookAt(0,.75,0);
  } else {
    const rig = parseRig(await (await fetch(import.meta.env.BASE_URL + 'assets/character-study/motions.json')).json());
    ['sword', 'knife', 'maul', 'spear', 'bow', 'fireblade', 'silverblade', 'staff'].slice(batch * 3, batch * 3 + 3).forEach((id, n) => {
      const actor = new BlockCharacter(rig); actor.setEquipment({model:'vanguard',outfit:'cloth',helmet:false,sword:true,shield:true}); actor.sample(batch===2?'walk':'idle',.25); actor.root.position.x = (n - 1) * 2.0; actor.root.rotation.y = batch===1?.40:-.22; characters.push(actor); scene.add(actor.root);
      const definitions=[id,n===1?'tower':'shield',n===1?'cap':'helm',['brigandine','plate','leather'][n]!,'boots','public-charm'];
      const slots=['mainHand','offHand','head','chest','legs','charm'] as const;
      const items:Item2View[]=definitions.map((definition,i)=>({id:i+1,name:{zh:definition,en:definition},category:i===0?'weapon':i===5?'accessory':'armor',...(i===5?{}:{definition}),appearance:n%2,durability:6,proof:false,actions:['equip'],note:'',weight:1,equipped:slots[i]!}));
      const worn=new ItemEquipment(actor,()=>{},cache,false);worn.setLOD(level);worn.update(items);worn.sample();equipment.push(worn);
    });
    camera.left = -3.8; camera.right = 3.8; camera.top = 2.9; camera.bottom = -1.53; camera.position.set(0, 2.1, 9); camera.lookAt(0, .85, 0);
  }
  const floor = new T.Mesh(new T.BoxGeometry(14, .1, 10), new T.MeshStandardMaterial({color:0x343e43,roughness:1})); floor.position.y = -.06; scene.add(floor);
  camera.near=.01;camera.far=40;camera.updateProjectionMatrix(); renderer.render(scene,camera);
  const calls = renderer.info.render.calls, triangles=renderer.info.render.triangles;
  return { canvas:renderer.domElement,calls,triangles,equipped:equipment.map(e=>e.inspect()),dispose(){ equipment.forEach(e=>e.dispose());characters.forEach(a=>a.dispose());floor.geometry.dispose();(floor.material as T.Material).dispose();cache.dispose();renderer.dispose(); } };
}
