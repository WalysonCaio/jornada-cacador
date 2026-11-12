import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const handlers={},deleted=[],puts=[];let networkCalls=0,offline=false;
const items=new Map();
const cache={match:async req=>items.get(typeof req==='string'?req:req.url),put:async(req,res)=>puts.push(req.url),addAll:async()=>{}};
const ctx={URL,Response,Set,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/'},addEventListener:(n,fn)=>handlers[n]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}},caches:{open:async()=>cache,keys:async()=>['other-app','jornada-cacador-old'],delete:async k=>deleted.push(k)},fetch:async()=>{networkCalls++;if(offline)throw Error('offline');return {status:200,type:'basic',clone:()=>new Response('network')};}};
vm.runInNewContext(fs.readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),ctx);
let pending;handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['jornada-cacador-old']);
function request(path,mode='cors',headers=new Headers()) {let response;handlers.fetch({request:{method:'GET',url:'https://example.test'+path,mode,headers},respondWith:p=>response=p});return response;}
items.set('https://example.test/icon.svg',new Response('cached'));
assert.equal(await (await request('/icon.svg')).text(),'cached');assert.equal(networkCalls,0);
offline=true;
assert.equal((await request('/v77-experience.js')).status,503,'JS ausente nunca vira HTML');
items.set('https://example.test/index.html',new Response('shell'));
assert.equal(await (await request('/','navigate')).text(),'shell');
assert.equal(request('/api/private'),undefined);assert.equal(request('/index.html?token=x'),undefined);assert.equal(request('/index.html','cors',new Headers({authorization:'Bearer x'})),undefined);
console.log('OK: cache isolado, mídia sem rede, navegação offline, JS ausente 503, conteúdo privado ignorado.');
