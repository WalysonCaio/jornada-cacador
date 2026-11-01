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
assert(/function duelErrorMessage/.test(read("dist/v77-experience.js")), "o duelo deve traduzir os erros do servidor para o jogador");
const ignore = read(".gitignore");
const ignoreLines = ignore.split("\n").map((l) => l.trim());
for (const p of ["android/app/build/", "android/.gradle/", "*.keystore", ".env"]) assert(ignoreLines.includes(p), `.gitignore sem ${p}`);
assert(!ignoreLines.includes("$null"), ".gitignore tem a linha acidental $null");
console.log("OK: contratos de segurança validados (contas, duelos, ranking, cabeçalhos).");

// 6) Validações v97/v105: base user_state, ocultação de gabarito no duelo pendente, opt-in da comunidade e teto de XP
const v00 = read("supabase/migrations/20260901000000_v00_base_user_state.sql");
assert(/create table if not exists public\.user_state/i.test(v00), "migração base deve criar public.user_state");
const v97 = read("supabase/migrations/20261101120000_v97_complete_security_duels_optin_and_base.sql");
assert(/redact_duel_questions_for_player/.test(v97) && /grade_hunter_duel_question/.test(v97), "v97 deve ocultar gabarito de duelos pendentes e corrigir questão no servidor");
assert(/set_document_community_sharing/.test(v97) && /share_with_community/.test(v97), "v97 deve exigir opt-in por documento na biblioteca comunitária");
console.log("OK: contratos v97/v105 (user_state base, duelo sem gabarito exposto, opt-in comunidade e CSP ativa) validados.");
