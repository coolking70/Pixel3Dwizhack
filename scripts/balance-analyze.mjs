import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import path from 'node:path';
const input=process.argv[2];if(!input)throw new Error('Usage: balance-analyze.mjs <runs.json or summary-runs.json>');
const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try{const {analyzeEvidence}=await server.ssrLoadModule('/src/balance/analysis.ts');const {runs}=JSON.parse(await readFile(input,'utf8'));const out=path.join(path.dirname(path.resolve(input)),'analysis.json');await writeFile(out,JSON.stringify(analyzeEvidence(runs),null,2));console.log(out);}finally{await server.close();}
