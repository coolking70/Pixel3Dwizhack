// Deterministic, texture-free GLB 2.0 exporter for original recipes (MIT).
import * as T from 'three';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { recipes } from '../assets-src/items/recipes.mjs';
const check=process.argv.includes('--check');
const root=new URL('../',import.meta.url), path=p=>new URL(p,root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const sourceHash=hash(await readFile(path('assets-src/items/recipes.mjs')));
async function output(file,bytes) { if(check) { if(!Buffer.from(await readFile(path(file))).equals(Buffer.from(bytes)))throw Error(`Stale item asset: ${file}`); } else { await writeFile(path(file),bytes); } }
function primitive(p,level) {
 const s=p.size;
 const segments=n=>Math.max(3,Math.floor(n*[1,.75,.5][level]));
 const g=p.shape==='box'?new T.BoxGeometry(...s):p.shape==='sphere'?new T.SphereGeometry(1,[10,8,6][level],[6,4,3][level]).scale(...s):p.shape==='cylinder'?new T.CylinderGeometry(s[0],s[1],s[2],segments(s[3])):p.shape==='cone'?new T.ConeGeometry(s[0],s[1],segments(s[2])):p.shape==='torus'?new T.TorusGeometry(s[0],s[1],[5,4,3][level],segments(s[2])):new T.OctahedronGeometry(s[0]);
 g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p.at),new T.Quaternion().setFromEuler(new T.Euler(...p.rotation)),new T.Vector3(1,1,1)));
 const result=g.index?g.toNonIndexed():g;if(result!==g)g.dispose();return result;
}
function exportGLB(recipe,level) {
 const chunks=[],views=[],accessors=[],materials=[],meshes=[],nodes=[];let offset=0,vertices=0,drawCalls=0;
 const bounds=new T.Box3();
 function accessor(values,type,dimension,withBounds=false) {
  const data=Buffer.from(new Float32Array(values).buffer),view=views.length;chunks.push(data);views.push({buffer:0,byteOffset:offset,byteLength:data.length});offset+=data.length;
  const a={bufferView:view,componentType:5126,count:values.length/dimension,type};
  if(withBounds){a.min=Array.from({length:dimension},(_,n)=>Math.min(...values.filter((_,i)=>i%dimension===n)));a.max=Array.from({length:dimension},(_,n)=>Math.max(...values.filter((_,i)=>i%dimension===n)));}
  accessors.push(a);return accessors.length-1;
 }
 const colors=new Map(),parts=recipe.parts.filter(p=>(p.lastLOD??2)>=level);
 for(const group of recipe.groups??[{id:'whole',assembly:[0,0,0]}]) {
  const selected=parts.filter(p=>(p.group??'whole')===group.id),primitives=[];
  for(const color of [...new Set(selected.map(p=>p.color))]) {
   const positions=[],normals=[];
   for(const p of selected.filter(p=>p.color===color)) { const g=primitive(p,level);positions.push(...g.getAttribute('position').array);normals.push(...g.getAttribute('normal').array);g.computeBoundingBox();bounds.union(g.boundingBox.clone().applyMatrix4(new T.Matrix4().compose(new T.Vector3(...group.assembly),new T.Quaternion(),new T.Vector3(...(group.initialScale??[1,1,1])))));g.dispose(); }
   vertices+=positions.length/3;
   if(!colors.has(color)){const c=new T.Color(color);colors.set(color,materials.length);materials.push({name:`surface-${materials.length}`,pbrMetallicRoughness:{baseColorFactor:[c.r,c.g,c.b,1],metallicFactor:.18,roughnessFactor:.72}});}
   primitives.push({attributes:{POSITION:accessor(positions,'VEC3',3,true),NORMAL:accessor(normals,'VEC3',3)},material:colors.get(color)});
  }
  nodes.push({name:group.name??`piece_${group.id}`,mesh:meshes.length,translation:group.assembly,...(group.initialScale?{scale:group.initialScale}:{})});meshes.push({primitives});drawCalls+=primitives.length;
 }
 nodes.push({name:'grip',translation:recipe.grip});
 if(recipe.muzzle)nodes.push({name:'muzzle',translation:recipe.muzzle});
 for(const socket of ['contact','supportGrip'])if(recipe[socket])nodes.push({name:socket,translation:recipe[socket]});
 const gltf={asset:{version:'2.0',generator:'Fallen Star original recipe exporter 2'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:offset}],bufferViews:views,accessors};
 let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 return {bytes:Buffer.concat([header,json,binHeader,bin]),vertices,triangles:vertices/3,drawCalls,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}
await mkdir(path('public/assets/items'),{recursive:true});
const assets=[];
for(const recipe of recipes) {
 const built=exportGLB(recipe,0),{bytes,...budget}=built;
 const file=`public/assets/items/${recipe.assetId}.glb`;
 await output(file,bytes);
 const lod=[{level:0,uri:`/assets/items/${recipe.assetId}.glb`,sha256:hash(bytes),triangles:budget.triangles,drawCalls:budget.drawCalls,bytes:bytes.length}];
 for(const level of [1,2]){const reduced=exportGLB(recipe,level),uri=`/assets/items/${recipe.assetId}-lod${level}.glb`;await output(`public${uri}`,reduced.bytes);lod.push({level,uri,sha256:hash(reduced.bytes),triangles:reduced.triangles,drawCalls:reduced.drawCalls,bytes:reduced.bytes.length});}
 assets.push({assetId:recipe.assetId,status:'ready',family:recipe.family,silhouetteTag:recipe.silhouetteTag,source:{kind:'glb',uri:`/assets/items/${recipe.assetId}.glb`,license:'MIT',sha256:hash(bytes)},recipe:{uri:'assets-src/items/recipes.mjs',sha256:sourceHash,author:'Fallen Star project — original procedural geometry'},ground:{scale:1,rotation:[0,0,0],anchor:[0,-budget.bounds.min[1],0]},preview:{cameraPreset:'three-quarter',framing:1.18,background:'transparent'},grip:recipe.grip,...(recipe.hand?{hand:recipe.hand}:{}),...(recipe.worn?{worn:recipe.worn}:{}),...(recipe.muzzle?{muzzle:recipe.muzzle}:{}),...(recipe.contact?{contact:recipe.contact}:{}),...(recipe.supportGrip?{supportGrip:recipe.supportGrip}:{}),lod,budget:{...budget,bytes:bytes.length,textures:0,minimumPreviewPixels:48}});
}
const manifest=JSON.stringify({schema:2,license:'MIT',assets},null,2)+'\n';
await output('public/assets/items/manifest.json',manifest);
await output('src/visual/items/manifest.json',manifest);
console.log(`${check?'Verified':'Built'} ${assets.length} original public identities / ${assets.length*3} GLBs; ${assets.reduce((n,a)=>n+a.lod.reduce((sum,l)=>sum+l.bytes,0),0)} bytes across three LODs.`);
