#!/usr/bin/env node
/**
 * Executa a validação de public.exam_questions em lotes pequenos via Edge Function validate-questions,
 * com retry automático para erros transitórios (546/502/503/504) e pausa entre lotes.
 *
 * Uso no CMD do Windows:
 *   set VALIDATION_ADMIN_TOKEN=SUA_SENHA_DO_SECRET
 *   node scripts/run-validation-batches.mjs --priority=ia --limit=2 --pause=35 --max-batches=25
 */

function parseArgs(argv) {
  const opts = {
    url: process.env.SUPABASE_URL || 'https://jybislbbblyjsrcdegjt.supabase.co',
    token: process.env.VALIDATION_ADMIN_TOKEN || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    priority: 'ia',
    limit: 2,
    pauseSec: 35,
    maxBatches: 25,
    provider: 'auto',
    dupla: undefined
  };
  for (const arg of argv) {
    if (arg.startsWith('--priority=')) opts.priority = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) opts.limit = Math.max(1, Math.min(20, Number(arg.split('=')[1]) || 2));
    else if (arg.startsWith('--pause=')) opts.pauseSec = Math.max(2, Number(arg.split('=')[1]) || 35);
    else if (arg.startsWith('--max-batches=')) opts.maxBatches = Math.max(1, Number(arg.split('=')[1]) || 25);
    else if (arg.startsWith('--provider=')) opts.provider = arg.split('=')[1];
    else if (arg === '--dupla') opts.dupla = true;
    else if (arg === '--simples') opts.dupla = false;
    else if (arg.startsWith('--url=')) opts.url = arg.split('=')[1];
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT_STATUS = new Set([502, 503, 504, 546]);

async function callBatchWithRetry(endpoint, headers, body, batchNum) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = await res.text().catch(() => '');
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (res.ok && data) return { ok: true, status: res.status, data };

    if (TRANSIENT_STATUS.has(res.status) && attempt < maxAttempts) {
      const waitSec = 15 * attempt;
      console.warn(`[Lote ${batchNum}] HTTP ${res.status} transitório (tentativa ${attempt}/${maxAttempts}). Aguardando ${waitSec}s...`);
      await sleep(waitSec * 1000);
      continue;
    }
    return { ok: false, status: res.status, data: data || raw };
  }
  return { ok: false, status: 0, data: 'falha_inesperada' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.token) {
    console.error('Erro: defina VALIDATION_ADMIN_TOKEN no CMD antes de rodar.');
    console.error('Exemplo: set VALIDATION_ADMIN_TOKEN=seu_token');
    process.exit(1);
  }

  const endpoint = `${opts.url.replace(/\/+$/, '')}/functions/v1/validate-questions`;
  const totals = {
    batches: 0,
    processadas: 0,
    verificada: 0,
    divergente: 0,
    sem_resposta: 0,
    erro: 0,
    tokens_entrada: 0,
    tokens_saida: 0
  };

  console.log(`Iniciando lotes em ${endpoint}`);
  console.log(`Config: priority=${opts.priority}, limit=${opts.limit}, pause=${opts.pauseSec}s, maxBatches=${opts.maxBatches}, provider=${opts.provider}, chave_override=${opts.geminiKey ? 'SIM (terminal)' : 'NÃO (Secret do Supabase)'}`);

  for (let b = 1; b <= opts.maxBatches; b++) {
    const body = {
      limit: opts.limit,
      priority: opts.priority,
      provider: opts.provider,
      dry_run: false
    };
    if (typeof opts.dupla === 'boolean') body.dupla = opts.dupla;

    const headers = {
      'Content-Type': 'application/json',
      'x-admin-token': opts.token
    };
    if (opts.geminiKey) headers['x-gemini-api-key'] = opts.geminiKey;

    const result = await callBatchWithRetry(endpoint, headers, body, b);
    if (!result.ok) {
      console.error(`[Lote ${b}] Erro HTTP ${result.status}:`, result.data);
      break;
    }

    const data = result.data;
    if (!data.processadas) {
      console.log(`[Lote ${b}] Fila concluída! Nenhuma questão pendente restante para priority=${opts.priority}.`);
      break;
    }

    totals.batches += 1;
    totals.processadas += Number(data.processadas || 0);
    totals.verificada += Number(data.resumo?.verificada || 0);
    totals.divergente += Number(data.resumo?.divergente || 0);
    totals.sem_resposta += Number(data.resumo?.sem_resposta || 0);
    totals.erro += Number(data.resumo?.erro || 0);
    totals.tokens_entrada += Number(data.tokens_entrada || 0);
    totals.tokens_saida += Number(data.tokens_saida || 0);

    console.log(
      `[Lote ${b}/${opts.maxBatches}] batch=${data.batch} | proc=${data.processadas} | resumo=${JSON.stringify(data.resumo)} | modelos=${JSON.stringify(data.modelos_usados)} | motivos=${JSON.stringify(data.motivos || {})}`
    );

    if (Number(data.resumo?.erro || 0) === Number(data.processadas || 0)) {
      console.log(`[Lote ${b}] Todas as questões do lote falharam (possível 429/cota). Pausando ${Math.max(45, opts.pauseSec * 2)}s antes de continuar...`);
      await sleep(Math.max(45, opts.pauseSec * 2) * 1000);
    } else if (b < opts.maxBatches) {
      await sleep(opts.pauseSec * 1000);
    }
  }

  console.log('\n=== RESUMO ACUMULADO DA SESSÃO ===');
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((err) => {
  console.error('Erro fatal:', err?.message || err);
  process.exit(1);
});
