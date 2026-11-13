# Arquivos alterados — r174

Base: `3d1e6ed2bac05a2d3ea3f560928247eadc3abcaa`. Código disponibilizado na branch de revisão `entrega/revisao-r174`; sem implantação do aplicativo.

## Aplicação e dados

- Nova migração: `supabase/migrations/20261113120000_v107_atomic_edital_topics.sql`.
- Edge Functions a atualizar: `account-security`, `assistente-pmpe`, `edital-gemini`, `system-diagnostics`.
- Frontend publicado a partir de `dist/`; novo módulo `question-session-store.js` incluído no cache r174.
- `package-lock.json` fixa dependências de testes, sem mudar o runtime estático.

## Lista completa

- `.github/workflows/browser-smoke.yml`
- `.github/workflows/validate.yml`
- `.gitignore`
- `README.md`
- `dist/index.html`
- `dist/native-question-bank.json`
- `dist/pdf-text-client.js`
- `dist/privacidade.html`
- `dist/question-session-store.js`
- `dist/sw.js`
- `dist/v59-enhancements.js`
- `dist/v77-experience.js`
- `docs/revisao-r174/ARQUIVOS-ALTERADOS.md`
- `docs/revisao-r174/AVALIACAO-COMPLETA.md`
- `docs/revisao-r174/GITHUB-E-APLICACAO.md`
- `docs/revisao-r174/LEIA-ME.md`
- `docs/revisao-r174/VALIDACAO.txt`
- `package-lock.json`
- `package.json`
- `scripts/browser-smoke.mjs`
- `scripts/fixtures/browser-state.json`
- `scripts/integration-edital-sql.mjs`
- `scripts/test-attach-answer-key.mjs`
- `scripts/test-crud-contracts.mjs`
- `scripts/test-front-study.mjs`
- `scripts/test-question-bank.mjs`
- `scripts/test-r171-grok.mjs`
- `scripts/test-r174-account-safety.mjs`
- `scripts/test-r174-answer-trust.mjs`
- `scripts/test-r174-classification.mjs`
- `scripts/test-r174-diagnostics.mjs`
- `scripts/test-r174-edital-persistence.mjs`
- `scripts/test-r174-error-retry.mjs`
- `scripts/test-r174-local-cache.mjs`
- `scripts/test-r174-option-telemetry.mjs`
- `scripts/test-r174-session-performance.mjs`
- `scripts/validate-project.mjs`
- `supabase/functions/account-security/index.ts`
- `supabase/functions/assistente-pmpe/index.ts`
- `supabase/functions/edital-gemini/index.ts`
- `supabase/functions/system-diagnostics/index.ts`
- `supabase/migrations/20261113120000_v107_atomic_edital_topics.sql`

## Pacotes

O ZIP completo preparado preserva fontes e recursos, excluindo dependências, histórico Git, configurações locais e produtos compilados. O ZIP automático da branch no GitHub segue os arquivos versionados originais, incluindo o APK histórico, que não foi recompilado. O ZIP de alterações inclui apenas os caminhos acima. Nenhum arquivo de progresso do usuário ou credencial foi acrescentado.
