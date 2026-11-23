// Positioned PDF fragments must preserve lexical spaces and reconstruct only
// boundaries supported by geometry. No browser, PDFs or external API required.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/pdf-text-client.js',import.meta.url),'utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);};
const ctx={window:{}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(section('  function pdfTextItemGeometry(', '  function withTimeout('),ctx);
const geometry=ctx.JCPdfTextGeometry;
const item=(str,x=0,y=100,width=str.length*5,font=10,extra={})=>({str,width,height:font,transform:[font,0,0,font,x,y],...extra});
const extract=items=>geometry.reconstruct({items});
let cases=0;
function check(name,fn){fn();cases++;console.log('OK',name);}
check('S/empre, responsáve/l e ilegal/idade reconstroem palavra pelos avanços',()=>{
 for(const [left,right,word] of [['S','empre','Sempre'],['responsáve','l','responsável'],['ilegal','idade','ilegalidade']]){
  assert.equal(extract([item(left,10),item(right,10+left.length*5+.25)]),word);
 }
});
check('hífens contíguos de ênclise/compostos não ganham espaços artificiais',()=>{
 for(const [left,right] of [['fazê','lo'],['aplica','se'],['habeas','corpus'],['licença','maternidade']]){
  const start=10+left.length*5;assert.equal(extract([item(left,10),item('-',start+.2,100,3),item(right,start+3.4)]),left+'-'+right);
 }
});
check('artigos A/O/E e espaços reais permanecem separados',()=>{
 for(const word of ['A','O','E'])assert.equal(extract([item(word,10),item('lei',17.6)]),word+' lei');
 assert.equal(extract([item('A ',10,100,7),item('lei',17.1)]),'A lei','o espaço explícito vence o intervalo curto');
 assert.equal(extract([item('A',10),item(' ',15,100,2.5),item('lei',17.5)]),'A lei');
});
check('limiar acompanha fonte estreita, tamanho e espaços medidos',()=>{
 assert.equal(extract([item('uma',10,100,6),item('lei',17.5,100,6)]),'uma lei','fonte estreita não pode usar 0.18em cegamente');
 for(const font of [6,8,18]){
  const width=font*.5;assert.equal(extract([item('S',10,100,width,font),item('empre',10+width+font*.06,100,width*5,font)]),'Sempre');
  assert.equal(extract([item('A',10,100,width,font),item('lei',10+width+font*.25,100,width*3,font)]),'A lei');
 }
});
check('espaço explícito, pontuação, símbolos e códigos não são reescritos',()=>{
 assert.equal(extract([item('art.',10,100,20),item('24',33,100,10)]),'art. 24');
 assert.equal(extract([item('Olá',10,100,15),item(',',25.2,100,2)]),'Olá,');
 assert.equal(extract([item('x',10),item('-',20,100,3),item('y',28)]),'x - y');
 assert.equal(extract([item('12',10,100,10),item('34',23,100,10)]),'12 34');
 assert.equal(extract([item('A-12',10,100,20),item('/34',30.1,100,15)]),'A-12/34');
});
check('ligaturas são expandidas sem converter expoentes ou numerais',()=>{
 assert.equal(extract([item('oﬁcial',10)]),'oficial');
 assert.equal(extract([item('m² ① ≠ 2',10)]),'m² ① ≠ 2');
});
check('metadados incompletos recebem fallback conservador e mantêm a ordem',()=>{
 assert.equal(extract([{str:'A'},{str:'lei'}]),'A lei');
 assert.equal(extract([item('A',10,100,null),item('lei',15.1,100,null)]),'A lei');
 assert.equal(extract([item('parte',10,100,25),item('outra',10,100,25)]),'parte outra','sobreposição grande não prova palavra concatenada');
});
check('linhas, EOL, palavras hifenizadas entre linhas e colunas não são coladas',()=>{
 assert.equal(extract([item('constitucio-',10,100,60),item('nal',10,86,15)]),'constitucio-\nnal');
 assert.equal(extract([item('texto',10,100,25)]),'texto');
 assert.equal(extract([item('esquerda',10,100,40),item('direita',300,100,35)]),'esquerda\ndireita');
 assert.equal(extract([item('A)',10,100,10),item('alternativa',70,100,55)]),'A) alternativa','marca alinhada distante não perde a alternativa');
 assert.equal(extract([item('primeira',10,100,40,10,{hasEOL:true}),item('segunda',52,100,35)]),'primeira\nsegunda');
});
check('fragmentos rotacionados e RTL usam o eixo de escrita',()=>{
 const rotate=(str,y,width)=>({str,width,height:10,transform:[0,10,-10,0,100,y]});
 assert.equal(extract([rotate('S',20,5),rotate('empre',25.2,25)]),'Sempre');
 assert.equal(extract([item('שלום',100,100,15,10,{dir:'rtl'}),item('עולם',80,100,15,10,{dir:'rtl'})]),'שלום עולם');
});
check('agrupamento não altera o array/items fornecidos pelo PDF.js',()=>{
 const items=[item('segunda',10,80),item('primeira',10,100)];const before=JSON.stringify(items);assert.equal(extract(items),'primeira\nsegunda');assert.equal(JSON.stringify(items),before);
});
check('normalizador tipográfico é opcional e aplicado após a geometria',()=>{
 const calls=[];ctx.JCQuestionText={normalizeTypography:text=>{calls.push(text);return text.replace('A Le i','A Lei');}};
 assert.equal(extract([item('A Le i',10)]),'A Lei');assert.deepEqual(calls,['A Le i']);delete ctx.JCQuestionText;
 assert.equal(extract([item('A Le i',10)]),'A Le i','ausência do módulo não inventa correção de palavra');
});

// Run the actual extraction pipeline; replace only the PDF module transport
// with a synthetic PDF.js document, while keeping scope/rows/sidecar handlers.
check('pré-scan e PDF de gabarito reutilizam reconstrução geométrica',()=>{
 assert(source.includes('const pageTxt = reconstructPdfTextContent(content);'));
 assert(source.includes('fullAk += "\\n" + reconstructPdfTextContent(content);'));
});
{
 const state={_ownerUserId:'owner',activeCampaignId:'pmpe',_resetEpoch:7},session={user:{id:'owner'}};
 const data=[item('S',40),item('empre',45.25),item('fazê',74),item('-',94.2,100,3),item('lo',97.45),item('responsáve',40,86),item('l',90.25,86),item('ilegal',40,72),item('idade',70.25,72),item('Texto adicional selecionável preservado integralmente para conferir a leitura digital e evitar qualquer fallback de OCR nesta prova.',40,58,550)];
 const columns=Array.from({length:10},(_,index)=>[item(`Esquerda ${index+1}: conteúdo da primeira coluna.`,40,400-index*14,205),item(`Direita ${index+1}: conteúdo da segunda coluna.`,320,400-index*14,205)]).flat();
 const calls=[],pdf={numPages:2,async getPage(number){return{async getTextContent(){return{items:number===2?columns:data};},getViewport(){return{width:595,height:842};},cleanup(){calls.push('cleanup');}};},async destroy(){calls.push('destroy');}};
 const pipeline={state,cloudSession:session,window:{},Uint8Array,URL,console:{info(){},warn(){}},setTimeout,clearTimeout,SUPABASE_URL:'https://storage.fixture',SUPABASE_KEY:'public-fixture',document:{baseURI:'https://app.fixture/'},toast(){},
  _testPdfJs:{GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(pdf)})},
  fetch:async(url,options={})=>{calls.push({url,method:options.method||'GET',body:options.body});return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}
 };
 pipeline.window=pipeline;vm.createContext(pipeline);
 const prefixes=section('  const MAX_EXTRACT_PAGES', '  function inferDisciplineFromTopicsBlock(');
 const helpers=section('  function pdfTextItemGeometry(', '  async function sidecarAlreadyExists(');
 const opener=section('  async function openPdfDocumentWithFallback(', '  // ── Filtro Detector');
 const flow=section('  function pdfExtractionScope(', '  async function prepareDocumentText(').replace('const pdfjs = await import("./pdf.mjs");','const pdfjs = _testPdfJs;');
 vm.runInContext(prefixes+helpers+opener+flow,pipeline);
 const doc={id:'doc',document_type:'prova',user_id:'owner',storage_path:'owner/pmpe/doc.pdf'};
 assert.equal(await pipeline.extractAndUploadText(doc,session,{forceFresh:true}),true);
 const prepared=pipeline._extractedPagesByDocId.get('doc');assert(prepared[0].text.startsWith('Sempre fazê-lo\nresponsável\nilegalidade\n'));
 assert.equal(prepared.length,2);assert.equal(prepared[1].text.split('\n').length,20);
 assert(prepared[1].text.indexOf('Esquerda 10:')<prepared[1].text.indexOf('Direita 1:'),'as duas colunas não podem ser intercaladas linha a linha');
 const upload=calls.find(call=>call.method==='POST');assert(upload,'pipeline envia sidecar com o texto reconstruído');
 assert.equal(JSON.parse(upload.body).pages[0].text,prepared[0].text);assert(calls.includes('cleanup'));assert(calls.includes('destroy'));cases++;
}
console.log(`OK r187 PDF: ${cases} cenários de espaçamento geométrico, preservação lexical, orientação e pipeline.`);
