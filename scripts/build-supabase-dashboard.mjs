// Gera cópias autocontidas para o editor do Supabase, sem alterar as fontes da CLI.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';

export const names = ['assistente-pmpe','redacao-gemini','material-gemini','edital-gemini','account-security','system-diagnostics'];
const root=fileURLToPath(new URL('../',import.meta.url));
const sharedExports = new Map([
  ['../_shared/solved-keys.mjs',['validatedSuggestedKeys']],
  ['../_shared/question-integrity.mjs',['normalizeSharedQuestion']],
  ['../_shared/essay-result.mjs',['validateEssayResult']],
]);
const sha256=source=>createHash('sha256').update(source).digest('hex');

export function buildFunction(name) {
  if(!names.includes(name))throw new Error(`Função não suportada: ${name}`);
  const file=resolve(root,'supabase/functions',name,'index.ts');
  const original=readFileSync(file,'utf8');
  const source=original.replace(/^import\s*\{([^}]+)\}\s*from\s*(['"])([^'"\n]+)\2;[ \t]*$/gm, (_line, bindings, _quote, path)=>{
    const exported=sharedExports.get(path);
    const imported=bindings.split(',').map(value=>value.trim());
    if(!exported||!imported.length||imported.some(value=>!exported.includes(value)))throw new Error(`Import não suportado em ${name}: ${path} (${bindings})`);
    const helper=readFileSync(resolve(dirname(file),path),'utf8');
    if(/^\s*(?:import|export\s*\{)/m.test(helper)||/\bimport\s*\(/.test(helper))throw new Error(`Dependência transitiva não suportada: ${path}`);
    const actual=[...helper.matchAll(/^export function (\w+)\(/gm)].map(match=>match[1]);
    if(actual.length!==exported.length||actual.some(value=>!exported.includes(value)))throw new Error(`Exports alterados: ${path}`);
    const body=helper.replace(/^export (?=function )/gm,'');
    return `// Dependência incorporada: ${path} (SHA-256 ${sha256(helper)})\nconst { ${imported.join(', ')} } = (() => {\n${body.trimEnd()}\nreturn { ${imported.join(', ')} };\n})();`;
  });
  if(/^\s*import\b/m.test(source)||/\bimport\s*\(/.test(source)||/^\s*export\s*(?:\*|\{)/m.test(source))throw new Error(`Há import/export externo não incorporado: ${name}`);
  return `// ARQUIVO AUTOCONTIDO PARA COLAR NO EDITOR DO SUPABASE: ${name}\n// Gerado por: node scripts/build-supabase-dashboard.mjs\n// Fonte: supabase/functions/${name}/index.ts\n// SHA-256 da fonte: ${sha256(original)}\n// Atualize a fonte e regenere; não exclua os validadores incorporados.\n\n${source}`;
}

export function buildAll() {
  const result=[];
  for(const name of names){
    const content=buildFunction(name),file=resolve(root,'supabase/dashboard',name,'index.ts');
    mkdirSync(dirname(file),{recursive:true});writeFileSync(file,content);
    result.push({function:name,path:`supabase/dashboard/${name}/index.ts`,bytes:Buffer.byteLength(content),sha256:sha256(content)});
  }
  writeFileSync(resolve(root,'supabase/dashboard/MANIFESTO.json'),JSON.stringify({format:1,generator:'scripts/build-supabase-dashboard.mjs',files:result},null,2)+'\n');
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  for(const item of buildAll())process.stdout.write(`${item.function}: ${item.bytes} bytes, sem imports locais\n`);
}
