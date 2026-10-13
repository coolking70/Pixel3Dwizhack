import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { catalog } from '../assets-src/items/catalog.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));
const fail=(ok,message)=>{if(!ok)throw Error(message);};
execFileSync(process.execPath,['scripts/build-item-models.mjs','--check'],{cwd:root,stdio:'inherit'});
const content=(await read('src/content/alpha2.ts')).toString(),ids=[...content.matchAll(/\bitem\('([^']+)'/g)].map(m=>m[1]);
fail(ids.length===45&&catalog.length===50&&new Set(catalog.map(c=>c.definition)).size===50,'45 historical + 2 Alpha5 + 3 Alpha6 distinct plans required');
fail(ids.every(id=>catalog.some(c=>c.definition===id)), 'Content/plan mismatch');
fail(catalog.filter(c=>c.stage==='m16-sample').length===12,'Preserve the 12 original sample provenance entries');
const added=(await read('src/content/alpha5-catalog.ts')).toString();
for(const id of ['sporeBell','coilKey'])fail(added.includes(`id:'${id}'`)&&catalog.some(c=>c.definition===id),'Alpha5 content/plan mismatch');
const added6=(await read('src/content/alpha6-catalog.ts')).toString();
for(const id of ['rimeUrn','silverCenser','vigilMirror'])fail(added6.includes(`id:'${id}'`)&&catalog.some(c=>c.definition===id),'Alpha6 content/plan mismatch');
const manifest=JSON.parse(await read('public/assets/items/manifest.json'));
fail(manifest.assets.length===50,'29 fixed models and 21 public appearance variants required');
fail(new Set(manifest.assets.map(a=>a.assetId)).size===50,'Duplicate public visual identity');
fail(new Set(manifest.assets.map(a=>a.silhouetteTag)).size===50,'Every model needs an independently described silhouette');
for(const plan of catalog.filter(c=>!['potion','wand','scroll','accessory'].includes(c.family)))fail(manifest.assets.some(a=>a.assetId===`fixed-${plan.definition}`),`Missing fixed model ${plan.definition}`);
fail((await read('src/visual/items/manifest.json')).equals(await read('public/assets/items/manifest.json')),'Runtime/public manifests differ');
let bytes=0,triangles=0;
for(const a of manifest.assets){
 fail(a.lod?.length===3&&a.lod.every((l,n)=>l.level===n),'Three measured geometry levels required');
 fail(a.lod[0].triangles>a.lod[1].triangles&&a.lod[1].triangles>a.lod[2].triangles,`${a.assetId}: LOD must actually reduce geometry`);
 for(const level of a.lod){
  const b=await read(`public${level.uri}`);bytes+=b.length;triangles+=level.triangles;
  fail(createHash('sha256').update(b).digest('hex')===level.sha256,`${a.assetId}/${level.level}: hash mismatch`);
  fail(b.readUInt32LE(0)===0x46546c67&&b.readUInt32LE(4)===2&&b.readUInt32LE(8)===b.length,`${a.assetId}: GLB header`);
  const json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  for(const socket of ['grip','muzzle','contact','supportGrip'])if(a[socket])fail(JSON.stringify(json.nodes.find(n=>n.name===socket)?.translation)===JSON.stringify(a[socket]),`${a.assetId}/${level.level}: ${socket} changed`);
  for(const binding of a.worn?.bindings??[])fail(json.nodes.some(n=>n.name===binding.node),`${a.assetId}: missing worn node ${binding.node}`);
  const actualTriangles=json.meshes.reduce((n,m)=>n+m.primitives.reduce((sum,p)=>sum+json.accessors[p.attributes.POSITION].count/3,0),0),actualCalls=json.meshes.reduce((n,m)=>n+m.primitives.length,0);
  fail(actualTriangles===level.triangles&&actualCalls===level.drawCalls&&b.length===level.bytes,`${a.assetId}: measured budget mismatch`);
  fail(level.triangles<=2000&&level.drawCalls<=12&&b.length<=150000,`${a.assetId}: provisional per-item production budget exceeded`);
 }
 fail(a.source.uri===a.lod[0].uri&&a.source.sha256===a.lod[0].sha256&&a.budget.textures===0,`${a.assetId}: base source differs from LOD 0`);
 fail(a.source.license==='MIT'&&a.recipe.sha256.length===64&&a.silhouetteTag,`${a.assetId}: provenance missing`);
}
for(const [family,count] of Object.entries({potion:8,scroll:6,wand:5,accessory:2}))for(let i=0;i<count;i++)fail(manifest.assets.some(a=>a.assetId===`${family}-${i}`),'Missing public variant');
const files=await readdir(new URL('public/assets/items',root));fail(files.filter(f=>f.endsWith('.glb')).length===150,'Stale unexpected GLBs');
console.log(`Audited 50 definition plans / 50 public identities / 150 GLBs; ${bytes} bytes; ${triangles} total triangles across three LODs. Visual and device approval are separate.`);
