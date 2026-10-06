import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
if (!scripts.length) throw new Error("Nenhum JavaScript incorporado foi encontrado.");
for (const source of scripts) new vm.Script(source);
for (const relative of ["../dist/v59-enhancements.js", "../dist/sw.js"]) new vm.Script(fs.readFileSync(new URL(relative, import.meta.url), "utf8"), { filename: relative });

const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicated.length) throw new Error(`IDs HTML duplicados: ${duplicated.join(", ")}`);

const referencedIds = [...scripts.join("\n").matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
const missing = [...new Set(referencedIds.filter((id) => !html.includes(`id="${id}"`)))];
if (missing.length) throw new Error(`Elementos referenciados e ausentes: ${missing.join(", ")}`);

const publicFiles = ["../dist/index.html", "../dist/sw.js", "../dist/content-summaries.js", "../dist/material-deep-dives.js", "../dist/v59-enhancements.js"];
const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+/i, /GEMINI_API_KEY\s*=\s*["'][^"']+/i, /GROQ_API_KEY\s*=\s*["'][^"']+/i];
for (const relative of publicFiles) {
  const contents = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(contents)) throw new Error(`Possível segredo encontrado em ${relative}`);
}

const sw = fs.readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
if (!sw.includes("jornada-cacador-v65")) throw new Error("O cache não aponta para a versão 65.");
const applyServerState = html.match(/function applyServerState[\s\S]*?function mergeProgressStates/)?.[0] || "";
if (!applyServerState.includes("focusWasRunning") || !applyServerState.includes("if(!focusWasRunning)restoreFocusTimerState()")) throw new Error("A sincronização não preserva o cronômetro de foco.");
if (applyServerState.includes("timerLeft=focusBlockSeconds()")) throw new Error("A sincronização ainda reinicia o cronômetro para 50 minutos.");
if (!html.includes("timerLeft=result.resumed?Math.min(timerLeft,serverRemaining):serverRemaining")) throw new Error("Uma retomada remota ainda pode aumentar o tempo restante.");
if (!sw.includes("url.origin!==self.location.origin") || !sw.includes("r.type==='basic'")) throw new Error("O service worker pode armazenar respostas privadas externas.");
const desktopMain = fs.readFileSync(new URL("../desktop/main.js", import.meta.url), "utf8");
if (!desktopMain.includes("https://jornada.wcaio.workers.dev") || desktopMain.includes("chatgpt.site")) throw new Error("O instalador Windows não aponta exclusivamente para o domínio oficial.");
const manifest = JSON.parse(fs.readFileSync(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"));
if (manifest.orientation !== "any") throw new Error("O aplicativo instalado precisa aceitar retrato e paisagem.");
const headers = fs.readFileSync(new URL("../dist/_headers", import.meta.url), "utf8");
for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cache-Control: no-cache"]) if (!headers.includes(header)) throw new Error(`Cabeçalho de segurança ausente: ${header}`);
const materialFunction = fs.readFileSync(new URL("../supabase/functions/material-gemini/index.ts", import.meta.url), "utf8");
if (materialFunction.includes("gemini-3.5-flash-lite") || materialFunction.includes("gemini-3.1-flash-lite")) throw new Error("A função de materiais ainda usa um identificador de modelo incompatível.");
for (const required of ["models?pageSize=1000", "supportedGenerationMethods", "availableGeminiModels", "FALLBACK_STATUS", "PROCESSING", "setDocumentStatus", "USAGE_GUARD_MISSING", "parseGeminiJsonText", "relaxedGenerationBody", "normalizeLegalNotation", "generateStudyPackageStable", "hasDeclaredCoverage", "const rawSummaries = generatedSummaries"]) if (!materialFunction.includes(required)) throw new Error(`Correção de PDF incompleta: ${required}`);
const enhancements = fs.readFileSync(new URL("../dist/v59-enhancements.js", import.meta.url), "utf8");
for (const required of ["openSummaries", "restoreOpenSummaries", "normalizeLegalTitle", "MutationObserver"]) if (!enhancements.includes(required)) throw new Error(`Persistência do resumo incompleta: ${required}`);
for (const required of ["rpc/sync_user_state", "rpc/claim_focus_session", "rpc/update_focus_session", "_serverRevision", "_resetEpoch", "refreshFromServer", "STALE_RESET", "subjectOrder", "learningOrder", "errorUrgency", "menuAbout", "STREAK_MIN_SECONDS", "manualStudyEntries", "questionsForMode", "prepareQuestion", "renderCustomBossCard", "renderExamCountdown", "renderEssays", "libraryFolders", "metadata?.coverage", "coverageWarnings", "v59-enhancements.js"]) {
  if (!html.includes(required)) throw new Error(`Sincronização precisa incompleta: ${required}`);
}

console.log(`OK: ${scripts.length} script(s), ${ids.length} IDs únicos, nenhuma referência ausente e nenhum segredo público detectado.`);
