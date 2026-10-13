// Dependency-free, loopback-only preview of the packaged production files.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname,isAbsolute} from 'node:path';
const root=fileURLToPath(new URL('./site/',import.meta.url));
const port=Number(process.argv[2]??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port must be 1024..65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(pathname==='/'){res.writeHead(302,{Location:'/alpha6.html'});res.end();return;}
  const file=resolve(root,'.'+pathname),local=relative(root,file);
  if(local.startsWith('..')||isAbsolute(local)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Fallen Star Alpha: http://127.0.0.1:${port}/alpha6.html\nPress Ctrl+C to stop.`));
