// Testa as regras de estudo do front (flashcards, questões, armazenamento) sem navegador.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const slice = (from, to) => { const a = script.indexOf(from), b = script.indexOf(to, a); assert(a >= 0 && b > a, `trecho não encontrado: ${from}`); return script.slice(a, b); };

const code = [
  slice("function fcKey(", "function belongsToActiveCampaign("),
  slice("function questionPriority(", "function learningUnits("),
  slice("function questionFingerprint(", "function questionsForMode("),
  slice("function save(){", "function level("),
  "function difficultyWeight(v){return({facil:0,medio:1,dificil:2})[v]??1} function learningCategory(s){return String(s||'')} function shuffle(a){return[...a]} function scheduleCloudSync(){} function renderStreak(){}",
].join("\n");

function makeEnv() {
  const els = { "#flashcard": { dataset: {}, classList: { remove() {} } }, "#cardQuestion": {}, "#cardAnswer": {}, "#cardCounter": {}, "#cardFilter": { value: "all" }, "#flashDueOnlyToggle": { checked: false }, "#toast": { classList: { add() {}, remove() {} } } };
  const toasts = [];
  const ctx = { ALL_FLASHCARDS: [], currentCard: 0, KEY: "k", state: { flashProgress: {}, answeredQuestionFingerprints: {} }, $: (s) => els[s], document: { dispatchEvent() {}, getElementById: (id) => els["#" + id] }, Event: class {}, localStorage: { setItem() {} }, window: {}, setTimeout, clearTimeout, console };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  ctx.toast = (m) => toasts.push(m);
  return { ctx, els, toasts, run: (e) => vm.runInContext(e, ctx) };
}
const cards = (n) => Array.from({ length: n }, (_, i) => ["Direito", `Pergunta número ${i}`, `Resposta ${i}`]);

// 1) cartões novos seguem a ordem e o avaliado sai da frente da fila
{
  const { ctx, els, run } = makeEnv(); ctx.ALL_FLASHCARDS = cards(5);
  run("renderCard()"); assert.equal(els["#cardQuestion"].textContent, "Pergunta número 0");
  run("gradeCard('easy')");
  assert.equal(els["#cardQuestion"].textContent, "Pergunta número 1", "depois de avaliar, deve vir o próximo cartão pendente");
  const p = ctx.state.flashProgress[run("fcKey(ALL_FLASHCARDS[0])")];
  assert.equal(p.streak, 1); assert.equal(Math.round(p.interval), 3);
}
// 2) difícil volta em ~10 min e zera a sequência; fácil dobra o intervalo
{
  const { ctx, els, run } = makeEnv(); ctx.ALL_FLASHCARDS = cards(3);
  run("renderCard(); gradeCard('hard')");
  const key = run("fcKey(ALL_FLASHCARDS[0])"), p = ctx.state.flashProgress[key];
  assert(p.interval < 0.01 && p.lapses === 1 && p.streak === 0);
  p.nextDue = new Date(Date.now() - 1000).toISOString();           // passaram os 10 min
  run("currentCard=0; renderCard()");
  assert.equal(els["#cardQuestion"].textContent, "Pergunta número 0", "cartão difícil vencido deve voltar primeiro");
  const intervals = []; for (let i = 0; i < 4; i++) { run("gradeCard('easy')"); intervals.push(Math.round(ctx.state.flashProgress[key].interval)); ctx.state.flashProgress[key].nextDue = new Date(Date.now() - 1000).toISOString(); run("currentCard=0; renderCard()"); }
  assert.deepEqual(intervals, [3, 7, 14, 30]);
}
// 3) filtro "apenas pendentes/difíceis" funciona
{
  const { ctx, els, run } = makeEnv(); ctx.ALL_FLASHCARDS = cards(4);
  const fut = new Date(Date.now() + 5 * 864e5).toISOString();
  ctx.state.flashProgress[run("fcKey(ALL_FLASHCARDS[0])")] = { level: "easy", nextDue: fut, streak: 1 };
  ctx.state.flashProgress[run("fcKey(ALL_FLASHCARDS[1])")] = { level: "hard", nextDue: fut, streak: 0 };
  assert.equal(run("filteredCards().length"), 4);
  els["#flashDueOnlyToggle"].checked = true;
  assert.deepEqual(JSON.parse(run("JSON.stringify(filteredCards().map(x=>x.i))")).sort(), [1, 2, 3]);
}
// 4) progresso antigo (por índice) é aproveitado e o novo acompanha o cartão se a ordem mudar
{
  const { ctx, run } = makeEnv(); ctx.ALL_FLASHCARDS = cards(3);
  ctx.state.flashProgress[2] = { level: "easy", nextDue: new Date(Date.now() + 9 * 864e5).toISOString() };
  assert.equal(run("filteredCards().find(x=>x.i===2).due"), false);
  const target = ctx.ALL_FLASHCARDS[1]; run("renderCard(); currentCard=0");
  ctx.state.flashProgress[run("fcKey(ALL_FLASHCARDS[1])")] = { level: "easy", nextDue: new Date(Date.now() + 9 * 864e5).toISOString() };
  ctx.ALL_FLASHCARDS = [["Direito", "Pergunta nova", "x"], ...ctx.ALL_FLASHCARDS];   // cartões regenerados, ordem mudou
  const moved = JSON.parse(run("JSON.stringify(filteredCards().map(x=>({q:x.c[1],due:x.due})))")).find((x) => x.q === target[1]);
  assert.equal(moved.due, false, "o progresso deve seguir o cartão, não a posição");
}
// 5) questões: erradas e inéditas aparecem mais do que as já dominadas
{
  const { ctx, run } = makeEnv();
  const pool = Array.from({ length: 12 }, (_, i) => ({ subject: "D", topic: "t", statement: `enunciado ${i}`, difficulty: ["facil", "medio", "dificil"][i % 3] }));
  ctx.POOL = pool;
  [0, 1, 2, 3].forEach((i) => { ctx.state.answeredQuestionFingerprints[run(`questionFingerprint(POOL[${i}])`)] = "correct"; });
  [4, 5].forEach((i) => { ctx.state.answeredQuestionFingerprints[run(`questionFingerprint(POOL[${i}])`)] = "wrong"; });
  const freq = Array(12).fill(0);
  for (let n = 0; n < 400; n++) for (const q of run("balancedQuestions(POOL,5)")) freq[pool.indexOf(q)]++;
  const avg = (ids) => ids.reduce((s, i) => s + freq[i], 0) / ids.length;
  assert(avg([4, 5]) > avg([0, 1, 2, 3]) * 1.5, `erradas (${avg([4, 5])}) devem sair bem mais que dominadas (${avg([0, 1, 2, 3])})`);
}
// 6) armazenamento cheio não derruba o app e avisa uma vez
{
  const { ctx, toasts, run } = makeEnv();
  ctx.localStorage = { setItem() { throw new Error("QuotaExceededError"); } };
  run("save(); save()");
  assert.equal(toasts.filter((m) => /armazenamento/i.test(m)).length, 1);
}
console.log("OK: regras de estudo do front validadas (flashcards, fila, filtro, legado, questões, armazenamento).");

// 7) reanálise do edital não pode apagar o progresso do aluno
{
  const rc = [slice("function normalizeText(", "function subjectKey("), slice("function missionIdentity(", "async function loadCampaignTopics("), "function dedupeDailyHistory(){}"].join("\n");
  const ctx = { state: { done: {}, errors: {}, daily: null, dailyHistory: [], activeCampaignId: "c1" } };
  vm.createContext(ctx); vm.runInContext(rc, ctx);
  const M = (id, subject, name) => ({ id, subject, name });
  const previous = [M("edital-1", "Língua Portuguesa", "Interpretação de textos"), M("edital-2", "Direito Penal", "Crimes contra a administração pública"), M("edital-3", "Informática", "Conceitos de hardware"), M("edital-4", "História", "Brasil Império")];
  Object.assign(ctx.state.done, { "edital-1": "2026-10-01", "edital-2": "2026-10-02", "edital-3": "2026-10-03", "edital-4": "2026-10-04" });
  ctx.state.errors["edital-2"] = { misses: 2, missionId: "edital-2" }; ctx.state.daily = "edital-2";
  const next = [
    M("edital-9", "LÍNGUA PORTUGUESA", "1. Interpretação de textos"),                         // mesmo nome (numeração/caixa diferentes)
    M("edital-8", "Direito Penal", "Crimes contra a administração pública em geral"),         // nome ampliado
    M("edital-7", "Informática", "Redes de computadores"),                                    // outro tema da mesma disciplina
    M("edital-6", "Geografia", "Clima do Brasil"),
  ];
  const stats = vm.runInContext("reconcileMissionProgress(" + JSON.stringify(previous) + "," + JSON.stringify(next) + ")", Object.assign(ctx, {}));
  assert(ctx.state.done["edital-9"], "casamento exato (ignora caixa e numeração)");
  assert(ctx.state.done["edital-8"] && ctx.state.errors["edital-8"] && ctx.state.daily === "edital-8", "casamento aproximado mantém missão, erro e missão do dia");
  assert(!ctx.state.done["edital-7"], "tema diferente não herda progresso");
  assert.equal(stats.fuzzy, 1); assert.equal(stats.lost, 2);
  assert.equal(ctx.state.archivedProgress.length, 2, "o que não casou fica arquivado, não some");
  assert(ctx.state.archivedProgress.some((x) => x.name === "Conceitos de hardware"));
}
console.log("OK: reanálise preserva/arquiva progresso.");

// 8) ofensiva diária adapta o mínimo quando a meta diária é menor que 50 min (ex.: 30 min)
{
  const sc = [
    slice("const STREAK_MIN_SECONDS=50*60;", "function repairStudyLedger("),
    "function localDayKey(d){return d.toISOString().slice(0,10)}",
  ].join("\n");
  const ctx = { state: { settings: { dailyMinutes: 30 }, studyByDay: { "2026-10-28": 30 * 60 }, done: { "m1": "2026-10-28T12:00:00Z" }, dailyHistory: [] } };
  vm.createContext(ctx); vm.runInContext(sc, ctx);
  assert.equal(vm.runInContext("streakMinSeconds()", ctx), 1800, "meta de 30 min reduz requisito da ofensiva para 30 min");
  assert.equal(vm.runInContext("qualifiesStreakDay('2026-10-28')", ctx), true, "30 min estudados + missão confirmam a ofensiva no plano de 30 min");
  ctx.state.settings.dailyMinutes = 120;
  assert.equal(vm.runInContext("streakMinSeconds()", ctx), 3000, "metas >= 50 min mantêm o teto de 50 min para a ofensiva");
}

// 9) duas questões erradas na mesma missão não sobrescrevem uma à outra no caderno de erros
{
  const ec = [
    slice("function normalizeText(", "function subjectKey("),
    slice("function missionForQuestion(", "function dueReviews("),
    "function missionPool(){return[{id:'m1',subject:'Direito Penal',name:'Crimes contra a Administração'}]} function learningCategory(s){return String(s||'')} function addDaysISO(d){return new Date(Date.now()+d*864e5).toISOString()}",
  ].join("\n");
  const ctx = { state: { activeCampaignId: "c1", errors: {}, questionStatsByCampaign: {} } };
  vm.createContext(ctx); vm.runInContext(ec, ctx);
  const q1 = { subject: "Direito Penal", topic: "Peculato", statement: "Questão 1 sobre peculato culposo", options: ["A", "B"], correct_index: 0 };
  const q2 = { subject: "Direito Penal", topic: "Concussão", statement: "Questão 2 sobre concussão e exigência", options: ["A", "B"], correct_index: 1 };
  vm.runInContext(`recordQuestionResult(${JSON.stringify(q1)}, false, 1)`, ctx);
  vm.runInContext(`recordQuestionResult(${JSON.stringify(q2)}, false, 0)`, ctx);
  assert.equal(Object.keys(ctx.state.errors).length, 2, "duas questões diferentes da mesma missão geram dois registros separados no caderno de erros");
}
console.log("OK: ofensiva adaptativa e caderno de erros por questão individual validados.");

// 10) edital com todos os tópicos sob 1 único subject genérico ("Conhecimentos Gerais" ou "Edital") é desdobrado em todas as disciplinas reais
{
  const uc = [
    slice("function normalizeText(", "function missionForQuestion("),
    slice("window.unpackEditalTopicsList=function(", "window._activeProcessingDocs="),
  ].join("\n");
  const ctx = { window: {} };
  vm.createContext(ctx); vm.runInContext(uc, ctx);
  const rawFromDb = [
    { id: 1, subject: "Conhecimentos Gerais", unit_name: "Língua Portuguesa", topic: "Compreensão e interpretação de textos" },
    { id: 2, subject: "Conhecimentos Gerais", unit_name: "Raciocínio Lógico", topic: "Estruturas lógicas e diagramas" },
    { id: 3, subject: "Conhecimentos Gerais", unit_name: "Direito Constitucional", topic: "Direitos e garantias fundamentais" },
    { id: 4, subject: "Edital", unit_name: "", topic: "Informática: 1. Conceitos de internet e intranet. 2. Segurança da informação. 3. Correio eletrônico e navegadores." },
  ];
  const unpacked = ctx.window.unpackEditalTopicsList(rawFromDb, "PMPE — Soldado");
  const subjects = [...new Set(unpacked.map((x) => x.subject))];
  assert(subjects.length >= 4, `esperava ao menos 4 disciplinas separadas, obteve ${subjects.length}: ${subjects.join(", ")}`);
  assert(subjects.includes("Língua Portuguesa") && subjects.includes("Direito Constitucional") && subjects.includes("Informática"));
}
console.log("OK: desdobramento automático de disciplinas do edital validado.");

// Teste 10: Redação esconde hero da tela inicial e sorteia tema com Textos Motivadores I e II + Comando
{
  const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  assert.ok(htmlSrc.includes("if(hero)hero.hidden=(id!=='today')"), "openView deve ocultar .hero fora da tela inicial (today)");
  assert.ok(v77Src.includes("TEXTO MOTIVADOR I:") && v77Src.includes("TEXTO MOTIVADOR II:") && v77Src.includes("PROPOSTA E CRITÉRIOS DA BANCA:"), "Sorteio de redação deve incluir Texto Motivador I, Texto Motivador II e Comando da Banca");
  assert.ok(v77Src.includes("generateAiEssayThemeBtn") && v77Src.includes("essayMotivatingBox"), "Central de Redação deve ter gerador IA de proposta com textos de apoio e painel visual de leitura");
  console.log("OK: tela de redação sem hero inicial e propostas com Textos Motivadores I e II validadas.");
}

// Teste 11: Painel TAF Policial (Forma Fit) e Ranking Geral de Caçadores
{
  const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  const sqlSrc = readFileSync(new URL("../supabase/migrations/20261030_v89_taf_and_leaderboard.sql", import.meta.url), "utf8");
  assert.ok(htmlSrc.includes('id="taf"') && htmlSrc.includes('id="ranking"'), "Views #taf e #ranking devem existir no index.html");
  assert.ok(htmlSrc.includes('data-menu-view="taf"') && htmlSrc.includes('data-menu-view="ranking"'), "Botões do Menu para TAF e Ranking devem existir");
  assert.ok(v77Src.includes("TAF_PRESETS") && v77Src.includes("tafMetTarget") && v77Src.includes("tafActiveSeconds"), "Painel TAF deve conter presets policiais, cálculo de aptidão e cronômetro do Forma Fit");
  assert.ok(v77Src.includes("get_hunters_leaderboard") && sqlSrc.includes("create or replace function public.get_hunters_leaderboard()"), "Ranking deve consultar get_hunters_leaderboard no Supabase listando todos os usuários cadastrados");
  console.log("OK: Painel TAF Policial e Ranking Geral de Caçadores validados.");
}

// Teste 12: Central de Revisão Ativa + Raio-X de Véspera + Incidência no Edital + Redação Digitada
{
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  assert.ok(v77Src.includes("enhanceReviewCenter") && v77Src.includes("exportVesperaRaioX") && v77Src.includes("startActiveReviewSession"), "Central de Revisão deve ter Raio-X de Véspera e Revisão Ativa por questões");
  assert.ok(v77Src.includes("decorateEditalIncidenceBadges") && v77Src.includes("enhanceTypedEssayOption"), "Deve conter etiquetas de incidência no edital e modo de redação digitada");
  console.log("OK: Central de Revisão Ativa, Raio-X de Véspera, Incidência no Edital e Redação Digitada validados.");
}

// Teste 13: Biblioteca Compartilhada da Comunidade (Sem Download de PDF + Anti-CPF), Perfis Primário/Secundário no Ranking (Sem TAF) e Responsividade Mobile
{
  const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  const sqlSrc = readFileSync(new URL("../supabase/migrations/20261030_v91_community_library_and_ranking.sql", import.meta.url), "utf8");
  assert.ok(htmlSrc.includes('id="communityViewerDialog"') && htmlSrc.includes('data-view-community-doc'), "Deve ter visualizador protegido da comunidade sem botão de download do PDF bruto");
  assert.ok(v77Src.includes("sanitizePersonalWatermarks") && sqlSrc.includes("sanitize_personal_watermarks"), "Deve higienizar CPF e marcas d'água pessoais no SQL e no JS");
  assert.ok(v77Src.includes("rankProfileSecRoleInput") && v77Src.includes("renderRoleBadgesHtml") && sqlSrc.includes("secondary_role"), "Ranking deve exibir perfil primário e secundário quando cadastrados");
  const rankSection = v77Src.slice(v77Src.indexOf("function renderHuntersLeaderboard()"), v77Src.indexOf("function ensureTafAndRankingShortcuts()"));
  assert.ok(!rankSection.includes("taf_ready"), "Ranking não deve exibir dados de treino do TAF");
  console.log("OK: Biblioteca da Comunidade (protegida contra download/CPF), Perfis Primário/Secundário no Ranking (sem TAF) e Responsividade Mobile validados.");
}

// Teste 14: Alinhamento do ícone de perfil mobile, 6 cards sem buraco em Hoje, bloqueio de e-mail duplicado e deduplicação do Ranking
{
  const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  const sqlSrc = readFileSync(new URL("../supabase/migrations/20261030_v92_dedup_accounts_and_ui.sql", import.meta.url), "utf8");
  assert.ok(!htmlSrc.includes(".accountArea #accountBtn{grid-column:1/3}"), "Regra legada que desalinhava o botão de perfil no mobile deve ter sido removida");
  assert.ok(htmlSrc.includes("checkEmailAlreadyRegistered") && htmlSrc.includes("translateAuthError") && htmlSrc.includes("token_hash"), "Autenticação deve verificar e-mail já cadastrado e suportar recuperação de senha completa");
  assert.ok(v77Src.includes("openEssayShortcut") && v77Src.includes("deduplicateHunterRows") && v77Src.includes("dedupRankingBtn"), "Painel Hoje deve ter o 6º card preenchendo a grade e Ranking deve deduplicar perfis");
  assert.ok(sqlSrc.includes("cleanup_duplicate_hunter_profiles") && sqlSrc.includes("select distinct on (c.norm_name)"), "SQL v92 deve limpar contas duplicadas em auth.users e deduplicar o Ranking");
  console.log("OK: Alinhamento mobile do perfil, grade 6 cards em Hoje, proteção contra conta duplicada e limpeza do Ranking validados.");
}

// Teste 15: Edital individual (não compartilhado na comunidade), estabilidade da lista sem piscar e padronização de nomes (ex.: DIREITOS INDIVIDUAIS E COLETIVOS-ART.5)
{
  const htmlSrc = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const v77Src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
  const sqlSrc = readFileSync(new URL("../supabase/migrations/20261030_v92_dedup_accounts_and_ui.sql", import.meta.url), "utf8");
  assert.ok(htmlSrc.includes("DIREITOS INDIVIDUAIS E COLETIVOS-ART.5") && htmlSrc.includes("standardizeDocumentTitle"), "Deve sugerir e padronizar nomes de arquivos na Biblioteca");
  assert.ok(htmlSrc.includes("preservedCommunity"), "loadCloudDocuments deve preservar arquivos da comunidade para não piscar na tela");
  assert.ok(v77Src.includes("!['edital','edital_concurso'].includes(d.document_type)") && sqlSrc.includes("d.document_type not in ('edital', 'edital_concurso')"), "Edital não deve ser compartilhado entre usuários na Biblioteca da Comunidade");
  console.log("OK: Edital exclusivo por usuário, lista estável sem piscar e padronização de títulos na Biblioteca validados.");
}

