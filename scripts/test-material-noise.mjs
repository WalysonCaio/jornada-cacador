// Anti-ruído do material: remove marca d'água repetida SEM apagar títulos legítimos (compatível com Node 18+ e Node 22+).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const src = readFileSync(new URL("../supabase/functions/material-gemini/index.ts", import.meta.url), "utf8");
const grab = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  assert(a >= 0 && b > a, `trecho não encontrado: ${from}`);
  return src.slice(a, b);
};

const rawTs = [
  grab("function stripWatermarksAndMeta(", "function removeRepeatedBoilerplate("),
  grab("function removeRepeatedBoilerplate(", "function isNonDidacticSlide("),
].join("\n");

const jsCode = rawTs
  .replace(/:\s*TextPage\[\]/g, "")
  .replace(/:\s*string(\[\])?/g, "")
  .replace(/<string(?:,\s*number)?>/g, "");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(jsCode, ctx);
const { stripWatermarksAndMeta, removeRepeatedBoilerplate } = ctx;

const headings = [
  "Controle De Constitucionalidade",
  "Poder Executivo Federal",
  "Superior Tribunal De Justiça",
  "Princípio Da Legalidade Administrativa",
  "Atos Administrativos Discricionários",
  "Direitos Fundamentais Sociais",
  "Conselho Nacional De Justiça",
  "Sistema Único De Saúde",
  "Estatuto Da Criança",
  "Lei Maria Da Penha",
  "Habeas Corpus Preventivo",
  "Mandado De Segurança",
  "Princípios Constitucionais Explícitos",
];

// 1) títulos legítimos nunca são apagados, nem por página nem pelo documento
for (const h of headings) assert(stripWatermarksAndMeta(`antes\n${h}\ndepois`).includes(h), `título apagado: ${h}`);
const pages = Array.from({ length: 13 }, (_, i) => ({
  page: i + 1,
  text: `${headings[i % headings.length]}\nConteúdo didático da página ${i + 1} sobre o tema.\nMaria Aparecida Souza Lima\nCurso Alfa Concursos - Prof. Fulano de Tal\nJulgue os itens a seguir.`,
}));
const cleaned = removeRepeatedBoilerplate(pages);
for (const h of headings) assert(cleaned.some((p) => p.text.includes(h)), `título perdido no documento: ${h}`);

// 2) marca d'água e cabeçalho repetidos em todas as páginas saem
assert(cleaned.every((p) => !p.text.includes("Maria Aparecida Souza Lima")), "nome do comprador repetido deveria sair");
assert(cleaned.every((p) => !p.text.includes("Curso Alfa Concursos")), "cabeçalho repetido deveria sair");
assert(cleaned.every((p) => p.text.includes("Conteúdo didático")), "conteúdo didático deve ficar");

// 3) estrutura de prova repetida é preservada
assert(cleaned.every((p) => p.text.includes("Julgue os itens a seguir.")), "instrução de prova não pode ser removida");

// 4) documentos curtos não são mexidos; CPF e e-mail saem sempre
assert.equal(removeRepeatedBoilerplate(pages.slice(0, 4)).length, 4);
assert.deepEqual(JSON.parse(JSON.stringify(removeRepeatedBoilerplate(pages.slice(0, 4)))), pages.slice(0, 4));
const priv = stripWatermarksAndMeta("Art. 5º todos são iguais\nCPF 123.456.789-09 aluno@email.com licenciado para Fulano");
assert(priv.includes("Art. 5º") && !priv.includes("123.456") && !priv.includes("@email"), "CPF/e-mail devem sair e o artigo ficar");
console.log("OK: anti-ruído preserva títulos e remove só marca d'água repetida.");
