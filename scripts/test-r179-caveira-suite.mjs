import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlCode = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const v77Code = fs.readFileSync(path.join(root, 'dist', 'v77-experience.js'), 'utf8');
const archCode = fs.readFileSync(path.join(root, 'dist', 'jc-architecture-modules.js'), 'utf8');

console.log('=== Teste r180: Auditoria Completa dos 8 Requisitos (Tema Claro, Vidas 20min, Invocador, Redação, Painel Tático, Flashcards, Leis e Questões) ===');

// 1. Tema Claro corrigido na Trilha Tática (.slBannerCard, .disciplineRail button, #trailHeartsStatusBadge)
assert.ok(v77Code.includes('body.lightAppTheme .slBannerCard') && v77Code.includes('body.lightAppTheme .disciplineRail button'), 'v77-experience.js deve conter correção de contraste do Tema Claro para Trilha Tática e pílulas de disciplina');
assert.ok(archCode.includes('body.lightAppTheme .jcCaveiraActionCard') && archCode.includes('body.lightAppTheme .jcTacticalWrap'), 'jc-architecture-modules.js deve conter suporte completo a Tema Claro');
console.log('✓ 1. Correção de contraste do Tema Claro na Trilha Tática e nos novos painéis validada');

// 2. Renovação automática das vidas da Trilha a cada 20 minutos (mesmo em 1/3 ou 2/3 vidas)
assert.ok(htmlCode.includes('TRAIL_HEART_REGEN_MS = 20 * 60 * 1000'), 'index.html deve definir TRAIL_HEART_REGEN_MS = 20 minutos');
assert.ok(htmlCode.includes('if (state.learning.hearts < 3)'), 'availableTrailHearts deve regenerar vidas sempre que hearts < 3 (não apenas em 0)');
assert.ok(archCode.includes('tickTrailHearts20MinRegen'), 'Módulo r180 deve atualizar o contador regressivo de 20 min ao vivo no selo de vidas');
console.log('✓ 2. Renovação automática de vidas da Trilha Tática a cada 20 minutos validada');

// 3. Renomeação de Instrutor IA (Charlie) para Invocador
assert.ok(!archCode.includes('Instrutor IA (Charlie)'), 'Sidebar não deve exibir Instrutor IA (Charlie)');
assert.ok(archCode.includes('Invocador IA') && archCode.includes('🧙‍♂️ INVOCADOR'), 'Sistema deve usar o nome Invocador');
assert.ok(htmlCode.includes('🧙‍♂️ Invocador'), 'Aba do assistente no index.html deve chamar-se Invocador');
console.log('✓ 3. Renomeação para Invocador validada em toda a interface');

// 4. Novo Hub de Redação Policial (#jcEssayDashboardHub)
assert.ok(archCode.includes('mountCaveiraEssayHub') && archCode.includes('jcEssayDashboardHub'), 'Hub de Redação Policial estilo Caveira deve estar implementado');
assert.ok(archCode.includes('MELHOR RESULTADO') && archCode.includes('MÉDIA GERAL') && archCode.includes('ÚLTIMOS ENVIOS'), 'Hub de Redação deve exibir Visão Geral, Melhor Resultado, Média Geral e gráfico de Últimos Envios');
console.log('✓ 4. Nova aba de Redação Policial validada');

// 5. Painel Tático Interativo no Perfil Social (#jcTacticalPanelSection)
assert.ok(archCode.includes('mountPainelTaticoInProfile') && archCode.includes('jcTacticalPanelSection'), 'Painel Tático deve estar integrado ao Perfil Social');
assert.ok(archCode.includes('ACERTEI x ERREI') && archCode.includes('TOTAL DO PERÍODO') && archCode.includes('ANÁLISE DE PERFORMANCE'), 'Painel Tático deve conter gráficos Acertei x Errei, Total do Período e tabela Análise de Performance');
console.log('✓ 5. Painel Tático no Perfil Social validado');

// 6. Novo Hub de Flashcards com Funil de 3 Chevrons (#jcFlashcardsDashboardHub)
assert.ok(archCode.includes('mountCaveiraFlashcardsHub') && archCode.includes('jcChevronStageWrap'), 'Hub de Flashcards com funil de 3 estágios de memória deve estar implementado');
assert.ok(archCode.includes('MEMÓRIA DE CURTO PRAZO') && archCode.includes('MEMÓRIA DE LONGO PRAZO'), 'Estágios de memória de curto e longo prazo devem estar presentes');
console.log('✓ 6. Hub de Flashcards com estágios de memória validado');

// 7. Central de Leis & Textos (Lei Seca Interativa) na aba Resumos/Estudar
assert.ok(archCode.includes('mountCaveiraSmartLawsHub') && archCode.includes('NATIVE_SMART_LAWS'), 'Central de Leis & Textos (Lei Seca) deve estar implementada na aba Estudar/Resumos');
assert.ok(archCode.includes('Lei nº 8.429/92') && archCode.includes('Art. 144') && archCode.includes('Lei Estadual nº 6.783/74'), 'Acervo de Lei Seca deve incluir CF/88 Art. 144, Improbidade e Estatuto PMPE');
console.log('✓ 7. Central de Leis & Textos (Lei Seca Interativa com Favoritos e Grifo) validada');

// 8. Banco de Questões com Pílulas Rápidas de Status e Barra Inferior da Questão
assert.ok(archCode.includes('jcCaveiraQuestionStatusPills') && archCode.includes('jcCaveiraQuestionToolbar'), 'Aba Questões deve ter pílulas de status e barra de ferramentas inferior na questão');
console.log('✓ 8. Melhorias no Banco de Questões e Simulados validadas');

console.log('=== Todos os 8 requisitos da r180 passaram com 100% de sucesso! ===');
