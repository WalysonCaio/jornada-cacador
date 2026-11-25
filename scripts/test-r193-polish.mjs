import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist/index.html', 'utf8');
const cls = fs.readFileSync('dist/invocador-classroom.js', 'utf8');
const css = fs.readFileSync('dist/ui-r188.css', 'utf8');
const sw = fs.readFileSync('dist/sw.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.equal(pkg.version, '1.0.193');
assert.ok(sw.includes('r193'), 'SW deve estar na r193');

// 1. Ofensiva do Caçador com ícone 🔥 e span .streakDaysUnit
assert.ok(html.includes('<span id="streakCardCount">0</span> <span class="streakDaysUnit">dias seguidos</span>'), 'Ofensiva deve usar .streakDaysUnit');
assert.ok(html.includes('<div class="streakFlame" aria-hidden="true">🔥</div>'), 'Ícone da ofensiva deve ser chama 🔥');

// 2. Central do caçador (#moreDialog) com ícones nítidos (sem dingbats quebrados)
assert.ok(html.includes('📝<span>Redação</span>') && html.includes('🔄<span>Revisões</span>'), 'Central do caçador deve usar ícones legíveis em Redação e Revisões');

// 3. Revisão 1-7-30 usa inferStrictQuestionSubjectDecision sem fallback enviesado
assert.ok(html.includes('inferStrictQuestionSubjectDecision(x.e.question||x.e.statement||\'\''), 'renderReviews deve inferir disciplina diretamente pelo enunciado');

// 4. Chips de tópicos fracos no Invocador deduplicam acentos/maiúsculas (História de Pernambuco vs historia de pernambuco)
{
  const sb = {
    window: null,
    console,
    state: {
      activeCampaignId: 'pmpe',
      errors: {
        e1: { campaignId: 'pmpe', subject: 'História de Pernambuco', topic: 'História de Pernambuco', count: 5 },
        e2: { campaignId: 'pmpe', subject: 'historia de pernambuco', topic: 'historia de pernambuco', count: 5 }
      }
    },
    cloudSession: null,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(cls, sb);
  const weak = sb.JCInvocadorClassroom.getWeakTopicSuggestions(4);
  assert.equal(weak.length, 1, 'Deve mesclar História de Pernambuco e historia de pernambuco em 1 único chip');
  assert.equal(weak[0].topic, 'História de Pernambuco', 'Deve manter a versão capitalizada/acentuada');
}

// 5. CSS: contraste do Hero no Tema Claro, tafStatusPill nowrap, e folga inferior no modal de questão
assert.ok(css.includes('body.lightAppTheme .hero .small.muted'), 'Tema claro deve garantir contraste claro no Hero escuro');
assert.ok(css.includes('.tafStatusPill'), 'TAF status pill deve ter nowrap');
assert.ok(css.includes('padding-bottom: 84px'), 'Modal de questão deve ter folga inferior antes da barra fixa');

console.log('OK: test-r193-polish.mjs (todas as verificações da r193 passaram)');
