import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const html = read("../dist/index.html");
const security = read("../supabase/functions/account-security/index.ts");
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
]);
requireAll("account-security", security, [
  '"delete_document"', '"delete_campaign"', '"delete_essay"',
  "user_id=eq.${user.id}", "selectOwned", ".text.json",
  "delete_user_study_document", "databaseResult?.deleted !== true",
]);
requireAll("database transaction", migration, [
  "auth.role() <> 'service_role'", "for update", "campaign_topics",
  "study_documents", "document_type in ('edital', 'edital_concurso')",
]);
requireAll("legacy assistant ownership", assistant, [
  "ownedDocumentResponse", "storage_path=eq.${encodeURIComponent(storagePath)}",
  "user_id=eq.${encodeURIComponent(user.id)}",
]);

if (/cloudFetch\(`study_(?:campaigns|documents)\?id=eq\.\$\{(?:c\.dbId|id)\}`\s*,\s*\{method:'DELETE'/.test(html)) {
  throw new Error("O frontend ainda contém exclusão destrutiva direta de portal/documento.");
}

console.log("OK: contratos CRUD protegidos, propriedade validada, Storage e banco cobertos.");
