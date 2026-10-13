// Public geometry only. --write deterministically refreshes metadata; default audits it.
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('src/visual/items/manifest.json',root),'utf8')),loader=new GLTFLoader(),assets={};
for(const spec of manifest.assets){
 assets[spec.assetId]=[];
 for(const level of spec.lod){
  const bytes=await readFile(new URL('public'+level.uri,root)),digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==level.sha256)throw Error(`GLB source mismatch: ${level.uri}`);
  const model=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,b=new T.Box3().setFromObject(model,true);
  assets[spec.assetId].push({min:b.min.toArray(),max:b.max.toArray(),sha256:digest});
 }
}
const path=new URL('src/room/ground-pile-bounds.json',root),text=JSON.stringify({schema:1,provenance:'Public GLB vertex bounds per LOD; generated and audited by scripts/check-pile-bounds.mjs',assets},null,2)+'\n';
if(process.argv.includes('--write'))await writeFile(path,text);
else if(await readFile(path,'utf8')!==text)throw Error('Ground pile bounds stale; run node scripts/check-pile-bounds.mjs --write and review changed source GLBs');
console.log(`${process.argv.includes('--write')?'Generated':'Audited'} ${Object.keys(assets).length} public assets / ${Object.values(assets).reduce((n,a)=>n+a.length,0)} LOD bounds and SHA-256s`);
