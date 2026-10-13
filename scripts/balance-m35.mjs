import {createServer} from 'vite';
import {writeFile,mkdir,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Output directory required');await mkdir(out,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function files(dir){const found=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())found.push(...await files(p));else found.push(p);}return found;}
const source=[];for(const p of (await Promise.all(['src/core','src/content','src/session','src/balance','src/balance4','src/balance5'].map(files))).flat().sort())source.push({path:p,sha256:hash(await readFile(p))});
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'}),started=performance.now();
try{const {runGame4,replayTrace4,captureTrace4}=await server.ssrLoadModule('/src/balance4/runner.ts');const rows=[];
for(const seed of [1,24681])for(const loadout of ['vanguard','breaker','channeler'])for(const strategy of ['novice','survivor','fighter']){
 const config={seed,loadout,strategy,scenario:'alpha6',maxActions:1600,maxTicks:40000,stuckLimit:12};const run=runGame4(config),again=runGame4(config);if(JSON.stringify(run.trace)!==JSON.stringify(again.trace))throw Error('Double run mismatch');replayTrace4(run);const raw=captureTrace4(run);await writeFile(`${out}/${seed}-${loadout}-${strategy}.json`,JSON.stringify({run,archive:JSON.parse(raw)}));
 if(seed===1&&loadout==='vanguard'&&strategy==='survivor'&&run.outcome==='won')await writeFile('tests/fixtures/alpha6-v1.json',raw+'\n');
 rows.push({config,outcome:run.outcome,actions:run.actions,digest:run.finalDigest,traceSha256:hash(JSON.stringify(run.trace))});console.log(seed,loadout,strategy,run.outcome,run.actions);
}
await writeFile('reports/m35/balance.json',JSON.stringify({source,sourceSha256:hash(JSON.stringify(source)),elapsedMs:performance.now()-started,rows,scope:'2 seeds x 3 loadouts x 3 policies; double run and per-attempt replay; no 9000 expansion'},null,2));}finally{await server.close();}
