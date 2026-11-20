// Extrator de provas: o gabarito nunca é inventado nem escolhido ao acaso (casos reais difíceis).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
const a = src.indexOf("function parseExamAnswerKeyTable("), b = src.indexOf("window.extractStructuredExamQuestions=");
assert(a >= 0 && b > a, "extrator não encontrado");
const optionStart = src.indexOf("function answerOptionText("), optionEnd = src.indexOf("function answerOptionsSignature(", optionStart);
assert(optionStart >= 0 && optionEnd > optionStart, "normalizador de alternativas não encontrado");
const ctx = { canonicalSubjectName: (s, d) => d || "Conteúdo Geral", window: {} };
vm.createContext(ctx); vm.runInContext(src.slice(optionStart, optionEnd) + "\n" + src.slice(a, b), ctx);
const extract = (t, o = {}) => ctx.extractStructuredExamQuestions(t, { defaultSubject: "Direito", defaultBoard: "AOCP", ...o });
const L = "ABCDE";
const mkQ = (n, correct, opts = 5, extra = "") => ({ n, correct, body: `QUESTÃO ${String(n).padStart(2, "0")}\nAssinale a alternativa correta sobre o tema número ${n} do edital de concurso.${extra}\n` + Array.from({ length: opts }, (_, i) => `(${L[i]}) Alternativa ${L[i]} da questão ${n} com texto suficiente.`).join("\n") });
const numOf = (r) => Number(r.statement.match(/número (\d+)/)?.[1]);
const wrongKeys = (res, truth) => res.filter((r) => { const exp = truth[numOf(r)]; return exp && r.options[r.correct_index] !== `Alternativa ${exp} da questão ${numOf(r)} com texto suficiente.`; }).length;
const truthOf = (qs) => Object.fromEntries(qs.map((q) => [q.n, q.correct]));

// S1 prova limpa, 5 alternativas, gabarito "01 - A": todas certas e com as 5 alternativas
{ const qs = Array.from({ length: 10 }, (_, i) => mkQ(i + 1, L[(i * 3) % 5]));
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nGABARITO DEFINITIVO\n" + qs.map((q) => `${String(q.n).padStart(2, "0")} - ${q.correct}`).join("   "));
  assert.equal(r.length, 10); assert.equal(wrongKeys(r, truthOf(qs)), 0); assert(r.every((x) => x.options.length === 5), "as 5 alternativas devem ser preservadas");
  assert.equal(r.report.percent, 100); assert(r.every((x) => x.origin === "oficial")); }
// S2 gabarito sem a palavra "gabarito" e prosa com números soltos ("questões 8 a 10", "itens 3 e 4")
{ const qs = Array.from({ length: 10 }, (_, i) => mkQ(i + 1, L[(i * 2 + 1) % 5], 5, i >= 7 ? " Considere as questões 8 a 10 e os itens 3 e 4 da Lei 8 e 9." : ""));
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nRESPOSTAS OFICIAIS\n" + qs.map((q) => `${q.n} ${q.correct}`).join(" | "));
  assert.equal(r.length, 10); assert.equal(wrongKeys(r, truthOf(qs)), 0); }
// S3 dois cadernos (Tipo 1 / Tipo 2): recusa em vez de escolher um caderno ao acaso
{ const qs = Array.from({ length: 6 }, (_, i) => mkQ(i + 1, L[i % 5]));
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nGABARITO\nTIPO 1: " + qs.map((q) => `${q.n}-${q.correct}`).join(" ") + "\nTIPO 2: " + qs.map((q) => `${q.n}-${L[(L.indexOf(q.correct) + 2) % 5]}`).join(" "));
  assert.equal(r.length, 0); assert.equal(r.report.ambiguous, true); assert(/mais de um gabarito/i.test(r.report.reason)); }
// S4 rodapé/cabeçalho de página dentro das alternativas
{ const qs = Array.from({ length: 6 }, (_, i) => mkQ(i + 1, L[i % 5]));
  const r = extract(qs.map((q, i) => q.body + `\nPMPE – Soldado – Caderno 1   Página ${i + 2} de 12\n`).join("\n") + "\nGABARITO\n" + qs.map((q) => `${q.n}-${q.correct}`).join(" "));
  assert.equal(r.length, 6); assert(r.every((x) => !/Página \d+ de|Caderno 1/.test(x.options.join(" ")))); }
// S5 texto-base depois da alternativa E não pode virar parte da alternativa
{ const qs = Array.from({ length: 4 }, (_, i) => mkQ(i + 1, "E")); const base = "\nTEXTO I\n" + "Trecho longo do texto base para as próximas questões de interpretação. ".repeat(6) + "\n";
  const r = extract(qs[0].body + "\n" + qs[1].body + base + qs[2].body + "\n" + qs[3].body + "\nGABARITO\n" + qs.map((q) => `${q.n}-E`).join(" "));
  assert.equal(r.length, 4); assert(r.every((x) => x.options.every((o) => o.length < 200)), "texto-base não pode poluir alternativa"); }
// S6 afirmativas numeradas no enunciado não abrem questão nova
{ const stm = (n) => `QUESTÃO ${n}\nSobre o tema ${n} considere:\n1. Primeira afirmativa sobre o assunto.\n2. Segunda afirmativa sobre o assunto.\n3. Terceira afirmativa sobre o assunto.\nEstá correto o que se afirma em:\n(A) 1 apenas.\n(B) 1 e 2 apenas.\n(C) 2 e 3 apenas.\n(D) 1, 2 e 3.\n(E) 3 apenas.`;
  const r = extract([1, 2, 3, 4].map(stm).join("\n\n") + "\nGABARITO\n1-A 2-B 3-C 4-D");
  assert.equal(r.length, 4); assert(r.every((x) => /Terceira afirmativa/.test(x.statement))); }
// S7 Cebraspe: itens "51 texto" sem ponto e "QUESTÃO N" com Certo/Errado; X = anulada
{ const items = Array.from({ length: 6 }, (_, i) => `${51 + i} O princípio da legalidade administrativa número ${51 + i} estabelece que a administração só pode fazer o que a lei permite.`).join("\n");
  const gab = "\nGABARITO DEFINITIVO\n" + Array.from({ length: 6 }, (_, i) => `${51 + i} ${["C", "E", "C", "C", "E", "X"][i]}`).join(" ");
  const r = extract("Julgue os itens a seguir.\n" + items + gab, { defaultBoard: "Cebraspe" });
  assert.equal(r.length, 5); assert(r.every((x) => JSON.stringify(x.options) === '["CERTO","ERRADO"]')); assert.equal(r.report.annulled, 1); assert.deepEqual([...r.map((x) => x.correct_index)], [0, 1, 0, 0, 1]);
  const items2 = Array.from({ length: 6 }, (_, i) => `QUESTÃO ${51 + i}\nO princípio ${51 + i} estabelece regra. Julgue o item. ( ) Certo ( ) Errado`).join("\n");
  assert.equal(extract(items2 + gab, { defaultBoard: "Cebraspe" }).length, 5); }
// S8 itens numerados de edital antes da prova não viram questões
{ const prefix = "1. DAS INSCRIÇÕES\n1. O candidato deverá se inscrever no site oficial durante o período indicado no edital.\n2. A taxa de inscrição deverá ser paga até a data limite informada no cronograma.\n\n";
  const qs = Array.from({ length: 5 }, (_, i) => mkQ(i + 1, L[i])); const r = extract(prefix + qs.map((q) => q.body).join("\n\n") + "\nGABARITO\n" + qs.map((q) => `${q.n}-${q.correct}`).join(" "));
  assert.equal(r.length, 5); assert.equal(wrongKeys(r, truthOf(qs)), 0); }
// S9 prova SEM gabarito: nada é importado (números soltos na prosa não viram gabarito)
{ const qs = Array.from({ length: 8 }, (_, i) => mkQ(i + 1, "A", 5, i >= 4 ? " Releia as questões 3 a 5, os itens 2 e 4, o artigo 5 a 8 e a Lei 9 e 10." : ""));
  const r = extract(qs.map((q) => q.body).join("\n\n")); assert.equal(r.length, 0, "sem gabarito não pode haver questão 'oficial'"); }
// S10 numeração reinicia por disciplina com gabaritos diferentes: recusa
{ const sec = (nome, letters) => `${nome.toUpperCase()}\n` + letters.map((c, i) => `QUESTÃO ${i + 1}\nAssinale a alternativa correta sobre ${nome} número ${i + 1} do edital.\n` + [...L].map((l) => `(${l}) Opção ${l} de ${nome} ${i + 1} com texto suficiente.`).join("\n")).join("\n\n");
  const r = extract(sec("Português", ["A", "B", "C", "D"]) + "\n\n" + sec("Direito", ["E", "D", "C", "B"]) + "\nGABARITO\nPORTUGUÊS 1-A 2-B 3-C 4-D\nDIREITO 1-E 2-D 3-C 4-B");
  assert.equal(r.length, 0); assert.equal(r.report.ambiguous, true); }
// S11 JSON: sem gabarito válido a questão é descartada; 5 alternativas são mantidas
{ const bad = extract(JSON.stringify([{ statement: "Qual alternativa está correta sobre o tema?", options: ["a1", "b2", "c3", "d4", "e5"] }])); assert.equal(bad.length, 0);
  const out = extract(JSON.stringify([{ statement: "Qual alternativa está correta sobre o tema?", options: ["a1", "b2", "c3", "d4", "e5"], correct_index: 4 }])); assert.equal(out.length, 1); assert.equal(out[0].options.length, 5); assert.equal(out[0].correct_index, 4); assert.notEqual(out[0].origin, "oficial", "JSON do usuário não é verificável como oficial"); }
// S12 preliminar × definitivo: vale o definitivo, sem acusar ambiguidade
{ const qs = Array.from({ length: 5 }, (_, i) => mkQ(i + 1, L[i]));
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nGABARITO PRELIMINAR\n" + qs.map((q) => `${q.n}-${L[(L.indexOf(q.correct) + 1) % 5]}`).join(" ") + "\nGABARITO DEFINITIVO\n" + qs.map((q) => `${q.n}-${q.correct}`).join(" "));
  assert.equal(r.length, 5); assert.equal(r.report.ambiguous, false); assert.equal(wrongKeys(r, truthOf(qs)), 0); }
// S13 gabarito em duas colunas (linha a linha)
{ const qs = Array.from({ length: 10 }, (_, i) => mkQ(i + 1, L[(i * 2) % 5])); const rows = Array.from({ length: 5 }, (_, i) => `${i + 1} ${qs[i].correct}   ${i + 6} ${qs[i + 5].correct}`).join("\n");
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nGABARITO\n" + rows); assert.equal(r.length, 10); assert.equal(wrongKeys(r, truthOf(qs)), 0); }
// S14 cobertura real: questão sem alternativas reconhecíveis baixa o percentual
{ const qs = Array.from({ length: 10 }, (_, i) => mkQ(i + 1, L[i % 5])); qs[4].body = "QUESTÃO 05\nEnunciado sem alternativas reconhecíveis nesta prova digitalizada de forma ruim.";
  const r = extract(qs.map((q) => q.body).join("\n\n") + "\nGABARITO\n" + qs.map((q) => `${q.n}-${q.correct}`).join(" "));
  assert.equal(r.length, 9); assert(r.report.percent < 100 && r.report.percent >= 85); assert.equal(r.report.skipped, 1); }
// S15 prosa em MAIÚSCULAS com "número + letra" soltos e SEM gabarito: nada pode virar gabarito
{ const qs = Array.from({ length: 8 }, (_, i) => mkQ(i + 1, "A", 5, i >= 3 ? " ANALISE OS ARTIGOS 2 E 4 DA LEI 8 A 9 E O ITEM 6 B DO ANEXO." : ""));
  const r = extract(qs.map((q) => q.body).join("\n\n")); assert.equal(r.length, 0, "números soltos em maiúsculas não podem virar gabarito"); }
// S16 questões numeradas "1." (sem a palavra QUESTÃO) com afirmativas "1. 2. 3." dentro do enunciado
{ const stm = (n) => `${n}. Sobre o tema ${n} do edital, considere as afirmativas:\n1. Primeira afirmativa sobre o assunto.\n2. Segunda afirmativa sobre o assunto.\n3. Terceira afirmativa sobre o assunto.\nEstá correto o que se afirma em:\nA) 1 apenas.\nB) 1 e 2 apenas.\nC) 2 e 3 apenas.\nD) 1, 2 e 3.\nE) 3 apenas.`;
  const r = extract([1, 2, 3].map(stm).join("\n\n") + "\nGABARITO\n1-A 2-B 3-C 4-D");
  assert.equal(r.length, 3, `afirmativas numeradas não podem abrir questões novas (obteve ${r.length})`); assert(r.every((x) => /Terceira afirmativa/.test(x.statement)) ); }
// S17 numeração simples ("1."): linha que começa com número FORA do gabarito ("12 A Constituição...") não conta como questão perdida
{ const q = (n, extra = "") => `${n}. Assinale a alternativa correta sobre o tema número ${n} do edital de concurso.\n` + [...L].map((l) => `${l}) Alternativa ${l} da questão ${n} com texto suficiente.`).join("\n") + extra;
  const txt = [q(1), q(2), q(3, "\n12 A Constituição Federal de 1988 estabelece princípios fundamentais para a administração pública."), q(4), q(5)].join("\n\n") + "\nGABARITO\n1-A 2-B 3-C 4-D 5-E";
  const r = extract(txt);
  assert.equal(r.length, 5, `esperava 5 questões (obteve ${r.length})`); assert.equal(r.report.expected, 5, "número fora do gabarito inflou o total esperado"); assert.equal(r.report.percent, 100); }

// ───────────────────────────────────────────────────────────────────────────
// 18. Multi-caderno (Tipo 1 e Tipo 2) com preferredCaderno resolve sem misturar
// ───────────────────────────────────────────────────────────────────────────
{
  const txt = `
    PROVA OBJETIVA
    QUESTÃO 01
    Qual o princípio explícito do art. 37 da Constituição Federal?
    (A) Legalidade administrativa estrita
    (B) Segredo administrativo irrestrito
    (C) Pessoalidade subjetiva
    (D) Nepotismo cruzado

    QUESTÃO 02
    Sobre os poderes administrativos, assinale a correta:
    (A) O poder disciplinar aplica-se a particulares sem vínculo
    (B) O poder de polícia restringe bens e direitos em prol do interesse público
    (C) O poder hierárquico inexiste na Polícia Militar
    (D) O poder regulamentar permite criar tipos penais

    QUESTÃO 03
    No crime de peculato, o funcionário público:
    (A) Apropria-se de bem de que tem a posse em razão do cargo
    (B) Pratica conduta atípica se devolver antes da denúncia
    (C) Só responde se for militar estadual
    (D) Não admite modalidade culposa

    QUESTÃO 04
    Sobre o inquérito policial, assinale a correta:
    (A) É procedimento administrativo inquisitório e preparatório
    (B) Admite contraditório pleno obrigatório sob pena de nulidade da sentença
    (C) Pode ser arquivado diretamente pelo delegado de polícia
    (D) É indispensável para a propositura da ação penal pública

    GABARITO OFICIAL DEFINITIVO
    CADERNO TIPO 1
    1 A 2 B 3 A 4 A
    CADERNO TIPO 2
    1 C 2 D 3 B 4 D
  `;
  const rAmbig = extract(txt, { title: "Prova Multi Caderno", banca: "AOCP", disciplina: "Direito Administrativo" });
  assert.equal(rAmbig.report.ambiguous, true, "sem preferredCaderno deve sinalizar conflito de cadernos");
  assert.ok(rAmbig.report.cadernos && rAmbig.report.cadernos.length >= 2, "deve listar os cadernos detectados");

  const rTipo1 = extract(txt, { title: "Prova Multi Caderno", banca: "AOCP", disciplina: "Direito Administrativo", preferredCaderno: "TIPO 1" });
  assert.equal(rTipo1.report.ambiguous, false, "com preferredCaderno TIPO 1 deve resolver sem ambiguidade");
  assert.equal(rTipo1.length, 4, "deve extrair as 4 questões do Tipo 1");
  assert.equal(rTipo1[0].correct_index, 0);
  assert.equal(rTipo1[1].correct_index, 1);
  assert.equal(rTipo1[2].correct_index, 0);
  assert.equal(rTipo1[3].correct_index, 0);
}


// ───────────────────────────────────────────────────────────────────────────
// 19. Língua Portuguesa: Texto I ANTES da Questão 01 + faixa "questões de 01 a 03"
//     + texto longo (>2.000 caracteres) + questão que cita apenas "No 2º parágrafo"
// ───────────────────────────────────────────────────────────────────────────
{
  const longP1 = "A formação das instituições policiais contemporâneas exige o equilíbrio permanente entre a pronta resposta operacional e a preservação das garantias constitucionais do cidadão. ".repeat(8).trim();
  const longP2 = "Todavia, a velocidade das comunicações digitais impõe desafios inéditos à rotina de patrulhamento, exigindo que cada agente público domine tanto a técnica jurídica quanto a clareza na expressão escrita. ".repeat(8).trim();
  const txt = `
    PROVA DE LÍNGUA PORTUGUESA
    Leia atentamente o texto a seguir para responder às questões de 01 a 04.
    TEXTO I
    ${longP1}

    ${longP2}

    QUESTÃO 01
    De acordo com a ideia central defendida pelo autor, assinale a correta:
    (A) A pronta resposta operacional deve caminhar junto com as garantias constitucionais
    (B) As comunicações digitais dispensam a expressão escrita nas corporações
    (C) O patrulhamento ostensivo independe da técnica jurídica
    (D) As garantias constitucionais opõem-se à formação policial

    QUESTÃO 02
    No 2º parágrafo, o vocábulo "Todavia" introduz relação lógico-semântica de:
    (A) Causa eficiente
    (B) Adversidade / oposição
    (C) Conclusão lógica
    (D) Finalidade restritiva

    QUESTÃO 03
    Assinale a opção em que a palavra "exigindo" (2º parágrafo) mantém o sentido original se reescrita como:
    (A) dispensando que
    (B) conquanto exija
    (C) de modo a exigir
    (D) embora exigisse

    QUESTÃO 04
    O termo "cidadão" (1º parágrafo) recebe acento gráfico ou sinal nasal em razão de:
    (A) Ser oxítona terminada em ditongo nasal
    (B) Ser paroxítona terminada em ditongo crescente
    (C) Ser proparoxítona aparente
    (D) Possuir hiato tônico isolado

    GABARITO DEFINITIVO
    1 A 2 B 3 C 4 A
  `;
  const rPt = extract(txt, { defaultSubject: "Língua Portuguesa", defaultBoard: "AOCP" });
  assert.equal(rPt.length, 4, "deve extrair as 4 questões de Português");
  assert.ok(rPt.every((q) => q.associated_text && q.associated_text.length > 1800), "deve preservar 100% do Texto I (>1800 chars, sem cortar em 1500) nas 3 questões");
  assert.ok(rPt.every((q) => q.associated_text.includes("\n\n")), "deve preservar a separação entre 1º e 2º parágrafos");
  assert.ok(/^Texto-base:/i.test(rPt[1].statement), "Q2 ('No 2º parágrafo...') deve receber o Texto-base mesmo sem repetir a palavra 'texto'");
  assert.ok(/^Texto-base:/i.test(rPt[2].statement), "Q3 (dentro da faixa 01 a 03) deve receber o Texto-base");
}

console.log("OK: extrator de provas (19 cenários: Texto I pré-Q01 de Português até 6.000 chars, faixa 01-03, multi-caderno, 5 alternativas e Certo/Errado).");

// ── modo "importar sem gabarito": nunca inventa a resposta (antes virava a alternativa A / CERTO como "oficial") ──
{
  const mkNoKey = (n) => `QUESTÃO ${String(n).padStart(2, "0")}\nAssinale a alternativa correta sobre o tema número ${n} do edital de concurso.\n` + [...L].map((l) => `(${l}) Alternativa ${l} da questão ${n} com texto suficiente.`).join("\n");
  const prova = [1, 2, 3, 4].map(mkNoKey).join("\n\n");
  const semGab = extract(prova, { allowWithoutKey: true });
  assert.equal(semGab.length, 4, "o modo sem gabarito ainda deve importar o enunciado");
  assert(semGab.every((x) => x.answer_unknown === true && x.correct_index === -1), "questão sem gabarito não pode ter alternativa correta inventada");
  assert(semGab.every((x) => x.origin !== "oficial"), "questão sem gabarito não pode ser 'oficial'");
  assert.equal(semGab.report.answerUnknown, 4);
  assert(semGab.every((x) => /SEM gabarito/i.test(x.explanation)), "a explicação deve dizer que não há gabarito");
  // misto: o que tem gabarito continua oficial e correto; o que não tem fica marcado
  const comPar = extract([1, 2, 3, 4, 5].map(mkNoKey).join("\n\n") + "\nGABARITO\n1-A 2-B 3-C 4-D", { allowWithoutKey: true });
  const q5 = comPar.find((x) => /número 5/.test(x.statement)); const q2 = comPar.find((x) => /número 2/.test(x.statement));
  assert(q5.answer_unknown && q5.correct_index === -1 && q5.origin !== "oficial");
  assert(!q2.answer_unknown && q2.correct_index === 1 && q2.origin === "oficial");
  // Certo/Errado sem gabarito também não assume CERTO
  const ce = extract("Julgue os itens a seguir.\n" + Array.from({ length: 5 }, (_, i) => `QUESTÃO ${60 + i}\nO princípio ${60 + i} da administração pública estabelece regra. ( ) Certo ( ) Errado`).join("\n"), { allowWithoutKey: true });
  assert(ce.length >= 3 && ce.every((x) => x.correct_index === -1 && x.answer_unknown), "C/E sem gabarito não pode assumir CERTO");
  // sem a opção, continua recusando
  assert.equal(extract(prova).length, 0);
  // questões sem gabarito nunca passam pelo filtro de salvamento/carregamento (correct_index inválido)
  assert(semGab.every((x) => x.correct_index < 0), "ficam fora de simulados e do desempenho");
}
{
  const pdfSrc = readFileSync(new URL("../dist/pdf-text-client.js", import.meta.url), "utf8");
  assert(/resolveAiBtn\.hidden = true/.test(pdfSrc), "o botão 'Resolver com IA' não pode aparecer enquanto não existir");
  assert(/examReport\.answerUnknown/.test(pdfSrc), "a cobertura deve avisar sobre questões sem gabarito");
  assert(/Date\.now\(\) - since > 150000/.test(pdfSrc), "a auto-recuperação só pode resetar documentos parados há mais de 150 s");
}
console.log("OK: extrator sem gabarito (nunca assume A/CERTO, fora de simulados).");

// ── S20: Mini Simulados por Tópico (1 a 3 questões com gabarito curto em tabela ou linha) ──
{
  const mini1 = `
MINI SIMULADO - HISTORIA DE PERNAMBUCO 21 - PMPE - HD CURSOS

QUESTÃO 01
A Revolução Pernambucana de 1817 teve como um de seus principais líderes:
(A) Frei Caneca
(B) Domingos José Martins
(C) Zumbi dos Palmares
(D) Maurício de Nassau
(E) Duarte Coelho

QUESTÃO 02
A Confederação do Equador eclodiu em Pernambuco no ano de:
(A) 1817
(B) 1822
(C) 1824
(D) 1830
(E) 1889

GABARITO
01 - B
02 - C
`;
  const r1 = extract(mini1);
  assert.equal(r1.length, 2, "Mini simulado com 2 questões deve ser extraído perfeitamente");
  assert.equal(r1[0].options[r1[0].correct_index], "Domingos José Martins");
  assert.equal(r1[1].options[r1[1].correct_index], "1824");
  assert.equal(r1.report.percent, 100);
  assert.equal(r1.report.ambiguous, false);
  assert(!r1.report.noKey, "Não pode marcar noKey para mini simulado com gabarito");

  const miniSolo = `
MINI SIMULADO - DIREITO CONSTITUCIONAL 15 - PMPE - HD CURSOS

QUESTÃO 01
São Poderes da União, independentes e harmônicos entre si:
(A) O Executivo, o Legislativo e o Judiciário.
(B) O Ministério Público, a Defensoria e a Polícia.
(C) O Presidente, o Governador e o Prefeito.
(D) O Senado, a Câmara e o STF.
(E) A União, os Estados e os Municípios.

GABARITO OFICIAL
1-A
`;
  const rSolo = extract(miniSolo);
  assert.equal(rSolo.length, 1, "Mini simulado com 1 questão e 1 gabarito deve ser aceito");
  assert.equal(rSolo[0].options[rSolo[0].correct_index], "O Executivo, o Legislativo e o Judiciário.");
  assert.equal(rSolo.report.percent, 100);
}
console.log("OK: mini simulados de 1 e 2 questões aceitos sem descartar gabarito.");

