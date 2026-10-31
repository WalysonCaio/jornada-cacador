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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 34000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const PUBLISHABLE_KEY = "sb_publishable_IcHLyErTCzshPU3JHRccVg_jLKY_yxw";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const FALLBACK_STATUS = new Set([400, 404]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const modelDiscovery = new Map<string, Promise<string[]>>();

async function availableGeminiModels(geminiKey: string): Promise<string[]> {
  if (modelDiscovery.has(geminiKey)) return modelDiscovery.get(geminiKey)!;
  const discovery = (async () => {
    const configured = String(Deno.env.get("GEMINI_MODEL") ?? "").replace(/^models\//, "").trim();
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": geminiKey } });
      const data = await response.json().catch(() => ({}));
      const blocked = /(embedding|imagen|veo|tts|audio|live|robotics|computer-use|gemma|learnlm|aqa)/i;
      const names = Array.isArray(data?.models)
        ? data.models
            .filter((item: any) => item?.supportedGenerationMethods?.includes("generateContent"))
            .map((item: any) => String(item?.name ?? "").replace(/^models\//, "").trim())
            .filter((name: string) => name && !blocked.test(name))
            .sort((a: string, b: string) => {
              const score = (name: string) =>
                (name === "gemini-2.5-flash" ? 0 : name === "gemini-2.5-flash-lite" ? 1 : /flash(?!.*lite)/i.test(name) ? 2 : /flash-lite/i.test(name) ? 3 : /pro/i.test(name) ? 4 : 5) +
                (/preview|experimental|exp/i.test(name) ? 6 : 0);
              return score(a) - score(b) || a.localeCompare(b);
            })
        : [];
      const preferred = [
        configured && names.includes(configured) ? configured : "",
        ...FALLBACK_MODELS.filter((m) => names.includes(m)),
        ...names,
        ...(names.length === 0 ? [configured, ...FALLBACK_MODELS] : []),
      ].filter(Boolean);
      const unique = [...new Set(preferred)].slice(0, 5);
      if (!unique.length) throw new Error(data?.error?.message || "Nenhum modelo generateContent liberado.");
      console.log("Gemini edital models", unique);
      return unique;
    } catch (error) {
      modelDiscovery.delete(geminiKey);
      console.error("Gemini model discovery", String((error as Error)?.message ?? error));
      const fallback = [...new Set([configured, ...FALLBACK_MODELS].filter(Boolean))];
      if (fallback.length) return fallback;
      throw new Error("A chave Gemini não possui um modelo disponível para analisar o edital.");
    }
  })();
  modelDiscovery.set(geminiKey, discovery);
  return discovery;
}

function parseGeminiJsonText(data: any) {
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.filter((part: any) => !part?.thought)
    : [];
  const raw = String((parts.length ? parts : data?.candidates?.[0]?.content?.parts || []).map((part: any) => part?.text || "").join("") ?? "").trim();
  if (!raw) throw new Error("EMPTY_GEMINI_RESPONSE");
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(unfenced.slice(start, end + 1)); } catch {}
    }
    const arrIdx = unfenced.search(/"topics"\s*:\s*\[/);
    if (arrIdx >= 0) {
      const openB = unfenced.indexOf("[", arrIdx);
      let depth = 0, inStr = false, esc = false, lastEnd = -1;
      for (let i = openB + 1; i < unfenced.length; i++) {
        const ch = unfenced[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) lastEnd = i; }
      }
      if (lastEnd > openB) {
        try {
          const topicsArr = JSON.parse(`[${unfenced.slice(openB + 1, lastEnd + 1)}]`);
          return { _partial: true, meta: { document_kind: "edital_oficial", classification_reason: "Recuperado de JSON parcial", detected_scope: "Edital", confidence: 0.85, warnings: ["A resposta da IA foi cortada; parte final recuperada automaticamente."] }, topics: topicsArr };
        } catch {}
      }
    }
    throw new Error("INVALID_GEMINI_JSON");
  }
}

async function setDocumentStatus(documentId: string, userId: string, processingStatus: "pending" | "processing" | "ready" | "error") {
  if (!documentId || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ processing_status: processingStatus }),
  }).catch(() => undefined);
}

async function saveEditalCoverage(documentId: string, userId: string, info: { percent: number; topics: number; pages: number; needsReview: boolean; warnings: string[] }) {
  if (!documentId || !userId) return;
  const base = `${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`;
  const auth = { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY };
  try {
    const current = await fetch(`${base}&select=metadata`, { headers: auth });
    const rows = current.ok ? await current.json().catch(() => []) : [];
    const metadata = rows?.[0]?.metadata && typeof rows[0].metadata === "object" ? rows[0].metadata : {};
    await fetch(base, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { ...metadata, coverage: { percent: info.percent, summary_count: info.topics, estimated_pages: info.pages, needs_review: info.needsReview, warnings: info.warnings.slice(0, 5) } } }),
    });
  } catch { /* informativo: não deve derrubar a análise */ }
}

const ALLOWED_ORIGINS = new Set([
  "https://jornada.wcaio.workers.dev",
  "http://localhost:4173",
  "http://localhost:3000",
]);

function headers(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jornada.wcaio.workers.dev",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function pdfInlinePart(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return { inline_data: { mime_type: "application/pdf", data: btoa(binary) } };
}

async function uploadPdfToGemini(bytes: Uint8Array, title: string, geminiKey: string) {
  const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: title } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`Falha ao iniciar envio ao Gemini (${start.status}).`);

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  const data = await uploaded.json().catch(() => ({}));
  if (!uploaded.ok || !data?.file?.uri) throw new Error(data?.error?.message ?? `Falha ao enviar PDF ao Gemini (${uploaded.status}).`);
  const file = data.file as { uri: string; name?: string; mimeType?: string; state?: string; error?: { message?: string } };
  if (!file.name) return file;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (String(file.state || "").toUpperCase() === "ACTIVE") return file;
    if (String(file.state || "").toUpperCase() === "FAILED") {
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(file.error?.message || "O Gemini não conseguiu preparar o edital.");
    }
    await wait(1500);
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": geminiKey } });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      if (RETRYABLE_STATUS.has(statusResponse.status)) continue;
      await removeGeminiFile(file.name, geminiKey);
      throw new Error(statusData?.error?.message || `Falha ao consultar o edital no Gemini (${statusResponse.status}).`);
    }
    Object.assign(file, statusData);
  }
  await removeGeminiFile(file.name, geminiKey);
  throw new Error("O Gemini demorou demais para preparar o edital. Tente novamente em alguns minutos.");
}

async function removeGeminiFile(name?: string, geminiKey = GEMINI_API_KEY) {
  if (!name) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": geminiKey },
  }).catch(() => undefined);
}

async function releaseStaleLocks(userId: string) {
  const cutoff = new Date(Date.now() - 170 * 1000).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?user_id=eq.${encodeURIComponent(userId)}&status=eq.started&created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "error", error_code: "STALE_RELEASED" }),
  }).catch(() => undefined);
}

async function loadEditalPages(storagePath: string, inlinePayload?: any): Promise<{ pages: EditalPage[]; pdfTotalPages: number; truncatedPages: boolean }> {
  let inline: EditalPage[] = [];
  if (Array.isArray(inlinePayload?.extracted_pages) && inlinePayload.extracted_pages.length) inline = normalizePages(inlinePayload.extracted_pages);
  if (!inline.length && typeof inlinePayload?.extracted_text === "string") inline = pagesFromMarkedText(inlinePayload.extracted_text);
  let stored: EditalPage[] = [];
  let pdfTotalPages = Number(inlinePayload?.pdf_total_pages) || 0;
  let truncatedPages = Boolean(inlinePayload?.truncated_pages);
  const result = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}.text.json`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  }).catch(() => null);
  if (result?.ok) {
    const payload = await result.json().catch(() => null);
    stored = normalizePages(payload?.pages);
    pdfTotalPages = Number(payload?.pdf_total_pages) || pdfTotalPages;
    if (payload?.truncated_pages) truncatedPages = true;
  }
  // Usa a versão mais completa (o arquivo salvo no Storage ou o que o navegador enviou).
  const best = totalChars(stored) >= totalChars(inline) ? stored : inline;
  if (totalChars(best) < 120) return { pages: [], pdfTotalPages, truncatedPages };
  return { pages: best, pdfTotalPages, truncatedPages };
}

async function reserveUsage(userId: string, campaignId: string, dailyLimit = 10) {
  await releaseStaleLocks(userId);
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reserve_ai_usage`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_campaign_id: campaignId, p_operation: "edital", p_daily_limit: dailyLimit }) });
  return result.ok ? await result.json() : { allowed: false, reason: "USAGE_GUARD_UNAVAILABLE" };
}

async function finishUsage(eventId: number | undefined, status: "success" | "error", errorCode?: string, model = "gemini-2.5-flash") {
  if (!eventId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_usage_events?id=eq.${eventId}`, { method: "PATCH", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ status, provider: "gemini", model, error_code: errorCode || null }) }).catch(() => undefined);
}

function extractSecretString(raw: unknown): string {
  if (typeof raw === "string") return raw.replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim();
  if (Array.isArray(raw) && raw[0]) return extractSecretString(raw[0]);
  if (raw && typeof raw === "object") {
    const val = (raw as Record<string, unknown>).get_user_ai_secret ?? (raw as Record<string, unknown>).decrypted_secret ?? "";
    return typeof val === "string" ? val.replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim() : "";
  }
  return "";
}

async function userGeminiKey(userId: string) {
  const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_ai_secret`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_user_id: userId, p_provider: "gemini" }) }).catch(() => null);
  if (!result?.ok) return "";
  return extractSecretString(await result.json().catch(() => ""));
}

Deno.serve(async (request) => {
  const deadline = Date.now() + 115000; // Edge Functions encerram por volta de 150 s
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  if (request.method !== "POST") return reply(request, { error: "Método não permitido." }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { "Authorization": authorization, "apikey": PUBLISHABLE_KEY } });
  const user = userResponse.ok ? await userResponse.json() : null;
  if (!user?.id) return reply(request, { error: "Sessão inválida. Entre novamente." }, 401);
  const personalGeminiKey = await userGeminiKey(user.id);
  const activeGeminiKey = personalGeminiKey || GEMINI_API_KEY;
  if (!activeGeminiKey) return reply(request, { error: "Configure sua chave Gemini em Minha conta → Configurar minha IA." }, 503);

  const payload = await request.json().catch(() => null);
  const storagePath = String(payload?.storage_path ?? "");
  const campaignId = String(payload?.campaign_id ?? "");
  const documentId = String(payload?.document_id ?? "");
  const title = String(payload?.title ?? "Edital enviado");
  if (!storagePath || !campaignId || !documentId) {
    console.error("Campos ausentes", { storagePath: !!storagePath, campaignId: !!campaignId, documentId: !!documentId });
    return reply(request, { error: "O aplicativo não enviou todos os dados do documento." }, 400);
  }
  if (!storagePath.startsWith(`${user.id}/`)) return reply(request, { error: "Este documento não pertence à conta conectada." }, 403);

  let geminiFileName: string | undefined;
  let geminiFileKey = activeGeminiKey;
  let usage: { allowed?: boolean; event_id?: number; reason?: string; limit?: number } | null = null;
  let selectedModel = "gemini-2.5-flash";
  let usedKeySource: "personal" | "shared" = personalGeminiKey ? "personal" : "shared";
  try {
    const campaignResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_campaigns?id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,name&limit=1`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    const campaigns = campaignResponse.ok ? await campaignResponse.json() : [];
    if (!Array.isArray(campaigns) || !campaigns[0]?.id) return reply(request, { error: "Este portal não pertence à conta conectada." }, 403);
    const documentResponse = await fetch(`${SUPABASE_URL}/rest/v1/study_documents?id=eq.${encodeURIComponent(documentId)}&campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,document_type,storage_path&limit=1`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    const documents = documentResponse.ok ? await documentResponse.json() : [];
    const document = Array.isArray(documents) ? documents[0] : null;
    if (!document || !["edital", "edital_concurso"].includes(String(document.document_type)) || document.storage_path !== storagePath) {
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: "O arquivo não está registrado como edital deste portal." }, 422);
    }
    usage = await reserveUsage(user.id, campaignId, personalGeminiKey ? 40 : 15);
    if (!usage.allowed) {
      await setDocumentStatus(documentId, user.id, "pending");
      if (usage.reason === "DAILY_LIMIT") return reply(request, { error: `Você atingiu o limite diário de ${usage.limit || (personalGeminiKey ? 40 : 15)} análises de arquivo concluídas. O edital está salvo e poderá ser processado após a renovação da cota.`, retryable: true, code: "DAILY_LIMIT" }, 429);
      if (usage.reason === "BUSY") return reply(request, { error: "Já existe um PDF sendo analisado. Este edital continuará aguardando na fila.", retryable: true, queued: true, code: "BUSY" }, 409);
      return reply(request, { error: "A proteção de consumo está temporariamente indisponível.", retryable: true }, 503);
    }
    const campaignName = String(payload?.campaign_name ?? campaigns[0]?.name ?? "").trim();
    const editalLoad = await loadEditalPages(storagePath, payload);
    const editalPages = editalLoad.pages;
    const structured = extractStructuredEditalTopics(editalPages, { title, campaignName });
    let bytes: Uint8Array | null = null;
    const ensurePdfBytes = async (): Promise<Uint8Array | Response> => {
      if (bytes) return bytes;
      const fileResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${storagePath}`, { headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
      if (!fileResponse.ok) {
        await finishUsage(usage?.event_id, "error", "FILE_READ_FAILED");
        await setDocumentStatus(documentId, user.id, "error");
        return reply(request, { error: "Não foi possível abrir o PDF armazenado." }, 502);
      }
      const loaded = new Uint8Array(await fileResponse.arrayBuffer());
      if (loaded.byteLength > 50 * 1024 * 1024) {
        await finishUsage(usage?.event_id, "error", "FILE_TOO_LARGE");
        await setDocumentStatus(documentId, user.id, "error");
        return reply(request, { error: "O edital deve ter no máximo 50 MB para análise." }, 413);
      }
      bytes = loaded;
      return bytes;
    };

    const promptText = `Você é um analista de editais de concursos públicos brasileiros. Analise exclusivamente o PDF anexado e extraia o conteúdo programático que realmente gera matérias de estudo e missões.

Portal do estudante: ${campaignName || "não informado"}
Nome do arquivo: ${title}

REGRAS OBRIGATÓRIAS:
1. Localize primeiro as seções intituladas Conteúdo Programático, Conhecimentos Gerais, Conhecimentos Específicos, Objetos de Avaliação ou equivalentes.
2. Se o PDF possuir vários cargos, use somente o cargo que corresponda ao nome do portal ou do arquivo. Se não for possível identificar com segurança, registre um aviso em meta.warnings; não misture silenciosamente cargos diferentes.
3. ATENÇÃO CRÍTICA SOBRE DISCIPLINAS (subject): subject DEVE ser o nome individual de cada matéria/disciplina (ex.: "Língua Portuguesa", "Raciocínio Lógico-Matemático", "Informática", "História de Pernambuco", "Direito Constitucional", "Direito Administrativo", "Direito Penal", "Direito Processual Penal", "Legislação Extravagante"). NUNCA agrupe várias disciplinas sob um único subject genérico como "Conhecimentos Gerais", "Conhecimentos Básicos", "Conhecimentos Específicos", "Conteúdo Programático", "Edital" ou o nome do cargo. Cada disciplina do edital precisa ter seu próprio subject separado.
4. unit representa apenas bloco intermediário dentro daquela disciplina quando existir. Se o edital tiver "Conhecimentos Gerais > Língua Portuguesa", o subject é "Língua Portuguesa" (e NÃO "Conhecimentos Gerais").
5. topic deve ser um item de estudo atômico e fiel. Separe enumerações apenas quando o próprio edital apresentar conteúdos distintos; preserve artigos, leis, decretos, intervalos e qualificadores.
6. Não transforme título de disciplina em tópico e não crie subassuntos ausentes.
7. Ignore inscrições, vagas, cotas, salários, datas, etapas, TAF, exames médicos, recursos, documentação e demais regras administrativas, salvo quando fizerem parte expressa de uma disciplina cobrada.
8. Preserve em edital_order a ordem original, mas organize learning_order como um professor planejando um currículo: fundamentos e pré-requisitos antes de aplicações e conteúdos avançados. Dentro de cada disciplina, cada etapa deve preparar a próxima.
9. Não use conhecimento externo e não complete texto truncado por suposição.
10. subject_order define a rotação das disciplinas; learning_order começa em 0 dentro de cada disciplina; difficulty é basic, intermediate ou advanced; prerequisite_topic deve conter o título exato de outro tópico retornado na mesma disciplina, ou string vazia; pedagogical_reason explica brevemente por que aquela posição facilita a aprendizagem.
11. Antes de extrair, classifique document_kind como edital_oficial, edital_verticalizado, material_estudo ou outro.
12. edital_oficial é o documento normativo de abertura do concurso. edital_verticalizado é uma organização fiel do conteúdo programático de um edital, normalmente separada por disciplinas, tópicos ou itens de acompanhamento. AMBOS SÃO FONTES VÁLIDAS para criar o mapa e as missões. Não rejeite um PDF apenas por ser verticalizado ou por não conter inscrições, vagas e regras administrativas.
13. Somente classifique como material_estudo quando o documento for apostila, aula, livro, resumo explicativo ou lei isolada, sem funcionar como lista do conteúdo programático do concurso.
14. Em meta, informe detected_scope, confidence de 0 a 1 e warnings objetivos. Se for verticalizado, avise que ele é uma fonte derivada e deve ser conferido com o edital oficial, mas extraia todos os tópicos normalmente.

Retorne somente o JSON solicitado no formato {"meta":{"document_kind":"edital_oficial","classification_reason":"...","detected_scope":"...","confidence":0.95,"warnings":[]},"topics":[{"subject":"...","unit":"...","topic":"...","subject_order":0,"learning_order":0,"difficulty":"basic","prerequisite_topic":"","pedagogical_reason":"..."}]}.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        meta: { type: "OBJECT", properties: { document_kind: { type: "STRING", enum: ["edital_oficial", "edital_verticalizado", "material_estudo", "outro"] }, classification_reason: { type: "STRING" }, detected_scope: { type: "STRING" }, confidence: { type: "NUMBER" }, warnings: { type: "ARRAY", items: { type: "STRING" } } }, required: ["document_kind", "classification_reason", "detected_scope", "confidence", "warnings"] },
        topics: { type: "ARRAY", items: { type: "OBJECT", properties: { subject: { type: "STRING" }, unit: { type: "STRING" }, topic: { type: "STRING" }, subject_order: { type: "INTEGER" }, learning_order: { type: "INTEGER" }, difficulty: { type: "STRING", enum: ["basic", "intermediate", "advanced"] }, prerequisite_topic: { type: "STRING" }, pedagogical_reason: { type: "STRING" } }, required: ["subject", "topic", "subject_order", "learning_order", "difficulty", "prerequisite_topic", "pedagogical_reason"] } },
      },
      required: ["meta", "topics"],
    };

    const keysToTry: Array<{ key: string; source: "personal" | "shared" }> = [];
    if (personalGeminiKey) keysToTry.push({ key: personalGeminiKey, source: "personal" });
    if (GEMINI_API_KEY && GEMINI_API_KEY !== personalGeminiKey) keysToTry.push({ key: GEMINI_API_KEY, source: "shared" });

    let parsed: any = null;
    let lastStatus = 502;
    let lastErrorMessage = "O Gemini não conseguiu analisar o edital.";
    let providerUsed = "gemini";

    // ── Análise por trechos: TODAS as páginas são lidas; nada é amostrado ou cortado ──
    const allChunks = buildChunks(editalPages);
    const { selected: selectedChunks, skipped: skippedChunks } = selectProgrammeChunks(allChunks);
    const contextHead = editalPages.slice(0, 2).map((p) => p.text).join("\n").slice(0, 2500);
    const chunkBasePrompt = promptText.replace("Analise exclusivamente o PDF anexado", "Analise exclusivamente o texto fornecido");
    const makeChunkPrompt = (chunk: { pageStart: number; pageEnd: number; text: string }, position: number, total: number) => `${chunkBasePrompt}

ANÁLISE POR TRECHOS:
- Este é o trecho ${position + 1} de ${total} do edital, cobrindo as páginas ${chunk.pageStart} a ${chunk.pageEnd}. Os demais trechos são analisados separadamente.
- Extraia TODAS as disciplinas e TODOS os tópicos de conteúdo programático que aparecem neste trecho, sem omitir nenhuma matéria e sem parar na primeira tabela.
- Se o trecho só tiver regras administrativas, devolva {"meta":{"document_kind":"edital_oficial","classification_reason":"Trecho sem conteúdo programático","detected_scope":"","confidence":0.5,"warnings":[]},"topics":[]}.
- Se uma disciplina começar no trecho anterior ou continuar no seguinte, use o nome exato da disciplina como aparece e extraia apenas os itens presentes aqui.
- Mantenha cada item completo e literal; não resuma listas nem junte vários itens em um só.${position > 0 ? `

INÍCIO DO EDITAL (apenas para identificar concurso e cargo):
${contextHead}` : ""}

TEXTO DO TRECHO:
${chunk.text}`;

    const geminiChunkCaller = (key: string, models: string[]): ChunkCaller => async (prompt, timeoutMs) => {
      const started = Date.now();
      for (let mIdx = 0; mIdx < Math.min(2, models.length); mIdx++) {
        for (const useSchema of [true, false]) {
          const left = timeoutMs - (Date.now() - started);
          if (left < 8000) return null;
          selectedModel = models[mIdx];
          const resp = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models[mIdx])}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json", ...(useSchema ? { responseSchema } : {}) },
            }),
          }, left);
          if (!resp) { lastStatus = 504; continue; }
          if (!resp.ok) {
            lastStatus = resp.status;
            lastErrorMessage = `O Gemini não conseguiu analisar o edital (${resp.status}).`;
            if (resp.status === 429 || resp.status === 503) await wait(2500);
            continue;
          }
          try {
            const data = await resp.json();
            const result = parseGeminiJsonText(data);
            if (result && Array.isArray(result.topics)) {
              if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") result._partial = true;
              return result;
            }
          } catch { /* tenta a próxima variação */ }
        }
      }
      return null;
    };

    const buildChunkedParsed = (run: { results: Array<{ index: number; parsed: any }>; failed: number; notRun: number }) => {
      if (!run.results.length) return null;
      const merged = mergeChunkResults(run.results, 4000, { campaignName, docTitle: title });
      if (!merged.topics.length) return null;
      const missing = run.failed + run.notRun;
      const partialChunks = run.results.filter((r) => r.parsed?._partial).length;
      const warnings = [...merged.meta.warnings];
      if (editalLoad.truncatedPages) warnings.unshift(`O PDF tem ${editalLoad.pdfTotalPages || "mais"} páginas e só as primeiras ${editalPages.length} com texto foram lidas. O restante do edital não entrou no mapa.`);
      if (partialChunks > 0) warnings.unshift(`${partialChunks} trecho(s) tiveram a resposta da IA cortada; alguns tópicos podem estar ausentes.`);
      if (missing > 0) warnings.unshift(`Análise parcial: ${missing} de ${selectedChunks.length} trechos do edital não puderam ser lidos. Reprocesse o edital para completar o mapa.`);
      if (merged.truncatedByLimit) warnings.push("O edital tem mais tópicos do que o limite de 4000 do mapa; os últimos foram ignorados.");
      return {
        meta: { ...merged.meta, warnings: warnings.slice(0, 10) },
        topics: merged.topics,
        _coverage: {
          pdf_total_pages: editalLoad.pdfTotalPages || editalPages.length,
          pages_with_text: editalPages.length,
          chunks_total: allChunks.length,
          chunks_selected: selectedChunks.length,
          chunks_ok: run.results.length,
          chunks_failed: run.failed,
          chunks_not_run: run.notRun,
          chunks_partial: partialChunks,
          chunks_skipped: skippedChunks,
          incomplete: missing > 0 || partialChunks > 0 || merged.truncatedByLimit || editalLoad.truncatedPages,
        },
      };
    };

    if (structured.isVerticalized && structured.subjectCount >= 3 && structured.topics.length >= 12) {
      parsed = {
        meta: structured.meta,
        topics: structured.topics,
        _coverage: {
          pdf_total_pages: editalLoad.pdfTotalPages || editalPages.length,
          pages_with_text: editalPages.length,
          chunks_total: Math.max(1, allChunks.length),
          chunks_selected: Math.max(1, selectedChunks.length),
          chunks_ok: Math.max(1, selectedChunks.length),
          chunks_failed: 0,
          chunks_not_run: 0,
          chunks_partial: 0,
          chunks_skipped: 0,
          incomplete: Boolean(editalLoad.truncatedPages),
          mode: "structured_vertical",
        },
      };
      providerUsed = "structured-vertical";
    }

    keyLoop: for (const candidateKey of (parsed ? [] : keysToTry)) {
      geminiFileKey = candidateKey.key;
      usedKeySource = candidateKey.source;
      const models = await availableGeminiModels(candidateKey.key);

      // 1ª Tentativa: texto extraído no navegador, analisado em trechos (todas as páginas, sem amostragem)
      let partialChunkAttempt: any = null;
      if (selectedChunks.length) {
        const caller = geminiChunkCaller(candidateKey.key, models);
        const run = await runChunked(selectedChunks, makeChunkPrompt, caller, { concurrency: 2, deadline });
        // Se alguns trechos falharam (ex.: limite de taxa temporário) e ainda há tempo, tenta novamente em sequência
        if (run.failed > 0 && deadline - Date.now() > 16000) {
          await wait(1200);
          const succeededIndexes = new Set(run.results.map((r) => r.index));
          const missingChunks = selectedChunks.filter((c) => !succeededIndexes.has(c.index));
          if (missingChunks.length) {
            const retryRun = await runChunked(missingChunks, (c, pos) => makeChunkPrompt(c, selectedChunks.findIndex((x) => x.index === c.index), selectedChunks.length), caller, { concurrency: 1, deadline });
            if (retryRun.results.length) {
              run.results.push(...retryRun.results);
              run.results.sort((a, b) => a.index - b.index);
              run.failed = Math.max(0, run.failed - retryRun.results.length);
            }
          }
        }
        const attempt = buildChunkedParsed(run);
        if (attempt) {
          const subjectCount = new Set((attempt.topics || []).map((t: any) => normalizeSearch(t.subject))).size;
          const minRequiredSubjects = structured.subjectCount >= 2 ? Math.min(structured.subjectCount, 3) : 2;
          if (subjectCount >= minRequiredSubjects && (!structured.topics.length || attempt.topics.length >= structured.topics.length * 0.75)) {
            parsed = attempt;
            break keyLoop;
          }
          partialChunkAttempt = attempt;
        }
      }

      // 2ª Tentativa: leitura multimodal nativa do PDF no Gemini (baixa o PDF somente agora se necessário)
      if (deadline - Date.now() < 45000) {
        lastStatus = 504;
        lastErrorMessage = "O tempo limite da análise foi atingido antes da leitura visual do PDF. Tente novamente.";
        break;
      }
      const loadedOrReply = await ensurePdfBytes();
      if (loadedOrReply instanceof Response) return loadedOrReply;
      const pdfBytes = loadedOrReply;

      let documentPart: any = null;
      try {
        if (pdfBytes.byteLength <= 12 * 1024 * 1024) {
          documentPart = pdfInlinePart(pdfBytes);
        } else {
          const geminiFile = await uploadPdfToGemini(pdfBytes, title, candidateKey.key);
          geminiFileName = geminiFile.name;
          documentPart = { file_data: { mime_type: geminiFile.mimeType ?? "application/pdf", file_uri: geminiFile.uri } };
        }
      } catch (uploadErr) {
        if (pdfBytes.byteLength <= 18 * 1024 * 1024) {
          documentPart = pdfInlinePart(pdfBytes);
        } else {
          lastErrorMessage = String((uploadErr as Error)?.message ?? uploadErr);
          continue;
        }
      }

      const baseRequestBody = {
        contents: [{ parts: [documentPart, { text: promptText }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
          responseSchema,
        },
      };
      const relaxedBody = {
        contents: baseRequestBody.contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      };

      for (let mIdx = 0; mIdx < models.length; mIdx++) {
        const candidateModel = models[mIdx];
        selectedModel = candidateModel;
        const bodies = [baseRequestBody, relaxedBody];
        for (let attempt = 0; attempt < bodies.length; attempt++) {
          const geminiResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": candidateKey.key },
            body: JSON.stringify(bodies[attempt]),
          }, 36000);
          if (!geminiResponse) {
            lastStatus = 504;
            lastErrorMessage = "Tempo limite excedido no modelo visual; tentando alternativa.";
            break;
          }
          const geminiData = await geminiResponse.json().catch(() => ({}));
          if (geminiResponse.ok) {
            try {
              parsed = parseGeminiJsonText(geminiData);
              if (parsed && (Array.isArray(parsed.topics) || parsed.meta)) {
                if (geminiData?.candidates?.[0]?.finishReason === "MAX_TOKENS" || parsed._partial) {
                  parsed._coverage = { mode: "pdf_visual", incomplete: true };
                  parsed.meta = parsed.meta || {};
                  parsed.meta.warnings = [...(Array.isArray(parsed.meta.warnings) ? parsed.meta.warnings : []), "A resposta da IA foi cortada por tamanho; o mapa pode estar incompleto. Reprocesse ou envie o edital verticalizado."];
                }
                await removeGeminiFile(geminiFileName, candidateKey.key);
                geminiFileName = undefined;
                break keyLoop;
              }
            } catch (parseErr) {
              console.warn("edital-gemini JSON parse warning", candidateModel, attempt + 1, String((parseErr as Error)?.message ?? parseErr));
              lastStatus = 502;
              lastErrorMessage = "O modelo devolveu uma resposta incompleta ao analisar o edital.";
              continue;
            }
          }
          lastStatus = geminiResponse.status;
          lastErrorMessage = geminiData?.error?.message ?? `O Gemini não conseguiu analisar o edital (${geminiResponse.status}).`;
          console.warn("Gemini edital attempt", candidateKey.source, candidateModel, attempt + 1, geminiResponse.status, lastErrorMessage);
          if (geminiResponse.status === 400 && attempt === 0) continue;
          // Em caso de 429 (cota por modelo) ou 503, aguarda brevemente e tenta o próximo modelo habilitado na mesma chave.
          if (geminiResponse.status === 429 || geminiResponse.status === 503 || FALLBACK_STATUS.has(geminiResponse.status)) {
            if (mIdx + 1 < models.length) await wait(1200);
            break;
          }
          break;
        }
      }
      await removeGeminiFile(geminiFileName, candidateKey.key);
      geminiFileName = undefined;
      if (!parsed && partialChunkAttempt) {
        parsed = partialChunkAttempt;
        break keyLoop;
      }
    }

    if (!parsed && selectedChunks.length && deadline - Date.now() > 20000) {
      const fallbackProviders = [
        { name: "deepseek", key: DEEPSEEK_API_KEY, url: "https://api.deepseek.com/chat/completions", model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat" },
        { name: "groq", key: GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b" },
      ].filter((p) => Boolean(p.key));
      for (const prov of fallbackProviders) {
        const providerCaller: ChunkCaller = async (prompt, timeoutMs) => {
          const resp = await fetchWithTimeout(prov.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${prov.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: prov.model,
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: 'Você é um analista de editais de concursos. Responda apenas com JSON válido no formato {"meta":{"document_kind":"edital_oficial","classification_reason":"Extraído do texto","detected_scope":"Edital","confidence":0.9,"warnings":[]},"topics":[{"subject":"...","unit":"","topic":"...","subject_order":0,"learning_order":0,"difficulty":"basic","prerequisite_topic":"","pedagogical_reason":""}]}.' },
                { role: "user", content: prompt },
              ],
            }),
          }, timeoutMs);
          if (!resp || !resp.ok) return null;
          try {
            const d = await resp.json().catch(() => ({}));
            const rawContent = String(d?.choices?.[0]?.message?.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            const candidate = JSON.parse(rawContent);
            return Array.isArray(candidate?.topics) ? candidate : null;
          } catch { return null; }
        };
        const run = await runChunked(selectedChunks, makeChunkPrompt, providerCaller, { concurrency: 2, deadline });
        const attempt = buildChunkedParsed(run);
        if (attempt) {
          parsed = attempt;
          selectedModel = prov.model;
          providerUsed = prov.name;
          break;
        }
      }
    }

    if (!parsed && structured.subjectCount >= 2 && structured.topics.length >= 5) {
      parsed = {
        meta: structured.meta,
        topics: structured.topics,
        _coverage: {
          pdf_total_pages: editalLoad.pdfTotalPages || editalPages.length,
          pages_with_text: editalPages.length,
          chunks_total: Math.max(1, allChunks.length),
          chunks_selected: Math.max(1, selectedChunks.length),
          chunks_ok: Math.max(1, selectedChunks.length),
          chunks_failed: 0,
          chunks_not_run: 0,
          chunks_partial: 0,
          chunks_skipped: 0,
          incomplete: Boolean(editalLoad.truncatedPages),
          mode: "structured_fallback",
        },
      };
      providerUsed = "structured-vertical";
    }

    if (!parsed) {
      const retryable = RETRYABLE_STATUS.has(lastStatus);
      const code = lastStatus === 429 ? "PROVIDER_429" : retryable ? "PROVIDER_UNAVAILABLE" : "AI_ERROR";
      await finishUsage(usage.event_id, "error", code, selectedModel);
      await setDocumentStatus(documentId, user.id, retryable ? "pending" : "error");
      const error = lastStatus === 429
        ? "A cota da sua chave Gemini foi atingida (erro 429). O edital permanece salvo e esta tentativa não foi contabilizada."
        : retryable
          ? "O Gemini está temporariamente indisponível. O edital permanece salvo na fila; tente novamente em alguns minutos."
          : lastErrorMessage;
      return reply(request, { error, retryable, code, provider_status: lastStatus, model: selectedModel, key_source: usedKeySource }, lastStatus === 429 ? 429 : 502);
    }

    const rawKind = String(parsed?.meta?.document_kind ?? "").toLowerCase().trim();
    const hasExtractedTopics = Array.isArray(parsed?.topics) && parsed.topics.length >= 1;
    const normalizedKind = ["edital_oficial", "edital_verticalizado", "edital_concurso"].includes(rawKind)
      ? rawKind
      : (structured.isVerticalized || /verticalizado/i.test(title) ? "edital_verticalizado" : (hasExtractedTopics && (rawKind !== "material_estudo" || structured.subjectCount >= 2) ? "edital_oficial" : (rawKind || "outro")));
    const meta = {
      document_kind: normalizedKind,
      classification_reason: String(parsed?.meta?.classification_reason ?? "Conteúdo programático identificado.").trim(),
      detected_scope: String(parsed?.meta?.detected_scope ?? campaignName ?? title).trim(),
      confidence: Math.max(0, Math.min(1, Number(parsed?.meta?.confidence ?? (hasExtractedTopics ? 0.88 : 0)))),
      warnings: Array.isArray(parsed?.meta?.warnings) ? parsed.meta.warnings.map((warning: unknown) => String(warning).trim()).filter(Boolean).slice(0, 10) : [],
    };
    const validEditalKinds = new Set(["edital_oficial", "edital_verticalizado", "edital_concurso"]);
    if (!validEditalKinds.has(meta.document_kind)) {
      await finishUsage(usage.event_id, "error", "NOT_AN_EDITAL", selectedModel);
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: `Este PDF não parece ser um edital oficial nem um edital verticalizado. ${meta.classification_reason} Exclua-o desta categoria e envie novamente como Material de estudo, Lei ou norma, Prova ou Simulado.`, code: "NOT_AN_EDITAL" }, 422);
    }
    if (meta.document_kind === "edital_verticalizado" && !meta.warnings.some((warning: string) => /verticalizado/i.test(warning))) meta.warnings.unshift("Edital verticalizado aceito como base do mapa. Confira os tópicos com o edital oficial quando ele estiver disponível.");
    const normalizedMerged = mergeChunkResults([{ index: 0, parsed }], 4000, { campaignName, docTitle: title });
    let uniqueTopics = normalizedMerged.topics;
    const aiSubjectCount = new Set(uniqueTopics.map((t) => normalizeSearch(t.subject))).size;
    if (
      structured.subjectCount >= 2 &&
      structured.topics.length >= 6 &&
      (aiSubjectCount < structured.subjectCount || uniqueTopics.length < structured.topics.length * 0.8)
    ) {
      uniqueTopics = structured.topics;
      if (structured.isVerticalized) meta.document_kind = "edital_verticalizado";
    }
    if (uniqueTopics.length < 1) {
      await finishUsage(usage.event_id, "error", "INSUFFICIENT_TOPICS", selectedModel);
      await setDocumentStatus(documentId, user.id, "error");
      return reply(request, { error: "A análise não encontrou conteúdo programático suficiente com segurança. Confira se o PDF contém as disciplinas e se o nome do portal corresponde ao cargo." }, 422);
    }
    if (meta.confidence < 0.65) meta.warnings.unshift("A IA indicou baixa confiança na identificação do cargo ou do conteúdo programático. Revise o mapa antes de iniciar as missões.");

    const coverage = parsed?._coverage ?? null;
    const topicsFilter = `campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}`;
    const serviceHeaders = { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY };
    let backupRows: any[] = [];
    try {
      const backup = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?${topicsFilter}&select=campaign_id,user_id,subject,unit_name,topic,edital_order,subject_order,learning_order,difficulty,prerequisite_topic,pedagogical_reason&limit=5000`, { headers: serviceHeaders });
      if (backup.ok) backupRows = await backup.json().catch(() => []);
    } catch { /* sem backup */ }
    const backupSubjectCount = new Set((backupRows || []).map((r: any) => normalizeSearch(r?.subject))).size;
    const newSubjectCount = new Set(uniqueTopics.map((t) => normalizeSearch(t.subject))).size;
    if (coverage?.incomplete && Array.isArray(backupRows) && backupRows.length > uniqueTopics.length && backupSubjectCount >= newSubjectCount) {
      await finishUsage(usage.event_id, "error", "PARTIAL_RESULT", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: `A análise leu só parte do edital (${uniqueTopics.length} tópicos contra ${backupRows.length} já salvos). O mapa atual foi mantido; tente novamente em instantes.`, retryable: true, code: "PARTIAL_RESULT", coverage, warnings: meta.warnings }, 503);
    }
    const restoreBackup = async () => {
      if (Array.isArray(backupRows) && backupRows.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics`, { method: "POST", headers: { ...serviceHeaders, "Content-Type": "application/json" }, body: JSON.stringify(backupRows) }).catch(() => undefined);
      }
    };
    const cleared = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?campaign_id=eq.${encodeURIComponent(campaignId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: "DELETE", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY } });
    if (!cleared.ok) {
      console.error("campaign_topics delete", cleared.status, await cleared.text());
      await finishUsage(usage.event_id, "error", "MAP_CLEAR_FAILED", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: "Não foi possível preparar o mapa anterior para a nova análise.", retryable: true }, 502);
    }
    const rows = uniqueTopics.map((item) => ({ campaign_id: campaignId, user_id: user.id, subject: item.subject, unit_name: item.unit, topic: item.topic, edital_order: item.edital_order, subject_order: item.subject_order, learning_order: item.learning_order, difficulty: item.difficulty, prerequisite_topic: item.prerequisite_topic || null, pedagogical_reason: item.pedagogical_reason || null }));
    const inserted = await fetch(`${SUPABASE_URL}/rest/v1/campaign_topics?on_conflict=campaign_id,subject,topic`, { method: "POST", headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY, "Content-Type": "application/json", "Prefer": "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify(rows) });
    if (!inserted.ok) {
      const detail = await inserted.text();
      console.error("campaign_topics insert", inserted.status, detail);
      await restoreBackup();
      await finishUsage(usage.event_id, "error", "TOPICS_SAVE_FAILED", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: `O edital foi analisado, mas os tópicos não puderam ser salvos (${inserted.status}).`, detail, retryable: true }, 502);
    }
    const savedTopics = await inserted.json();
    if (!Array.isArray(savedTopics) || savedTopics.length === 0) {
      await restoreBackup();
      await finishUsage(usage.event_id, "error", "TOPICS_EMPTY", selectedModel);
      await setDocumentStatus(documentId, user.id, "pending");
      return reply(request, { error: "O edital foi analisado, mas nenhum tópico foi confirmado no banco.", retryable: true }, 502);
    }
    const chunkPct = coverage?.chunks_selected ? Math.round((coverage.chunks_ok / coverage.chunks_selected) * 100) : 100;
    const pagesPct = coverage?.pdf_total_pages && coverage?.pages_with_text ? Math.round((coverage.pages_with_text / coverage.pdf_total_pages) * 100) : 100;
    await saveEditalCoverage(documentId, user.id, {
      percent: Math.max(1, Math.min(100, chunkPct, pagesPct)),
      topics: savedTopics.length,
      pages: Number(coverage?.pdf_total_pages) || editalPages.length,
      needsReview: Boolean(coverage?.incomplete) || meta.confidence < 0.65,
      warnings: meta.warnings,
    });
    await setDocumentStatus(documentId, user.id, "ready");
    await finishUsage(usage.event_id, "success", undefined, selectedModel);
    return reply(request, { topics: uniqueTopics, saved: savedTopics.length, provider: providerUsed, model: selectedModel, key_source: usedKeySource, meta, coverage });
  } catch (error) {
    console.error("edital-gemini", error);
    await finishUsage(usage?.event_id, "error", "PROCESSING_FAILED", selectedModel);
    if (documentId) await setDocumentStatus(documentId, user.id, "error");
    return reply(request, { error: String((error as Error)?.message || "Falha interna ao interpretar o edital.") }, 500);
  } finally {
    await removeGeminiFile(geminiFileName, geminiFileKey);
  }
});
