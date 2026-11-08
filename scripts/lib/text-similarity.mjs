/**
 * Biblioteca de Similaridade Textual, Shingling (Word & Char), MinHash e LSH Sharded por Disciplina
 * Para detecção determinística de duplicatas e quase-duplicatas no banco de questões da Jornada do Caçador.
 */

export function normalizeText(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(art\.?|artigo|inc\.?|inciso|par[aá]grafo|§)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function subjectKey(s = '') {
  return normalizeText(s)
    .replace(/\b(disciplina|materia|conteudo|modulo|parte)\b/g, ' ')
    .replace(/\b(i{1,3}|iv|v|[1-9])\b$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function questionFingerprint(q) {
  const text = `${subjectKey(q?.subject)}|${normalizeText(q?.topic || '')}|${normalizeText(q?.statement || '')}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function jaccardSets(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) inter++;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

export function tokenJaccard(a, b) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  return jaccardSets(ta, tb);
}

export function wordShingles(text, n = 3) {
  const toks = normalizeText(text).split(' ').filter(Boolean);
  if (!toks.length) return new Set();
  if (toks.length < n) return new Set([toks.join(' ')]);
  const out = new Set();
  for (let i = 0; i <= toks.length - n; i++) {
    out.add(toks.slice(i, i + n).join(' '));
  }
  return out;
}

export function shingleJaccard(a, b, n = 3) {
  return jaccardSets(wordShingles(a, n), wordShingles(b, n));
}

export function charShingles(text, k = 4) {
  const clean = normalizeText(text).replace(/\s+/g, ' ');
  if (!clean) return new Set();
  if (clean.length < k) return new Set([clean]);
  const out = new Set();
  for (let i = 0; i <= clean.length - k; i++) {
    out.add(clean.slice(i, i + k));
  }
  return out;
}

export function charShingleJaccard(a, b, k = 4) {
  return jaccardSets(charShingles(a, k), charShingles(b, k));
}

export function questionSimilarity(a, b, strict = false) {
  const token = tokenJaccard(a, b);
  const wordShingle = shingleJaccard(a, b, 3);
  const charShingle = charShingleJaccard(a, b, 4);
  const combined = Number((0.35 * token + 0.40 * wordShingle + 0.25 * charShingle).toFixed(4));
  const threshold = strict ? 0.76 : 0.82;
  const isNearDuplicate =
    token >= (strict ? 0.82 : 0.90) ||
    combined >= threshold ||
    (token >= 0.75 && wordShingle >= 0.70);
  const isLikelyDuplicate = token >= 0.96 || combined >= 0.94;
  return {
    token: Number(token.toFixed(4)),
    shingle: Number(wordShingle.toFixed(4)),
    charShingle: Number(charShingle.toFixed(4)),
    combined,
    isNearDuplicate,
    isLikelyDuplicate,
  };
}

function hashStringWithSeed(str, seed) {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function minhashStatement(text, opts = {}) {
  const numHashes = opts.numHashes || 128;
  const mode = opts.mode || 'hybrid';
  const shingleSize = opts.shingleSize || 3;
  const charSize = opts.charSize || 4;
  const sig = new Uint32Array(numHashes);
  sig.fill(0xffffffff);

  if (mode === 'word' || mode === 'char') {
    const items = mode === 'word' ? wordShingles(text, shingleSize) : charShingles(text, charSize);
    if (!items.size) return sig;
    for (let i = 0; i < numHashes; i++) {
      const seed = Math.imul(i + 1, 0x9e3779b9) >>> 0;
      let minVal = 0xffffffff;
      for (const sh of items) {
        const hv = hashStringWithSeed(sh, seed);
        if (hv < minVal) minVal = hv;
      }
      sig[i] = minVal;
    }
    return sig;
  }

  // Modo hybrid: metade word-shingles + metade char-shingles
  const half = Math.floor(numHashes / 2);
  const wItems = wordShingles(text, shingleSize);
  const cItems = charShingles(text, charSize);
  for (let i = 0; i < half; i++) {
    const seed = Math.imul(i + 1, 0x9e3779b9) >>> 0;
    let minVal = 0xffffffff;
    for (const sh of wItems) {
      const hv = hashStringWithSeed(sh, seed);
      if (hv < minVal) minVal = hv;
    }
    sig[i] = minVal;
  }
  for (let i = half; i < numHashes; i++) {
    const seed = Math.imul(i + 1, 0x7f4a7c15) >>> 0;
    let minVal = 0xffffffff;
    for (const sh of cItems) {
      const hv = hashStringWithSeed(sh, seed);
      if (hv < minVal) minVal = hv;
    }
    sig[i] = minVal;
  }
  return sig;
}

export function minhashCharStatement(text, numHashes = 128) {
  return minhashStatement(text, { numHashes, mode: 'char' });
}

export function minhashSignatureSimilarity(sigA, sigB) {
  if (!sigA?.length || sigA.length !== sigB?.length) return 0;
  let eq = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) eq++;
  }
  return eq / sigA.length;
}

export function lshCandidateProbability(j, bands = 16, rows = 8) {
  return 1 - Math.pow(1 - Math.pow(j, rows), bands);
}

export function suggestLshParams(numHashes = 128, targetJ = 0.8, minProb = 0.9) {
  let best = { bands: 16, rows: 8, numHashes: 128, probabilityAtThreshold: lshCandidateProbability(targetJ, 16, 8) };
  for (let rows = 2; rows <= 16; rows++) {
    if (numHashes % rows !== 0) continue;
    const bands = numHashes / rows;
    const p = lshCandidateProbability(targetJ, bands, rows);
    if (p >= minProb) {
      best = { bands, rows, numHashes, probabilityAtThreshold: Number(p.toFixed(4)) };
    }
  }
  return best;
}

const LSH_PRESETS = {
  precision: { numHashes: 128, bands: 16, rows: 8, mode: 'hybrid' },
  balanced: { numHashes: 96, bands: 16, rows: 6, mode: 'hybrid' },
  recall: { numHashes: 64, bands: 32, rows: 2, mode: 'word' },
  ocr: { numHashes: 128, bands: 16, rows: 8, mode: 'char' },
};

export function findNearDuplicatesMinHash(questions, opts = {}) {
  const preset = LSH_PRESETS[opts.preset || 'precision'] || LSH_PRESETS.precision;
  const numHashes = opts.numHashes || preset.numHashes;
  const bands = opts.bands || preset.bands;
  const rows = opts.rows || preset.rows;
  const mode = opts.mode || preset.mode;
  const strict = Boolean(opts.strict);
  const sameSubjectOnly = opts.sameSubjectOnly !== false;

  const items = questions.map((q, idx) => ({
    idx,
    id: q.id || q._id || `#${idx}`,
    subj: subjectKey(q.subject || q.disciplina || ''),
    statement: String(q.statement || q.enunciado || '').trim(),
    sig: minhashStatement(q.statement || q.enunciado || '', { numHashes, mode }),
  }));

  const buckets = new Map();
  for (const item of items) {
    for (let b = 0; b < bands; b++) {
      const start = b * rows;
      const bandSlice = Array.from(item.sig.subarray(start, start + rows)).join(',');
      const bucketKey = `${sameSubjectOnly ? item.subj : '*'}|b${b}|${bandSlice}`;
      let list = buckets.get(bucketKey);
      if (!list) {
        list = [];
        buckets.set(bucketKey, list);
      }
      list.push(item.idx);
    }
  }

  const candidatePairs = new Set();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = Math.min(list[i], list[j]);
        const b = Math.max(list[i], list[j]);
        candidatePairs.add(`${a}:${b}`);
      }
    }
  }

  const nearDuplicates = [];
  for (const pair of candidatePairs) {
    const [idxA, idxB] = pair.split(':').map(Number);
    const qa = items[idxA];
    const qb = items[idxB];
    if (sameSubjectOnly && qa.subj !== qb.subj) continue;
    const sim = questionSimilarity(qa.statement, qb.statement, strict);
    if (sim.isNearDuplicate) {
      nearDuplicates.push({
        a: qa.id,
        b: qb.id,
        idxA,
        idxB,
        similarity: sim.combined,
        tokenSimilarity: sim.token,
        shingleSimilarity: sim.shingle,
        charSimilarity: sim.charShingle,
        previewA: qa.statement.slice(0, 70),
      });
    }
  }
  return nearDuplicates;
}

export function findNearDuplicatesMinHashBySubject(questions, opts = {}) {
  return findNearDuplicatesMinHash(questions, { ...opts, sameSubjectOnly: true });
}

export function cosineSimilarity(vecA, vecB) {
  if (!vecA?.length || vecA.length !== vecB?.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export async function mockEmbedFn(texts) {
  return texts.map((t) => {
    const vec = new Float32Array(64);
    const words = normalizeText(t).split(' ').filter(Boolean);
    for (const w of words) {
      const h = hashStringWithSeed(w, 42);
      vec[h % 64] += 1;
    }
    return Array.from(vec);
  });
}

export async function findNearDuplicatesEmbeddings(questions, embedFn = mockEmbedFn, opts = {}) {
  const threshold = opts.threshold || 0.88;
  const sameSubjectOnly = opts.sameSubjectOnly !== false;
  const statements = questions.map((q) => String(q.statement || q.enunciado || '').trim());
  const vectors = await embedFn(statements);
  const out = [];
  for (let i = 0; i < questions.length; i++) {
    const subjA = subjectKey(questions[i].subject || '');
    for (let j = i + 1; j < questions.length; j++) {
      const subjB = subjectKey(questions[j].subject || '');
      if (sameSubjectOnly && subjA !== subjB) continue;
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim >= threshold) {
        out.push({
          a: questions[i].id || `#${i}`,
          b: questions[j].id || `#${j}`,
          idxA: i,
          idxB: j,
          similarity: Number(sim.toFixed(3)),
          previewA: statements[i].slice(0, 70),
        });
      }
    }
  }
  return out;
}
