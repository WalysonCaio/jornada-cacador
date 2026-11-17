import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const v77Code = fs.readFileSync(path.join(root, 'dist', 'v77-experience.js'), 'utf8');
const archCode = fs.readFileSync(path.join(root, 'dist', 'jc-architecture-modules.js'), 'utf8');
const swCode = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');

console.log('=== Teste r180: Velocidade O(1) (Questões/Trilha), Pastas Retráteis, Sem Manuais nas Disciplinas, Base Externa de Leis e Paleta Oficial ===');

// 1. Service Worker na versão r180
assert.ok(swCode.includes('r180'), 'sw.js deve estar na versão r180');
console.log('✓ 1. Service Worker atualizado para r180');

// 2. Otimização O(1) de questionPool, questionsForMode e learningUnits
assert.ok(htmlCode.includes('_jcQuestionPoolCache') && htmlCode.includes('_ensureModeBucketsIndex') && htmlCode.includes('_jcLearningUnitsCache'), 'index.html deve ter indexação O(1) para questionPool, questionsForMode e learningUnits');
assert.ok(v77Code.includes('${isOpen ? subjBlocks : ""}') && v77Code.includes('${isOpen ? catBlocks : ""}'), 'renderExamBankHub deve fazer lazy-render das pastas fechadas');
console.log('✓ 2. Otimização O(1) da aba Questões e da Trilha Tática validada');

// 3. Pastas de disciplinas fechadas por padrão em Resumos e em Leis & Textos (só abrem ao clicar)
assert.ok(htmlCode.includes('open=Boolean(libraryUI.studyFolders[key]===true||q.length>0)'), 'Pastas de disciplinas em Resumos devem iniciar fechadas por padrão e abrir somente ao clicar');
assert.ok(archCode.includes('const isOpen = Boolean(openMap[discKey] === true || qNorm.length > 0);') && archCode.includes('data-law-folder-toggle'), 'Pastas de disciplinas em Leis & Textos devem iniciar fechadas por padrão e abrir ao clicar');
console.log('✓ 3. Pastas de disciplinas retráteis (exibindo conteúdo apenas ao clicar) validadas');

// 4. Manuais do Caçador removido da barra de Resumos e das disciplinas
assert.ok(v77Code.includes('if(isManual)continue;'), 'Manuais do Caçador não deve ser injetado em ALL_SUMMARIES nem nas disciplinas');
assert.ok(archCode.includes('#openManuaisCacadorBtn {\n        display: none !important;\n      }'), 'Botão Manuais do Caçador deve estar oculto na barra de Resumos');
console.log('✓ 4. Remoção de Manuais do Caçador da barra de Resumos e das disciplinas validada');

// 5. Sincronia das 5 abas em linha única (.studyTabs.smartEnabled)
assert.ok(htmlCode.includes('.studyTabs.smartEnabled{grid-template-columns:repeat(5,minmax(0,1fr))}') && archCode.includes('switchStudySubtab'), 'As 5 abas da Central de Estudo devem ficar alinhadas em linha única e sincronizadas');
console.log('✓ 5. Sincronia das 5 abas da Central de Estudo em linha única validada');

// 6. Base Externa Completa de Leis & Textos (Wikisource API + Wikipedia API + Importador Ao Vivo)
assert.ok(archCode.includes('fetchExternalCompleteLawText') && archCode.includes('searchAndImportExternalLawOrText') && archCode.includes('pt.wikisource.org/w/api.php'), 'Módulo de Leis & Textos deve buscar texto completo em bases externas públicas');
console.log('✓ 6. Integração com Base Externa Completa de Leis & Textos validada');

// 7. Paleta Oficial da Jornada do Caçador (sem verde-oliva #a3b899 e sem fundo cinza #181b21 no Módulo 8)
const mod8Slice = archCode.slice(archCode.indexOf('MÓDULO 8'));
assert.ok(!mod8Slice.includes('#a3b899') && !mod8Slice.includes('#181b21'), 'Módulo 8 deve usar a paleta Azul-Abissal e Ciano Elétrico da Jornada do Caçador, sem verde-oliva (#a3b899) ou cinza (#181b21)');
assert.ok(mod8Slice.includes('linear-gradient(135deg, #65e7ff, #34aee9)'), 'Botões devem usar o gradiente Ciano Elétrico oficial do site');
console.log('✓ 7. Paleta de cores oficial da Jornada do Caçador validada');

console.log('=== Todos os testes da r180 passaram com 100% de sucesso! ===');
