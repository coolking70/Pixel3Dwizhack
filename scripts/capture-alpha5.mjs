import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=process.argv[2];if(!file)throw Error('Pass a recorded Alpha5 natural run');
const saved=JSON.parse(await readFile(file,'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
if(saved.run.config.scenario!=='alpha5'||saved.run.outcome!=='won'||saved.traceSha256!==sha(JSON.stringify(saved.run.trace)))throw Error('Not a valid Alpha5 winning trace');
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
try{const {captureTrace4}=await server.ssrLoadModule('/src/balance4/runner.ts');const raw=captureTrace4(saved.run);await writeFile('tests/fixtures/alpha5-v1.json',raw+'\n');await writeFile('reports/m31/golden.json',JSON.stringify({sourceRun:file,sourceSha256:saved.sourceSha256,traceSha256:saved.traceSha256,archiveSha256:sha(raw),seed:saved.run.config.seed,loadout:saved.run.config.loadout,strategy:saved.run.config.strategy,actions:saved.run.actions,digest:saved.run.finalDigest},null,2)+'\n');console.log('Captured formal natural Alpha5 golden',saved.run.actions,saved.run.finalDigest);}finally{await server.close();}
