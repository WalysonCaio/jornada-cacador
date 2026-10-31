// Análise de editais em trechos + extrator determinístico para editais verticalizados/tabelados:
// nenhuma página é descartada por amostragem, editais verticalizados extraem 100% das disciplinas
// e tópicos sem colapsar em 1 matéria, e trechos de editais longos são analisados separadamente.

export type EditalPage = { page: number; text: string };
export type EditalChunk = { index: number; pageStart: number; pageEnd: number; text: string; chars: number };

export const CHUNK_TARGET_CHARS = 24000;
export const CHUNK_MAX_CHARS = 30000;
export const MAX_CHUNKS = 18;

const clean = (value: unknown) => String(value ?? "")
  .replace(/\u0000/g, "")
  .replace(/[\t ]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const normalizeKey = (value: unknown) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
const normalizeSearch = (value: unknown) => normalizeKey(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const EMAIL_LINE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const CPF_LINE_RE = /^(?:cpf\s*:?\s*)?\d{3}\.?\d{3}\.?\d{3}[-./]\d{2}$/i;
const TABLE_CHROME_LINE_RE = /^(leitura|-?\s*letra|da\s+lei|leitura\s*-\s*letra\s+da\s+lei|quest[oõ]|es|quest[oõ]es|acerto|s\s*\(\%\).*|acertos\s*\(\%\).*|tempo|revis[aã]|o|revis[aã]o|teoria|resumo|videoaula|pdf|status|conclu[ií]do|\(\%\))$/i;

const GENERIC_SUBJECT = /^(edital(\s+verticalizado|\s+do\s+concurso|\s+de\s+abertura|\s+esquematizado|\s+sintetizado|\s+n[ºo°]?\s*[\d\/.-]+)?.*|ciclo\s*\d+.*|conte[uú]do(s)?\s*program[aá]tico(s)?|conhecimentos?\s*(gerais|b[aá]sicos|espec[ií]ficos|complementares|t[eé]cnicos|profissionais)?|objetos?\s*de\s*avalia[cç][aã]o|disciplinas?|mat[eé]rias?|programa(s)?|anexo\s*[ivxlcdm\d]*.*|bloco\s*[ivxlcdm\d]*.*|m[oó]dulo\s*[ivxlcdm\d]*.*|parte\s*[ivxlcdm\d]*.*|geral|comum\s+a\s+todos.*|cargo\s*\d*.*|pol[ií]cia\s*(penal|militar|civil|federal|rodovi[aá]ria|cient[ií]fica|legislativa|judicial).*|corpo\s+de\s+bombeiros.*|guarda\s+(municipal|civil).*|agente\s+(penitenci[aá]rio|de\s+pol[ií]cia|socioeducativo).*|soldado.*|oficial.*|pm\s*pe.*|pp\s*pe.*|pc\s*pe.*|cbm\s*pe.*|prf.*|pf.*)$/i;

export const KNOWN_SUBJECT_HEADER_RE = /^(?:disciplina\s*:\s*|mat[eé]ria\s*:\s*)?(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)?(l[ií]ngua\s+portuguesa|portugu[eê]s|interpreta[cç][aã]o\s+de\s+textos?|reda[cç][aã]o(\s+oficial|\s+discursiva)?|[eé]tica(\s+no\s+servi[cç]o\s+p[uú]blico|\s+na\s+administra[cç][aã]o\s+p[uú]blica|\s+p[uú]blica|\s+e\s+cidadania)?|racioc[ií]nio\s+l[oó]gico(\s*[-e/]\s*matem[aá]tico|\s+quantitativo)?|matem[aá]tica(\s+financeira|\s+b[aá]sica|\s+e\s+racioc[ií]nio\s+l[oó]gico)?|estat[ií]stica|(no[cç][oõ]es\s+de\s+)?inform[aá]tica|tecnologia\s+da\s+informa[cç][aã]o(\s+e\s+comunica[cç][aã]o)?|atualidades(\s*\(.*\)|\s+e\s+conhecimentos\s+gerais)?|conhecimentos\s+regionais.*|hist[oó]ria(\s+de\s+pernambuco|\s+do\s+brasil|\s+geral)?|geografia(\s+de\s+pernambuco|\s+do\s+brasil|\s+geral)?|(no[cç][oõ]es\s+de\s+)?direito\s+(constitucional|administrativo|penal(\s+militar)?|processual\s+penal(\s+militar)?|militar|civil|processual\s+civil|tribut[aá]rio|previdenci[aá]rio|eleitoral|do\s+trabalho|ambiental|financeiro|empresarial|consumidor|internacional|humanos).*|direitos?\s+humanos(\s+e\s+participa[cç][aã]o\s+social|\s+e\s+cidadania|\s+e\s+legisla[cç][aã]o.*)?|legisla[cç][aã]o\s+(estadual|especial|extravagante|institucional|penal(\s+especial)?|espec[ií]fica|municipal|de\s+tr[aâ]nsito|aplicada|pertinente|penitenci[aá]ria|do\s+sistema\s+prisional).*|leis?\s+(especiais|extravagantes|penais\s+especiais).*|estatuto.*|criminologia|(no[cç][oõ]es\s+de\s+)?criminologia|(no[cç][oõ]es\s+de\s+)?medicina\s+legal|(no[cç][oõ]es\s+de\s+)?administra[cç][aã]o(\s+p[uú]blica|\s+geral|\s+financeira\s+e\s+or[cç]ament[aá]ria)?|afo|arquivologia|(no[cç][oõ]es\s+de\s+)?arquivologia|contabilidade(\s+geral|\s+p[uú]blica)?|economia|l[ií]ngua\s+(inglesa|espanhola|estrangeira).*|ingl[eê]s|espanhol|f[ií]sica|qu[ií]mica|biologia|anatomia\s+humana|primeiros\s+socorros|defesa\s+civil)$/i;

export function isGenericSubjectName(value: unknown, campaignName = "", docTitle = ""): boolean {
  const s = normalizeSearch(value).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (KNOWN_SUBJECT_HEADER_RE.test(String(value ?? "").trim())) return false;
  if (GENERIC_SUBJECT.test(s)) return true;
  const camp = normalizeSearch(campaignName).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (camp && (s === camp || (camp.length >= 4 && s.includes(camp)) || (s.length >= 4 && camp.includes(s)))) return true;
  const title = normalizeSearch(docTitle).replace(/\.pdf$/i, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (title && (s === title || (title.length >= 5 && s.includes(title)))) return true;
  return false;
}

export function sanitizeWatermarkText(value: unknown): string {
  return String(value ?? "")
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "")
    .replace(/\b(?:cpf\s*:?\s*)?\d{3}\.?\d{3}\.?\d{3}[-./]\d{2}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Limpa linhas de marca d'água (nome + e-mail + CPF) e cabeçalhos de tabela verticalizada. */
export function cleanEditalPageLines(pageText: string): string[] {
  const rawLines = String(pageText ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const removeIdx = new Set<number>();
  for (let i = 0; i < rawLines.length; i++) {
    if (EMAIL_LINE_RE.test(rawLines[i]) || CPF_LINE_RE.test(rawLines[i])) {
      removeIdx.add(i);
      if (i > 0 && EMAIL_LINE_RE.test(rawLines[i]) && !/\d/.test(rawLines[i - 1]) && rawLines[i - 1].length <= 65) {
        const prev = rawLines[i - 1];
        if (!KNOWN_SUBJECT_HEADER_RE.test(prev) && !GENERIC_SUBJECT.test(normalizeSearch(prev))) {
          removeIdx.add(i - 1);
        }
      }
    }
  }
  const out: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (removeIdx.has(i)) continue;
    const line = sanitizeWatermarkText(rawLines[i]);
    if (!line) continue;
    if (TABLE_CHROME_LINE_RE.test(line)) continue;
    const norm = normalizeSearch(line);
    if (TABLE_CHROME_LINE_RE.test(norm)) continue;
    if (/^(edital\s+verticalizado.*|ciclo\s*\d+.*|policia\s+(penal|militar|civil|federal)\s*[-–—]?\s*[a-z]{0,3})$/i.test(norm)) continue;
    out.push(line);
  }
  return out;
}

/** Normaliza páginas vindas do navegador ou do arquivo .text.json. */
export function normalizePages(raw: unknown): EditalPage[] {
  const list = Array.isArray(raw) ? raw : [];
  const byPage = new Map<number, string>();
  list.forEach((item: any, idx: number) => {
    const page = Number(item?.page) || idx + 1;
    const text = clean(item?.text);
    if (text.length <= 10) return;
    byPage.set(page, byPage.has(page) ? `${byPage.get(page)}\n${text}` : text);
  });
  return [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, text]) => ({ page, text }));
}

/** Converte o texto antigo "[PÁGINA n]\n..." em páginas. */
export function pagesFromMarkedText(raw: unknown): EditalPage[] {
  const text = String(raw ?? "");
  const parts = text.split(/\[P[ÁA]GINA\s+(\d+)\]\s*/i);
  if (parts.length < 3) return normalizePages(text.trim() ? [{ page: 1, text }] : []);
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 1; i < parts.length; i += 2) pages.push({ page: Number(parts[i]), text: parts[i + 1] ?? "" });
  return normalizePages(pages);
}

export const totalChars = (pages: EditalPage[]) => pages.reduce((sum, p) => sum + p.text.length, 0);

function splitLongText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const pieces: string[] = [];
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
export function buildChunks(pages: EditalPage[], target = CHUNK_TARGET_CHARS, max = CHUNK_MAX_CHARS): EditalChunk[] {
  const blocks: Array<{ page: number; text: string }> = [];
  for (const page of pages) {
    for (const piece of splitLongText(page.text, max - 40)) blocks.push({ page: page.page, text: `[PÁGINA ${page.page}]\n${piece}` });
  }
  const chunks: EditalChunk[] = [];
  let current: typeof blocks = [];
  let size = 0;
  const flush = () => {
    if (!current.length) return;
    const text = current.map((b) => b.text).join("\n\n");
    chunks.push({ index: chunks.length, pageStart: current[0].page, pageEnd: current[current.length - 1].page, text, chars: text.length });
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

const STRONG = /conte[uú]do(s)? program[aá]tico(s)?|programa(s)? (das|de|da|do) (prova|provas|disciplina|disciplinas|mat[eé]ria|materias|concurso)|conhecimentos (gerais|espec[ií]ficos|b[aá]sicos|profissionais|t[eé]cnicos|complementares)|objetos? de avalia[cç][aã]o|edital verticalizado|anexo [ivxlcdm\d]+\W.{0,120}(conte[uú]do|programa|disciplina|mat[eé]ria|descri[cç][aã]o)/i;
const SUBJECTS = [
  /l[ií]ngua portuguesa|portugu[eê]s|interpreta[cç][aã]o de texto/i, /racioc[ií]nio l[oó]gico/i, /matem[aá]tica/i, /inform[aá]tica|tecnologia da informa[cç][aã]o/i,
  /direito constitucional/i, /direito administrativo/i, /direito penal/i, /direito processual/i, /direito civil|direito tribut[aá]rio|direito previdenci[aá]rio|direito eleitoral/i,
  /direito penal militar|processual penal militar|estatuto dos policiais|legisla[cç][aã]o institucional/i,
  /direitos? humanos/i, /legisla[cç][aã]o|leis? extravagantes|maria da penha|crimes hediondos/i, /no[cç][oõ]es de/i, /atualidades/i, /hist[oó]ria/i, /geografia/i,
  /ingl[eê]s|espanhol/i, /ci[eê]ncias/i, /biologia|f[ií]sica|qu[ií]mica/i, /contabilidade|administra[cç][aã]o|economia|arquivologia|afo/i, /[eé]tica|redac[aã]o oficial|criminologia|medicina legal|tr[aâ]nsito/i,
];
const NUMBERED_SYLLABUS = /(?:^|\n)\s*(?:1|01|I)\s*(?:[.\-)]\s+|\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|\n)[^\n]{4,}[\s\S]{5,600}(?:^|\n)\s*(?:2|02|II)\s*(?:[.\-)]\s+|\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|\n)[^\n]{4,}/;

export function chunkScore(text: string): number {
  let score = STRONG.test(text) ? 3 : 0;
  if (NUMBERED_SYLLABUS.test(text)) score += 2;
  for (const re of SUBJECTS) if (re.test(text)) score += 1;
  return score;
}

export function selectProgrammeChunks(chunks: EditalChunk[], maxChunks = MAX_CHUNKS) {
  if (chunks.length <= 8) return { selected: chunks, skipped: 0 };
  const scores = chunks.map((c) => chunkScore(c.text));
  let hits = scores.map((score, i) => (score >= 4 ? i : -1)).filter((i) => i >= 0);
  if (!hits.length || hits.every((h) => h <= 1)) {
    const secondary = scores.map((score, i) => (score >= 2 ? i : -1)).filter((i) => i >= 0);
    if (secondary.length) hits = [...new Set([...hits, ...secondary])].sort((a, b) => a - b);
  }
  let indexes: number[];
  if (!hits.length) {
    indexes = chunks.map((_, i) => i);
  } else {
    const first = hits[0];
    let last = Math.min(chunks.length - 1, hits[hits.length - 1] + 1);
    while (last + 1 < chunks.length && scores[last + 1] >= 1 && (last + 1 - first + 1) <= maxChunks) {
      last += 1;
    }
    if (last - first + 1 <= maxChunks) {
      indexes = Array.from({ length: last - first + 1 }, (_, k) => first + k);
    } else {
      const wanted = new Set<number>();
      hits.forEach((i) => { wanted.add(i); if (i + 1 < chunks.length) wanted.add(i + 1); });
      indexes = [...wanted];
    }
  }
  if (indexes.length > maxChunks) {
    indexes = indexes.sort((a, b) => scores[b] - scores[a] || a - b).slice(0, maxChunks);
  }
  indexes.sort((a, b) => a - b);
  return { selected: indexes.map((i) => chunks[i]), skipped: chunks.length - indexes.length };
}

export type ChunkCaller = (prompt: string, timeoutMs: number) => Promise<any | null>;
export type ChunkResult = { index: number; parsed: any };

export async function runChunked(
  chunks: EditalChunk[],
  makePrompt: (chunk: EditalChunk, position: number, total: number) => string,
  caller: ChunkCaller,
  options: { concurrency?: number; deadline: number; perCallMs?: number; now?: () => number },
) {
  const now = options.now ?? Date.now;
  const results: ChunkResult[] = [];
  let failed = 0;
  let notRun = 0;
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const position = cursor++;
      if (position >= chunks.length) return;
      const remaining = options.deadline - now();
      if (remaining < 12000) { notRun++; continue; }
      const timeout = Math.min(options.perCallMs ?? 50000, remaining - 4000);
      let parsed: any = null;
      try { parsed = await caller(makePrompt(chunks[position], position, chunks.length), timeout); } catch { parsed = null; }
      if (parsed && Array.isArray(parsed.topics)) results.push({ index: chunks[position].index, parsed });
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 3, chunks.length)) }, worker));
  results.sort((a, b) => a.index - b.index);
  return { results, failed, notRun };
}

const ADMIN_ONLY = /^(inscri(c|ç)(a|ã)o|cronograma|remunera(c|ç)(a|ã)o|vagas?|isen(c|ç)(a|ã)o|taxa de inscri(c|ç)(a|ã)o|resultado|recursos?|exame m[eé]dico|teste de aptid(a|ã)o f[ií]sica|investiga(c|ç)(a|ã)o social|documentos?|matr[ií]cula|curso de forma(c|ç)(a|ã)o)$/i;

export function splitNumberedTopicBlock(topic: string): string[] {
  const cleanTopic = sanitizeWatermarkText(topic).replace(/\s+/g, " ").trim();
  if (cleanTopic.length <= 140) return [cleanTopic];
  const hasPunct1 = /(?:^|[\s.;:])0?1\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(cleanTopic);
  const hasPunct2 = /[\s.;:]0?2\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(cleanTopic);
  const hasPunct3 = /[\s.;:]0?3\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(cleanTopic);
  if (hasPunct1 && hasPunct2 && hasPunct3) {
    const parts = cleanTopic
      .split(/(?=(?:^|[\s.;:])\d{1,2}\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g)
      .map((p) => p.replace(/^[\s.;:]+|[\s.;]+$/g, "").trim())
      .filter((p) => p.length >= 3);
    if (parts.length >= 3) return parts;
  }
  const hasSpace1 = /(?:^|[\s.;:])1\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/.test(cleanTopic);
  const hasSpace2 = /[\s.;:]2\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/.test(cleanTopic);
  const hasSpace3 = /[\s.;:]3\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/.test(cleanTopic);
  if (hasSpace1 && hasSpace2 && hasSpace3) {
    const parts = cleanTopic
      .split(/(?=(?:^|[\s.;:])\d{1,2}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})/g)
      .map((p) => p.replace(/^[\s.;:]+|[\s.;]+$/g, "").trim())
      .filter((p) => p.length >= 3);
    if (parts.length >= 3) return parts;
  }
  return [cleanTopic];
}

const TOPIC_DISCIPLINE_RULES: Array<{ subject: string; re: RegExp }> = [
  { subject: "Língua Portuguesa", re: /\b(compreensao e interpretacao|tipologia textual|generos textuais|ortografia|coesao|coerencia|morfossintatica|classes de palavras|coordenacao entre oracoes|subordinacao entre oracoes|sinais de pontuacao|concordancia verbal|regencia verbal|indicativo de crase|pronomes atonos|colocacao pronominal|semantica|figuras de linguagem|redacao oficial)\b/i },
  { subject: "Ética no Serviço Público", re: /\b(etica e moral|etica, principios e valores|etica e democracia|etica e funcao publica|etica no setor publico|codigo de etica|decreto n[ºo°]?\s*46[\s.]*852|sindicancias? investigativa)\b/i },
  { subject: "Legislação Estadual", re: /\b(codigo penitenciario do estado de pernambuco|15[\s.]*755\/2016|106\/2007|422\/2019|150\/2009|6[\s.]*123\/1968|regime juridico dos funcionarios publicos civis do estado de pernambuco|policial penal de pernambuco|normas disciplinares dos policiais penais)\b/i },
  { subject: "Informática", re: /\b(sistema operacional|ambientes linux e windows|redes de computadores|intranet|microsoft edge|mozilla firefox|google chrome|correio eletronico|computacao na nuvem|cloud computing|arquivos, pastas e programas|seguranca da informacao|virus, worms|antivirus|firewall|procedimentos de backup|cloud storage)\b/i },
  { subject: "Raciocínio Lógico", re: /\b(estruturas logicas|logica de argumentacao|logica sentencial|proposicoes simples e compostas|tabelas verdade|equivalencias|leis de de morgan|diagramas logicos|logica de primeira ordem|principios de contagem|operacoes com conjuntos|problemas aritmeticos, geometricos e matriciais)\b/i },
  { subject: "Atualidades", re: /\b(topicos relevantes e atuais|seguranca prisional nacional|somente para prova discursiva)\b/i },
  { subject: "Direito Administrativo", re: /\b(estado, governo e administracao publica|direito administrativo\. objeto|ato administrativo|extincao do ato administrativo|cassacao, anulacao, revogacao e convalidacao|decadencia administrativa|agentes publicos.*cargo, emprego e funcao|poderes da administracao publica|hierarquico, disciplinar, regulamentar e de policia|regime juridico-administrativo|responsabilidade civil do estado|servicos publicos.*concessao, permissao|organizacao administrativa.*autarquias, fundacoes|controle da administracao publica|improbidade administrativa|8[\s.]*429\/1992|9[\s.]*784\/1999)\b/i },
  { subject: "Direito Constitucional", re: /\b(constituicao da republica federativa do brasil de 1988|aplicabilidade das normas constitucionais|eficacia plena, contida e limitada|direitos e garantias fundamentais|direitos e deveres individuais e coletivos|organizacao politico-administrativa do estado|poder executivo.*presidente da republica|poder legislativo.*processo legislativo|poder judiciario.*conselho nacional de justica|funcoes essenciais a justica)\b/i },
  { subject: "Direito Processual Penal", re: /\b(disposicoes preliminares do codigo de processo penal|inquerito policial|acao penal|9[\s.]*296\/1996|interceptacao telefonica|juiz, ministerio publico, acusado, defensor|prisao, liberdade provisoria e fianca|crimes de responsabilidade dos funcionarios publicos|habeas corpus e seu processo|aplicaveis ao direito processual penal)\b/i },
  { subject: "Direito Penal", re: /\b(aplicacao da lei penal|lei penal no tempo e no espaco|territorialidade e extraterritorialidade|fato tipico e seus elementos|crime consumado e tentado|ilicitude e causas de exclusao|culpabilidade|imputabilidade penal|concurso de pessoas|crimes contra a pessoa|crimes contra o patrimonio|crimes contra a fe publica|crimes contra a administracao publica|8[\s.]*072\/1990|delitos hediondos|aplicaveis ao direito penal)\b/i },
  { subject: "Direitos Humanos e Participação Social", re: /\b(declaracao universal dos direitos humanos|regras minimas da onu|tratamento de pessoas presas|programa nacional de direitos humanos|7[\s.]*037\/2009|conselhos da comunidade|conselhos penitenciarios|arts\. 62 a 64 da lei de execucao penal)\b/i },
  { subject: "Legislação Especial", re: /\b(12[\s.]*850\/2013|organizacoes criminosas|9[\s.]*613\/1998|lavagem de dinheiro|9[\s.]*455\/1997|antitortura|12[\s.]*846\/2013|anticorrupcao|13[\s.]*869\/2019|abuso de autoridade|10[\s.]*826\/2003|estatuto do desarmamento|11[\s.]*343\/2006|lei de drogas|13[\s.]*964\/2019|lei de execucao penal|sistema penitenciario federal|11[\s.]*671\/2008|atencao integral a saude das pessoas privadas de liberdade|plano estrategico de educacao no ambito do sistema prisional|atencao as mulheres em situacao de privacao de liberdade)\b/i },
  { subject: "Direito Militar", re: /\b(estatuto dos policiais militares|codigo disciplinar dos militares|penal militar|processual penal militar|sunor|lei\s*6[\s.]*783|lei\s*11[\s.]*817)\b/i },
  { subject: "História de Pernambuco", re: /\b(insurreicao pernambucana|revolucao pernambucana|confederacao do equador|revolucao praieira|capitania de pernambuco|guerra dos mascates)\b/i },
  { subject: "Geografia de Pernambuco", re: /\b(mesorregioes de pernambuco|bacias hidrograficas de pernambuco|relevo de pernambuco|agreste e sertao pernambucano)\b/i },
];

export function inferDisciplineFromTopicsBlock(topicsText: string): string {
  const norm = normalizeSearch(topicsText);
  let bestSubject = "";
  let bestHits = 0;
  for (const rule of TOPIC_DISCIPLINE_RULES) {
    const matches = norm.match(new RegExp(rule.re.source, "gi"));
    const count = matches ? matches.length : 0;
    if (count > bestHits) {
      bestHits = count;
      bestSubject = rule.subject;
    }
  }
  return bestSubject;
}

function isSubjectHeaderLine(line: string, nextLine: string, campaignName = "", docTitle = ""): boolean {
  const s = line.replace(/^\s*(?:disciplina|mat[eé]ria)\s*:\s*/i, "").trim();
  if (s.length < 4 || s.length > 88) return false;
  if (/^\d+\s+[a-záéíóúâêôãõç]/.test(s)) return false;
  if (/[.;]$/.test(s)) return false;
  if (isGenericSubjectName(s, campaignName, docTitle)) return false;
  const cleanedHeader = s.replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "").trim();
  if (KNOWN_SUBJECT_HEADER_RE.test(cleanedHeader)) {
    const letters = cleanedHeader.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const upper = cleanedHeader.replace(/[^A-ZÀ-Ý]/g, "");
    if (letters.length >= 4 && upper.length / letters.length >= 0.65) return true;
    if (nextLine && /^(?:0?1|I)(?:\s*$|[.\-)]\s*|\s+[A-ZÀ-Ý])/i.test(nextLine)) return true;
  }
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = s.replace(/[^A-ZÀ-Ý]/g, "");
  if (!/^\d/.test(s) && letters.length >= 5 && upper.length === letters.length && nextLine && /^0?1(?:\s*$|[.\-)]\s+|\s+[A-ZÀ-Ý])/i.test(nextLine)) {
    return true;
  }
  return false;
}

export type MergedTopic = {
  subject: string; unit: string; topic: string; edital_order: number; subject_order: number; learning_order: number;
  difficulty: string; prerequisite_topic: string; pedagogical_reason: string;
};

/**
 * Extrator determinístico para editais verticalizados ou quadros numerados de conteúdo programático.
 * Garante que todas as disciplinas e tópicos numerados sejam extraídos mesmo sem depender da IA.
 */
export function extractStructuredEditalTopics(
  pages: EditalPage[],
  options: { title?: string; campaignName?: string } = {},
): { isVerticalized: boolean; subjectCount: number; topics: MergedTopic[]; meta: any } {
  const campaignName = options.campaignName ?? "";
  const docTitle = options.title ?? "";
  const fullRawText = pages.map((p) => p.text).join("\n");
  const isVerticalizedHint = /verticalizado|ciclo\s*\d+|leitura\s*-\s*letra\s+da\s+lei|acertos\s*\(\%\)/i.test(`${docTitle}\n${fullRawText.slice(0, 4000)}`);

  const allLines: string[] = [];
  for (const p of pages) {
    allLines.push(...cleanEditalPageLines(p.text));
  }

  const rawExtracted: Array<{ subject: string; topic: string }> = [];
  const perSubjectDisplayCount = new Map<string, number>();
  let currentSubject = "";
  let currentTableNum = 0;
  let currentTopicParts: string[] = [];

  const flushTopic = () => {
    if (!currentSubject || !currentTopicParts.length) return;
    const rawBody = sanitizeWatermarkText(currentTopicParts.join(" ").replace(/\s+/g, " ").replace(/-\s+/g, "-").trim());
    currentTopicParts = [];
    if (rawBody.length < 3) return;
    const subKey = normalizeSearch(currentSubject);
    if (ADMIN_ONLY.test(normalizeSearch(rawBody)) || normalizeSearch(rawBody) === subKey) return;
    const pieces = splitNumberedTopicBlock(rawBody);
    for (const piece of pieces) {
      const stripped = piece.replace(/^\d{1,2}\s*(?:[.\-)]\s*|\s+)/, "").trim();
      if (stripped.length < 2) continue;
      const nextCount = (perSubjectDisplayCount.get(subKey) ?? 0) + 1;
      perSubjectDisplayCount.set(subKey, nextCount);
      rawExtracted.push({
        subject: currentSubject,
        topic: `${nextCount}. ${stripped}`,
      });
    }
  };

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const nextLine = allLines[i + 1] ?? "";
    if (isSubjectHeaderLine(line, nextLine, campaignName, docTitle)) {
      flushTopic();
      currentSubject = line
        .replace(/^\s*(?:disciplina|mat[eé]ria)\s*:\s*/i, "")
        .replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "")
        .replace(/\s*:\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      currentTableNum = 0;
      continue;
    }
    if (!currentSubject) continue;

    const standaloneNum = line.match(/^0?(\d{1,2})\s*[.\-)]?$/);
    if (standaloneNum) {
      const n = Number(standaloneNum[1]);
      if (n === currentTableNum + 1 || (currentTableNum === 0 && n === 1)) {
        flushTopic();
        currentTableNum = n;
        continue;
      }
    }

    const inlineNum = line.match(/^0?(\d{1,2})(?:\s*[.\-)]\s*|\s+)([A-ZÀ-Ýa-zà-ÿ].*)$/);
    if (inlineNum) {
      const n = Number(inlineNum[1]);
      const rest = inlineNum[2].trim();
      const isLawContinuation = /^(?:a\s+\d+|de\s+\d+|\d|º|°|da\s+lei|do\s+decreto|do\s+c[oó]digo|da\s+constitui[cç][aã]o|e\s+\d+)/i.test(rest);
      if (!isLawContinuation && (n === currentTableNum + 1 || (currentTableNum === 0 && n === 1))) {
        flushTopic();
        currentTableNum = n;
        currentTopicParts.push(rest);
        continue;
      }
    }

    if (currentTableNum > 0) {
      currentTopicParts.push(line);
    } else if (line.length > 40 && /(?:^|[\s.;:])0?1\s*(?:[.\-)]\s+|\s+)[A-ZÀ-Ý]/.test(line)) {
      currentTableNum = 1;
      currentTopicParts.push(line);
      flushTopic();
    }
  }
  flushTopic();

  const subjectDisplay = new Map<string, string>();
  const subjectOrder = new Map<string, number>();
  const bySubject = new Map<string, Array<{ subject: string; topic: string; subjectKey: string }>>();
  const seen = new Set<string>();

  for (const item of rawExtracted) {
    const subjectKey = normalizeSearch(item.subject);
    if (!subjectDisplay.has(subjectKey)) subjectDisplay.set(subjectKey, item.subject);
    if (!subjectOrder.has(subjectKey)) subjectOrder.set(subjectKey, subjectOrder.size);
    const topicBodyKey = normalizeSearch(item.topic.replace(/^\d+\.\s*/, ""));
    const dedupKey = `${subjectKey}\u0000${topicBodyKey}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const list = bySubject.get(subjectKey) ?? [];
    list.push({ subject: subjectDisplay.get(subjectKey)!, topic: item.topic, subjectKey });
    bySubject.set(subjectKey, list);
  }

  const topics: MergedTopic[] = [];
  let globalIdx = 0;
  for (const [subjectKey, list] of bySubject.entries()) {
    const sOrder = subjectOrder.get(subjectKey) ?? 0;
    list.forEach((entry, lIdx) => {
      const ratio = list.length > 1 ? lIdx / (list.length - 1) : 0;
      const difficulty = ratio < 0.4 ? "basic" : ratio < 0.8 ? "intermediate" : "advanced";
      topics.push({
        subject: entry.subject,
        unit: "",
        topic: entry.topic.slice(0, 700),
        edital_order: globalIdx++,
        subject_order: sOrder,
        learning_order: lIdx,
        difficulty,
        prerequisite_topic: lIdx > 0 ? list[lIdx - 1].topic.slice(0, 700) : "",
        pedagogical_reason: lIdx === 0 ? "Tópico base inicial da disciplina no edital." : "Sequência progressiva direta do edital verticalizado.",
      });
    });
  }

  return {
    isVerticalized: isVerticalizedHint || (bySubject.size >= 3 && topics.length >= 12),
    subjectCount: bySubject.size,
    topics,
    meta: {
      document_kind: isVerticalizedHint ? "edital_verticalizado" : "edital_oficial",
      classification_reason: isVerticalizedHint
        ? "Edital verticalizado estruturado identificado com extração integral de disciplinas e tópicos."
        : "Conteúdo programático estruturado identificado.",
      detected_scope: campaignName || docTitle || "Edital",
      confidence: bySubject.size >= 3 ? 0.96 : 0.88,
      warnings: isVerticalizedHint
        ? ["Edital verticalizado aceito como base do mapa. Confira os tópicos com o edital oficial quando ele estiver disponível."]
        : [],
    },
  };
}

/** Junta os resultados dos trechos, remove duplicatas, desdobra disciplinas agrupadas sob rótulo genérico e recalcula as ordens globais. */
export function mergeChunkResults(results: ChunkResult[], maxTopics = 4000, context: { campaignName?: string; docTitle?: string } = {}) {
  const campaignName = context.campaignName ?? "";
  const docTitle = context.docTitle ?? "";
  const subjectDisplay = new Map<string, string>();
  const seen = new Set<string>();
  const raw: Array<MergedTopic & { chunk: number; modelOrder: number; seq: number; subjectKey: string }> = [];
  const kinds: string[] = [];
  const confidences: number[] = [];
  const warnings: string[] = [];
  let reason = "";
  let scope = "";
  let seq = 0;

  const allItems = results.flatMap((r) => (Array.isArray(r.parsed?.topics) ? r.parsed.topics : []));
  const nonGenericSubjects = new Set(
    allItems
      .map((it: any) => String(it?.subject ?? "").trim())
      .filter((s: string) => s && !isGenericSubjectName(s, campaignName, docTitle))
      .map((s: string) => normalizeSearch(s)),
  );
  const distinctRawUnits = new Set(
    allItems
      .map((it: any) => String(it?.unit ?? it?.unit_name ?? "").trim())
      .filter((u: string) => u.length >= 3 && !isGenericSubjectName(u, campaignName, docTitle))
      .map((u: string) => normalizeSearch(u)),
  );
  const promoteUnitGlobally = nonGenericSubjects.size <= 1 && distinctRawUnits.size >= 2;

  const flatExpanded: Array<{ chunk: number; item: any; piece: string }> = [];
  for (const { index, parsed } of results) {
    const meta = parsed?.meta ?? {};
    const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    if (topics.length) {
      const kind = String(meta.document_kind ?? "").toLowerCase().trim();
      if (kind) kinds.push(kind);
      const conf = Number(meta.confidence);
      if (Number.isFinite(conf)) confidences.push(Math.max(0, Math.min(1, conf)));
      if (!reason && meta.classification_reason) reason = String(meta.classification_reason).trim();
      if (!scope && meta.detected_scope) scope = String(meta.detected_scope).trim();
      if (Array.isArray(meta.warnings)) for (const w of meta.warnings) { const t = String(w).trim(); if (t && !warnings.includes(t)) warnings.push(t); }
    }
    for (const item of topics) {
      const rawTopic = sanitizeWatermarkText(item?.topic ?? item?.name ?? "");
      if (rawTopic.length < 3) continue;
      for (const piece of splitNumberedTopicBlock(rawTopic)) {
        if (piece.length >= 3) flatExpanded.push({ chunk: index, item, piece });
      }
    }
  }

  const inferredBlockSubjects = new Map<number, string>();
  if (nonGenericSubjects.size <= 1 && !promoteUnitGlobally && flatExpanded.length >= 4) {
    const blocks: Array<number[]> = [];
    let currentBlock: number[] = [];
    let prevNum = 0;
    let explicitHeaderSubject = "";
    for (let i = 0; i < flatExpanded.length; i++) {
      const piece = flatExpanded[i].piece.trim();
      if (KNOWN_SUBJECT_HEADER_RE.test(piece) && piece.length <= 80 && !/^\d/.test(piece)) {
        explicitHeaderSubject = piece;
        inferredBlockSubjects.set(i, "__SKIP_HEADER__");
        continue;
      }
      if (explicitHeaderSubject) {
        inferredBlockSubjects.set(i, explicitHeaderSubject);
        continue;
      }
      const numMatch = piece.match(/^0?(\d{1,2})(?:\s*[.\-)]\s*|\s+)/);
      const num = numMatch ? Number(numMatch[1]) : 0;
      if (currentBlock.length > 0 && num === 1 && prevNum >= 1) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      currentBlock.push(i);
      if (num > 0) prevNum = num;
    }
    if (currentBlock.length) blocks.push(currentBlock);
    for (const b of blocks) {
      const combinedText = b.map((idx) => flatExpanded[idx].piece).join(" \n ");
      const bSubj = inferDisciplineFromTopicsBlock(combinedText);
      if (bSubj) {
        for (const idx of b) inferredBlockSubjects.set(idx, bSubj);
      } else {
        for (const idx of b) {
          const singleSubj = inferDisciplineFromTopicsBlock(flatExpanded[idx].piece);
          if (singleSubj) inferredBlockSubjects.set(idx, singleSubj);
        }
      }
    }
  }

  let lastValidSubject = "";
  for (let i = 0; i < flatExpanded.length; i++) {
    const { chunk: index, item, piece } = flatExpanded[i];
    const blockHint = inferredBlockSubjects.get(i) ?? "";
    if (blockHint === "__SKIP_HEADER__") continue;

    let subject = sanitizeWatermarkText(item?.subject ?? "").slice(0, 200);
    let unit = sanitizeWatermarkText(item?.unit ?? item?.unit_name ?? "");
    let rawTopic = piece;

    if ((promoteUnitGlobally || isGenericSubjectName(subject, campaignName, docTitle)) && unit && !isGenericSubjectName(unit, campaignName, docTitle)) {
      subject = unit;
      unit = "";
    } else if (blockHint) {
      subject = blockHint;
    } else if (isGenericSubjectName(subject, campaignName, docTitle) || nonGenericSubjects.size <= 1) {
      const prefixMatch = rawTopic.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s\-\/()]{2,60}?)\s*(?::|\s[–—-]\s)\s*(.+)$/);
      if (prefixMatch && !/^\d/.test(prefixMatch[1]) && !isGenericSubjectName(prefixMatch[1], campaignName, docTitle) && (KNOWN_SUBJECT_HEADER_RE.test(prefixMatch[1].trim()) || SUBJECTS.some((re) => re.test(prefixMatch[1])))) {
        subject = prefixMatch[1].trim();
        rawTopic = prefixMatch[2].trim();
      } else {
        const inferredSingle = inferDisciplineFromTopicsBlock(rawTopic);
        if (inferredSingle) subject = inferredSingle;
        else if (isGenericSubjectName(subject, campaignName, docTitle) && lastValidSubject) subject = lastValidSubject;
      }
    }

    if (!subject || isGenericSubjectName(subject, campaignName, docTitle)) {
      subject = lastValidSubject || sanitizeWatermarkText(item?.subject ?? "") || "Edital";
    } else {
      lastValidSubject = subject;
    }

    const topic = rawTopic.slice(0, 700).trim();
    if (topic.length < 3) continue;
    const subjectKey = normalizeSearch(subject);
    if (subjectKey === normalizeSearch(topic)) continue;
    if (ADMIN_ONLY.test(normalizeSearch(topic))) continue;
    if (!subjectDisplay.has(subjectKey)) subjectDisplay.set(subjectKey, subject);
    const finalSubject = subjectDisplay.get(subjectKey)!;
    const key = `${subjectKey}\u0000${normalizeSearch(topic)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const difficulty = ["basic", "intermediate", "advanced"].includes(String(item?.difficulty)) ? String(item.difficulty) : "basic";
    raw.push({
      subject: finalSubject, unit, topic, edital_order: 0, subject_order: 0, learning_order: 0,
      difficulty, prerequisite_topic: String(item?.prerequisite_topic ?? "").replace(/\s+/g, " ").trim(),
      pedagogical_reason: String(item?.pedagogical_reason ?? "").trim().slice(0, 500),
      chunk: index, modelOrder: Math.max(0, Number(item?.learning_order) || 0), seq: seq++, subjectKey,
    });
  }

  const limited = raw.slice(0, maxTopics);
  const subjectOrder = new Map<string, number>();
  limited.forEach((t) => { if (!subjectOrder.has(t.subjectKey)) subjectOrder.set(t.subjectKey, subjectOrder.size); });
  const bySubject = new Map<string, typeof limited>();
  limited.forEach((t) => { const list = bySubject.get(t.subjectKey) ?? []; list.push(t); bySubject.set(t.subjectKey, list); });
  for (const list of bySubject.values()) {
    [...list].sort((a, b) => a.chunk - b.chunk || a.modelOrder - b.modelOrder || a.seq - b.seq).forEach((t, i) => { t.learning_order = i; });
    const titles = new Set(list.map((t) => normalizeSearch(t.topic)));
    for (const t of list) {
      if (t.prerequisite_topic && (!titles.has(normalizeSearch(t.prerequisite_topic)) || normalizeSearch(t.prerequisite_topic) === normalizeSearch(t.topic))) t.prerequisite_topic = "";
    }
  }
  const topics: MergedTopic[] = limited.map((t, i) => ({
    subject: t.subject, unit: t.unit, topic: t.topic, edital_order: i, subject_order: subjectOrder.get(t.subjectKey) ?? 0,
    learning_order: t.learning_order, difficulty: t.difficulty, prerequisite_topic: t.prerequisite_topic, pedagogical_reason: t.pedagogical_reason,
  }));

  const officialKinds = ["edital_oficial", "edital_verticalizado", "edital_concurso"];
  const kind = officialKinds.find((k) => kinds.includes(k)) ?? (kinds.find((k) => k !== "material_estudo") ?? kinds[0] ?? "");
  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0.85;
  return {
    topics,
    truncatedByLimit: raw.length > maxTopics,
    meta: {
      document_kind: kind, classification_reason: reason || "Conteúdo programático identificado.",
      detected_scope: scope, confidence, warnings: warnings.slice(0, 10),
    },
  };
}
