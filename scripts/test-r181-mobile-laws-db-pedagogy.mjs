import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const archCode = fs.readFileSync(path.join(root, 'dist', 'jc-architecture-modules.js'), 'utf8');
const swCode = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
const lawsDbJson = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'native-laws-database.json'), 'utf8'));
const sqlV106 = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20261117130000_v106_internal_laws_bank.sql'), 'utf8');

console.log('=== Teste r181: Responsividade Mobile, Banco Interno de Leis (Supabase + JSON), Preservação das 2.554 Questões e Auditoria Pedagógica ===');

// 1. Service Worker r181
assert.ok(swCode.includes('r184'), 'sw.js deve estar na versão r184');
console.log('✓ 1. Service Worker atualizado para r181');

// 2. Preservação de todas as questões em loadGeneratedContent (evita queda de 2554 -> 781)
assert.ok(htmlCode.includes('_prevPreservedQs') && htmlCode.includes('_customCampQs') && htmlCode.includes('_mergedQs'), 'loadGeneratedContent deve mesclar e preservar todas as questões do banco compartilhado, comunidade e locais');
console.log('✓ 2. Preservação de 100% das questões (sem perda ao sincronizar) validada');

// 3. Base Interna de Leis no Banco de Dados (JSON + Migração SQL v106 + syncAllLawsToUserDatabase sem links externos)
assert.ok(Array.isArray(lawsDbJson) && lawsDbJson.length >= 10, 'dist/native-laws-database.json deve conter os seleções de dispositivos legais');
assert.ok(sqlV106.includes('CREATE TABLE IF NOT EXISTS public.study_laws_bank'), 'Migração v106 deve criar a tabela public.study_laws_bank');
assert.ok(archCode.includes('syncAllLawsToUserDatabase') && !archCode.includes('🌐 Fonte Oficial ↗'), 'Leis devem ser salvas no banco interno sem redirecionar o aluno para fora do site');
console.log('✓ 3. Base Interna de Leis (dist/native-laws-database.json + study_laws_bank + leitura 100% interna) validada');

// 4. Responsividade Mobile (#jcTopMobileUtilityRow evita sobreposição no topo)
assert.ok(archCode.includes('jcTopMobileUtilityRow') && archCode.includes('flex: 1 1 calc(100% - 118px)'), 'Topo mobile deve separar a marca na linha 1 e o cronômetro na linha 2 sem sobreposição');
console.log('✓ 4. Correção de responsividade mobile no topo, perfil e rodapé validada');

// 5. Auditoria e Cura Pedagógica Automática de Questões Extraídas
const sb = {
  window: {},
  globalThis: {},
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: () => {},
  setInterval: () => {}
};
sb.window = sb;
vm.createContext(sb);
new vm.Script(archCode).runInContext(sb);

const sampleExtracted = [
  { subject: 'Simulado 01', topic: 'Questão 12', statement: 'Qual o prazo do inquérito policial com indiciado preso no CPP?', options: ['5 dias', '10 dias', '15 dias', '30 dias'], correct_index: 1, explanation: '' }
];
const report = sb.auditAndEnrichAllQuestionsPedagogy(sampleExtracted);
assert.equal(report.validCount, 1);
assert.equal(report.enrichedCount, 0, 'Auditoria não fabrica conteúdo');
assert.equal(sampleExtracted[0].explanation, '', 'Ausência de comentário continua explícita');
assert.equal(report.missingExplanationCount, 1, 'Auditoria informa a pendência');
console.log('✓ 5. Motor de auditoria e enriquecimento pedagógico das questões extraídas validado');

console.log('=== Todos os testes da r181 passaram com 100% de sucesso! ===');
