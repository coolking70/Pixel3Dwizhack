import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadBalance} from './balance-load.mjs';
const root=process.argv[2]&&path.resolve(process.argv[2]);if(!root)throw new Error('Usage: balance-diagnose.mjs <milestone-directory>');
const folders=(await readdir(root)).filter(name=>/^seeds-\d+-\d+$/.test(name)).sort((a,b)=>Number(a.split('-')[1])-Number(b.split('-')[1]));
const balance=await loadBalance(),verified=[],errors=[];
try{
 for(const folder of folders){const directory=path.join(root,folder,'failures');for(const file of (await readdir(directory)).filter(name=>name.endsWith('.json')).sort()){
  const trace=JSON.parse(await readFile(path.join(directory,file),'utf8'));
  try{const digest=balance.replayTrace(trace);verified.push({file:`${folder}/failures/${file}`,seed:trace.config.seed,loadout:trace.config.loadout,strategy:trace.config.strategy,outcome:trace.outcome,cause:trace.deathCause,attempts:trace.attempts,digest});}
  catch(error){errors.push({file:`${folder}/failures/${file}`,error:String(error)});}
 }}
 const categories={};for(const row of verified){const key=`${row.outcome}:${row.cause??'not-a-death'}`;categories[key]=(categories[key]??0)+1;}
 await writeFile(path.join(root,'failure-verification.json'),JSON.stringify({verified:verified.length,categories,errors,traces:verified},null,2));
 console.log(JSON.stringify({verified:verified.length,categories,errors}));if(errors.length)process.exitCode=1;
}finally{await balance.close();}
