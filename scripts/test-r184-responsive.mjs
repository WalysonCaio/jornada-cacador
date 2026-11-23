// Régression du rendu réel du lecteur; CSS contrôlé structurellement, sans navigateur.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../dist/ui-r184.css',import.meta.url),'utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);};
const escapeCode=section('  function lawEscape(', '  function officialLawSource(');
const reader=section('  function renderActiveLawReaderHtml(', '  // 6) Pílulas Rápidas');
const ctx={URL,materializeLaw:law=>law,getHighlightedArticles:()=>({'official-cf88:60':true}),
 officialLawIdsFor:()=>['cf88'],OFFICIAL_LAW_IMPORTS:[{id:'cf88',title:'Constituição Federal de 1988'}],
 LAW_READER_PAGE_SIZE:Number(source.match(/const LAW_READER_PAGE_SIZE\s*=\s*(\d+)/)?.[1]),lawReaderPage:0,activeLawExternalLoading:false};
assert.equal(ctx.LAW_READER_PAGE_SIZE,60);
vm.createContext(ctx);vm.runInContext(escapeCode+reader,ctx);
const hash='1234567890abcdef'.repeat(4),warning='Confira a vigência e as alterações na referência.';
const law={id:'official-cf88',law_id:'cf88',discipline:'Direito Constitucional',title:'Constituição Federal',badge:'Texto extraído da fonte oficial',full_document:true,
 sourceName:'Câmara dos Deputados',sourceUrl:'https://www2.camara.leg.br/legin/teste.html',sourceVersion:`Extração 2026-11-20 · SHA-256 ${hash}`,
 content_hash:hash,fetchedAt:'2026-11-20T12:00:00Z',sourceWarnings:[warning,warning],
 coverage:'Todo o texto extraído foi preservado.',articles:Array.from({length:125},(_,i)=>`Art. ${i+1}º. Bloco legal ${i+1} com texto para leitura.`)};
let rendered=ctx.renderActiveLawReaderHtml(law);
assert.equal((rendered.match(new RegExp(hash,'g'))||[]).length,1,'Hash aparece uma única vez; a versão não o repete');
assert.equal((rendered.match(new RegExp(warning,'g'))||[]).length,1,'Avisos duplicados de fonte não repetem no leitor');
assert(rendered.indexOf('não certifica vigência')<rendered.indexOf('<details'),'Limite de confiança permanece sempre visível');
assert(rendered.includes('Imagens, OCR e anexos externos não estão incluídos'));
assert(rendered.includes('class="jcLawReaderActions"'),'Ações têm contêiner próprio para não herdar largura integral do layout geral');
assert(rendered.includes('<summary>Fonte, versão e limites da leitura</summary>'));
assert.equal((rendered.match(/data-law-highlight=/g)||[]).length,60);
assert(rendered.includes('aria-label="Grifar o bloco 1"'));assert(rendered.includes('tabindex="0"'));
ctx.lawReaderPage=1;rendered=ctx.renderActiveLawReaderHtml(law);
assert(rendered.includes('aria-label="Remover grifo do bloco 61"'));assert(rendered.includes('aria-pressed="true"'));
assert(rendered.includes('data-law-highlight="official-cf88:60"'));
assert(rendered.includes('Página 2/3'));assert(!rendered.includes('Bloco legal 1 com'));
const evil={...law,title:'<img src=x onerror=alert(1)>',sourceWarnings:['<script>bad()</script>'],sourceName:'<svg onload=alert(1)>',sourceUrl:'javascript:alert(1)',sourceVersion:'<iframe src=x>',articles:['<img src=x onerror=alert(1)>']};
rendered=ctx.renderActiveLawReaderHtml(evil);
for(const tag of ['<script','<img','<svg','<iframe','href="javascript:'])assert(!rendered.includes(tag),tag);
assert(rendered.includes('&lt;script&gt;'));assert(rendered.includes('&lt;img'));assert(rendered.includes('referência documental não informada'));
rendered=ctx.renderActiveLawReaderHtml({...law,full_document:false,coverage:'Seleção local; não é texto integral.',sourceUrl:'https://pt.wikisource.org/wiki/Teste',sourceWarnings:[],contentTruncated:true});
assert(rendered.includes('Consultar referência informada'));assert(!rendered.includes('Consultar referência oficial'));
assert(rendered.includes('Conteúdo limitado ao trecho importado.'));assert(rendered.includes('jcFetchLawComplementBtn'));
assert(!rendered.includes('<dt>SHA-256</dt>'));
// A folha acompanha os pontos reais do renderer, preserva texto e evita largura mínima rígida.
for(const selector of ['#laws .jcLawReaderActions > button','#laws .jcLawSourceMetadata dd','#laws .jcLawReaderParagraphs','#laws .jcLawParagraph > p','.app .optionWithScissors','.app .questionFilters > *'])assert(css.includes(selector),selector);
assert.match(css,/#laws \.jcLawReaderActions > button\s*\{[^}]*width:\s*auto !important/s);
assert(css.includes('grid-template-columns: minmax(0, 1fr) 44px'));
assert(css.includes('overflow-wrap: anywhere'));assert(css.includes('@media (max-width: 640px)'));assert(css.includes('@media (max-width: 390px)'));
assert(!/html\s*,?\s*body\s*\{[^}]*overflow(?:-x)?:\s*hidden/s.test(css),'Não esconder overflow da página para simular responsividade');
assert(!/questionTrust[^}]*display\s*:\s*none/s.test(css),'Avisos de confiança não são ocultados');
console.log('OK r184: leitor com metadados únicos, limites visíveis, ações próprias, 60 blocos, grifos absolutos e HTML escapado; CSS responsivo conferido estruturalmente, sem QA visual.');
