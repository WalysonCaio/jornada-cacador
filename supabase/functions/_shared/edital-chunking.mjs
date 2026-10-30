// Análise de editais em trechos: nenhuma página é descartada por amostragem e cada trecho
// é enviado ao modelo separadamente, evitando o corte por limite de tokens/tempo de uma
// única chamada gigante.

export const CHUNK_TARGET_CHARS = 24000;
export const CHUNK_MAX_CHARS = 30000;
export const MAX_CHUNKS = 18;
const clean = value => String(value ?? "").replace(/\u0000/g, "").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** Normaliza páginas vindas do navegador ou do arquivo .text.json. */
export function normalizePages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const byPage = new Map();
  list.forEach((item, idx) => {
    const page = Number(item?.page) || idx + 1;
    const text = clean(item?.text);
    if (text.length <= 10) return;
    byPage.set(page, byPage.has(page) ? `${byPage.get(page)}\n${text}` : text);
  });
  return [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, text]) => ({
    page,
    text
  }));
}

/** Converte o texto antigo "[PÁGINA n]\n..." em páginas. */
export function pagesFromMarkedText(raw) {
  const text = String(raw ?? "");
  const parts = text.split(/\[P[ÁA]GINA\s+(\d+)\]\s*/i);
  if (parts.length < 3) return normalizePages(text.trim() ? [{
    page: 1,
    text
  }] : []);
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) pages.push({
    page: Number(parts[i]),
    text: parts[i + 1] ?? ""
  });
  return normalizePages(pages);
}
export const totalChars = pages => pages.reduce((sum, p) => sum + p.text.length, 0);
function splitLongText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const pieces = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf("\n", maxChars);
    if (cut < maxChars * 0.5) cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/** Divide TODAS as páginas em trechos de ~24 mil caracteres, sem perder nenhuma. */
export function buildChunks(pages, target = CHUNK_TARGET_CHARS, max = CHUNK_MAX_CHARS) {
  const blocks = [];
  for (const page of pages) {
    for (const piece of splitLongText(page.text, max - 40)) blocks.push({
      page: page.page,
      text: `[PÁGINA ${page.page}]\n${piece}`
    });
  }
  const chunks = [];
  let current = [];
  let size = 0;
  const flush = () => {
    if (!current.length) return;
    const text = current.map(b => b.text).join("\n\n");
    chunks.push({
      index: chunks.length,
      pageStart: current[0].page,
      pageEnd: current[current.length - 1].page,
      text,
      chars: text.length
    });
    current = [];
    size = 0;
  };
  for (const block of blocks) {
    if (size > 0 && size + block.text.length > target) flush();
    current.push(block);
    size += block.text.length + 2;
  }
  flush();
  return chunks;
}
const STRONG = /conte[uú]do program[aá]tico|programa(s)? (das|de|da|do) (prova|provas|disciplina|disciplinas|mat[eé]ria|materias|concurso)|conhecimentos (gerais|espec[ií]ficos|b[aá]sicos|profissionais|t[eé]cnicos)|objetos? de avalia[cç][aã]o|anexo [ivxlc\d]+\W.{0,80}(conte[uú]do|programa|disciplina|mat[eé]ria)/i;
const SUBJECTS = [/l[ií]ngua portuguesa|portugu[eê]s/i, /racioc[ií]nio l[oó]gico/i, /matem[aá]tica/i, /inform[aá]tica/i, /direito constitucional/i, /direito administrativo/i, /direito penal/i, /direito processual/i, /direito civil/i, /direitos? humanos/i, /legisla[cç][aã]o/i, /no[cç][oõ]es de/i, /atualidades/i, /hist[oó]ria/i, /geografia/i, /ingl[eê]s/i, /ci[eê]ncias/i, /biologia|f[ií]sica|qu[ií]mica/i, /contabilidade|administra[cç][aã]o|economia/i, /[eé]tica/i];
export function chunkScore(text) {
  let score = STRONG.test(text) ? 3 : 0;
  for (const re of SUBJECTS) if (re.test(text)) score += 1;
  return score;
}

/**
 * Escolhe os trechos que provavelmente contêm conteúdo programático. Editais curtos são
 * analisados inteiros. Trechos vizinhos de um acerto também entram (o programa continua).
 */
export function selectProgrammeChunks(chunks, maxChunks = MAX_CHUNKS) {
  if (chunks.length <= 6) return {
    selected: chunks,
    skipped: 0
  };
  const scores = chunks.map(c => chunkScore(c.text));
  const hits = scores.map((score, i) => score >= 4 ? i : -1).filter(i => i >= 0);
  let indexes;
  if (!hits.length) {
    indexes = chunks.map((_, i) => i);
  } else {
    // Faixa contínua do primeiro ao último acerto (+1 trecho): o programa pode ter disciplinas
    // fora da lista de palavras-chave e elas ficam no meio da faixa.
    const first = hits[0];
    let last = Math.min(chunks.length - 1, hits[hits.length - 1] + 1);
    while (last + 1 < chunks.length && scores[last + 1] >= 1 && last + 1 - first + 1 <= maxChunks) {
      last += 1;
    }
    if (last - first + 1 <= maxChunks) {
      indexes = Array.from({
        length: last - first + 1
      }, (_, k) => first + k);
    } else {
      const wanted = new Set();
      hits.forEach(i => {
        wanted.add(i);
        if (i + 1 < chunks.length) wanted.add(i + 1);
      });
      indexes = [...wanted];
    }
  }
  if (indexes.length > maxChunks) {
    indexes = indexes.sort((a, b) => scores[b] - scores[a] || a - b).slice(0, maxChunks);
  }
  indexes.sort((a, b) => a - b);
  return {
    selected: indexes.map(i => chunks[i]),
    skipped: chunks.length - indexes.length
  };
}
/** Executa os trechos com concorrência limitada e prazo total. */
export async function runChunked(chunks, makePrompt, caller, options) {
  const now = options.now ?? Date.now;
  const results = [];
  let failed = 0;
  let notRun = 0;
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const position = cursor++;
      if (position >= chunks.length) return;
      const remaining = options.deadline - now();
      if (remaining < 12000) {
        notRun++;
        continue;
      }
      const timeout = Math.min(options.perCallMs ?? 50000, remaining - 4000);
      let parsed = null;
      try {
        parsed = await caller(makePrompt(chunks[position], position, chunks.length), timeout);
      } catch {
        parsed = null;
      }
      if (parsed && Array.isArray(parsed.topics)) results.push({
        index: chunks[position].index,
        parsed
      });else failed++;
    }
  };
  await Promise.all(Array.from({
    length: Math.max(1, Math.min(options.concurrency ?? 3, chunks.length))
  }, worker));
  results.sort((a, b) => a.index - b.index);
  return {
    results,
    failed,
    notRun
  };
}
const normalizeKey = value => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
const normalizeSearch = value => normalizeKey(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ADMIN_ONLY = /^(inscri(c|ç)(a|ã)o|cronograma|remunera(c|ç)(a|ã)o|vagas?|isen(c|ç)(a|ã)o|taxa de inscri(c|ç)(a|ã)o|resultado|recursos?|exame m[eé]dico|teste de aptid(a|ã)o f[ií]sica|investiga(c|ç)(a|ã)o social|documentos?|matr[ií]cula|curso de forma(c|ç)(a|ã)o)$/i;
/** Junta os resultados dos trechos, remove duplicatas e recalcula as ordens globais. */
export function mergeChunkResults(results, maxTopics = 4000) {
  const subjectDisplay = new Map();
  const seen = new Set();
  const raw = [];
  const kinds = [];
  const confidences = [];
  const warnings = [];
  let reason = "";
  let scope = "";
  let seq = 0;
  for (const {
    index,
    parsed
  } of results) {
    const meta = parsed?.meta ?? {};
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    if (topics.length) {
      const kind = String(meta.document_kind ?? "").toLowerCase().trim();
      if (kind) kinds.push(kind);
      const conf = Number(meta.confidence);
      if (Number.isFinite(conf)) confidences.push(Math.max(0, Math.min(1, conf)));
      if (!reason && meta.classification_reason) reason = String(meta.classification_reason).trim();
      if (!scope && meta.detected_scope) scope = String(meta.detected_scope).trim();
      if (Array.isArray(meta.warnings)) for (const w of meta.warnings) {
        const t = String(w).trim();
        if (t && !warnings.includes(t)) warnings.push(t);
      }
    }
    for (const item of topics) {
      let subject = String(item?.subject ?? "Edital").replace(/\s+/g, " ").trim().slice(0, 200) || "Edital";
      const topic = String(item?.topic ?? "").replace(/\s+/g, " ").trim().slice(0, 700);
      if (topic.length < 3) continue;
      const subjectKey = normalizeSearch(subject);
      if (subjectKey === normalizeSearch(topic)) continue;
      if (ADMIN_ONLY.test(normalizeSearch(topic))) continue;
      if (!subjectDisplay.has(subjectKey)) subjectDisplay.set(subjectKey, subject);
      subject = subjectDisplay.get(subjectKey);
      const key = `${subjectKey}\u0000${normalizeSearch(topic)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const difficulty = ["basic", "intermediate", "advanced"].includes(String(item?.difficulty)) ? String(item.difficulty) : "basic";
      raw.push({
        subject,
        unit: String(item?.unit ?? "").replace(/\s+/g, " ").trim(),
        topic,
        edital_order: 0,
        subject_order: 0,
        learning_order: 0,
        difficulty,
        prerequisite_topic: String(item?.prerequisite_topic ?? "").replace(/\s+/g, " ").trim(),
        pedagogical_reason: String(item?.pedagogical_reason ?? "").trim().slice(0, 500),
        chunk: index,
        modelOrder: Math.max(0, Number(item?.learning_order) || 0),
        seq: seq++,
        subjectKey
      });
    }
  }
  const limited = raw.slice(0, maxTopics);
  const subjectOrder = new Map();
  limited.forEach(t => {
    if (!subjectOrder.has(t.subjectKey)) subjectOrder.set(t.subjectKey, subjectOrder.size);
  });
  const bySubject = new Map();
  limited.forEach(t => {
    const list = bySubject.get(t.subjectKey) ?? [];
    list.push(t);
    bySubject.set(t.subjectKey, list);
  });
  for (const list of bySubject.values()) {
    [...list].sort((a, b) => a.chunk - b.chunk || a.modelOrder - b.modelOrder || a.seq - b.seq).forEach((t, i) => {
      t.learning_order = i;
    });
    const titles = new Set(list.map(t => normalizeSearch(t.topic)));
    for (const t of list) {
      if (t.prerequisite_topic && (!titles.has(normalizeSearch(t.prerequisite_topic)) || normalizeSearch(t.prerequisite_topic) === normalizeSearch(t.topic))) t.prerequisite_topic = "";
    }
  }
  const topics = limited.map((t, i) => ({
    subject: t.subject,
    unit: t.unit,
    topic: t.topic,
    edital_order: i,
    subject_order: subjectOrder.get(t.subjectKey) ?? 0,
    learning_order: t.learning_order,
    difficulty: t.difficulty,
    prerequisite_topic: t.prerequisite_topic,
    pedagogical_reason: t.pedagogical_reason
  }));
  const officialKinds = ["edital_oficial", "edital_verticalizado", "edital_concurso"];
  const kind = officialKinds.find(k => kinds.includes(k)) ?? kinds.find(k => k !== "material_estudo") ?? kinds[0] ?? "";
  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.85;
  return {
    topics,
    truncatedByLimit: raw.length > maxTopics,
    meta: {
      document_kind: kind,
      classification_reason: reason || "Conteúdo programático identificado.",
      detected_scope: scope,
      confidence,
      warnings: warnings.slice(0, 10)
    }
  };
}