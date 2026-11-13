/**
 * Testes de navegador sobre o aplicativo real em dist/, sem conta ou APIs reais.
 *
 * CI/local: npm ci && npx playwright install --with-deps chromium
 *           node scripts/browser-smoke.mjs
 * Dependência de desenvolvimento necessária: playwright.
 *
 * Esta suíte foi preparada e verificada sintaticamente no ambiente de revisão.
 * A execução em navegador deve ocorrer no CI/local: a ferramenta de navegador
 * autorizada não estava disponível no ambiente de revisão.
 *
 * Apenas dados fictícios são injetados no banco local. Nenhuma função do app é
 * substituída. Respostas, filtros, navegação e retomada usam os handlers reais.
 * Requisições para origens externas são bloqueadas antes de sair do navegador.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const fixture = JSON.parse(await readFile(new URL('./fixtures/browser-state.json', import.meta.url), 'utf8'));
const artifactDir = process.env.BROWSER_SMOKE_ARTIFACTS;
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

// O processo oferece somente dist/ e escuta exclusivamente no loopback.
const server = createServer(async (request, response) => {
  try {
    const requested = new URL(request.url || '/', 'http://localhost').pathname;
    if (requested === '/__fixture__') {
      response.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-store' });
      response.end('<!doctype html><html lang="pt-BR"><title>Fixture local</title><body>Fixture local isolada</body></html>');
      return;
    }
    const relative = decodeURIComponent(requested).replace(/^\/+/, '') || 'index.html';
    const filename = path.resolve(root, relative);
    if (filename !== path.join(root, 'index.html') && !filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(filename);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404).end();
  }
});

function containsManual(value) { return /manuais? do ca[cç]ador|manual-/i.test(value); }

async function visible(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
}

async function openQuestions(page) {
  await page.locator('button[data-view="report"]').click();
  await visible(page, '#report.active #questionSubject');
  await visible(page, '#report.active #questionTopic');
}

async function pickSubjectAndTopic(page, subject, topic) {
  await page.locator('#questionSubject').selectOption(subject);
  const choice = await page.locator('#questionTopic option').evaluateAll((options, label) =>
    options.find(option => option.textContent.includes(label))?.value, topic);
  assert(choice && choice !== 'all', `O assunto ${topic} deve estar disponível somente na disciplina ${subject}.`);
  await page.locator('#questionTopic').selectOption(choice);
}

async function assertQuestionScope(page, subject, questions) {
  await visible(page, '#questionDialog[open] #questionText');
  const statement = await page.locator('#questionText').innerText();
  assert(questions.some(question => statement.includes(question.statement)),
    `Questão fora do filtro ${subject}: ${statement}`);
  const meta = await page.locator('#questionMetaPills').innerText();
  assert(meta.includes(subject), `A disciplina deve estar visível nos metadados: ${meta}`);
  const otherSubject = subject === 'Língua Portuguesa' ? 'Direito Penal' : 'Língua Portuguesa';
  assert(!meta.includes(otherSubject), `O treino de ${subject} não pode exibir ${otherSubject}.`);
  return statement;
}

async function answerFirstOption(page) {
  await page.locator('#questionOptions [data-question-index="0"]').click();
  await visible(page, '#nextQuestion');
  assert(await page.locator('#questionFeedback').innerText(), 'A resposta deve produzir feedback pedagógico.');
  assert(await page.locator('#questionFeedback .stepResolutionBlock').count(), 'O feedback deve apresentar explicação em blocos.');
  assert.equal(await page.locator('#questionFeedback .stepOptionItem').count(), 2,
    'Cada alternativa precisa de um bloco de conferência.');
  assert(await page.locator('#questionOptions [data-question-index]').evaluateAll(buttons => buttons.every(button => button.disabled)),
    'Responder deve bloquear novas tentativas na mesma questão.');
}

async function exitAndDiscard(page) {
  await page.keyboard.press('Escape');
  await visible(page, '#confirmExitSimuladoDialog[open]');
  await page.locator('#confirmExitSimuladoBtn').click();
  await page.locator('#questionDialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#resumeSavedQuestionSessionBar').count(), 0,
    'Encerrar treino deve remover a oferta de retomada.');
}

async function assertNoHorizontalOverflow(page, selector) {
  const result = await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: innerWidth, scroll: document.documentElement.scrollWidth };
  });
  assert(result.left >= -1 && result.right <= result.viewport + 1,
    `${selector} deve caber na largura de ${result.viewport}px: ${JSON.stringify(result)}`);
  assert(result.scroll <= result.viewport + 1, `A página não deve ter rolagem horizontal: ${JSON.stringify(result)}`);
}

async function timedSimuladoRecovery(page, questions) {
  await page.locator('#simuladoScope').selectOption('filtered');
  await page.locator('#simuladoCount').selectOption('10');
  await page.locator('#simuladoMinutes').selectOption('20');
  await page.locator('#startSimuladoBtn').click();
  await visible(page, '#simuladoDialog[open]');
  const statement = await page.locator('#simuladoQuestionText').innerText();
  assert(questions.some(question => statement.includes(question.statement)), 'O simulado filtrado deve usar a disciplina selecionada.');
  assert((await page.locator('#simuladoQuestionMeta').innerText()).includes('Direito Penal'));
  const options = await page.locator('#simuladoOptions [data-simulado-option]').allTextContents();
  await page.locator('#simuladoOptions [data-simulado-option="1"]').click();
  await page.locator('#simuladoOptions [data-simulado-scissor="0"]').click();
  assert.match(await page.locator('#simuladoAnsweredCount').innerText(), /1\/2/);
  const seconds = value => value.trim().split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const remainingBefore = seconds(await page.locator('#simuladoClock').innerText());
  await page.locator('#abortSimuladoBtn').click();
  await visible(page, '#confirmExitTimedSimuladoDialog[open]');
  await page.locator('#pauseTimedSimuladoBtn').click();
  await visible(page, '#resumeTimedSimuladoBtn');
  await page.reload({ waitUntil: 'load' });
  await page.locator('#appBootSplash').waitFor({ state: 'hidden' });
  await openQuestions(page);
  await visible(page, '#resumeTimedSimuladoBtn');
  await page.locator('#resumeTimedSimuladoBtn').click();
  await visible(page, '#simuladoDialog[open]');
  assert.equal(await page.locator('#simuladoQuestionText').innerText(), statement, 'A retomada do simulado deve preservar a questão atual.');
  assert.deepEqual(await page.locator('#simuladoOptions [data-simulado-option]').allTextContents(), options,
    'O simulado retomado deve manter a ordem das alternativas.');
  await visible(page, '#simuladoOptions [data-simulado-option="1"].selectedOption');
  await visible(page, '#simuladoOptions [data-simulado-option="0"].eliminatedOption');
  assert.match(await page.locator('#simuladoAnsweredCount').innerText(), /1\/2/);
  const remainingAfter = seconds(await page.locator('#simuladoClock').innerText());
  assert(Number.isFinite(remainingAfter) && remainingAfter <= remainingBefore,
    'Recarregar a página não deve reiniciar nem aumentar o tempo do simulado.');
  await page.locator('#simuladoNextBtn').click();
  const second = await page.locator('#simuladoQuestionText').innerText();
  assert.notEqual(second, statement);
  assert(questions.some(question => second.includes(question.statement)), 'A segunda questão do simulado deve manter o filtro.');
  await page.locator('#abortSimuladoBtn').click();
  await visible(page, '#confirmExitTimedSimuladoDialog[open]');
  await page.locator('#discardTimedSimuladoBtn').click();
  await page.locator('#simuladoDialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#resumeTimedSimuladoBar').count(), 0, 'Encerrar o simulado deve descartar a retomada.');
}

async function runScenario(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: 'pt-BR', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  const localFailures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      localFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort('blockedbyclient');
  });
  try {
    // Uma página vazia da própria origem prepara apenas dados do visitante.
    await page.goto(origin + '/__fixture__');
    await page.evaluate(data => {
      const customCampaign = { name: data.campaignName, missions: data.missions };
      localStorage.setItem('pmpe-hunter-v1', JSON.stringify({
        activeCampaignId: data.campaignId, customCampaign,
        campaigns: [{ id: data.campaignId, name: data.campaignName, template: 'custom', priority: 1, customCampaign }],
      }));
      localStorage.setItem('pmpe-guest-mode', '1');
      localStorage.setItem('jornada-lgpd-consent-v1', new Date().toISOString());
    }, fixture);
    await page.goto(origin + '/', { waitUntil: 'load' });
    await page.locator('#appBootSplash').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#loginGate').isVisible(), false, 'O modo visitante deve abrir sem autenticação.');
    await page.waitForFunction(() => typeof window.showQuestion === 'function' && typeof window.requestExitQuestionSession === 'function');

    // Injeção de DADOS, usando os renderizadores e a persistência reais.
    // Não substitui implementação, temporizadores, handlers nem resultado de IA.
    await page.evaluate(async questions => {
      const known = new Set(ALL_QUESTIONS.map(question => question.id));
      ALL_QUESTIONS.push(...questions.filter(question => !known.has(question.id)));
      renderQuestionFilters();
      window.markViewsDirty?.();
      await window.persistToLocalDatabase();
    }, fixture.questions);

    const started = Date.now();
    await openQuestions(page);
    const questionsOpenMs = Date.now() - started;
    await assertNoHorizontalOverflow(page, '.questionTrainer');
    const subjectOptions = await page.locator('#questionSubject option').allTextContents();
    assert(!subjectOptions.some(containsManual), 'Manuais de uso não devem aparecer como disciplinas de questões.');

    const portuguese = fixture.questions.filter(question => question.subject === 'Língua Portuguesa');
    await pickSubjectAndTopic(page, 'Língua Portuguesa', 'SMOKE-PORTUGUES');
    assert.match(await page.locator('#questionPoolCount').innerText(), /^3\s/, 'O filtro isolado deve listar as três questões de Português.');
    await page.locator('#startQuestions').click();
    const initialStatement = await assertQuestionScope(page, 'Língua Portuguesa', portuguese);
    await assertNoHorizontalOverflow(page, '#questionDialog');
    const initialOptions = await page.locator('#questionOptions [data-question-index] .optBodyText').allTextContents();
    await answerFirstOption(page);

    // ESC protege o treino; permanecer preserva a resposta já dada.
    await page.keyboard.press('Escape');
    await visible(page, '#confirmExitSimuladoDialog[open]');
    await page.locator('#stayInSimuladoBtn').click();
    await visible(page, '#questionDialog[open]');
    assert.equal(await page.locator('#questionText').innerText(), initialStatement);
    await page.keyboard.press('Escape');
    await visible(page, '#confirmExitSimuladoDialog[open]');
    await page.locator('#pauseQuestionSessionBtn').click();
    await visible(page, '#resumeSavedQuestionSessionBtn');
    await page.reload({ waitUntil: 'load' });
    await page.locator('#appBootSplash').waitFor({ state: 'hidden' });
    await openQuestions(page);
    await visible(page, '#resumeSavedQuestionSessionBtn');
    await page.locator('#resumeSavedQuestionSessionBtn').click();
    assert.equal(await assertQuestionScope(page, 'Língua Portuguesa', portuguese), initialStatement,
      'Retomar após recarregar deve manter a questão atual.');
    assert.deepEqual(await page.locator('#questionOptions [data-question-index] .optBodyText').allTextContents(), initialOptions,
      'A retomada deve preservar a ordem das alternativas.');
    assert(await page.locator('#questionOptions [data-question-index]').evaluateAll(buttons => buttons.every(button => button.disabled)),
      'A resposta anterior deve permanecer registrada e bloqueada após retomar.');
    await visible(page, '#nextQuestion');
    assert(await page.locator('#questionFeedback').innerText(), 'A correção anterior deve ser recuperada.');
    await page.locator('#nextQuestion').click();
    const secondStatement = await assertQuestionScope(page, 'Língua Portuguesa', portuguese);
    assert.notEqual(secondStatement, initialStatement, 'Próxima questão deve avançar sem repetir o item anterior.');
    await exitAndDiscard(page);

    // Um assunto sem questões deve permanecer vazio, sem completar com outra disciplina.
    await pickSubjectAndTopic(page, 'Língua Portuguesa', 'SMOKE-SEM-QUESTOES');
    assert.match(await page.locator('#questionPoolCount').innerText(), /^0\s/);
    assert(await page.locator('#startQuestions').isDisabled(), 'Não iniciar treino quando nenhum item corresponde ao filtro.');

    const penal = fixture.questions.filter(question => question.subject === 'Direito Penal');
    await pickSubjectAndTopic(page, 'Direito Penal', 'SMOKE-PENAL');
    assert.match(await page.locator('#questionPoolCount').innerText(), /^2\s/);
    await page.locator('#startQuestions').click();
    await assertQuestionScope(page, 'Direito Penal', penal);
    await answerFirstOption(page);
    await page.locator('#nextQuestion').click();
    await assertQuestionScope(page, 'Direito Penal', penal);
    await exitAndDiscard(page);
    await timedSimuladoRecovery(page, penal);

    // Guias vivem em Ajuda: nunca são resumos ou disciplinas do edital.
    await page.locator('button[data-view="study"]').click();
    await visible(page, '#study.active');
    assert.equal(await page.locator('#openManuaisCacadorBtn').count(), 0,
      'O atalho antigo não deve recolocar manuais nos filtros de estudo.');
    assert.equal(await page.locator('#summaryList [data-summary^="manual-"]').count(), 0);
    assert(!(await page.locator('#summaryFilter option').allTextContents()).some(containsManual));
    await page.locator('[data-study="cards"]').click();
    assert(!(await page.locator('#cardFilter option').allTextContents()).some(containsManual));
    await page.locator('#moreBtn').click();
    await visible(page, '#moreDialog[open] #openHunterManualsBtn');
    await page.locator('#openHunterManualsBtn').click();
    await visible(page, '#hunterManualsDialog[open]');
    assert.equal(await page.locator('#hunterManualsDialog [data-hunter-manual-id]').count(), 4);
    assert.match(await page.locator('#hunterManualsContent .hmSource').innerText(), /Guia da plataforma/);
    for (const id of ['manual-01-ciclo-estudos','manual-02-dominando-questoes','manual-03-revisao-pos-edital','manual-04-guia-passo-a-passo']) {
      await page.locator(`[data-hunter-manual-id="${id}"]`).click();
      assert.equal(await page.locator(`[data-hunter-manual-id="${id}"]`).getAttribute('aria-current'), 'page');
      assert((await page.locator('#hunterManualsContent').innerText()).length > 200);
    }
    assert(!/GERADO POR IA|\d+ resumos/i.test(await page.locator('#hunterManualsDialog').innerText()));
    await assertNoHorizontalOverflow(page, '#hunterManualsDialog');
    await page.locator('#closeHunterManualsBtn').click();
    await page.locator('#hunterManualsDialog').waitFor({state:'hidden'});
    await page.locator('#moreBtn').evaluate(button => {
      if (document.activeElement !== button) throw new Error('Fechar o guia deve devolver o foco ao Menu.');
    });
    assert.deepEqual(errors, [], 'Não deve haver exceções JavaScript durante os fluxos do estudante.');
    assert.deepEqual(localFailures, [], 'Todos os arquivos locais solicitados devem carregar.');
    console.log(`OK browser ${name}: filtros, vazio honesto, resposta, saída, retomada de treino e simulado, manuais e largura; aba Questões ${questionsOpenMs} ms (amostra local, sem meta de desempenho).`);
  } catch (error) {
    if (artifactDir) {
      await mkdir(artifactDir, { recursive: true });
      await page.screenshot({ path: path.join(artifactDir, `${name}-failure.png`), fullPage: true }).catch(() => {});
    }
    if (errors.length) console.error('Exceções no navegador:', errors);
    throw error;
  } finally {
    await context.close();
  }
}

let browser;
let origin;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  await runScenario(browser, 'desktop', { width: 1440, height: 1000 });
  await runScenario(browser, 'mobile', { width: 390, height: 844 });
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
