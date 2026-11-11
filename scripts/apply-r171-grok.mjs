import { readFileSync, writeFileSync } from "node:fs";

// 1. Modificar dist/v77-experience.js
let v77 = readFileSync("dist/v77-experience.js", "utf8");

const grokCoreFunctions = `
  // ── r171: Auditoria Pedagógica e Técnica Grok (Chefe com Maestria, Selo, Recibo, Estados de Gabarito) ──
  function disciplineReadyForBoss(subject){
    const bag = (state && state.topicMastery) || {};
    const camp = String((state && state.activeCampaignId) || "default");
    let sKey = "";
    try { sKey = subjectKey(canonicalSubjectName(subject || "")) || ""; } catch (_e) { sKey = ""; }
    let attempts = 0, correct = 0;
    Object.entries(bag).forEach(([k, v]) => {
      if (!v || typeof v !== "object") return;
      if (!String(k).startsWith(camp + "|")) return;
      if (sKey && v.subjectKey && v.subjectKey !== sKey) return;
      attempts += Number(v.attempts || 0);
      correct += Number(v.correct || 0);
    });
    const score = attempts > 0 ? Number(((correct / attempts) * 100).toFixed(1)) : 0;
    const ready = attempts >= 10 && score >= 70;
    return { ready, attempts, score, minAttempts: 10, minScore: 70 };
  }
  window.disciplineReadyForBoss = disciplineReadyForBoss;

  function questionOriginSeal(q){
    const o = String((q && (q.origin || q.source || q.bank)) || "").toLowerCase();
    const src = String((q && (q.material_title || q.source_label || q.catalog || q.source)) || "").toLowerCase();
    if (q && (q.from_community === true || q.is_community === true || src.includes("compartilh") || src.includes("comunidade"))) return "COMUNIDADE";
    if (o.includes("oficial") || (q && q.official === true)) return "OFICIAL";
    if (o.includes("nativ") || (q && q.native === true)) return "NATIVO";
    return "IA DO SEU MATERIAL";
  }
  window.questionOriginSeal = questionOriginSeal;

  function warnStudyFailure(message){
    try { if (typeof toast === "function") toast(message); else console.warn(message); }
    catch (_e) { console.warn(message); }
  }
  window.warnStudyFailure = warnStudyFailure;

  function answerKeyStatus(q) {
    if (q?.annulled || q?.anulada) return "anulada";
    if (q?.origin === "oficial" && Number.isInteger(Number(q?.correct_index)) && Number(q?.correct_index) >= 0) return "oficial";
    if (q?.answer_unknown || !Number.isInteger(Number(q?.correct_index)) || Number(q?.correct_index) < 0) return "sem_gabarito";
    return "oficial";
  }
  window.answerKeyStatus = answerKeyStatus;

  function gradeAnswer(q, chosen) {
    const status = answerKeyStatus(q);
    if (status === "anulada") return { status, scored: false };
    if (status !== "oficial") return { status, scored: false, chosen };
    const ok = Number(chosen) === Number(q.correct_index);
    return { status, scored: true, ok };
  }
  window.gradeAnswer = gradeAnswer;

  function classifyQuestion(q) {
    const locked = ["edital", "prova", "manual"].includes(q?.subject_source);
    if (locked && q?.subject && !/geral/i.test(q.subject)) {
      return { subject: q.subject, source: q.subject_source, confidence: 1 };
    }
    if (q?.subject && q.subject !== "Conteúdo Geral" && q.subject !== "Geral") {
      return { subject: q.subject, source: "origem", confidence: 1 };
    }
    return { subject: q?.subject || "Conteúdo Geral", source: "padrao", confidence: 0 };
  }
  window.classifyQuestion = classifyQuestion;
`;

if (!v77.includes("async function completeMissionHonestServer")) {
  console.error("completeMissionHonestServer not found in v77");
  process.exit(1);
}

v77 = v77.replace(
  "async function completeMissionHonestServer",
  grokCoreFunctions + "\n  async function completeMissionHonestServer"
);

// Atualizar recibo da missão em finalizeDailyMissionWithHonestXp
const oldReceipt = `    const bonus=Math.max(0,(Number(server?.performance_xp)||0)+(Number(server?.mastery_bonus)||0));
    if(bonus>0)applyXpLocal(bonus,'bonus_desempenho_missao');
    const detail=server?\` (desempenho +\${server.performance_xp||0} XP\${server.mastery_bonus?\` · domínio +\${server.mastery_bonus} XP\`:''})\`:'';
    toast(\`🏆 Missão concluída! +\${100+bonus} XP\${detail}\`);`;

const newReceipt = `    const bonus = Math.max(0, (Number(server?.performance_xp) || 0) + (Number(server?.mastery_bonus) || 0));
    if (bonus > 0) applyXpLocal(bonus, "bonus_desempenho_missao");
    const ac = Number(server?.questions_correct) || 0;
    const n = Number(server?.questions_total) || 0;
    const pct = Number(server?.score) || 0;
    const perf = Number(server?.performance_xp) || 0;
    const mast = Number(server?.mastery_bonus) || 0;
    const bossXp = Number(server?.boss_bonus) || 0;
    const sampleNote = n < 5 ? " Amostra menor que 5: bônus de domínio não entra." : "";
    toast(\`Recibo da missão: \${ac}/\${n} (\${pct}%). XP extra: desempenho +\${perf}, domínio +\${mast}\${bossXp ? \`, chefe +\${bossXp}\` : ""}. A base da missão continua no XP do app. 0% de acerto não gera bônus.\${sampleNote}\`);`;

if (!v77.includes(oldReceipt)) {
  console.error("Old receipt not found in v77");
  process.exit(1);
}
v77 = v77.replace(oldReceipt, newReceipt);

// Incluir selo em showQuestion em v77
v77 = v77.replace(
  "const diffLabel={facil:'🟢 Fácil',medio:'🟡 Média',dificil:'🔴 Difícil'}[diff]||'🟡 Média';",
  "const diffLabel={facil:'🟢 Fácil',medio:'🟡 Média',dificil:'🔴 Difícil'}[diff]||'🟡 Média'; const sealOrigin = typeof window.questionOriginSeal === 'function' ? window.questionOriginSeal(item) : 'OFICIAL';"
);

v77 = v77.replace(
  '<span class="qMetaPill board">🎯 ${escText(boardLabel)}</span>',
  '<span class="qMetaPill board">🎯 ${escText(boardLabel)}</span><span class="qMetaPill seal" style="font-weight:bold;background:rgba(56,189,248,0.18);border:1px solid rgba(56,189,248,0.4);">🏷️ ${escText(sealOrigin)}</span>'
);

writeFileSync("dist/v77-experience.js", v77, "utf8");
console.log("dist/v77-experience.js updated with Grok improvements");

// 2. Modificar dist/index.html para Chefe com Maestria e Selo
let idx = readFileSync("dist/index.html", "utf8");

// Trava do Chefe em renderTopics (disciplinas padrão)
const oldBoss1 = "const unlocked=done>=Math.ceil(s.t.length/2),won=state.bosses?.[selectedSubject];$('#bossCard').innerHTML=`<div class=\"sectionHead\"><h2>Chefe: ${s.n}</h2><strong>${won?'DERROTADO':unlocked?'LIBERADO':'BLOQUEADO'}</strong></div><p class=\"small muted\">${won?'Você venceu o simulado desta disciplina.':unlocked?'Faça um simulado de 20 questões e alcance 70% para vencer.':`Conclua pelo menos ${Math.ceil(s.t.length/2)} missões desta disciplina.`}</p>${unlocked&&!won?'<button class=\"action\" id=\"bossFight\">Iniciar batalha contra o chefe</button>':''}`;";
const newBoss1 = "const bossGate=typeof window.disciplineReadyForBoss==='function'?window.disciplineReadyForBoss(s.n):null;const unlocked=bossGate?bossGate.ready:(done>=Math.ceil(s.t.length/2)),won=state.bosses?.[selectedSubject];const lockMsg=bossGate?`Chefe bloqueado: maestria ${bossGate.score}% em ${bossGate.attempts} questões (precisa ≥70% e pelo menos 10 questões).`:`Conclua pelo menos ${Math.ceil(s.t.length/2)} missões desta disciplina.`;$('#bossCard').innerHTML=`<div class=\"sectionHead\"><h2>Chefe: ${s.n}</h2><strong>${won?'DERROTADO':unlocked?'LIBERADO':'BLOQUEADO'}</strong></div><p class=\"small muted\">${won?'Você venceu o simulado desta disciplina.':unlocked?'Faça um simulado de 20 questões e alcance 70% para vencer.':lockMsg}</p>${unlocked&&!won?'<button class=\"action\" id=\"bossFight\">Iniciar batalha contra o chefe</button>':''}`;";

idx = idx.replace(oldBoss1, newBoss1);

// Trava do Chefe em renderCustomBossCard (disciplinas do edital do usuário)
const oldBoss2 = "const missions=missionPool().filter(m=>m.subject===subject),done=missions.filter(m=>state.done[m.id]).length,unlocked=missions.length>0&&done===missions.length,won=state.bosses?.[bossKey(subject)];$('#bossCard').innerHTML=`<div class=\"sectionHead\"><h2>Chefe: ${esc(subject)}</h2><strong>${won?'DERROTADO':unlocked?'LIBERADO':'BLOQUEADO'}</strong></div><p class=\"small muted\">${won?'Você venceu a avaliação final desta disciplina.':unlocked?'Avaliação final com questões de níveis variados. Alcance 70% para vencer.':`Conclua as ${missions.length} missões da disciplina para enfrentar o Chefe.`}</p>${unlocked&&!won?'<button class=\"action\" id=\"customBossFight\">Enfrentar Chefe da disciplina</button>':''}`;";
const newBoss2 = "const missions=missionPool().filter(m=>m.subject===subject),done=missions.filter(m=>state.done[m.id]).length,bossGate=typeof window.disciplineReadyForBoss==='function'?window.disciplineReadyForBoss(subject):null,unlocked=bossGate?bossGate.ready:(missions.length>0&&done===missions.length),won=state.bosses?.[bossKey(subject)];const lockMsg=bossGate?`Chefe bloqueado: maestria ${bossGate.score}% em ${bossGate.attempts} questões (precisa ≥70% e pelo menos 10 questões).`:`Conclua as ${missions.length} missões da disciplina para enfrentar o Chefe.`;$('#bossCard').innerHTML=`<div class=\"sectionHead\"><h2>Chefe: ${esc(subject)}</h2><strong>${won?'DERROTADO':unlocked?'LIBERADO':'BLOQUEADO'}</strong></div><p class=\"small muted\">${won?'Você venceu a avaliação final desta disciplina.':unlocked?'Avaliação final com questões de níveis variados. Alcance 70% para vencer.':lockMsg}</p>${unlocked&&!won?'<button class=\"action\" id=\"customBossFight\">Enfrentar Chefe da disciplina</button>':''}`;";

idx = idx.replace(oldBoss2, newBoss2);

// Selo de questão em showQuestion de index.html
idx = idx.replace(
  "const q=battle.questions[battle.current],origin=q.origin==='adaptada_do_pdf'?'ADAPTADA DO PDF':'AUTORAL';",
  "const q=battle.questions[battle.current],origin=typeof window.questionOriginSeal==='function'?window.questionOriginSeal(q):(q.origin==='oficial'?'OFICIAL':'IA DO SEU MATERIAL');"
);

writeFileSync("dist/index.html", idx, "utf8");
console.log("dist/index.html updated with Boss Mastery Gate and Question Seal");

// 3. Atualizar cache em dist/sw.js para r171
let sw = readFileSync("dist/sw.js", "utf8");
sw = sw.replace("jornada-cacador-v78-smart-notebook-r170", "jornada-cacador-v78-smart-notebook-r171");
writeFileSync("dist/sw.js", sw, "utf8");
console.log("dist/sw.js updated to r171");
