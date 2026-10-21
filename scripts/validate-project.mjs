import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
if (!scripts.length) throw new Error("Nenhum JavaScript incorporado foi encontrado.");
for (const source of scripts) new vm.Script(source);
for (const relative of ["../dist/v59-enhancements.js", "../dist/v77-experience.js", "../dist/sw.js"]) new vm.Script(fs.readFileSync(new URL(relative, import.meta.url), "utf8"), { filename: relative });

const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, "");
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicated.length) throw new Error(`IDs HTML duplicados: ${duplicated.join(", ")}`);

const referencedIds = [...scripts.join("\n").matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
const missing = [...new Set(referencedIds.filter((id) => !html.includes(`id="${id}"`)))];
if (missing.length) throw new Error(`Elementos referenciados e ausentes: ${missing.join(", ")}`);

const publicFiles = ["../dist/index.html", "../dist/sw.js", "../dist/content-summaries.js", "../dist/material-deep-dives.js", "../dist/v59-enhancements.js", "../dist/v77-experience.js"];
const secretPatterns = [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+/i, /GEMINI_API_KEY\s*=\s*["'][^"']+/i, /GROQ_API_KEY\s*=\s*["'][^"']+/i];
for (const relative of publicFiles) {
  const contents = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(contents)) throw new Error(`Possível segredo encontrado em ${relative}`);
}

const sw = fs.readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
if (!sw.includes("jornada-cacador-v77-study-experience")) throw new Error("O cache não aponta para a versão 77.");
if (!html.includes('href="ui-v75.css"') || !sw.includes("ui-v75.css")) throw new Error("A interface v75 não está ligada ao HTML e ao cache offline.");
if (!html.includes('href="ui-v77.css"') || !html.includes('src="v77-experience.js"') || !sw.includes("ui-v77.css") || !sw.includes("v77-experience.js")) throw new Error("A experiência v77 não está ligada ao HTML e ao cache offline.");
const modernUi = fs.readFileSync(new URL("../dist/ui-v75.css", import.meta.url), "utf8");
for (const required of ["@media(max-width:719px)", "@media(min-width:1040px)", "prefers-reduced-motion", ":focus-visible", "env(safe-area-inset-bottom)"]) if (!modernUi.includes(required)) throw new Error(`Interface responsiva incompleta: ${required}`);
const experienceUi = fs.readFileSync(new URL("../dist/ui-v77.css", import.meta.url), "utf8");
for (const required of ["todayCommand", "questionFilters", "performanceBar", "@media(max-width:719px)", "@media(max-width:390px)"]) if (!experienceUi.includes(required)) throw new Error(`Experiência v77 incompleta: ${required}`);
const experienceJs = fs.readFileSync(new URL("../dist/v77-experience.js", import.meta.url), "utf8");
for (const required of ["filteredQuestionPool", "questionsForMode('battle'", "renderPerformanceChart", "jornada-last-view-v77", "openUrgentReview"]) if (!experienceJs.includes(required)) throw new Error(`Comportamento v77 incompleto: ${required}`);
if (!html.includes('data-view="report"><i>◎</i>Questões') || !html.includes('data-menu-view="assistant"')) throw new Error("A navegação principal da versão 77 não está configurada corretamente.");
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
if (materialFunction.includes("gemini-3.1-flash-lite")) throw new Error("A função de materiais ainda usa um identificador de modelo antigo.");
if (!materialFunction.includes(":generateContent") || !materialFunction.includes("availableGeminiModels(geminiKey)")) throw new Error("A função de materiais não está descobrindo e usando modelos compatíveis com a chave pessoal.");
if (materialFunction.includes('"llama-3.3-70b-versatile"') || materialFunction.includes('"deepseek-chat"')) throw new Error("A função de materiais ainda usa modelos de fallback desativados.");
for (const required of ["models?pageSize=1000", "supportedGenerationMethods", "availableGeminiModels", "FALLBACK_STATUS", "PROCESSING", "setDocumentStatus", "USAGE_GUARD_MISSING", "parseGeminiJsonText", "relaxedGenerationBody", "normalizeLegalNotation", "generateStudyPackageStable", "pdfInlinePart", "hasDeclaredCoverage", "const rawSummaries = generatedSummaries", "get_user_ai_secret", "key_source"]) if (!materialFunction.includes(required)) throw new Error(`Correção de PDF incompleta: ${required}`);
const enhancements = fs.readFileSync(new URL("../dist/v59-enhancements.js", import.meta.url), "utf8");
for (const required of ["openSummaries", "restoreOpenSummaries", "normalizeLegalTitle", "MutationObserver"]) if (!enhancements.includes(required)) throw new Error(`Persistência do resumo incompleta: ${required}`);
for (const required of ["personalAiDialog", "ai-key-manager", "Testar e salvar", "Chave pessoal ativa"]) if (!enhancements.includes(required)) throw new Error(`Configuração de IA pessoal incompleta: ${required}`);
const aiKeyManager = fs.readFileSync(new URL("../supabase/functions/ai-key-manager/index.ts", import.meta.url), "utf8");
for (const required of ["verifyPassword", "validateGeminiKey", "store_user_ai_secret", "delete_user_ai_secret"]) if (!aiKeyManager.includes(required)) throw new Error(`Gerenciador seguro de chaves incompleto: ${required}`);
const accountSecurity = fs.readFileSync(new URL("../supabase/functions/account-security/index.ts", import.meta.url), "utf8");
for (const required of ["reset_profile", "reset_user_profile_content", "verified", "remaining", "gemini_key_preserved", "delete_document", "delete_campaign", "delete_essay", "delete_user_study_document", ".text.json", "selectOwned"]) if (!accountSecurity.includes(required)) throw new Error(`Operação segura de conta/CRUD incompleta: ${required}`);
for (const required of ["secureAccountAction('delete_document'", "secureAccountAction('delete_campaign'", "secureAccountAction('delete_essay'"]) if (!html.includes(required)) throw new Error(`Exclusão protegida ausente no frontend: ${required}`);
if (!html.includes("doc.document_type==='edital_concurso'?'edital':doc.document_type")) throw new Error("Documentos legados de edital não são normalizados na leitura.");
for (const required of ["clearLocalProfileData", "action:'reset_profile'", "!data.verified", "Redefinir perfil e apagar conteúdos"]) if (!html.includes(required)) throw new Error(`Interface de redefinição incompleta: ${required}`);
const resetMigration = fs.readFileSync(new URL("../supabase/migrations/20261017_v72_reset_profile_complete.sql", import.meta.url), "utf8");
for (const required of ["reset_user_profile_content", "study_campaigns", "study_documents", "user_state", "user_ai_credentials", "server-profile-reset", "reset_epoch", "on conflict (user_id)"]) if (!resetMigration.includes(required)) throw new Error(`Migração de redefinição incompleta: ${required}`);
const deleteMigration = fs.readFileSync(new URL("../supabase/migrations/20261017_v74_secure_document_delete.sql", import.meta.url), "utf8");
for (const required of ["delete_user_study_document", "service_role", "campaign_topics", "study_documents", "pg_advisory_xact_lock"]) if (!deleteMigration.includes(required)) throw new Error(`Migração de exclusão segura incompleta: ${required}`);
const editalFunction = fs.readFileSync(new URL("../supabase/functions/edital-gemini/index.ts", import.meta.url), "utf8");
for (const required of ["edital_oficial", "edital_verticalizado", "validEditalKinds", "Edital verticalizado aceito"]) if (!editalFunction.includes(required)) throw new Error(`Compatibilidade com edital verticalizado incompleta: ${required}`);
const assistantFunction = fs.readFileSync(new URL("../supabase/functions/assistente-pmpe/index.ts", import.meta.url), "utf8");
for (const required of ["ownedDocumentResponse", "campaign_id=eq.${encodeURIComponent(campaignId)}", "user_id=eq.${encodeURIComponent(user.id)}"]) if (!assistantFunction.includes(required)) throw new Error(`Proteção de propriedade do assistente incompleta: ${required}`);
const byokMigration = fs.readFileSync(new URL("../supabase/migrations/20261014_v69_user_ai_keys.sql", import.meta.url), "utf8");
for (const required of ["user_ai_credentials", "vault.create_secret", "get_user_ai_secret", "service_role"]) if (!byokMigration.includes(required)) throw new Error(`Migração BYOK incompleta: ${required}`);
for (const required of ["rpc/sync_user_state", "rpc/claim_focus_session", "rpc/update_focus_session", "_serverRevision", "_resetEpoch", "refreshFromServer", "STALE_RESET", "subjectOrder", "learningOrder", "errorUrgency", "menuAbout", "STREAK_MIN_SECONDS", "manualStudyEntries", "questionsForMode", "prepareQuestion", "renderCustomBossCard", "renderExamCountdown", "renderEssays", "libraryFolders", "metadata?.coverage", "coverageWarnings", "v59-enhancements.js"]) {
  if (!html.includes(required)) throw new Error(`Sincronização precisa incompleta: ${required}`);
}
if (html.includes("/functions/v1/hyper-endpoint") || !html.includes("/functions/v1/assistente-pmpe")) throw new Error("O frontend ainda aponta para a função antiga do assistente.");

console.log(`OK: ${scripts.length} script(s), ${ids.length} IDs únicos, nenhuma referência ausente e nenhum segredo público detectado.`);
