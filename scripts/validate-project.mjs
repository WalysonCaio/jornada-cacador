import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
if (!scripts.length) throw new Error("Nenhum JavaScript incorporado foi encontrado.");
for (const source of scripts) new vm.Script(source);

const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicated.length) throw new Error(`IDs HTML duplicados: ${duplicated.join(", ")}`);

const referencedIds = [...scripts.join("\n").matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
const missing = [...new Set(referencedIds.filter((id) => !html.includes(`id="${id}"`)))];
if (missing.length) throw new Error(`Elementos referenciados e ausentes: ${missing.join(", ")}`);

const publicFiles = ["../dist/index.html", "../dist/sw.js", "../dist/content-summaries.js", "../dist/material-deep-dives.js"];
const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+/i, /GEMINI_API_KEY\s*=\s*["'][^"']+/i, /GROQ_API_KEY\s*=\s*["'][^"']+/i];
for (const relative of publicFiles) {
  const contents = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(contents)) throw new Error(`Possível segredo encontrado em ${relative}`);
}

const sw = fs.readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
if (!sw.includes("jornada-cacador-v48")) throw new Error("O cache não aponta para a versão 48.");
for (const required of ["rpc/sync_user_state", "rpc/claim_focus_session", "rpc/update_focus_session", "_serverRevision", "_resetEpoch", "refreshFromServer", "STALE_RESET", "subjectOrder", "learningOrder", "errorUrgency", "menuAbout"]) {
  if (!html.includes(required)) throw new Error(`Sincronização precisa incompleta: ${required}`);
}

console.log(`OK: ${scripts.length} script(s), ${ids.length} IDs únicos, nenhuma referência ausente e nenhum segredo público detectado.`);
