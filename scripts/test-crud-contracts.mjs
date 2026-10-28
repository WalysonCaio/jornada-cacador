import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const html = read("../dist/index.html");
const pdfClient = read("../dist/pdf-text-client.js");
const security = read("../supabase/functions/account-security/index.ts");
const edital = read("../supabase/functions/edital-gemini/index.ts");
const material = read("../supabase/functions/material-gemini/index.ts");
const migration = read("../supabase/migrations/20261017_v74_secure_document_delete.sql");
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
]);
requireAll("pdf-text-client", pdfClient, [
  '["edital", "edital_concurso"].includes',
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
]);
requireAll("material-gemini", material, [
  "parseGeminiJsonText",
  "!part?.thought",
  "setDocumentStatus",
]);
requireAll("database transaction", migration, [
  "auth.role() <> 'service_role'", "for update", "campaign_topics",
  "study_documents", "document_type in ('edital', 'edital_concurso')",
]);
requireAll("legacy assistant ownership", assistant, [
  "ownedDocumentResponse", "storage_path=eq.${encodeURIComponent(storagePath)}",
  "user_id=eq.${encodeURIComponent(user.id)}",
  "askGemini",
]);

if (/cloudFetch\(`study_(?:campaigns|documents)\?id=eq\.\$\{(?:c\.dbId|id)\}`\s*,\s*\{method:'DELETE'/.test(html)) {
  throw new Error("O frontend ainda contém exclusão destrutiva direta de portal/documento.");
}
if (material.includes("gemini-3.8-flash") || material.includes("gemini-3.5-flash-lite")) {
  throw new Error("material-gemini ainda referencia identificadores de modelo inexistentes (3.8/3.5).");
}

console.log("OK: contratos CRUD protegidos, exclusão de edital/portal sincronizada, Storage, PDFs e banco cobertos.");
