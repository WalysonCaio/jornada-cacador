// Integridade da análise de materiais (apostilas, provas, simulados): cobertura real, sem truncar, sem gabarito inventado e anti-ruído.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as nodeModule from "node:module";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = readFileSync(new URL("../supabase/functions/material-gemini/index.ts", import.meta.url), "utf8");
const grab = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a + 1); assert(a >= 0 && b > a, `trecho não encontrado: ${from}`); return src.slice(a, b); };

function stripTs(tsCode) {
  if (typeof nodeModule.stripTypeScriptTypes === "function") {
    return nodeModule.stripTypeScriptTypes(tsCode);
  }
  const babel = require("@babel/core");
  const res = babel.transformSync(tsCode, {
    plugins: ["@babel/plugin-transform-typescript"],
    filename: "chunk.ts",
  });
  return res.code;
}

const code = [
  src.match(/const TEXT_CHUNK_TARGET = \d+;/)[0], src.match(/const MAX_TEXT_CHUNKS = \d+;/)[0], src.match(/const TEXT_CHUNK_MAX = \d+;/)[0],
  "type TextPage = { page: number; text: string };", "type TextChunk = { index: number; pageStart: number; pageEnd: number; text: string; headings: string[] };",
  grab("function stripWatermarksAndMeta(", "function normalizeExtractedPage("),
  grab("function pageHeadings(", "function createTextChunks("),
  grab("function createTextChunks(", "async function callOpenAiCompatibleProvider("),
  grab("function cleanGeneratedText(", "function subjectKey("),
  grab("function sanitizeQuestions(", "function sanitizeStrings("),
  grab("function isNonDidacticSummary(", "function coverageReport("),
  "export { createTextChunks, buildTextCoverage, sanitizeQuestions, sanitizeSummary, isNonDidacticSummary, isNonDidacticSlide };",
].join("\n");

const dir = mkdtempSync(join(tmpdir(), "mat-")); const file = join(dir, "m.mjs");
writeFileSync(file, stripTs(code));
const { createTextChunks, buildTextCoverage, sanitizeQuestions, sanitizeSummary, isNonDidacticSummary, isNonDidacticSlide } = await import(pathToFileURL(file).href);

// 1) apostila grande: nenhum caractere é descartado
const pages = Array.from({ length: 400 }, (_, i) => ({ page: i + 1, text: `CAPÍTULO ${i + 1}\n` + `Conteúdo da página ${i + 1}. `.repeat(100) }));
const chunks = createTextChunks(pages);
const total = pages.reduce((s, p) => s + p.text.length, 0);
const kept = chunks.reduce((s, c) => s + c.text.replace(/\[PÁGINA \d+\]\n/g, "").replace(/\n\n/g, "").length, 0);
assert(chunks.every((c) => c.text.length <= 44000 + 4000), "trecho acima do limite");
assert(pages.every((p) => chunks.some((c) => c.text.includes(`Conteúdo da página ${p.page}. `))), "alguma página ficou fora dos trechos");
assert(kept >= total * 0.98, `texto descartado: manteve ${kept} de ${total}`);
assert.equal(chunks[0].pageStart, 1); assert.equal(chunks.at(-1).pageEnd, 400);
// documento pequeno continua em poucos trechos
assert(createTextChunks(pages.slice(0, 20)).length <= 2);

// 2) cobertura não pode ser 100% quando trechos falham
const ok = chunks.map((_, i) => i % 3 !== 0);
const cov = buildTextCoverage(chunks, ok, 400);
const failed = ok.filter((x) => !x).length;
assert.equal(cov.omissions.length, failed); assert(cov.coverage_confidence < 0.9);
assert(cov.sections_covered.length < cov.sections_detected.length, "cobertura declarada não pode ser total");
const full = buildTextCoverage(chunks, chunks.map(() => true), 400);
assert.equal(full.omissions.length, 0); assert.equal(full.coverage_confidence, 0.9);

// 3) gabarito nunca é inventado
const q = (extra) => ({ statement: "Qual alternativa está correta sobre o tema estudado?", options: ["Alfa", "Beta", "Gama", "Delta"], explanation: "Justificativa completa da resposta.", difficulty: "medio", ...extra });
assert.equal(sanitizeQuestions([q({ correct_index: 2 })], "t").length, 1);
assert.equal(sanitizeQuestions([q({ correct_index: "C" })], "t")[0].correct_index, 2);
for (const bad of [undefined, null, "", "Z", 9, -1, 4]) assert.equal(sanitizeQuestions([q({ correct_index: bad })], "t").length, 0, `gabarito inválido (${bad}) deveria descartar a questão`);
// questões de 5 alternativas mantêm a correta
const five = sanitizeQuestions([{ ...q({ correct_index: 4 }), options: ["A1", "B2", "C3", "D4", "E5"] }], "t");
assert.equal(five.length, 1); assert.equal(five[0].options[five[0].correct_index], "E5");

// 4) anti-ruído: descarta questões sobre @prof, gratidão ou pouca densidade conceitual
const qNoiseProf = q({ statement: "Sobre o documento, o material faz referência ao perfil @PROFGEDSON?", correct_index: 0 });
assert.equal(sanitizeQuestions([qNoiseProf], "t").length, 0, "deve descartar questão que menciona @prof");
const qNoiseCapa = q({ statement: "O arquivo aparenta ser uma capa ou introdução com pouca densidade conceitual detalhada?", correct_index: 0 });
assert.equal(sanitizeQuestions([qNoiseCapa], "t").length, 0, "deve descartar questão sobre pouca densidade/capa");
const qNoiseGratidao = q({ statement: "A mensagem GRATIDÃO!! expressa encerramento?", correct_index: 0 });
assert.equal(sanitizeQuestions([qNoiseGratidao], "t").length, 0, "deve descartar questão sobre GRATIDÃO");

// 5) anti-ruído: descarta resumos sobre capa ou gratidão
assert.equal(isNonDidacticSummary("GRATIDÃO!!", "Encerramento", ["Agradecimento"]), true);
assert.equal(isNonDidacticSummary("RACIOCÍNIO LÓGICO MATEMÁTICO - @PROFGEDSON", "", ["O conteúdo nesta seção é introdutório/capa, sem aprofundamento"]), true);
assert.equal(isNonDidacticSummary("Equivalências Lógicas da Condicional", "Teoria da condicional", ["P -> Q <=> ~Q -> ~P"]), false);
const badSum = sanitizeSummary({ title: "GRATIDÃO!!", explanation: "Obrigado", points: ["Fim"] }, []);
assert.equal(badSum.title, "", "resumo de gratidão deve ser sanitizado como vazio");

// 6) a cobertura publicada vem dos trechos realmente analisados (e não de um valor fixo)
assert(/const analyzed = chunks\.map\(\(_, index\) => Boolean\(results\[index\]\?\.parsed\?\.summaries\?\.length\)\)/.test(src), "cobertura deve depender do resultado de cada trecho");
assert(/coverage: buildTextCoverage\(chunks, analyzed, pages\.length\)/.test(src), "generateStudyPackageFromText deve usar buildTextCoverage(analyzed)");
assert(!/origin: "oficial"/.test(src), "questões geradas/adaptadas não podem ser gravadas como origem oficial");

console.log("OK: material íntegro (sem truncar, cobertura real, sem gabarito inventado e anti-ruído validado).");
