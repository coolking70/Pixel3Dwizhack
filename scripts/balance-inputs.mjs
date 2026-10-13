import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function walk(dir){
 const files=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const file=`${dir}/${e.name}`;
  if(e.isDirectory())files.push(...await walk(file));else if(/\.(ts|json|mjs)$/.test(e.name))files.push(file);
 }
 return files;
}
/** Freeze actual rule/content/session/policy inputs before loading Vite modules. */
export async function experimentInputs(){
 const files=(await Promise.all(['src/core','src/content','src/session','src/balance'].map(walk))).flat();
 files.push(...(await readdir('scripts')).filter(n=>/^balance-.*\.mjs$/.test(n)).map(n=>`scripts/${n}`),'package.json','package-lock.json');
 return Object.fromEntries(await Promise.all(files.sort().map(async f=>[f,sha(await readFile(f))])));
}
export function manifestSha(files){return sha(JSON.stringify(files));}
export async function verifyExperimentInputs(before){
 const after=await experimentInputs();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Experiment inputs changed during execution; candidate rejected');
 return after;
}
