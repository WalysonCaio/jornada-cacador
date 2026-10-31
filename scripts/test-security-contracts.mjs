// Guardas de regressão de segurança (estáticas): rode antes de publicar.
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const migrations = readdirSync(new URL("supabase/migrations/", root)).filter((f) => f.endsWith(".sql")).sort();

// 1) nenhuma migração pode executar a exclusão automática de contas
for (const f of migrations) {
  const sql = read(`supabase/migrations/${f}`);
  const active = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert(!/select\s+public\.cleanup_duplicate_hunter_profiles\s*\(/i.test(active), `${f}: executa a limpeza que apaga contas`);
}
// 2) o front não pode chamar RPCs que apagam contas
for (const f of ["dist/index.html", "dist/v77-experience.js", "dist/v59-enhancements.js", "dist/v78-smart-notebook.js", "dist/pdf-text-client.js"]) {
  assert(!/cleanup_duplicate_hunter_profiles/.test(read(f)), `${f}: chama RPC que exclui contas`);
}
// 3) funções SECURITY DEFINER que apagam auth.users não podem ficar liberadas a usuários logados (considera a última definição)
const all = migrations.map((f) => read(`supabase/migrations/${f}`)).join("\n");
const defs = [...all.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$;/gi)];
for (const m of defs) {
  const [block, name] = m;
  if (/delete\s+from\s+auth\.users/i.test(block)) {
    const dropped = new RegExp(`drop function if exists public\\.${name}\\b`, "i").test(all.slice(m.index + block.length));
    assert(dropped, `public.${name} apaga auth.users e não foi removida por migração posterior`);
  }
}
// 4) estrutura das migrações novas
for (const f of migrations.filter((x) => x.startsWith("20261031"))) {
  const sql = read(`supabase/migrations/${f}`);
  assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, `${f}: $$ desbalanceado`);
  const code = sql.replace(/--[^\n]*/g, "").replace(/'(?:[^']|'')*'/g, "''");
  let depth = 0; for (const ch of code) { if (ch === "(") depth++; if (ch === ")") depth--; assert(depth >= 0, `${f}: parêntese fechado sem abrir`); }
  assert.equal(depth, 0, `${f}: parênteses desbalanceados`);
  assert(!/split_part\(coalesce\(u\.email/.test(sql), `${f}: deriva nome público do e-mail`);
  assert(!/\(\s*(us\.state|ru\.st|s\.item|c_item)[^)]*\)\s*::(int|numeric|boolean)/.test(sql.replace(/safe_int\([^)]*\)::numeric/g, "")), `${f}: conversão insegura de JSON do usuário`);
}
const b = read("supabase/migrations/20261031120100_v96_b_ranking_duels_hardening.sql");
assert(/using \(auth\.uid\(\) in \(challenger_id, opponent_id\)\)/.test(b), "duelos devem ser legíveis só por participantes");
assert(/already_submitted/.test(b) && /duel_closed/.test(b), "reenvio de placar deve ser recusado");
assert(!/challenger_score := greatest\(0, coalesce\(p_score/.test(b), "placar não pode vir do cliente");
// 5) cabeçalhos de segurança
const headers = read("dist/_headers");
for (const h of ["Strict-Transport-Security", "Content-Security-Policy-Report-Only", "X-Content-Type-Options", "frame-ancestors"]) assert(headers.includes(h), `faltando ${h} em _headers`);
console.log("OK: contratos de segurança validados (contas, duelos, ranking, cabeçalhos).");
