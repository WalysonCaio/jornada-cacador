// Executa os handlers reais do service worker, sem navegador ou acesso à rede.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
const expectedRelease='r'+JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version.split('.').at(-1);
const scope='https://app.test/study/';
const absolute=value=>typeof value==='string'?new URL(value,scope).href:value.url;
function response(body,{status=200,type='basic'}={}){
 return{status,type,body,clone(){return response(body,{status,type});},async text(){return body;}};
}
function fixture(existing){
 const stores=existing||new Map(),handlers=new Map(),networkCalls=[],precached=[],removed=[];
 let fetchHandler=async request=>response(`network:${absolute(request)}`),rejectPut=false,skipped=0,claimed=0;
 function cache(name){
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return{
   async addAll(assets){for(const asset of assets){precached.push(asset);store.set(absolute(asset),response(`precache:${absolute(asset)}`));}},
   async match(request){const saved=store.get(absolute(request));return saved?.clone();},
   async put(request,value){if(rejectPut)throw new Error('fixture quota');store.set(absolute(request),value.clone());},
  };
 }
 const ctx={URL,Response,Set,Promise,
  self:{registration:{scope},location:{origin:new URL(scope).origin},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skipped++;},addEventListener:(name,handler)=>handlers.set(name,handler)},
  caches:{open:async name=>cache(name),keys:async()=>[...stores.keys()],delete:async name=>{removed.push(name);return stores.delete(name);}},
  fetch:async(request,options)=>{networkCalls.push({url:absolute(request),options});return fetchHandler(request,options);},
 };
 vm.runInNewContext(source,ctx);
 async function lifecycle(name){let pending;handlers.get(name)({waitUntil:promise=>{assert.equal(pending,undefined);pending=promise;}});assert(pending,name+' registra waitUntil');await pending;}
 async function request(path,options={}){
  let pending;
  const req={url:new URL(path,scope).href,method:options.method||'GET',headers:new Headers(options.headers),mode:options.mode||'cors'};
  handlers.get('fetch')({request:req,respondWith:promise=>{assert.equal(pending,undefined);pending=promise;}});
  return pending===undefined?undefined:await pending;
 }
 return{stores,networkCalls,precached,removed,request,install:()=>lifecycle('install'),activate:()=>lifecycle('activate'),
  network:fn=>{fetchHandler=fn;},offline:()=>{fetchHandler=async()=>{throw new Error('fixture offline');};},failPut:value=>{rejectPut=value;},
  get skipped(){return skipped;},get claimed(){return claimed;}};
}

// A instalação conserva o shell e os fallbacks de imagem, sem baixar o motor PDF.
{
 const f=fixture();await f.install();
 assert.equal(f.skipped,1);assert(f.precached.includes('./index.html'));
 for(const file of ['./pdf.mjs','./pdf.worker.mjs'])assert(!f.precached.includes(file),file+' deve carregar no primeiro uso');
 for(const file of ['./login-banner.jpg','./login-banner.webp','./bancas-boss-banner.jpg','./bancas-boss-banner.webp','./og-banner-1200x630.jpg'])assert(f.precached.includes(file),file+' permanece disponível no modo offline');
 assert.equal(f.networkCalls.length,0,'Nenhuma chamada de rede do handler foi disparada no teste');
 assert.equal(f.stores.size,1);assert([...f.stores.keys()][0].endsWith('-'+expectedRelease));
}

// Um PDF ainda não aberto falha como recurso, sem receber o HTML do aplicativo.
{
 const f=fixture();await f.install();f.offline();
 for(const file of ['./pdf.mjs','./pdf.worker.mjs']){
  const result=await f.request(file);assert.equal(result.status,503);const body=await result.text();assert.match(body,/offline/);
  assert(!body.includes('precache:'));
 }
 const shell=await f.request('./index.html',{mode:'navigate'});assert.equal(shell.status,200);assert.match(await shell.text(),/precache:.*index\.html/);
}

// Primeiro uso online grava só a resposta válida; os próximos usos funcionam offline.
{
 const f=fixture();await f.install();
 for(const file of ['./pdf.mjs','./pdf.worker.mjs']){
  const first=await f.request(file);assert.equal(first.status,200);assert.equal(await first.text(),`network:${absolute(file)}`);
  assert.equal(f.networkCalls.at(-1).options.cache,'no-cache');
 }
 const calls=f.networkCalls.length;f.offline();
 for(const file of ['./pdf.mjs','./pdf.worker.mjs'])assert.equal(await(await f.request(file)).text(),`network:${absolute(file)}`);
 assert.equal(f.networkCalls.length,calls,'Cache de módulos evita nova tentativa de rede quando a cópia já existe');
 const restarted=fixture(f.stores);restarted.offline();
 assert.equal(await(await restarted.request('./pdf.mjs')).text(),`network:${absolute('./pdf.mjs')}`,'Cópia fica disponível após reiniciar o worker');
}

// Só os dois caminhos públicos explicitamente permitidos entram no cache sob demanda.
{
 const f=fixture();await f.install();
 for(const [path,options] of [
  ['./pdf.mjs?token=fixture',{}],['./pdf.worker.mjs?version=1',{}],['./pdf.mjs',{method:'POST'}],
  ['./pdf.mjs',{headers:{Authorization:'Bearer fixture'}}],['https://other.test/pdf.mjs',{}],
  ['./rest/v1/private',{}],['./private.mjs',{}],['./nested/pdf.mjs',{}],
 ])assert.equal(await f.request(path,options),undefined,`${path} deve continuar fora do handler`);
 assert.equal(f.networkCalls.length,0);
}

// Respostas incompletas, de erro ou de outra natureza não criam uma cópia offline.
for(const options of [{status:404,type:'basic'},{status:500,type:'basic'},{status:206,type:'basic'},{status:200,type:'opaque'},{status:200,type:'cors'}]){
 const f=fixture();await f.install();f.network(async()=>response('not cacheable',options));
 const fetched=await f.request('./pdf.mjs');assert.equal(fetched.status,options.status);
 f.offline();assert.equal((await f.request('./pdf.mjs')).status,503,JSON.stringify(options));
}

// Falha de quota não transforma um download bem-sucedido em falha do leitor.
{
 const f=fixture();await f.install();f.failPut(true);
 const result=await f.request('./pdf.mjs');assert.equal(result.status,200);assert.equal(await result.text(),`network:${absolute('./pdf.mjs')}`);
 f.offline();assert.equal((await f.request('./pdf.mjs')).status,503,'Sem gravação confirmada não se anuncia funcionamento offline');
}

// Ativação limpa apenas as versões antigas desta aplicação.
{
 const f=fixture(new Map([['unrelated-user-cache',new Map()],['jornada-cacador-old',new Map()],['jornada-cacador-v78-smart-notebook-r184',new Map()]]));
 await f.install();await f.activate();assert.equal(f.claimed,1);assert(f.stores.has('unrelated-user-cache'));
 assert(!f.stores.has('jornada-cacador-old'));assert(!f.stores.has('jornada-cacador-v78-smart-notebook-r184'));
 assert([...f.stores.keys()].some(key=>key.endsWith('-'+expectedRelease)));assert(!f.removed.includes('unrelated-user-cache'));
}
console.log('OK r185 SW: PDF/worker sob demanda, shell e JPGs preservados, cache válido após primeiro uso, offline honesto, allowlist, falha de quota e ativação isolada.');
