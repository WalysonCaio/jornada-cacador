import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const html = read("../dist/index.html");
const pdfClient = read("../dist/pdf-text-client.js");
const enhancements = read("../dist/v59-enhancements.js");
const experience = read("../dist/v77-experience.js");
const security = read("../supabase/functions/account-security/index.ts");
const edital = read("../supabase/functions/edital-gemini/index.ts");
const material = read("../supabase/functions/material-gemini/index.ts");
const redacao = read("../supabase/functions/redacao-gemini/index.ts");
const keyManager = read("../supabase/functions/ai-key-manager/index.ts");
const migration = read("../supabase/migrations/20261017_v74_secure_document_delete.sql");
const sharedBankMigration = read("../supabase/migrations/20261028_v79_shared_question_bank.sql");
const assistant = read("../supabase/functions/assistente-pmpe/index.ts");

const requireAll = (name, source, terms) => {
  const missing = terms.filter((term) => !source.includes(term));
  if (missing.length) throw new Error(`${name}: contratos ausentes: ${missing.join(", ")}`);
};

requireAll("frontend", html, [
  "secureAccountAction('delete_campaign'",
  "secureAccountAction('delete_document'",
  "secureAccountAction('delete_essay'",
  "requestPasswordConfirmation",
  "['edital','edital_concurso'].includes(doc.document_type)",
  "state._resetEpoch=Date.now()",
  "Number(local._resetEpoch||0)>Number(server._resetEpoch||0)",
  "data.key_source==='personal'",
  "reconcileCloudCampaigns",
  "_ownerUserId",
  "_activeProcessingDocs",
  "_autoTriedDocs",
  "Destravar e Recomeçar Análise",
]);
requireAll("v59-enhancements", enhancements, [
  "window.openPersonalAiSettings",
  "data-open-personal-ai",
  "extracting_text",
  "is_question_pack",
  "customQuestionsByCampaign",
  "customFlashcardsByCampaign",
]);
requireAll("v77-experience", experience, [
  "renderReverseSchedule",
  "reverseSchedulePanel",
  "renderStudyCycle",
  "studyCyclePanel",
  "questionTopic",
  "questionHistoryFilter",
  "populateTopicFilter",
  "startTimedSimulado",
  "simuladoScoringMode",
  "simuladoSheetGrid",
  "finishTimedSimulado",
  "topicSearchInput",
  "practiceDailySubjectBtn",
  "startSprint5MinBtn",
  "formatStepByStepResolution",
  "spawnTwinQuestionForCurrent",
  "explainQuestionWithEasyAnalogy",
  "createFlashcardFromQuestion",
  "scissorBtn",
  "progressiveQuestions",
  "startErrorReinforcementBattle",
  "renderTacticalDiagnosis",
  "ensureExamBankHub",
  "syncSharedQuestionBank",
  "handleParseAndSaveRawQuestions",
  "handleGenerateBoardPack",
  "renderCutoffThermometer",
  "exportPrintableQuestionBooklet",
  "applyLegalHighlightsToTextNodes",
]);
requireAll("pdf-text-client", pdfClient, [
  '["edital", "edital_concurso"].includes',
  "_recentUploadedPdfBytes",
  "_extractedPagesByDocId",
  "recoverPdfViaAssistant",
  "compactPagesForInlinePayload",
  "withTimeout",
  "backupTopics",
  "wasSampled",
  "realLastPage",
  "useSystemFonts",
]);
requireAll("account-security", security, [
  '"delete_document"', '"delete_campaign"', '"delete_essay"',
  "user_id=eq.${user.id}", "selectOwned", ".text.json",
  "delete_user_study_document", "databaseResult?.deleted !== true",
  "fallback_used", "deleteOwnedRow(\"study_documents\", documentId)",
]);
requireAll("edital-gemini", edital, [
  "parseGeminiJsonText",
  "maxOutputTokens: 65536",
  '["edital", "edital_concurso"].includes',
  "setDocumentStatus",
  "extractSecretString",
  "personalGeminiKey",
  "releaseStaleLocks",
  "loadBrowserExtractedEditalText",
  "fetchWithTimeout",
  "ensurePdfBytes",
]);
requireAll("material-gemini", material, [
  "parseGeminiJsonText",
  "!part?.thought",
  "setDocumentStatus",
  "CHUNK_SUMMARY_SCHEMA",
  "extractSecretString",
  "personalGeminiKey",
  "releaseStaleLocks",
  "shared_question_bank",
  "validateExtractedPagesList",
  "repairTruncatedSummariesJson",
  "preExtractedPages",
]);
requireAll("redacao-gemini", redacao, [
  "parseGeminiJsonText",
  "extractSecretString",
  "personalGeminiKey",
  "availableGeminiModels(activeGeminiKey)",
]);
requireAll("ai-key-manager", keyManager, [
  "validateGeminiKey",
  "store_user_ai_secret",
  "delete_user_ai_secret",
]);
requireAll("database transaction", migration, [
  "auth.role() <> 'service_role'", "for update", "campaign_topics",
  "study_documents", "document_type in ('edital', 'edital_concurso')",
]);
requireAll("shared question bank migration", sharedBankMigration, [
  "shared_question_bank",
  "fingerprint",
  "enable row level security",
]);
requireAll("legacy assistant ownership & structured questions", assistant, [
  "ownedDocumentResponse", "storage_path=eq.${encodeURIComponent(storagePath)}",
  "user_id=eq.${encodeURIComponent(user.id)}",
  "askGemini(systemPrompt, userPrompt, personalGeminiKey)",
  "extractSecretString",
  "shared_question_bank",
  "generate_structured_questions",
  "askStructuredQuestions",
]);

if (/cloudFetch\(`study_(?:campaigns|documents)\?id=eq\.\$\{(?:c\.dbId|id)\}`\s*,\s*\{method:'DELETE'/.test(html)) {
  throw new Error("O frontend ainda contém exclusão destrutiva direta de portal/documento.");
}
if (material.includes("gemini-3.8-flash") || material.includes("gemini-3.5-flash-lite")) {
  throw new Error("material-gemini ainda referencia identificadores de modelo inexistentes (3.8/3.5).");
}

console.log("OK: contratos CRUD, anti-loop de PDFs, recuperação automática, chave Gemini pessoal e recursos Caveira/TEC/Qconcursos/Estratégia/Gran validados.");
