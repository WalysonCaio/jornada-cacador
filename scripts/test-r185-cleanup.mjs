// Arquivos de usuário diferentes e links não são apagados pelo helper de limpeza.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,symlinkSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {cleanupRepositoryArtifacts,stageArtifactRemovals} from './cleanup-repository-artifacts.mjs';
const root=mkdtempSync(join(tmpdir(),'jc-cleanup-'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cleanup-artifacts.json',import.meta.url),'utf8'));
const names=fixture.map(item=>item.name);
try{
 for(const item of fixture)writeFileSync(join(root,item.name),item.text);
 writeFileSync(join(root,'trabalho-do-usuario.txt'),'Preservar');
 execFileSync('git',['init','--quiet',root]);execFileSync('git',['add','--',...names,'trabalho-do-usuario.txt'],{cwd:root});const before=execFileSync('git',['write-tree'],{cwd:root,encoding:'utf8'}).trim();
 const removed=cleanupRepositoryArtifacts(root);assert.equal(stageArtifactRemovals(root,removed).length,3);assert.equal(execFileSync('git',['diff','--cached','--name-only','--diff-filter=D',before],{cwd:root,encoding:'utf8'}).trim().split('\n').length,3);assert(removed.every(r=>r.status==='removed'));assert(names.every(n=>!existsSync(join(root,n))));assert(existsSync(join(root,'trabalho-do-usuario.txt')));
 assert(cleanupRepositoryArtifacts(root).every(r=>r.status==='already_absent'));
 writeFileSync(join(root,'$null'),'Conteúdo novo do usuário');try{symlinkSync(join(root,'trabalho-do-usuario.txt'),join(root,'0'));}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error;mkdirSync(join(root,'0'));console.log('Symlink indisponível neste sistema; diretório usado para verificar preservação de caminhos que não são arquivos.');}
 const preserved=cleanupRepositoryArtifacts(root);assert.equal(preserved.find(r=>r.name==='$null').status,'preserved_different_content');assert.equal(preserved.find(r=>r.name==='0').status,'preserved_non_file');assert.equal(readFileSync(join(root,'$null'),'utf8'),'Conteúdo novo do usuário');assert.equal(readFileSync(join(root,'trabalho-do-usuario.txt'),'utf8'),'Preservar');
 const tempScripts=join(root,'scripts');mkdirSync(tempScripts);const tempCli=join(tempScripts,'cleanup-repository-artifacts.mjs');copyFileSync(resolve('scripts/cleanup-repository-artifacts.mjs'),tempCli);const cli=spawnSync(process.execPath,[tempCli],{encoding:'utf8'});assert.equal(cli.status,1);assert(cli.stdout.includes('preserved_different_content'));assert(cli.stdout.includes('preserved_non_file'));assert.equal(readFileSync(join(root,'$null'),'utf8'),'Conteúdo novo do usuário');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('OK r185 limpeza: três saídas conhecidas, hash, reexecução, conteúdo diferente, arquivo alheio e symlink preservados.');
