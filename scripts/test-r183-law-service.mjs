import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto, createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const source=readFileSync(new URL('../supabase/functions/leis-oficiais/index.ts',import.meta.url),'utf8');
assert(!/^\s*import\s/m.test(source),'O editor do painel precisa de uma função autocontida.');
const regularHtml=`<html><head><title>Constituição Federal</title><style>.revogado { text-decoration:line-through; }</style></head><body><h1>Constituição da República Federativa do Brasil</h1>${Array.from({length:260},(_,i)=>`<p>Art. ${i+1}º Dispositivo completo número ${i+1}, com conteúdo suficiente para verificar a leitura integral.</p>`).join('')}<p><span class="revogado">Redação antiga &amp; revogada</span> <strong>Redação atual</strong></p><p>FIM DO DOCUMENTO OFICIAL — MARCADOR 260</p><script>throw new Error('não executar')</script></body></html>`;
const fixtureResponse=()=>new Response(regularHtml,{headers:{'content-type':'text/html; charset=utf-8'}});
function setup({official=()=>fixtureResponse(),auth=()=>Response.json({id:'user-1'}),expire=false}={}){
  let handler;const calls=[],timers=[];
  const context={Request,Response,Headers,TextEncoder,TextDecoder,Uint8Array,URL,AbortController,crypto:webcrypto,console,
    setTimeout:(fn,delay)=>{assert(delay<=25000,'Prazo deve ser <=25 segundos.');const timer=setTimeout(fn,expire?1:delay);timers.push(timer);return timer;},clearTimeout,
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://supabase.test':undefined},serve:value=>{handler=value;}},
    fetch:async(url,options)=>{calls.push({url:String(url),options});return String(url)==='https://supabase.test/auth/v1/user'?auth(url,options):official(url,options);},
  };
  vm.runInNewContext(stripTypeScriptTypes(source)+`;globalThis.extract=extractParagraphs;`,context);
  return{handler,calls,context,timers};
}
const request=(body={law_id:'cf88'},options={})=>new Request('https://function.test/leis-oficiais',{method:'POST',headers:{Authorization:'Bearer fixture-user','Content-Type':'application/json'},body:JSON.stringify(body),...options});

{
  const {handler,calls}=setup();
  const preflight=await handler(new Request('https://function.test',{method:'OPTIONS',headers:{Origin:'https://jornada.wcaio.workers.dev'}}));
  assert.equal(preflight.status,200);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://jornada.wcaio.workers.dev');
  assert.equal((await handler(new Request('https://function.test'))).status,401);
  assert.equal((await handler(new Request('https://function.test',{method:'DELETE'}))).status,405);assert.equal(calls.length,0);
  const rejected=await handler(request({law_id:'cf88',url:'http://169.254.169.254/latest/meta-data'}));assert.equal(rejected.status,400);assert.equal(calls.length,1);
  assert.equal((await handler(request({law_id:'../../secrets'}))).status,400);assert.equal(calls.length,2);
  const catalog=await handler(new Request('https://function.test',{headers:{Authorization:'Bearer fixture-user'}}));
  const data=await catalog.json();assert.equal(data.catalog.length,13);assert(data.catalog.every(item=>item.source_url.startsWith('https://')));assert.equal(calls.length,3);
}
{
  const {handler,calls}=setup();
  assert.equal((await handler(request({law_id:'cf88',extra:'x'.repeat(3000)}))).status,413);
  assert.equal(calls.length,1,'Pedido maior que2KB não pode consultar a fonte.');
  const malformed=await handler(new Request('https://function.test',{method:'POST',headers:{Authorization:'Bearer fixture-user'},body:'{invalid json'}));assert.equal(malformed.status,400);
}
{
  const {handler,calls}=setup({auth:()=>new Response('',{status:401})});assert.equal((await handler(request())).status,401);assert.equal(calls.length,1);
}
{
  const {handler,calls}=setup({auth:()=>new Response('',{status:503})});assert.equal((await handler(request())).status,503);assert.equal(calls.length,1);
}
{
  const {handler,calls}=setup();const response=await handler(request());assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.law.id,'official-cf88');assert.equal(data.law.full_document,true);assert.equal(data.law.content_kind,'official_document_extraction');
  assert(data.law.articles.length>260,'Não pode cortar em180parágrafos.');
  assert(data.law.articles.some(line=>line.includes('MARCADOR 260')),'O último parágrafo precisa permanecer.');
  assert(data.law.articles.some(line=>line.includes('[TEXTO RISCADO NA FONTE:')&&line.includes('Redação antiga & revogada')),'Redação riscada não pode aparecer como texto vigente.');
  assert(!data.law.articles.some(line=>line.includes('throw new Error')));assert(data.warnings.join(' ').includes('vigência'));
  assert.equal(data.law.content_hash,createHash('sha256').update(JSON.stringify(data.law.articles)).digest('hex'));
  assert.equal(calls[1].options.redirect,'manual');assert(calls[1].options.signal instanceof AbortSignal);
}
{
  const {handler,calls}=setup({official:()=>new Response(null,{status:302,headers:{location:'https://evil.test/steal'}})});
  const response=await handler(request());assert.equal(response.status,502);assert.equal(calls.length,2,'Jamais seguir redirecionamento externo.');assert(!(await response.json()).law);
}
{
  const {handler,calls}=setup({official:()=>new Response(null,{status:302,headers:{location:'/other-document'}})});
  assert.equal((await handler(request())).status,502);assert.equal(calls.length,2,'Não seguir outro caminho do mesmo host.');
}
for(const scenario of [
  {label:'bloqueio HTTP',response:()=>new Response('Indisponível',{status:503}),status:502},
  {label:'captcha com HTTP200',response:()=>new Response('<html><body>Access denied. Complete challenge.</body></html>',{headers:{'content-type':'text/html'}}),status:422},
  {label:'HTML interrompido',response:()=>new Response(regularHtml.replace('</body></html>',''),{headers:{'content-type':'text/html'}}),status:422},
  {label:'documento de outra lei',response:()=>new Response(regularHtml,{headers:{'content-type':'text/html'}}),body:{law_id:'drogas'},status:422},
  {label:'JSON em vez de HTML',response:()=>Response.json({error:'blocked'}),status:422},
  {label:'tamanho declarado maior',response:()=>new Response(regularHtml,{headers:{'content-type':'text/html','content-length':String(5*1024*1024+1)}}),status:413},
  {label:'transferência menor que declarada',response:()=>new Response(regularHtml,{headers:{'content-type':'text/html','content-length':String(new TextEncoder().encode(regularHtml).length+9)}}),status:422},
  {label:'stream maior sem ContentLength',response:()=>new Response(new Uint8Array(5*1024*1024+1),{headers:{'content-type':'text/html'}}),status:413},
]){
  const {handler}=setup({official:scenario.response});const response=await handler(request(scenario.body));assert.equal(response.status,scenario.status,scenario.label);assert(!(await response.json()).law,scenario.label+' não deve retornar documento parcial.');
}
{
  const {handler}=setup({expire:true,official:(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')),{once:true}))});
  const response=await handler(request());assert.equal(response.status,504);assert(!(await response.json()).law);
}
{
  const latin='Constitui\u00e7\u00e3o da Rep\u00fablica Federativa do Brasil';
  const text=`<html><body><h1>${latin}</h1>${Array.from({length:20},(_,i)=>`<p>Art. ${i+1}º Teste com ação e órgão, redação atual da Constituição.</p>`).join('')}</body></html>`;
  const {handler}=setup({official:()=>new Response(Buffer.from(text,'latin1'),{headers:{'content-type':'text/html; charset=iso-8859-1'}})});
  const response=await handler(request());assert.equal(response.status,200);assert((await response.json()).law.articles[0].includes('Constituição'));
}
{
  const {context}=setup();const text=`<html><body><form><p>NAVEGAÇÃO</p><div class=WordSection1><p>Lei 6.783</p><div><p>Art. 1º Texto legal.</p></div><p>FINAL INTERNO</p></div><p>FORA DO DIPLOMA</p></form></body></html>`;
  const paragraphs=context.extract(text,'estatuto-pmpe');assert(paragraphs.includes('FINAL INTERNO'));assert(!paragraphs.some(item=>/NAVEGAÇÃO|FORA DO DIPLOMA/.test(item)));
}
{
  const {context}=setup();const paragraphs=context.extract(`<html><body><p>Texto de formatação\n em duas linhas.</p><p>${'a'.repeat(1200000)}</p><p>ÚLTIMO</p></body></html>`,'cf88');
  assert.equal(paragraphs[0],'Texto de formatação em duas linhas.');assert.equal(paragraphs[1].length,1200000);assert.equal(paragraphs.at(-1),'ÚLTIMO');
}
console.log('OK r183 leis-oficiais: autenticação, catálogo13, fontes fixas, bloqueios/SSRF, prazo, limites, charset, extração integral, versão/hash e texto riscado.');
