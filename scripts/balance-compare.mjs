import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const [baseline,candidate,out]=process.argv.slice(2);
if(!baseline||!candidate||!out)throw new Error('Usage: balance-compare.mjs <baseline-summary-runs.json> <candidate-summary-runs.json> <out.json>');
const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try{const {compareMatrices}=await server.ssrLoadModule('/src/balance/compare.ts');const a=JSON.parse(await readFile(baseline,'utf8')),b=JSON.parse(await readFile(candidate,'utf8'));const result=compareMatrices(a.runs,b.runs);await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({pairs:result.pairs,exactMatches:result.exactTraceAndDigestMatches,divergent:result.divergent.length}));if(result.divergent.length)process.exitCode=1;}finally{await server.close();}
