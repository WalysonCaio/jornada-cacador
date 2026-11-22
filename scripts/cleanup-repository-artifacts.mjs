// Limpeza limitada a saídas acidentais conhecidas; preserva conteúdo diferente.
import {readFileSync,lstatSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const knownArtifacts=[
  {
    "name": "$null",
    "sha256": "7f89e347a7719f48dd23fbcfd82b23fc338e0d42599594e421e95884a9419484"
  },
  {
    "name": "0",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  {
    "name": ", gabaritos e recupera\u00e7\u00e3o de estudos na r174\uf022",
    "sha256": "df4133dcd3180f96451573686c85b050859a769c35a6a81934c43e809d50e8be"
  }
];
export function cleanupRepositoryArtifacts(root){
  return knownArtifacts.map(item=>{
    const path=resolve(root,item.name);
    try{
      if(!lstatSync(path).isFile())return{name:item.name,status:'preserved_non_file'};
      const bytes=readFileSync(path),normalized=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
      if(createHash('sha256').update(normalized).digest('hex')!==item.sha256)return{name:item.name,status:'preserved_different_content'};
      unlinkSync(path);return{name:item.name,status:'removed'};
    }catch(error){if(error.code==='ENOENT')return{name:item.name,status:'already_absent'};return{name:item.name,status:'failed',code:error.code||'IO_ERROR'};}
  });
}
export function stageArtifactRemovals(root,results){
  const paths=[];
  for(const item of knownArtifacts){
    const result=results.find(row=>row.name===item.name);if(!result||!['removed','already_absent'].includes(result.status))continue;
    try{const original=execFileSync('git',['show',':'+item.name],{cwd:root,stdio:['ignore','pipe','ignore']});
      const normalized=Buffer.from(original.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
      if(createHash('sha256').update(normalized).digest('hex')===item.sha256)paths.push(item.name);
    }catch{}
  }
  if(paths.length)execFileSync('git',['add','-u','--',...paths],{cwd:root,stdio:'pipe'});
  return paths;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const result=cleanupRepositoryArtifacts(root);
  for(const item of result)console.log(`${item.status}: ${item.name}${item.code?' ('+item.code+')':''}`);
  if(process.argv.includes('--stage')){try{for(const name of stageArtifactRemovals(root,result))console.log(`staged_removal: ${name}`);}catch(error){console.error('Falha ao selecionar exclusões no Git. Confira git status.');process.exitCode=1;}}
  if(result.some(item=>item.status==='failed'||item.status==='preserved_different_content'||item.status==='preserved_non_file'))process.exitCode=1;
}
