// Jornada do Caçador — serviço autocontido, sem dependência de outro arquivo no painel.
// A extração registra a fonte e seu hash; não certifica vigência nem revisão jurídica.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLIC_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw';
const SITE = 'https://jornada.wcaio.workers.dev';
const ALLOWED_ORIGINS = new Set([SITE, 'http://localhost:4173', 'http://localhost:3000']);
const MAX_BYTES = 5 * 1024 * 1024;
const DEADLINE_MS = 24000;
const LAW_CATALOG = [
  {id:'cf88',title:'Constituição Federal de 1988',discipline:'Direito Constitucional',sourceName:'Câmara dos Deputados',url:'https://www2.camara.leg.br/legin/fed/consti/1988/constituicao-1988-5-outubro-1988-322142-normaatualizada-pl.html',identity:/constituicao[\s\S]{0,90}(?:federativa|federal)/i},
  {id:'cp',title:'Código Penal',discipline:'Direito Penal',sourceName:'Câmara dos Deputados',url:'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html',identity:/codigo penal/i},
  {id:'cpp',title:'Código de Processo Penal',discipline:'Direito Processual Penal',sourceName:'Câmara dos Deputados',url:'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-3689-3-outubro-1941-322206-normaatualizada-pe.html',identity:/codigo de processo penal/i},
  {id:'cpm',title:'Código Penal Militar',discipline:'Direito Penal Militar',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm',identity:/codigo penal militar/i},
  {id:'cppm',title:'Código de Processo Penal Militar',discipline:'Direito Processual Penal Militar',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm',identity:/codigo de processo penal militar/i},
  {id:'improbidade',title:'Lei de Improbidade Administrativa',discipline:'Direito Administrativo',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',identity:/8[.\s]?429/},
  {id:'licitacoes',title:'Lei de Licitações e Contratos',discipline:'Direito Administrativo',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',identity:/14[.\s]?133/},
  {id:'abuso',title:'Lei de Abuso de Autoridade',discipline:'Legislação Extravagante',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',identity:/13[.\s]?869/},
  {id:'tortura',title:'Lei dos Crimes de Tortura',discipline:'Legislação Extravagante',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm',identity:/9[.\s]?455/},
  {id:'maria-da-penha',title:'Lei Maria da Penha',discipline:'Legislação Extravagante',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',identity:/11[.\s]?340/},
  {id:'desarmamento',title:'Estatuto do Desarmamento',discipline:'Legislação Extravagante',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm',identity:/10[.\s]?826/},
  {id:'drogas',title:'Lei de Drogas',discipline:'Legislação Extravagante',sourceName:'Presidência da República — Planalto',url:'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm',identity:/11[.\s]?343/},
  {id:'estatuto-pmpe',title:'Estatuto dos Policiais Militares de Pernambuco',discipline:'Direito Militar',sourceName:'Assembleia Legislativa de Pernambuco',url:'https://legis.alepe.pe.gov.br/texto.aspx?id=1032&tipo=TEXTOATUALIZADO',identity:/6[.\s]?783/},
];
function headersFor(request) {
  const origin=request.headers.get('origin') || '';
  return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:SITE,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
}
function fail(message,status=502) { return Object.assign(new Error(message),{status}); }
function normalized(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function decodeEntities(text) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ordm:'º',ordf:'ª',sect:'§',ndash:'–',mdash:'—',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',copy:'©',aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',agrave:'à',acirc:'â',ecirc:'ê',ocirc:'ô',atilde:'ã',otilde:'õ',ccedil:'ç',uuml:'ü'};
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (whole,key)=>{
    if(key[0]==='#'){const value=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return value>0&&value<=0x10ffff&&!(value>=0xd800&&value<=0xdfff)?String.fromCodePoint(value):'�';}
    const value=named[key.toLowerCase()];return value===undefined?whole:key[0]===key[0].toUpperCase()?value.toUpperCase():value;
  });
}
function selectDocumentBody(html,lawId) {
  const body=html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  if(!body)throw fail('A fonte não entregou um documento HTML completo; nenhum trecho foi importado.',422);
  let value=body[1];
  // O diploma da Alepe está dentro do WordSection1; exclui os formulários da página.
  if(lawId==='estatuto-pmpe'){
    const start=/<div\b[^>]*class\s*=\s*["']?WordSection1\b[^>]*>/i.exec(value);
    if(!start)throw fail('O conteúdo do diploma não foi identificado na página da Alepe.',422);
    const scanner=/<\/?div\b[^>]*>/gi;scanner.lastIndex=start.index+start[0].length;
    let depth=1,match,end=-1;
    while((match=scanner.exec(value))){depth+=/^<\//.test(match[0])?-1:1;if(depth===0){end=match.index;break;}}
    if(end<0)throw fail('O documento da Alepe chegou incompleto.',422);
    value=value.slice(start.index+start[0].length,end);
  }
  return value;
}
function extractParagraphs(html,lawId) {
  const struckClasses=new Set();
  for(const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)){
    for(const rule of style[1].split('}')){
      const opening=rule.lastIndexOf('{');if(opening<0||!/text-decoration[^;]*line-through/i.test(rule.slice(opening+1)))continue;
      for(const item of rule.slice(0,opening).matchAll(/\.([a-z_][\w-]*)/gi))struckClasses.add(item[1].toLowerCase());
    }
  }
  let body=selectDocumentBody(html,lawId).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const stack=[],parts=[];
  const blocks=new Set(['p','div','br','hr','li','h1','h2','h3','h4','h5','h6','tr','table','section','article']);
  for(const token of body.match(/<[^<>]*>|[^<]+/g)||[]){
    if(token[0]!=='<'){parts.push(decodeEntities(token).replace(/\s+/g,' '));continue;}
    const match=/^<(\/)?\s*([a-z][\w:-]*)\b([^>]*)>/i.exec(token);if(!match)continue;
    const closing=!!match[1],tag=match[2].toLowerCase(),attributes=match[3];
    if(blocks.has(tag))parts.push('\n');
    if(closing){
      let index=-1;for(let i=stack.length-1;i>=0;i--)if(stack[i].tag===tag){index=i;break;}
      if(index>=0){for(const old of stack.splice(index).reverse())if(old.struck)parts.push(' ] ');}
    }else if(!/^(?:br|hr|img|input|meta|link|source|wbr|area|base|embed|param|track)$/.test(tag)&&! /\/\s*>$/.test(token)){
      const classes=(attributes.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]||'').toLowerCase().split(/\s+/);
      const struck=/^(s|strike|del)$/.test(tag)||/text-decoration[^;"']*line-through/i.test(attributes)||classes.some(item=>struckClasses.has(item));
      stack.push({tag,struck});if(struck)parts.push(' [TEXTO RISCADO NA FONTE: ');
    }
  }
  for(const old of stack.reverse())if(old.struck)parts.push(' ] ');
  const paragraphs=parts.join('').split(/\n+/).map(text=>text.replace(/[\s\u200b\u00ad]+/g,' ').trim()).filter(Boolean);
  if(paragraphs.length>30000)throw fail('O documento excedeu o limite de parágrafos; a importação foi recusada sem cortar o texto.',413);
  return paragraphs;
}
function validateSourceUrl(value,entry) {
  let actual,expected;try{actual=new URL(value);expected=new URL(entry.url);}catch{throw fail('Endereço da fonte oficial inválido.',502);}
  if(actual.protocol!=='https:'||actual.username||actual.password||actual.origin!==expected.origin||actual.pathname!==expected.pathname||actual.search!==expected.search)throw fail('A fonte tentou redirecionar para um endereço não permitido.',502);
  return actual.href;
}
async function readLimited(response) {
  const declared=response.headers.get('content-length');
  if(declared&&Number(declared)>MAX_BYTES)throw fail('O documento excede 5 MB; nenhum trecho foi importado.',413);
  if(!response.body)throw fail('A fonte oficial não retornou conteúdo.',502);
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>MAX_BYTES)throw fail('O documento excede 5 MB; nenhum trecho foi importado.',413);chunks.push(item.value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  if(declared&&Number.isFinite(Number(declared))&&!response.headers.get('content-encoding')&&length!==Number(declared))throw fail('A transferência do documento chegou incompleta.',422);
  const bytes=new Uint8Array(length);let offset=0;for(const item of chunks){bytes.set(item,offset);offset+=item.byteLength;}
  const hint=new TextDecoder('windows-1252').decode(bytes.subarray(0,2048));
  const charset=(response.headers.get('content-type')?.match(/charset\s*=\s*["']?([\w-]+)/i)||hint.match(/charset\s*=\s*["']?([\w-]+)/i))?.[1]?.toLowerCase();
  return new TextDecoder(/^(?:iso-8859-1|latin1|windows-1252)$/.test(charset||'')?'windows-1252':'utf-8').decode(bytes);
}
async function readRequestBody(request) {
  if(!request.body)return '';
  const reader=request.body.getReader(),chunks=[];let length=0;
  try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>2048)throw fail('Pedido muito grande.',413);chunks.push(item.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(length);let offset=0;for(const item of chunks){bytes.set(item,offset);offset+=item.byteLength;}
  return new TextDecoder().decode(bytes);
}
async function fetchDocument(entry,signal) {
  let target=entry.url;
  for(let redirects=0;redirects<=2;redirects++){
    validateSourceUrl(target,entry);
    const response=await fetch(target,{signal,redirect:'manual',headers:{Accept:'text/html, application/xhtml+xml','User-Agent':'JornadaCacador/1.0 (+official-law-reader)'}});
    if(response.status>=300&&response.status<400){const next=response.headers.get('location');if(!next||redirects===2)throw fail('A fonte retornou um redirecionamento inesperado.',502);target=validateSourceUrl(new URL(next,target).href,entry);continue;}
    if(response.url)validateSourceUrl(response.url,entry);
    if(!response.ok)throw fail(`A fonte oficial está indisponível (HTTP ${response.status}); seus textos salvos foram preservados.`,502);
    if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw fail('A fonte não retornou HTML; nenhum conteúdo foi importado.',422);
    const html=await readLimited(response),articles=extractParagraphs(html,entry.id),text=articles.join('\n');
    if(text.length<500||!/(?:^|\s)Art\.?\s*1\s*[ºo°.\-–—]/im.test(text)||!entry.identity.test(normalized(text)))throw fail('A resposta não contém a identificação e os artigos esperados do diploma. Pode ser uma página de bloqueio; nada foi importado.',422);
    const encoded=new TextEncoder().encode(JSON.stringify(articles));
    if(encoded.length>6*1024*1024)throw fail('O documento excedeu o limite de armazenamento; a importação foi recusada sem cortar o texto.',413);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)),value=>value.toString(16).padStart(2,'0')).join('');
    const retrieved=new Date().toISOString();
    return {law:{id:`official-${entry.id}`,law_id:entry.id,title:entry.title,discipline:entry.discipline,articles,source_url:entry.url,sourceName:entry.sourceName,source_version:`Extração ${retrieved.slice(0,10)} · SHA-256 ${hash}`,content_hash:hash,retrieved_at:retrieved,content_kind:'official_document_extraction',full_document:true,coverage:'Extração de todos os parágrafos do documento HTML recebido da fonte indicada; não constitui certificação de vigência ou de consolidação normativa.'},warnings:['Confira a data, as alterações e a vigência na fonte oficial antes de estudar ou citar. Textos riscados na fonte permanecem identificados. Imagens, anexos sem texto e remissões externas não foram transcritos; consulte o documento original.']};
  }
  throw fail('Não foi possível consultar a fonte oficial.',502);
}
Deno.serve(async request=>{
  const headers=headersFor(request),reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.method==='OPTIONS')return new Response('ok',{headers});
  if(request.method!=='GET'&&request.method!=='POST')return reply({error:'Método não permitido.'},405);
  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(authorization))return reply({error:'Entre na sua conta para consultar as fontes oficiais.'},401);
  if(!SUPABASE_URL)return reply({error:'Serviço de autenticação não configurado.'},503);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),DEADLINE_MS);
  try{
    const auth=await fetch(`${SUPABASE_URL}/auth/v1/user`,{signal:controller.signal,headers:{Authorization:authorization,apikey:PUBLIC_KEY}});
    if(auth.status>=500)throw fail('O serviço de autenticação está indisponível.',503);
    const user=auth.ok?await auth.json().catch(()=>null):null;
    if(!user?.id)return reply({error:'Sessão inválida ou expirada.'},401);
    let lawId;
    if(request.method==='GET')lawId=new URL(request.url).searchParams.get('law_id');
    else{
      if(Number(request.headers.get('content-length')||0)>2048)return reply({error:'Pedido muito grande.'},413);
      const raw=await readRequestBody(request);
      let input;try{input=JSON.parse(raw);}catch{return reply({error:'Informe JSON válido com law_id.'},400);}
      if(!input||typeof input!=='object'||Object.keys(input).some(key=>key!=='law_id'))return reply({error:'Use somente law_id do catálogo; URLs externas não são aceitas.'},400);
      lawId=input.law_id;
    }
    if(request.method==='GET'&&!lawId)return reply({catalog:LAW_CATALOG.map(({id,title,discipline,sourceName,url})=>({id,title,discipline,sourceName,source_url:url})),max_bytes:MAX_BYTES,coverage:'A importação depende da disponibilidade de cada fonte oficial.'});
    if(typeof lawId!=='string')return reply({error:'Selecione um law_id válido do catálogo.'},400);
    const entry=LAW_CATALOG.find(item=>item.id===lawId);
    if(!entry)return reply({error:'Diploma não encontrado no catálogo oficial.'},400);
    return reply(await fetchDocument(entry,controller.signal));
  }catch(error){
    if(controller.signal.aborted||error?.name==='AbortError')return reply({error:'A fonte oficial excedeu o prazo; nenhum texto parcial foi salvo.'},504);
    return reply({error:error?.status?error.message:'Não foi possível consultar a fonte oficial agora; seus textos salvos foram preservados.'},error?.status||502);
  }finally{clearTimeout(timer);}
});
