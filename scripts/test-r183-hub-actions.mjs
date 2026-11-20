// Executa os atalhos reais e impede navegação sem salvar ou com contexto antigo.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/jc-architecture-modules.js',import.meta.url),'utf8');
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);};
const actionIds=['jcQBarInvocadorBtn','jcQBarProfCommentBtn','jcQBarTheoryBtn','jcQBarNotebookBtn','jcQBarNotesBtn','jcQBarStatsBtn'];
function fixture(){
 const ids=new Map(),calls=[],messages=[];
 const cls=()=>({toggle(){}});
 const node=(id)=>({id,textContent:'',classList:cls(),querySelector:()=>null,querySelectorAll:()=>[],scrollIntoView:()=>calls.push(['scroll',id])});
 const dialog={...node('questionDialog'),open:true,close(){this.open=false;calls.push(['close']);}};
 const qbox={insertBefore(bar){ids.set(bar.id,bar);for(const id of actionIds)ids.set(id,node(id));}};
 dialog.querySelector=()=>qbox;
 const feedback=node('questionFeedback');feedback.textContent='Explicação com fonte';
 const stats=node('stats');feedback.querySelector=()=>stats;
 ids.set('questionDialog',dialog);ids.set('questionFeedback',feedback);
 ids.set('askQapInstructorBtn',{textContent:'Invocador',click:()=>calls.push(['ai'])});
 const state={_ownerUserId:'a',_resetEpoch:1,activeCampaignId:'p'};
 const item={subject:'Direito Processual Penal',topic:'Inquérito',statement:'Questão de teste'};
 const ctx={document:{getElementById:id=>ids.get(id)||null,createElement:()=>node('')},getAppStateSafe:()=>state,cloudSession:{user:{id:'a'}},state,
 activeQuestions:{questions:[item],current:0},showQuestion:()=>{},toast:m=>messages.push(m),
 saveActiveQuestionSession:()=>{calls.push(['save']);return true;},checkAndOfferSavedQuestionSessionResume:()=>calls.push(['resume']),
 openTheoryForSubjectAndTopic:(...args)=>calls.push(['theory',...args]),saveCurrentQuestionToNotes:question=>calls.push(['note',question]),
 openView:view=>calls.push(['view',view]),switchStudySubtab:tab=>calls.push(['tab',tab]),
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(section('  function mountCaveiraQuestionBankEnhancements()', '\n\n  // =========================================================================='),ctx);
 ctx.mountCaveiraQuestionBankEnhancements();ctx.showQuestion();
 return {ctx,ids,calls,messages,item,state,dialog};
}
{
 const f=fixture();f.ids.get('jcQBarTheoryBtn').onclick();
 assert.deepEqual(f.calls.find(c=>c[0]==='theory'),['theory','Direito Processual Penal','Inquérito']);
 assert(f.calls.findIndex(c=>c[0]==='save')<f.calls.findIndex(c=>c[0]==='close'));
 assert.equal(f.ctx.activeQuestions,null);assert.equal(f.dialog.open,false);
}
{
 const f=fixture();f.ids.get('jcQBarNotebookBtn').onclick();
 assert.deepEqual(f.calls.filter(c=>['view','tab'].includes(c[0])),[['view','study'],['tab','notes']]);
}
{
 const f=fixture();f.ids.get('jcQBarNotesBtn').onclick();
 assert.equal(f.calls.find(c=>c[0]==='note')[1],f.item);assert(f.dialog.open,'Salvar nota preserva treino');
 f.ids.get('jcQBarProfCommentBtn').onclick();f.ids.get('jcQBarStatsBtn').onclick();
 assert(f.calls.some(c=>c[0]==='scroll'&&c[1]==='questionFeedback'));assert(f.calls.some(c=>c[0]==='scroll'&&c[1]==='stats'));
}
{
 const f=fixture();f.ids.get('jcQBarInvocadorBtn').onclick();assert(f.calls.some(c=>c[0]==='ai'));assert(f.calls.some(c=>c[0]==='save'));
}
for(const id of ['jcQBarTheoryBtn','jcQBarNotebookBtn','jcQBarInvocadorBtn']){
 const f=fixture();f.ctx.saveActiveQuestionSession=()=>false;f.ids.get(id).onclick();
 assert(f.dialog.open);assert(!f.calls.some(c=>['theory','view','ai','close'].includes(c[0])));assert.match(f.messages.at(-1),/Não foi possível salvar/);
}
for(const change of [f=>f.state._resetEpoch++,f=>f.state.activeCampaignId='other',f=>f.ctx.cloudSession.user.id='b']){
 const f=fixture();change(f);for(const id of actionIds)f.ids.get(id).onclick();
 assert.equal(f.calls.length,0,'Nenhum botão usa contexto antigo de conta/portal/reset');assert.equal(f.messages.length,actionIds.length);
}
{
 const ctx=vm.createContext({});vm.runInContext(section('  function normalizeHunterBio(', '  const profileSaveScopes='),ctx);
 assert.equal(ctx.normalizeHunterBio('  “"Minha bio"”  '),'Minha bio');
 assert.equal(ctx.normalizeHunterBio('A palavra "foco" ajuda.'),'A palavra "foco" ajuda.');
 assert.equal(ctx.normalizeHunterBio('“Aspas incompletas'),'“Aspas incompletas');
 assert.equal(ctx.normalizeHunterBio('a'.repeat(180)).length,140);
}
console.log('OK r183: teoria com disciplina/assunto reais, Invocador/cadernos/notas/histórico, salvamento antes de sair, escopo e bio sem aspas duplicadas.');
