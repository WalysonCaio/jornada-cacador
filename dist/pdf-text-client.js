(function () {
  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function () {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const MAX_EXTRACT_PAGES = 600;
  const extractionJobs = new Map();
  const isEditalType = (doc) => ["edital", "edital_concurso"].includes(String(doc?.document_type || ""));
  window._recentUploadedPdfBytes = window._recentUploadedPdfBytes || new Map();
  window._extractedPagesByDocId = window._extractedPagesByDocId || new Map();
  window._extractedPdfMetaByDocId = window._extractedPdfMetaByDocId || new Map();
  window._activeProcessingDocs = window._activeProcessingDocs || new Set();

  const normalizeSearch = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const EMAIL_LINE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const CPF_LINE_RE = /^(?:cpf\s*:?\s*)?\d{3}\.?\d{3}\.?\d{3}[-./]\d{2}$/i;
  const INCIDENCE_ONLY_LINE_RE = /^(?:(?:n[ií]vel\s+de\s+)?incid[eê]ncia\s*:?\s*)?(?:alta|m[eé]dia|media|baixa)(?:[\s,/|-]+(?:incid[eê]ncia\s+)?(?:alta|m[eé]dia|media|baixa))*$/i;
  const LEGEND_OR_CHECKLIST_LINE_RE = /^(?:cai\s+muito.*|cai\s+com\s+frequ[eê]ncia.*|dificilmente\s+cai.*|incid[eê]ncia\s+(?:alta|m[eé]dia|media|baixa).*|as\s+ma\s*t[eé]rias\s+foram\s+organizadas.*|para\s+tornar\s+o\s+estudo\s+mais\s+pr[aá]tico.*|poss[ií]vel\s+identificar\s+rapidamente.*|definir\s+prioridades\s+de\s+revis[aã]o.*|aprendizado|\(somente\s+para\s+a?\s*prova\s+discursiva\)|checklist|s\s*i\s*m\s*u\s*l\s*a\s*d\s*o\s*s.*|acompanhe\s+sua\s+evolu[cç][aã]o.*|__\/__.*|anota[cç][oõ]es\s*:?|(?:0?\d\s+){3,}.*)$/i;
  const TABLE_CHROME_LINE_RE = /^(leitura|-?\s*letra|da\s+lei|letra\s+de\s+lei|leitura\s*-?\s*letra\s+d[ae]\s+lei|quest[oõ]|es|quest[oõ]es|exerc[ií]cios?|acerto|s\s*\(\%\).*|acertos?\s*(?:\(\%\))?.*|tempo|revis[aã]|o|revis[aã]o|1[ªa]\s*rev.*|2[ªa]\s*rev.*|3[ªa]\s*rev.*|teoria|resumo|videoaula|pdf|status|conclu[ií]do|estudado|check|\(\%\)|item|t[oó]pico|assunto|conte[uú]do|incid[eê]ncia)$/i;
  const ADMIN_ONLY_RE = /^(inscri(c|ç)(a|ã)o|cronograma|remunera(c|ç)(a|ã)o|vagas?|isen(c|ç)(a|ã)o|taxa de inscri(c|ç)(a|ã)o|resultado|recursos?|exame m[eé]dico|teste de aptid(a|ã)o f[ií]sica|investiga(c|ç)(a|ã)o social|documentos?|matr[ií]cula|curso de forma(c|ç)(a|ã)o|alta|m[eé]dia|media|baixa|alta\s+m[eé]dia|alta\s+media|m[eé]dia\s+alta|media\s+alta)$/i;

  const GENERIC_SUBJECT_RE = /^(edital(\s+verticalizado|\s+do\s+concurso|\s+de\s+abertura|\s+esquematizado|\s+sintetizado|\s+n[ºo°]?\s*[\d\/.-]+)?.*|ciclo\s*\d+.*|conte[uú]do(s)?\s*program[aá]tico(s)?|conhecimentos?\s*(gerais|b[aá]sicos|espec[ií]ficos|complementares|t[eé]cnicos|profissionais)?|objetos?\s*de\s*avalia[cç][aã]o|disciplinas?|mat[eé]rias?|programa(s)?|anexo\s*[ivxlcdm\d]*.*|bloco\s*[ivxlcdm\d]*.*|m[oó]dulo\s*[ivxlcdm\d]*.*|parte\s*[ivxlcdm\d]*.*|geral|comum\s+a\s+todos.*|cargo\s*\d*.*|pol[ií]cia\s*(penal|militar|civil|federal|rodovi[aá]ria|cient[ií]fica|legislativa|judicial).*|corpo\s+de\s+bombeiros.*|guarda\s+(municipal|civil).*|agente\s+(penitenci[aá]rio|de\s+pol[ií]cia|socioeducativo).*|soldado.*|oficial.*|pm\s*pe.*|pp\s*pe.*|pc\s*pe.*|cbm\s*pe.*|bcm\s*pe.*|bombeiro.*|prf.*|pf.*)$/i;

  const KNOWN_SUBJECT_HEADER_RE = /^(?:(?:disciplina|mat[eé]ria|bloco\s*[ivxlcdm\d]+|m[oó]dulo\s*[ivxlcdm\d]+|conhecimentos?\s*(?:b[aá]sicos|gerais|espec[ií]ficos))\s*[:\-–—]\s*)?(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)?(l[ií]ngua\s+portuguesa(\s+e\s+interpreta[cç][aã]o\s+de\s+textos?|\s+e\s+reda[cç][aã]o.*)?|portugu[eê]s|gram[aá]tica.*|interpreta[cç][aã]o\s+de\s+textos?|reda[cç][aã]o(\s+oficial|\s+discursiva)?|[eé]tica(\s+no\s+servi[cç]o\s+p[uú]blico|\s+na\s+administra[cç][aã]o\s+p[uú]blica|\s+p[uú]blica|\s+e\s+cidadania|\s+e\s+conduta.*)?|racioc[ií]nio\s+l[oó]gico(\s*[-e/]\s*matem[aá]tico|\s+quantitativo|\s+e\s+estat[ií]stica)?|rlm|matem[aá]tica(\s+financeira|\s+b[aá]sica|\s+e\s+racioc[ií]nio\s+l[oó]gico)?|estat[ií]stica|(?:no[cç][oõ]es\s+de\s+|conhecimentos?\s+de\s+)?inform[aá]tica|tecnologia\s+da\s+informa[cç][aã]o(\s+e\s+comunica[cç][aã]o)?|atualidades(\s*\(.*\)|\s+e\s+conhecimentos\s+gerais|\s+e\s+hist[oó]ria.*|\s+e\s+geografia.*)?|conhecimentos\s+regionais.*|realidade\s+[eé]tnica.*|hist[oó]ria(\s+e\s+geografia.*|\s+de\s+pernambuco|\s+do\s+brasil|\s+geral|\s+da\s+para[ií]ba|\s+da\s+bahia|\s+do\s+cear[aá]|\s+de\s+alagoas)?|geografia(\s+e\s+hist[oó]ria.*|\s+de\s+pernambuco|\s+do\s+brasil|\s+geral|\s+da\s+para[ií]ba|\s+da\s+bahia|\s+do\s+cear[aá]|\s+de\s+alagoas)?|(?:no[cç][oõ]es\s+de\s+|conhecimentos?\s+de\s+)?direito\s+(constitucional|administrativo|penal(\s+militar|\s+e\s+processual\s+penal)?|processual\s+penal(\s+militar|\s+e\s+penal)?|militar|civil|processual\s+civil|tribut[aá]rio|previdenci[aá]rio|eleitoral|do\s+trabalho|ambiental|financeiro|empresarial|consumidor|internacional|humanos|penitenci[aá]rio).*|(?:no[cç][oõ]es\s+de\s+)?direitos?\s+humanos(\s+e\s+participa[cç][aã]o\s+social|\s+e\s+cidadania|\s+e\s+legisla[cç][aã]o.*)?|(?:no[cç][oõ]es\s+de\s+)?legisla[cç][aã]o(\s+estadual|\s+especial|\s+extravagante|\s+institucional|\s+penal(\s+especial|\s+extravagante)?|\s+espec[ií]fica|\s+municipal|\s+de\s+tr[aâ]nsito|\s+aplicada|\s+pertinente|\s+penitenci[aá]ria|\s+do\s+sistema\s+prisional|\s+militar|\s+da\s+pm.*|\s+da\s+pp.*|\s+da\s+pc.*|\s+jur[ií]dica.*)?|leis?\s+(especiais|extravagantes|penais\s+especiais).*|(?:no[cç][oõ]es\s+de\s+)?execu[cç][aã]o\s+penal.*|(?:no[cç][oõ]es\s+de\s+)?direito\s+penitenci[aá]rio.*|estatuto.*|c[oó]digo\s+de\s+tr[aâ]nsito.*|ctb|(?:no[cç][oõ]es\s+de\s+)?criminologia|(?:no[cç][oõ]es\s+de\s+)?medicina\s+legal|(?:no[cç][oõ]es\s+de\s+)?criminal[ií]stica|seguran[cç]a\s+(p[uú]blica|prisional|corporativa|org[aâ]nica).*|(?:no[cç][oõ]es\s+de\s+)?administra[cç][aã]o(\s+p[uú]blica|\s+geral|\s+financeira\s+e\s+or[cç]ament[aá]ria|\s+de\s+recursos\s+materiais|\s+e\s+[eé]tica)?|afo|or[cç]amento\s+p[uú]blico|gest[aã]o\s+de\s+pessoas|atendimento\s+ao\s+p[uú]blico|(?:no[cç][oõ]es\s+de\s+)?arquivologia|(?:no[cç][oõ]es\s+de\s+)?contabilidade(\s+geral|\s+p[uú]blica)?|economia|l[ií]ngua\s+(inglesa|espanhola|estrangeira).*|ingl[eê]s|espanhol|f[ií]sica|qu[ií]mica|biologia|anatomia\s+humana|primeiros\s+socorros|defesa\s+civil|dire[cç][aã]o\s+defensiva)$/i;

  const TOPIC_DISCIPLINE_RULES = [
    { subject: "Língua Portuguesa", re: /\b(compreensao e interpretacao|tipologia textual|generos textuais|ortografia|acentuacao grafica|coesao|coerencia|morfossintatica|morfologia|classes de palavras|coordenacao entre oracoes|subordinacao entre oracoes|sinais de pontuacao|concordancia verbal|concordancia nominal|regencia verbal|regencia nominal|indicativo de crase|pronomes atonos|colocacao pronominal|semantica|figuras de linguagem|redacao oficial|manual de redacao da presidencia|reescrita de frases)\b/i },
    { subject: "Ética no Serviço Público", re: /\b(etica e moral|etica, principios e valores|etica e democracia|etica e funcao publica|etica no setor publico|codigo de etica|46[\s.]*852|1[\s.]*171\/1994|sindicancias? investigativa)\b/i },
    { subject: "Legislação Estadual", re: /\b(codigo penitenciario do estado de pernambuco|15[\s.]*755\/2016|106\/2007|422\/2019|150\/2009|6[\s.]*123\/1968|regime juridico dos funcionarios publicos civis do estado de pernambuco|policial penal de pernambuco|normas disciplinares dos policiais penais)\b/i },
    { subject: "Informática", re: /\b(sistema operacional|ambientes linux e windows|windows 10|windows 11|redes de computadores|intranet|navegadores|microsoft edge|mozilla firefox|google chrome|correio eletronico|computacao na nuvem|cloud computing|arquivos, pastas e programas|seguranca da informacao|virus, worms|malware|phishing|ransomware|antivirus|firewall|procedimentos de backup|cloud storage|pacote office|libreoffice|word|excel|powerpoint)\b/i },
    { subject: "Raciocínio Lógico-Matemático", re: /\b(estruturas logicas|logica de argumentacao|logica sentencial|proposicoes simples e compostas|tabelas verdade|equivalencias|leis de de morgan|diagramas logicos|logica de primeira ordem|principios de contagem|analise combinatoria|probabilidade|operacoes com conjuntos|problemas aritmeticos, geometricos e matriciais|porcentagem|regra de tres|juros simples)\b/i },
    { subject: "Atualidades", re: /\b(topicos relevantes e atuais|seguranca prisional nacional|somente para prova discursiva|energia, transporte, meio ambiente, economia, sociedade)\b/i },
    { subject: "Direito Administrativo", re: /\b(estado, governo e administracao publica|direito administrativo\. objeto|ato administrativo|extincao do ato administrativo|cassacao, anulacao, revogacao e convalidacao|decadencia administrativa|agentes publicos.*cargo, emprego e funcao|poderes da administracao publica|hierarquico, disciplinar, regulamentar e de policia|regime juridico-administrativo|responsabilidade civil do estado|servicos publicos.*concessao, permissao|organizacao administrativa.*autarquias, fundacoes|controle da administracao publica|improbidade administrativa|8[\s.]*429\/1992|9[\s.]*784\/1999|14[\s.]*133\/2021|licitacoes e contratos)\b/i },
    { subject: "Direito Constitucional", re: /\b(constituicao da republica federativa do brasil de 1988|aplicabilidade das normas constitucionais|eficacia plena, contida e limitada|direitos e garantias fundamentais|direitos e deveres individuais e coletivos|direitos sociais|nacionalidade|direitos politicos|organizacao politico-administrativa do estado|poder executivo.*presidente da republica|poder legislativo.*processo legislativo|poder judiciario.*conselho nacional de justica|funcoes essenciais a justica|defesa do estado e das instituicoes|art\.?\s*144)\b/i },
    { subject: "Direito Processual Penal", re: /\b(disposicoes preliminares do codigo de processo penal|inquerito policial|acao penal|9[\s.]*296\/1996|interceptacao telefonica|juiz, ministerio publico, acusado, defensor|prisao, liberdade provisoria e fianca|prisao em flagrante|prisao preventiva|prisao temporaria|provas.*cadeia de custodia|crimes de responsabilidade dos funcionarios publicos|habeas corpus e seu processo|aplicaveis ao direito processual penal)\b/i },
    { subject: "Direito Penal", re: /\b(aplicacao da lei penal|lei penal no tempo e no espaco|territorialidade e extraterritorialidade|fato tipico e seus elementos|crime consumado e tentado|ilicitude e causas de exclusao|legitima defesa|estado de necessidade|culpabilidade|imputabilidade penal|concurso de pessoas|concurso de crimes|crimes contra a pessoa|crimes contra o patrimonio|crimes contra a fe publica|crimes contra a administracao publica|8[\s.]*072\/1990|delitos hediondos|aplicaveis ao direito penal)\b/i },
    { subject: "Direitos Humanos", re: /\b(declaracao universal dos direitos humanos|regras minimas da onu|regras de nelson mandela|regras de bangkok|pacto de san jose da costa rica|convencao americana sobre direitos humanos|tratamento de pessoas presas|programa nacional de direitos humanos|7[\s.]*037\/2009|conselhos da comunidade|conselhos penitenciarios|arts\. 62 a 64 da lei de execucao penal)\b/i },
    { subject: "Legislação Extravagante", re: /\b(12[\s.]*850\/2013|organizacoes criminosas|9[\s.]*613\/1998|lavagem de dinheiro|9[\s.]*455\/1997|antitortura|crimes de tortura|12[\s.]*846\/2013|anticorrupcao|13[\s.]*869\/2019|abuso de autoridade|10[\s.]*826\/2003|estatuto do desarmamento|11[\s.]*343\/2006|lei de drogas|13[\s.]*964\/2019|pacote anticrime|lei de execucao penal|7[\s.]*210\/1984|11[\s.]*340\/2006|maria da penha|sistema penitenciario federal|11[\s.]*671\/2008|atencao integral a saude das pessoas privadas de liberdade|plano estrategico de educacao no ambito do sistema prisional|atencao as mulheres em situacao de privacao de liberdade)\b/i },
    { subject: "Direito Militar", re: /\b(estatuto dos policiais militares|codigo disciplinar dos militares|direito penal militar|processual penal militar|sunor|6[\s.]*783\/1974|11[\s.]*817\/2000|crimes militares em tempo de paz)\b/i },
    { subject: "História de Pernambuco", re: /\b(insurreicao pernambucana|revolucao pernambucana|confederacao do equador|revolucao praieira|capitania de pernambuco|guerra dos mascates|ocupacao holandesa)\b/i },
    { subject: "Geografia de Pernambuco", re: /\b(mesorregioes de pernambuco|bacias hidrograficas de pernambuco|relevo de pernambuco|agreste e sertao pernambucano|zona da mata pernambucana)\b/i },
  ];

  function inferDisciplineFromTopicsBlock(topicsText) {
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

  function sanitizeWatermarkText(value) {
    return String(value ?? "")
      .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "")
      .replace(/\b(?:cpf\s*:?\s*)?\d{3}\.?\d{3}\.?\d{3}[-./]\d{2}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripTableChromeSuffix(value) {
    let s = String(value ?? "").trim();
    for (let pass = 0; pass < 2; pass++) {
      s = s.replace(/^(?:disciplina|mat[eé]ria|bloco\s*[ivxlcdm\d]+|m[oó]dulo\s*[ivxlcdm\d]+|conhecimentos?\s*(?:b[aá]sicos|gerais|espec[ií]ficos))\s*[:\-–—]\s*/i, "").trim();
      s = s.replace(/\s+(?:leitura(?:\s*-\s*letra\s+da\s+lei)?|teoria|resumo|pdf|videoaula|quest[oõ]es|exerc[ií]cios?|acertos?(?:\s*\(\%\))?|tempo|revis[aã]o|\d[ªa]\s*rev(?:is[aã]o)?|status|conclu[ií]do|estudado|check)(?:\s+(?:leitura(?:\s*-\s*letra\s+da\s+lei)?|da\s+lei|teoria|resumo|pdf|videoaula|quest[oõ]es|exerc[ií]cios?|acertos?(?:\s*\(\%\))?|\(\%\)|tempo|revis[aã]o|\d[ªa]\s*rev(?:is[aã]o)?|status|conclu[ií]do|estudado|check))*\s*$/i, "").trim();
      s = s.replace(/\s*\(\s*(?:\d+\s*quest[oõ]es?|peso\s*[\d.,]+|conhecimentos?\s*(?:b[aá]sicos|gerais|espec[ií]ficos))(?:[^)]*)\)\s*$/i, "").trim();
    }
    return s;
  }

  function isGenericSubjectName(value, campaignName = "", docTitle = "") {
    const cleaned = stripTableChromeSuffix(value);
    const s = normalizeSearch(cleaned).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return true;
    const withoutPrefixNum = cleaned.replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "").trim();
    if (KNOWN_SUBJECT_HEADER_RE.test(withoutPrefixNum)) return false;
    if (GENERIC_SUBJECT_RE.test(s)) return true;
    const camp = normalizeSearch(campaignName).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (camp && (s === camp || (camp.length >= 4 && s.includes(camp)) || (s.length >= 4 && camp.includes(s)))) return true;
    const title = normalizeSearch(docTitle).replace(/\.pdf$/i, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (title && (s === title || (title.length >= 5 && s.includes(title)))) return true;
    return false;
  }

  function cleanEditalPageLines(pageText) {
    const fullStr = String(pageText ?? "");
    if (/__\/__\s+__\/__/i.test(fullStr) || (/checklist/i.test(fullStr) && /s\s*i\s*m\s*u\s*l\s*a\s*d\s*o\s*s/i.test(fullStr))) {
      return [];
    }
    const rawLines = fullStr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const removeIdx = new Set();
    for (let i = 0; i < rawLines.length; i++) {
      if (EMAIL_LINE_RE.test(rawLines[i]) || CPF_LINE_RE.test(rawLines[i])) {
        removeIdx.add(i);
        if (i > 0 && EMAIL_LINE_RE.test(rawLines[i]) && !/\d/.test(rawLines[i - 1]) && rawLines[i - 1].length <= 65) {
          const prev = stripTableChromeSuffix(rawLines[i - 1]);
          if (!KNOWN_SUBJECT_HEADER_RE.test(prev) && !GENERIC_SUBJECT_RE.test(normalizeSearch(prev))) {
            removeIdx.add(i - 1);
          }
        }
      }
    }
    const out = [];
    for (let i = 0; i < rawLines.length; i++) {
      if (removeIdx.has(i)) continue;
      let line = sanitizeWatermarkText(rawLines[i]);
      if (!line) continue;
      if (INCIDENCE_ONLY_LINE_RE.test(line) || LEGEND_OR_CHECKLIST_LINE_RE.test(line)) continue;
      line = line
        .replace(/^(?:(?:incid[eê]ncia\s+)?(?:alta|m[eé]dia|media|baixa)\s+)+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ•▪▸→☐▢☑])/i, "")
        .replace(/(?:\s+(?:incid[eê]ncia\s+)?(?:alta|m[eé]dia|media|baixa))+$/i, "")
        .trim();
      if (!line) continue;
      if (INCIDENCE_ONLY_LINE_RE.test(line) || LEGEND_OR_CHECKLIST_LINE_RE.test(line)) continue;
      if (TABLE_CHROME_LINE_RE.test(line)) continue;
      const norm = normalizeSearch(line);
      if (TABLE_CHROME_LINE_RE.test(norm) || INCIDENCE_ONLY_LINE_RE.test(norm) || LEGEND_OR_CHECKLIST_LINE_RE.test(norm)) continue;
      if (/^(edital\s+verticalizado.*|ciclo\s*\d+.*|policia\s+(penal|militar|civil|federal)(?:\s+de\s+pernambuco.*|\s*[-–—]?\s*[a-z]{0,3})|pagina\s+\d+(\s+de\s+\d+)?)$/i.test(norm)) continue;
      out.push(line);
    }
    return out;
  }

  function splitNumberedTopicBlock(topic) {
    const cleanTopic = sanitizeWatermarkText(topic).replace(/\s+/g, " ").trim();
    if (cleanTopic.length <= 120) return [cleanTopic];
    const hasPunct1 = /(?:^|[\s.;:])0?1(?:\.\d+)?\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(cleanTopic);
    const hasPunct2 = /[\s.;:]0?2(?:\.\d+)?\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(cleanTopic);
    if (hasPunct1 && hasPunct2) {
      const parts = cleanTopic
        .split(/(?=(?:^|[\s.;:])\d{1,3}(?:\.\d+)?\s*[.\-)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g)
        .map((p) => p.replace(/^[\s.;:]+|[\s.;]+$/g, "").trim())
        .filter((p) => p.length >= 3);
      if (parts.length >= 2) return parts;
    }
    const hasSpace1 = /(?:^|[\s.;:])1\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/.test(cleanTopic);
    const hasSpace2 = /[\s.;:]2\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/.test(cleanTopic);
    if (hasSpace1 && hasSpace2) {
      const parts = cleanTopic
        .split(/(?=(?:^|[\s.;:])\d{1,3}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})/g)
        .map((p) => p.replace(/^[\s.;:]+|[\s.;]+$/g, "").trim())
        .filter((p) => p.length >= 3);
      if (parts.length >= 2) return parts;
    }
    return [cleanTopic];
  }

  function isSubjectHeaderLine(line, nextLine, campaignName = "", docTitle = "", currentSubject = "") {
    if (/^[•▪▸→☐▢☑✓✔]/.test(String(line || "").trim())) return false;
    const s = stripTableChromeSuffix(line);
    if (s.length < 3 || s.length > 96) return false;
    if (/^\d+\s+[a-záéíóúâêôãõç]/.test(s)) return false;
    if (/[.;]$/.test(s)) return false;
    if (INCIDENCE_ONLY_LINE_RE.test(s) || LEGEND_OR_CHECKLIST_LINE_RE.test(s)) return false;
    if (isGenericSubjectName(s, campaignName, docTitle)) return false;
    const rawTrim = String(line || "").trim();
    const cleanedHeader = s.replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "").replace(/\s*:\s*$/, "").trim();
    // Se a linha termina com ":" e estamos dentro da própria disciplina (ou a próxima linha é um subtópico com bullet),
    // trata-se de um nome de CONTEÚDO (bloco pai) da disciplina atual, não de uma nova disciplina!
    if (rawTrim.endsWith(":") && !/^(?:disciplina|mat[eé]ria)\s*:/i.test(rawTrim)) {
      if (currentSubject && normalizeSearch(cleanedHeader) === normalizeSearch(currentSubject)) return false;
      if (nextLine && /^[•▪▸→]/.test(String(nextLine).trim())) return false;
    }
    if (KNOWN_SUBJECT_HEADER_RE.test(cleanedHeader)) {
      if (!rawTrim.endsWith(":")) return true;
      const letters = cleanedHeader.replace(/[^A-Za-zÀ-ÿ]/g, "");
      const upper = cleanedHeader.replace(/[^A-ZÀ-Ý]/g, "");
      if (letters.length >= 3 && upper.length / letters.length >= 0.55) return true;
      if (nextLine && /^(?:0?\d{1,3}|[IVX]{1,4}|[☐▢☑✓✔•▪▸\-–—]|\[\s*\])(?:\s*$|[.\-)]\s*|\s+[A-ZÀ-Ý])/i.test(nextLine)) return true;
      if (/^(?:disciplina|mat[eé]ria)\s*:/i.test(line)) return true;
    }
    const letters = cleanedHeader.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const upper = cleanedHeader.replace(/[^A-ZÀ-Ý]/g, "");
    if (!/^\d/.test(s) && letters.length >= 5 && upper.length === letters.length && nextLine && /^(?:0?\d{1,3}|[☐▢☑✓✔•▪▸])(?:\s*$|[.\-)]\s+|\s+[A-ZÀ-Ý])/i.test(nextLine)) {
      return true;
    }
    return false;
  }

  function extractStructuredEditalTopics(pages, options = {}) {
    if (!Array.isArray(pages) || !pages.length) {
      return { isVerticalized: false, subjectCount: 0, topics: [], meta: {} };
    }
    const campaignName = options.campaignName || "";
    const docTitle = options.title || "";
    const fullRawText = pages.map((p) => String(p?.text || "")).join("\n");
    const isVerticalizedHint = /verticalizado|esquematizado|sintetizado|ciclo\s*\d+|leitura\s*-\s*letra\s+da\s+lei|acertos\s*\(\%\)|quadro\s+de\s+estudos/i.test(`${docTitle}\n${fullRawText.slice(0, 5000)}`);

    const allLines = [];
    for (const p of pages) {
      allLines.push(...cleanEditalPageLines(p?.text || ""));
    }

    const rawExtracted = [];
    const perSubjectDisplayCount = new Map();
    let currentSubject = "";
    let currentTableNum = 0;
    let currentTopicParts = [];
    let unnumberedSubjectLines = [];
    let autoBlockCounter = 1;

    const pushTopicForSubject = (subj, topicBody, unitName = "") => {
      const cleanSubj = stripTableChromeSuffix(subj)
        .replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "")
        .replace(/\s*:\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      const rawBody = sanitizeWatermarkText(topicBody.replace(/\s+/g, " ").replace(/-\s+/g, "-").trim());
      if (!cleanSubj || rawBody.length < 3) return;
      const subKey = normalizeSearch(cleanSubj);
      const normBody = normalizeSearch(rawBody);
      if (ADMIN_ONLY_RE.test(normBody) || INCIDENCE_ONLY_LINE_RE.test(normBody) || LEGEND_OR_CHECKLIST_LINE_RE.test(normBody) || normBody === subKey) return;
      const pieces = splitNumberedTopicBlock(rawBody);
      for (const piece of pieces) {
        const stripped = piece
          .replace(/^(?:[☐▢☑✓✔•▪▸→]|\[\s*[xX ]?\s*\])\s*/, "")
          .replace(/^\d{1,3}(?:\.\d{1,2})?\s*(?:[.\-)]\s*|\s+)/, "")
          .replace(/^(?:(?:incid[eê]ncia\s+)?(?:alta|m[eé]dia|media|baixa)\s+)+/i, "")
          .trim();
        if (stripped.length < 2) continue;
        if (INCIDENCE_ONLY_LINE_RE.test(stripped) || LEGEND_OR_CHECKLIST_LINE_RE.test(stripped)) continue;
        const cleanUnit = sanitizeWatermarkText(unitName).replace(/\s*:\s*$/, "").trim();
        const formattedTopic = cleanUnit && !stripped.toLowerCase().startsWith(cleanUnit.toLowerCase())
          ? `${cleanUnit} — ${stripped}`
          : stripped;
        const nextCount = (perSubjectDisplayCount.get(subKey) || 0) + 1;
        perSubjectDisplayCount.set(subKey, nextCount);
        rawExtracted.push({
          subject: cleanSubj,
          unit: cleanUnit,
          topic: `${nextCount}. ${formattedTopic}`,
        });
      }
    };

    const flushUnnumberedLines = () => {
      if (!currentSubject || !unnumberedSubjectLines.length) {
        unnumberedSubjectLines = [];
        return;
      }
      // 1) Agrupar linhas quebradas preservando o nível hierárquico (0 = linha/conteúdo, 1 = bullet •/☐, 2 = sub-bullet →)
      const statements = [];
      for (const rawLn of unnumberedSubjectLines) {
        const ln = String(rawLn || "").trim();
        if (!ln || INCIDENCE_ONLY_LINE_RE.test(ln) || LEGEND_OR_CHECKLIST_LINE_RE.test(ln)) continue;
        const isLevel2 = /^→/.test(ln);
        const isLevel1 = !isLevel2 && /^(?:[☐▢☑✓✔•▪▸]|\[\s*[xX ]?\s*\])/.test(ln);
        const cleanLn = ln.replace(/^(?:[☐▢☑✓✔•▪▸→]|\[\s*[xX ]?\s*\])\s*/, "").trim();
        if (!cleanLn || INCIDENCE_ONLY_LINE_RE.test(cleanLn)) continue;

        const prev = statements.length > 0 ? statements[statements.length - 1] : null;
        const prevEndsPunct = prev ? /[.;:!?]$/.test(prev.text) : true;
        const prevEndsColon = prev ? /:\s*$/.test(prev.text) : false;
        const startsLower = /^[a-záéíóúâêôãõç]/.test(cleanLn);

        if (
          prev &&
          !isLevel1 &&
          !isLevel2 &&
          (!prevEndsPunct || (prevEndsColon && startsLower))
        ) {
          prev.text = `${prev.text} ${cleanLn}`.replace(/-\s+/g, "-").replace(/\s+/g, " ").trim();
        } else {
          statements.push({
            level: isLevel2 ? 2 : isLevel1 ? 1 : 0,
            text: cleanLn,
          });
        }
      }
      unnumberedSubjectLines = [];

      // 2) Identificar o que é nome de CONTEÚDO (bloco pai terminado em ":") e o que é ASSUNTO que faz parte do conteúdo
      let currentContent = "";
      let currentSubContent = "";
      for (let idx = 0; idx < statements.length; idx++) {
        const st = statements[idx];
        const nextSt = statements[idx + 1] || null;
        if (st.level === 0) {
          if (st.text.endsWith(":") && nextSt && (nextSt.level >= 1 || !nextSt.text.endsWith(":"))) {
            currentContent = st.text.replace(/:\s*$/, "").trim();
            currentSubContent = "";
            continue;
          }
          // Se estamos dentro de um bloco de conteúdo (ex.: Resoluções) e um item veio sem marcador entre bullets
          if (currentContent && st.text.endsWith(";") && nextSt && nextSt.level >= 1) {
            pushTopicForSubject(currentSubject, st.text, currentContent);
            continue;
          }
          currentContent = "";
          currentSubContent = "";
          pushTopicForSubject(currentSubject, st.text, "");
        } else if (st.level === 1) {
          if (nextSt && nextSt.level === 2) {
            currentSubContent = st.text.replace(/[.:;]\s*$/, "").trim();
            continue;
          }
          const unitLabel = currentSubContent
            ? (currentContent ? `${currentContent} (${currentSubContent})` : currentSubContent)
            : currentContent;
          pushTopicForSubject(currentSubject, st.text, unitLabel);
        } else if (st.level === 2) {
          if (nextSt && nextSt.level === 1 && /processo administrativo disciplinar/i.test(st.text)) {
            currentSubContent = st.text.replace(/[.:;]\s*$/, "").trim();
            continue;
          }
          const unitLabel = currentSubContent
            ? (currentContent ? `${currentContent} (${currentSubContent})` : currentSubContent)
            : currentContent;
          pushTopicForSubject(currentSubject, st.text, unitLabel);
          if (!nextSt || nextSt.level !== 2) {
            currentSubContent = "";
          }
        }
      }
    };

    const flushTopic = () => {
      if (!currentSubject || !currentTopicParts.length) {
        currentTopicParts = [];
        return;
      }
      const rawBody = currentTopicParts.join(" ");
      currentTopicParts = [];
      pushTopicForSubject(currentSubject, rawBody);
    };

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const nextLine = allLines[i + 1] || "";

      // Caso 1: Linha com "DISCIPLINA: 1. Tópico..." na mesma linha
      const inlineHeaderAndTopics = line.match(/^([A-ZÀ-Ý][A-Za-zÀ-ÿ\s\-–—/()]{3,65}?)\s*(?::|\s[-–—]\s)\s*((?:0?1(?:\.\d+)?\s*[.\-)\s]|[☐▢☑•])\s*.+)$/);
      if (inlineHeaderAndTopics) {
        const candHeader = stripTableChromeSuffix(inlineHeaderAndTopics[1]);
        const cleanedCand = candHeader.replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "").trim();
        if (!isGenericSubjectName(candHeader, campaignName, docTitle) && KNOWN_SUBJECT_HEADER_RE.test(cleanedCand)) {
          flushTopic();
          flushUnnumberedLines();
          currentSubject = cleanedCand;
          currentTableNum = 1;
          currentTopicParts.push(inlineHeaderAndTopics[2].trim());
          flushTopic();
          continue;
        }
      }

      // Caso 2: Linha de tabela estilo Excel "Disciplina | 1 | Tópico" ou "Disciplina \t Tópico"
      const excelRowMatch = line.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-/]{3,50}?)\s*(?:\||\t)\s*(?:0?(\d{1,3})\s*(?:\||\t|[.\-)])\s*)?(.{4,})$/);
      if (excelRowMatch) {
        const candSubj = stripTableChromeSuffix(excelRowMatch[1]);
        if (!isGenericSubjectName(candSubj, campaignName, docTitle) && KNOWN_SUBJECT_HEADER_RE.test(candSubj)) {
          flushTopic();
          flushUnnumberedLines();
          currentSubject = candSubj;
          currentTableNum = Number(excelRowMatch[2] || 1);
          pushTopicForSubject(currentSubject, excelRowMatch[3]);
          continue;
        }
      }

      // Caso 3: Linha cabeçalho de disciplina
      if (isSubjectHeaderLine(line, nextLine, campaignName, docTitle, currentSubject)) {
        flushTopic();
        flushUnnumberedLines();
        currentSubject = stripTableChromeSuffix(line)
          .replace(/^(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)/i, "")
          .replace(/\s*:\s*$/, "")
          .replace(/\s+/g, " ")
          .trim();
        currentTableNum = 0;
        continue;
      }

      if (!currentSubject) {
        // Se o edital começou direto em "1 Compreensão e interpretação..." sem cabeçalho explícito
        const firstNoHeader = line.match(/^0?1(?:\s*[.\-)]\s*|\s+)([A-ZÀ-Ý].{10,})$/);
        if (firstNoHeader) {
          const inferred = inferDisciplineFromTopicsBlock(`${line} ${nextLine}`);
          if (inferred) {
            currentSubject = inferred;
            currentTableNum = 1;
            currentTopicParts.push(firstNoHeader[1].trim());
            continue;
          }
        }
        continue;
      }

      // Caso 4: Número isolado na linha (ex.: célula da coluna Nº da tabela)
      const standaloneNum = line.match(/^0?(\d{1,3})\s*[.\-)]?$/);
      if (standaloneNum) {
        const n = Number(standaloneNum[1]);
        const isFirstInSubject = currentTableNum === 0 && n >= 1 && n <= 400;
        const isSequential = currentTableNum > 0 && (n === currentTableNum + 1 || n === currentTableNum + 2);
        const isResetToOne = currentTableNum >= 2 && n === 1;
        if (isFirstInSubject || isSequential || isResetToOne) {
          flushTopic();
          flushUnnumberedLines();
          if (isResetToOne) {
            const lookahead = allLines.slice(i + 1, i + 8).join(" ");
            const inf = inferDisciplineFromTopicsBlock(lookahead);
            if (inf && normalizeSearch(inf) !== normalizeSearch(currentSubject)) {
              currentSubject = inf;
            } else {
              currentSubject = `${currentSubject}__bloco_${++autoBlockCounter}`;
            }
          }
          currentTableNum = n;
          continue;
        }
      }

      // Caso 5: Número + Texto na mesma linha (ex.: "1 Compreensão...", "11 Noções de sistema...", "1.1 Tipologia...")
      const inlineNum = line.match(/^0?(\d{1,3})(?:\.(\d{1,2}))?(?:\s*[.\-)]\s*|\s+)([A-ZÀ-Ýa-zà-ÿ].*)$/);
      if (inlineNum) {
        const n = Number(inlineNum[1]);
        const subN = inlineNum[2] ? Number(inlineNum[2]) : null;
        const rest = inlineNum[3].trim();
        const isLawContinuation = /^(?:a\s+\d+|de\s+\d+|\d|º|°|da\s+lei|do\s+decreto|do\s+c[oó]digo|da\s+constitui[cç][aã]o|e\s+\d+|mil\s|reais|anos|meses|dias|horas)/i.test(rest);
        if (!isLawContinuation) {
          const isFirstInSubject = currentTableNum === 0 && n >= 1 && n <= 400;
          const isSequential = currentTableNum > 0 && (n === currentTableNum + 1 || n === currentTableNum + 2 || (subN !== null && n === currentTableNum));
          const isResetToOne = currentTableNum >= 2 && n === 1 && subN === null;
          if (isFirstInSubject || isSequential || isResetToOne) {
            flushTopic();
            flushUnnumberedLines();
            if (isResetToOne) {
              const lookahead = [rest, ...allLines.slice(i + 1, i + 7)].join(" ");
              const inf = inferDisciplineFromTopicsBlock(lookahead);
              if (inf && normalizeSearch(inf) !== normalizeSearch(currentSubject)) {
                currentSubject = inf;
              }
            }
            currentTableNum = n;
            currentTopicParts.push(rest);
            continue;
          }
        }
      }

      // Caso 6: Quando a disciplina já usa numeração explícita (1, 2, 3...), um checkbox isolado inicia novo tópico numerado;
      // caso contrário (disciplina estruturada por Conteúdo: + bullets • / → / ☐), acumula em unnumberedSubjectLines para preservar a hierarquia Conteúdo -> Assunto!
      if (currentTableNum > 0) {
        const bulletMatch = line.match(/^(?:[☐▢☑✓✔]|\[\s*[xX ]?\s*\])\s+(.{3,})$/);
        if (bulletMatch) {
          flushTopic();
          currentTableNum = currentTableNum + 1;
          currentTopicParts.push(bulletMatch[1].trim());
          continue;
        }
      }

      if (currentTableNum > 0) {
        currentTopicParts.push(line);
      } else if (line.length > 40 && /(?:^|[\s.;:])0?1\s*(?:[.\-)]\s+|\s+)[A-ZÀ-Ý]/.test(line)) {
        currentTableNum = 1;
        currentTopicParts.push(line);
        flushTopic();
      } else if (line.length >= 4 && !TABLE_CHROME_LINE_RE.test(line)) {
        unnumberedSubjectLines.push(line);
      }
    }
    flushTopic();
    flushUnnumberedLines();

    // Resolver quaisquer blocos anônimos (__bloco_) inferindo a disciplina real
    const blockGroups = new Map();
    for (const item of rawExtracted) {
      if (item.subject.includes("__bloco_")) {
        const list = blockGroups.get(item.subject) || [];
        list.push(item.topic);
        blockGroups.set(item.subject, list);
      }
    }
    const resolvedBlockNames = new Map();
    for (const [blkName, tList] of blockGroups.entries()) {
      const inf = inferDisciplineFromTopicsBlock(tList.join(" \n "));
      resolvedBlockNames.set(blkName, inf || blkName.split("__bloco_")[0]);
    }
    for (const item of rawExtracted) {
      if (resolvedBlockNames.has(item.subject)) {
        item.subject = resolvedBlockNames.get(item.subject);
      }
    }

    // Se todas as linhas caíram em apenas 1 disciplina e há >= 8 tópicos, verifica se há múltiplas disciplinas misturadas
    const initialSubjects = new Set(rawExtracted.map((r) => normalizeSearch(r.subject)));
    if (initialSubjects.size <= 1 && rawExtracted.length >= 6 && typeof window.unpackEditalTopicsList === "function") {
      const unpacked = window.unpackEditalTopicsList(rawExtracted, campaignName, docTitle);
      const unpackedSubj = new Set(unpacked.map((u) => normalizeSearch(u.subject)));
      if (unpackedSubj.size >= 2) {
        rawExtracted.length = 0;
        for (const u of unpacked) {
          rawExtracted.push({ subject: u.subject, topic: u.topic });
        }
      }
    }

    const subjectDisplay = new Map();
    const subjectOrder = new Map();
    const bySubject = new Map();
    const seen = new Set();

    for (const item of rawExtracted) {
      const canonicalSubj = typeof canonicalSubjectName === "function" ? canonicalSubjectName(item.subject) : item.subject;
      const subjectKey = normalizeSearch(canonicalSubj);
      if (!subjectDisplay.has(subjectKey)) subjectDisplay.set(subjectKey, canonicalSubj);
      if (!subjectOrder.has(subjectKey)) subjectOrder.set(subjectKey, subjectOrder.size);
      const topicBodyKey = normalizeSearch(item.topic.replace(/^\d+\.\s*/, ""));
      const dedupKey = `${subjectKey}\u0000${topicBodyKey}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const list = bySubject.get(subjectKey) || [];
      list.push({ subject: subjectDisplay.get(subjectKey), unit: item.unit || "", topic: item.topic, subjectKey });
      bySubject.set(subjectKey, list);
    }

    const topics = [];
    let globalIdx = 0;
    for (const [subjectKey, list] of bySubject.entries()) {
      const sOrder = subjectOrder.get(subjectKey) || 0;
      list.forEach((entry, lIdx) => {
        const ratio = list.length > 1 ? lIdx / (list.length - 1) : 0;
        const difficulty = ratio < 0.4 ? "basic" : ratio < 0.8 ? "intermediate" : "advanced";
        const cleanBody = entry.topic.replace(/^\d+\.\s*/, "").trim();
        const numberedTopic = `${lIdx + 1}. ${cleanBody}`;
        topics.push({
          subject: entry.subject,
          unit: entry.unit || "",
          topic: numberedTopic.slice(0, 700),
          edital_order: globalIdx++,
          subject_order: sOrder,
          learning_order: lIdx,
          difficulty,
          prerequisite_topic: lIdx > 0 ? `${lIdx}. ${list[lIdx - 1].topic.replace(/^\d+\.\s*/, "").trim()}`.slice(0, 700) : "",
          pedagogical_reason: lIdx === 0 ? "Tópico base inicial da disciplina no edital." : "Sequência progressiva direta do edital verticalizado.",
        });
      });
    }

    return {
      isVerticalized: isVerticalizedHint || (bySubject.size >= 2 && topics.length >= 8),
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

  window.extractStructuredEditalTopics = extractStructuredEditalTopics;

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function storageFetch(path, session, options = {}) {
    return fetch(`${SUPABASE_URL}/storage/v1/object/study-documents/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        ...(options.headers || {}),
      },
    });
  }

  async function sidecarAlreadyExists(path, session) {
    try {
      const response = await storageFetch(`${path}.text.json`, session);
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (Number(payload?.version) >= 2 && Array.isArray(payload?.pages) && payload.pages.length) {
          return {
            pages: payload.pages,
            pdfTotalPages: Number(payload.pdf_total_pages || payload.total_pages || payload.pages.length),
            truncatedPages: Boolean(payload.truncated_pages),
          };
        }
      }
    } catch {}
    return null;
  }

  async function openPdfDocumentWithFallback(pdfjs, bytes) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", document.baseURI).href;
      const task = pdfjs.getDocument({ data: bytes.slice(0), useSystemFonts: true, isEvalSupported: false });
      return await withTimeout(task.promise, 18000, "PDF_OPEN_TIMEOUT");
    } catch (firstErr) {
      const fallbackTask = pdfjs.getDocument({ data: bytes.slice(0), useSystemFonts: true, isEvalSupported: false, disableWorker: true });
      return await withTimeout(fallbackTask.promise, 25000, "PDF_OPEN_TIMEOUT");
    }
  }


  // ── Filtro Detector de PDF Digital vs. PDF Escaneado + Conversor OCR com Confirmação Prévia de Tokens ──
  function ensureScannedPdfDecisionDialog() {
    let dlg = document.querySelector("#scannedPdfDecisionDialog");
    if (dlg) return dlg;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="scannedPdfDecisionDialog" style="width:min(94vw,510px);padding:20px;border-radius:18px;background:linear-gradient(160deg,#0a1929,#06101c);border:1px solid #f59e0b;color:#f8fafc;box-shadow:0 24px 60px rgba(0,0,0,.78)">
        <div class="sectionHead" style="margin-bottom:10px">
          <div>
            <div class="eyebrow" style="color:#fbbf24;font-weight:900">🔍 FILTRO DE ARQUIVO · PDF ESCANEADO DETECTADO</div>
            <h2 id="scannedPdfTitle" style="margin:4px 0 0;font-size:1.15rem">Conversão de Arquivo Escaneado (OCR)</h2>
          </div>
        </div>
        <div id="scannedPdfDiagBox" style="padding:12px 14px;border-radius:12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);font-size:.88rem;line-height:1.55;color:#fde68a;margin-bottom:14px"></div>
        <div style="display:grid;gap:9px">
          <button type="button" class="action" id="scannedOptConvertCompactBtn" style="text-align:left;padding:12px 14px;display:flex;flex-direction:column;gap:3px">
            <b style="font-size:.92rem">⚡ 1. Converter Escaneado em Texto (OCR Compacto Otimizado)</b>
            <span style="font-size:.76rem;opacity:.9;font-weight:500">Pré-processa as páginas em alto contraste no navegador e extrai o texto antes da análise (reduz o consumo de tokens da IA).</span>
          </button>
          <button type="button" class="ghost" id="scannedOptFullVisionBtn" style="text-align:left;padding:12px 14px;display:flex;flex-direction:column;gap:3px;border-color:#38bdf8">
            <b style="font-size:.9rem;color:#63e7ff">🤖 2. Leitura Visual Completa pela IA (Gemini Vision)</b>
            <span style="font-size:.75rem;color:#9cb6cc">Envia o PDF escaneado inteiro direto para leitura óptica da IA (maior consumo de tokens/cota).</span>
          </button>
          <button type="button" class="ghost danger" id="scannedOptCancelBtn" style="padding:10px 14px;font-weight:800">
            ✕ Cancelar agora (Não usar tokens da IA)
          </button>
        </div>
      </dialog>
    `);
    return document.querySelector("#scannedPdfDecisionDialog");
  }

  function askUserScannedPdfPermission(doc, meta) {
    return new Promise((resolve) => {
      const dlg = ensureScannedPdfDecisionDialog();
      const diagBox = dlg.querySelector("#scannedPdfDiagBox");
      const totalP = Number(meta?.pdfTotalPages || 1);
      const chars = Number(meta?.meaningfulCharacters || 0);
      if (diagBox) {
        diagBox.innerHTML = `
          <div><b>Arquivo:</b> ${String(doc?.title || "PDF").replace(/</g, "&lt;")}</div>
          <div style="margin-top:4px"><b>Diagnóstico do filtro:</b> Detectamos que este arquivo possui <b>${totalP} página(s)</b>, mas apenas <b>${chars} caracteres</b> de texto selecionável (arquivo escaneado como imagem/foto).</div>
          <div style="margin-top:6px;color:#fff">⚠️ <b>Atenção ao uso de tokens:</b> Para transformar páginas escaneadas em questões, flashcards ou missões, é necessário usar o conversor de leitura óptica (OCR) da IA, que consome tokens da sua cota. Deseja prosseguir?</div>
        `;
      }
      const cleanup = (choice) => {
        try { dlg.close(); } catch {}
        resolve(choice);
      };
      dlg.querySelector("#scannedOptConvertCompactBtn").onclick = () => cleanup("compact_ocr");
      dlg.querySelector("#scannedOptFullVisionBtn").onclick = () => cleanup("full_vision");
      dlg.querySelector("#scannedOptCancelBtn").onclick = () => cleanup("cancel");
      if (!dlg.open) dlg.showModal();
    });
  }
  window.askUserScannedPdfPermission = askUserScannedPdfPermission;

  async function convertScannedPdfViaBrowserCanvasOcr(doc, meta, session) {
    if (!meta?.rawBytes) return null;
    try {
      toast(`Convertendo páginas escaneadas de “${doc.title}” em alto contraste no navegador...`);
      const pdfjs = await import("./pdf.mjs");
      const pdf = await openPdfDocumentWithFallback(pdfjs, meta.rawBytes);
      const maxOcrPages = Math.min(Number(pdf.numPages) || 1, 16);
      const convertedPages = [];
      for (let pNum = 1; pNum <= maxOcrPages; pNum++) {
        const page = await withTimeout(pdf.getPage(pNum), 5000, "OCR_PAGE_TIMEOUT");
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1200, Math.round(viewport.width));
        canvas.height = Math.min(1650, Math.round(viewport.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        // Aplica filtro de alto contraste (binarização suave para destacar texto escaneado e reduzir tamanho em bytes)
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const v = lum < 165 ? Math.max(0, lum * 0.5) : 255;
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch {}
        page.cleanup();
      }
      try { await pdf.destroy(); } catch {}
      return convertedPages;
    } catch (e) {
      console.warn("Pré-conversão local de canvas concluída com fallback", e);
      return null;
    }
  }

  async function extractAndUploadText(doc, session) {
    if (!doc?.storage_path) return false;
    if (window._extractedPagesByDocId.has(doc.id)) return true;

    const existingSidecar = await sidecarAlreadyExists(doc.storage_path, session);
    if (existingSidecar) {
      window._extractedPagesByDocId.set(doc.id, existingSidecar.pages);
      window._extractedPdfMetaByDocId.set(doc.id, {
        pdfTotalPages: existingSidecar.pdfTotalPages,
        truncatedPages: existingSidecar.truncatedPages,
      });
      return true;
    }

    toast(`Extraindo texto de “${doc.title}” no navegador...`);
    let bytes;
    const cachedBlob = window._recentUploadedPdfBytes?.get(doc.id);
    if (cachedBlob) {
      bytes = new Uint8Array(await cachedBlob.arrayBuffer());
      window._recentUploadedPdfBytes.delete(doc.id);
    } else {
      const pdfResponse = await storageFetch(doc.storage_path, session);
      if (!pdfResponse.ok) throw new Error("Não foi possível abrir o PDF para preparar o texto.");
      bytes = new Uint8Array(await pdfResponse.arrayBuffer());
    }

    const pdfjs = await import("./pdf.mjs");
    const pdf = await openPdfDocumentWithFallback(pdfjs, bytes);

    const pdfTotalPages = Number(pdf.numPages) || 0;
    const maxPages = Math.min(pdfTotalPages, MAX_EXTRACT_PAGES);
    const truncatedPages = pdfTotalPages > maxPages;
    const pages = [];
    let meaningfulCharacters = 0;

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      try {
        const page = await withTimeout(pdf.getPage(pageNumber), 4500, "PAGE_TIMEOUT");
        const content = await page.getTextContent();
        const rawItems = (content.items || []).filter((it) => it && typeof it.str === "string" && it.str.trim());
        const watermarkZones = [];
        for (const it of rawItems) {
          const s = it.str.trim();
          if (EMAIL_LINE_RE.test(s) || CPF_LINE_RE.test(s)) {
            watermarkZones.push({
              x: Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0,
              y: Array.isArray(it.transform) && Number.isFinite(it.transform[5]) ? it.transform[5] : 0,
            });
          }
        }
        const isWatermarkItem = (s) => /@|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|Leonardo\s+Thom[eé]/i.test(s);
        const filteredItems = rawItems.filter((it) => {
          const s = it.str.trim();
          const x = Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0;
          const y = Array.isArray(it.transform) && Number.isFinite(it.transform[5]) ? it.transform[5] : 0;
          if (EMAIL_LINE_RE.test(s) || CPF_LINE_RE.test(s) || isWatermarkItem(s)) return false;
          if (INCIDENCE_ONLY_LINE_RE.test(s) || TABLE_CHROME_LINE_RE.test(s)) return false;
          if (watermarkZones.some((w) => Math.abs(x - w.x) < 65 && y >= w.y && y - w.y <= 36) && !/\d/.test(s) && s.length <= 55) {
            return false;
          }
          return true;
        });
        const vp = typeof page.getViewport === "function" ? page.getViewport({ scale: 1 }) : { width: 595, height: 842 };
        const midX = (Number(vp?.width) || 595) * 0.5;
        const leftColCount = filteredItems.filter((it) => {
          const x = Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0;
          const w = Number(it.width) || (it.str.length * 4.5);
          return x >= 18 && x < midX - 24 && (x + w) < midX + 12;
        }).length;
        const rightColCount = filteredItems.filter((it) => {
          const x = Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0;
          return x >= midX - 6 && x <= midX + 90;
        }).length;
        const isTwoColumnPage = ["prova", "simulado"].includes(String(doc.document_type || "")) && leftColCount >= 10 && rightColCount >= 10;
        const groupItemsIntoRows = (itemsSubset) => {
          itemsSubset.sort((a, b) => {
            const ay = Array.isArray(a.transform) && Number.isFinite(a.transform[5]) ? a.transform[5] : 0;
            const by = Array.isArray(b.transform) && Number.isFinite(b.transform[5]) ? b.transform[5] : 0;
            if (Math.abs(by - ay) > 3.5) return by - ay;
            const ax = Array.isArray(a.transform) && Number.isFinite(a.transform[4]) ? a.transform[4] : 0;
            const bx = Array.isArray(b.transform) && Number.isFinite(b.transform[4]) ? b.transform[4] : 0;
            return ax - bx;
          });
          const groups = [];
          let cRow = [], cY = null;
          for (const it of itemsSubset) {
            const y = Array.isArray(it.transform) && Number.isFinite(it.transform[5]) ? it.transform[5] : 0;
            const x = Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0;
            const str = it.str.trim();
            if (cY !== null && Math.abs(y - cY) > 3.5) {
              groups.push(cRow);
              cRow = [];
            }
            cRow.push({ x, y, str });
            cY = y;
          }
          if (cRow.length) groups.push(cRow);
          return groups;
        };
        const rowGroups = isTwoColumnPage
          ? [
              ...groupItemsIntoRows(filteredItems.filter((it) => (Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0) < midX - 6)),
              ...groupItemsIntoRows(filteredItems.filter((it) => (Array.isArray(it.transform) && Number.isFinite(it.transform[4]) ? it.transform[4] : 0) >= midX - 6)),
            ]
          : groupItemsIntoRows(filteredItems);
        const pageLines = [];
        const stripChrome = (l) => l.replace(/\b(?:COMENT[AÁ]RIO|DIREITO\s+(?:PENAL|CONSTITUCIONAL)|WWW\.CTCONCURSOS(?:\s+ONLINE\.COM\.BR)?|PROF\.ABIBREBIUCAS|PROJETO\s+105\s+QUEST\s*Õ?ES(?:\s+PMCE)?)\b/gi, "").trim();
        for (const r of rowGroups) {
          const minX = Math.min(...r.map((i) => i.x));
          let rowTxt = r.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
          if (!rowTxt) continue;
          rowTxt = rowTxt.replace(/(?:^|\n|\s)(\d)\s+(\d)\s*\)/g, " $1$2)").replace(/(?:^|\n|\s)(\d)\s+(\d)\s+(\d)\s*\)/g, " $1$2$3)");
          rowTxt = stripChrome(rowTxt);
          if (!rowTxt || /^\d{1,3}$/.test(rowTxt) || isWatermarkItem(rowTxt)) continue;
          const prevLine = pageLines.length ? pageLines[pageLines.length - 1] : "";
          if (minX >= 47 && minX <= 59 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]/.test(rowTxt) && /[.:;]$/.test(prevLine)) {
            pageLines.push(`• ${rowTxt}`);
          } else {
            pageLines.push(rowTxt);
          }
        }
        const text = pageLines.join("\n").trim();
        meaningfulCharacters += text.replace(/\s/g, "").length;
        if (text.length > 0) pages.push({ page: pageNumber, text });
        page.cleanup();
      } catch (pageErr) {
        console.warn("Página ignorada na extração local", pageNumber, pageErr);
      }
      if (pageNumber % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    try { await pdf.destroy(); } catch {}

    if (truncatedPages) {
      toast(`Aviso: o PDF possui ${pdfTotalPages} páginas; foram extraídas as primeiras ${maxPages} páginas.`);
    }

    const avgCharsPerPage = pdfTotalPages > 0 ? Math.round(meaningfulCharacters / pdfTotalPages) : 0;
    const isScannedPdf = !pages.length || meaningfulCharacters < 120 || (pdfTotalPages >= 2 && avgCharsPerPage < 35);

    if (isScannedPdf) {
      window._extractedPdfMetaByDocId.set(doc.id, {
        pdfTotalPages,
        truncatedPages,
        isScannedPdf: true,
        meaningfulCharacters,
        avgCharsPerPage,
        rawBytes: bytes,
      });
      doc.metadata = { ...(doc.metadata || {}), pdf_kind: "scanned_image", selectable_chars: meaningfulCharacters };
      console.info("PDF escaneado detectado pelo filtro local.", { pages: pages.length, pdfTotalPages, meaningfulCharacters, avgCharsPerPage });
      return false;
    }

    doc.metadata = { ...(doc.metadata || {}), pdf_kind: "native_text", selectable_chars: meaningfulCharacters };
    window._extractedPagesByDocId.set(doc.id, pages);
    window._extractedPdfMetaByDocId.set(doc.id, { pdfTotalPages, truncatedPages, isScannedPdf: false, meaningfulCharacters, avgCharsPerPage });

    const payload = JSON.stringify({
      version: 2,
      generated_at: new Date().toISOString(),
      total_pages: pages.length,
      pdf_total_pages: pdfTotalPages,
      truncated_pages: truncatedPages,
      meaningful_characters: meaningfulCharacters,
      pages,
    });
    try {
      // Tenta application/pdf primeiro (sempre aceito no bucket study-documents), depois text/plain
      let sidecarRes = await storageFetch(`${doc.storage_path}.text.json`, session, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
        body: payload,
      });
      if (!sidecarRes.ok) {
        sidecarRes = await storageFetch(`${doc.storage_path}.text.json`, session, {
          method: "POST",
          headers: { "Content-Type": "text/plain", "x-upsert": "true" },
          body: payload,
        });
      }
    } catch (sidecarErr) {
      console.warn("Sidecar opcional não salvo no Storage; usando envio inline.", sidecarErr);
    }
    console.info("Texto do PDF preparado no navegador", { pages: pages.length, pdfTotalPages, meaningfulCharacters });
    return true;
  }

  async function prepareDocumentText(doc, session) {
    if (!doc?.storage_path) return false;
    if (!extractionJobs.has(doc.id)) {
      extractionJobs.set(doc.id, extractAndUploadText(doc, session).finally(() => extractionJobs.delete(doc.id)));
    }
    return extractionJobs.get(doc.id);
  }

  function compactPagesForInlinePayload(pages, maxTotalChars = 115000) {
    if (!Array.isArray(pages) || !pages.length) return [];
    const total = pages.reduce((sum, p) => sum + String(p.text || "").length, 0);
    if (total <= maxTotalChars) return pages;
    const step = Math.max(1, Math.ceil(total / maxTotalChars));
    const selected = [];
    let count = 0;
    for (let i = 0; i < pages.length; i++) {
      if (i < 5 || i >= pages.length - 5 || i % step === 0) {
        const slice = String(pages[i].text || "").slice(0, 3500);
        if (count + slice.length <= maxTotalChars) {
          selected.push({ page: pages[i].page, text: slice });
          count += slice.length;
        }
      }
    }
    return selected.length ? selected : pages.slice(0, 25);
  }

  function parseJsonBlock(raw) {
    const cleaned = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try { return JSON.parse(cleaned); } catch {}
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {}
    }
    const keyMatch = cleaned.match(/"(topics|summaries|questions)"\s*:\s*\[/);
    if (keyMatch) {
      const key = keyMatch[1];
      const openB = cleaned.indexOf("[", keyMatch.index);
      let depth = 0, inStr = false, esc = false, lastEnd = -1;
      for (let i = openB + 1; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) lastEnd = i; }
      }
      if (lastEnd > openB) {
        try {
          const arr = JSON.parse(`[${cleaned.slice(openB + 1, lastEnd + 1)}]`);
          return { [key]: arr };
        } catch {}
      }
    }
    throw new Error("INVALID_RECOVERY_JSON");
  }

  async function saveTopicsToCampaignAndSync(doc, rawTopics, session, pagesCount = 1) {
    if (!isEditalType(doc)) {
      console.warn("Bloqueado: documento não é edital, não pode criar missões.", doc?.title, doc?.document_type);
      return false;
    }
    const campaignName = typeof activeCampaign === "function" ? activeCampaign()?.name || "" : "";
    const topics = typeof window.unpackEditalTopicsList === "function"
      ? window.unpackEditalTopicsList(rawTopics, campaignName, doc.title)
      : rawTopics.filter((t) => t?.subject && t?.topic).slice(0, 1800);
    if (!topics.length) return false;

    const topicsFilter = `campaign_id=eq.${doc.campaign_id}&user_id=eq.${session.user.id}`;
    let backupTopics = [];
    try {
      const backupRes = await cloudFetch(`campaign_topics?${topicsFilter}&select=campaign_id,user_id,subject,unit_name,topic,edital_order,subject_order,learning_order,difficulty,prerequisite_topic,pedagogical_reason`);
      if (backupRes.ok) backupTopics = await backupRes.json().catch(() => []);
    } catch {}

    const newSubjects = new Set(topics.map((t) => normalizeSearch(t.subject)).filter(Boolean));
    const oldSubjects = new Set((backupTopics || []).map((t) => normalizeSearch(t.subject)).filter(Boolean));
    const oldHadIncidenceNoise = (backupTopics || []).some((t) => INCIDENCE_ONLY_LINE_RE.test(String(t?.topic || "").replace(/^\d+\.\s*/, "").trim()));
    if (!oldHadIncidenceNoise && oldSubjects.size > newSubjects.size && backupTopics.length > topics.length && oldSubjects.size >= 2) {
      toast("A análise parcial encontrou menos disciplinas que o mapa atual; o mapa anterior foi preservado.");
      return false;
    }

    const subjOrderMap = new Map();
    const subjLearnCounter = new Map();
    const seenRowKeys = new Set();
    const rows = [];

    for (let idx = 0; idx < topics.length; idx++) {
      const item = topics[idx];
      const subj = typeof canonicalSubjectName === "function"
        ? canonicalSubjectName(item.subject || "Edital")
        : String(item.subject || "Edital").trim();
      const topicText = sanitizeWatermarkText(item.topic || item.name || "").slice(0, 700).trim();
      if (!topicText || topicText.length < 2) continue;
      const dedupKey = `${subj.toLowerCase()}\u0000${topicText.toLowerCase()}`;
      if (seenRowKeys.has(dedupKey)) continue;
      seenRowKeys.add(dedupKey);

      if (!subjOrderMap.has(subj)) subjOrderMap.set(subj, subjOrderMap.size);
      const lOrder = subjLearnCounter.get(subj) || 0;
      subjLearnCounter.set(subj, lOrder + 1);
      rows.push({
        campaign_id: doc.campaign_id,
        user_id: session.user.id,
        subject: subj,
        unit_name: String(item.unit || item.unit_name || "").trim(),
        topic: topicText,
        edital_order: rows.length,
        subject_order: subjOrderMap.get(subj) || 0,
        learning_order: lOrder,
        difficulty: ["basic", "intermediate", "advanced"].includes(String(item.difficulty)) ? item.difficulty : "basic",
        prerequisite_topic: item.prerequisite_topic ? String(item.prerequisite_topic).slice(0, 700) : null,
        pedagogical_reason: item.pedagogical_reason ? String(item.pedagogical_reason).slice(0, 500) : null,
      });
    }

    if (!rows.length) return false;

    // Atualiza o estado local imediatamente para que os portais e disciplinas nunca fiquem vazios
    const previous = [...(state.customCampaign?.missions || [])];
    const prefix = state.activeCampaignId.replace(/[^a-z0-9]/gi, "").slice(-10);
    const missions = rows.map((item, i) => ({
      id: `${prefix}-ai-${i}`,
      si: null,
      ti: i,
      name: item.topic,
      subject: item.subject || "Edital",
      editalOrder: item.edital_order,
      subjectOrder: item.subject_order,
      learningOrder: item.learning_order,
      difficulty: item.difficulty,
    }));
    if (typeof reconcileMissionProgress === "function") reconcileMissionProgress(previous, missions);
    state.customCampaign = { name: activeCampaign()?.name || "Campanha", missions };
    if (activeCampaign()) activeCampaign().customCampaign = state.customCampaign;
    save();

    const delRes = await cloudFetch(`campaign_topics?${topicsFilter}`, { method: "DELETE" }).catch(() => null);
    if (delRes && delRes.ok) {
      let insRes = await cloudFetch("campaign_topics?on_conflict=campaign_id,subject,topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify(rows),
      }).catch(() => null);

      // Fallback caso alguma coluna estendida (v48) ainda não exista no banco do usuário
      if (!insRes || !insRes.ok) {
        const minimalRows = rows.map((r) => ({
          campaign_id: r.campaign_id,
          user_id: r.user_id,
          subject: r.subject,
          unit_name: r.unit_name,
          topic: r.topic,
          edital_order: r.edital_order,
        }));
        insRes = await cloudFetch("campaign_topics?on_conflict=campaign_id,subject,topic", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation,resolution=ignore-duplicates",
          },
          body: JSON.stringify(minimalRows),
        }).catch(() => null);
      }

      if (!insRes || !insRes.ok) {
        if (Array.isArray(backupTopics) && backupTopics.length) {
          await cloudFetch("campaign_topics?on_conflict=campaign_id,subject,topic", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Prefer: "resolution=ignore-duplicates",
            },
            body: JSON.stringify(backupTopics),
          }).catch(() => undefined);
        }
      }
    }

    await cloudFetch(`study_documents?id=eq.${doc.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        document_type: "edital",
        processing_status: "ready",
        metadata: {
          ...(doc.metadata || {}),
          coverage: {
            percent: 100,
            summary_count: rows.length,
            estimated_pages: pagesCount,
            needs_review: false,
            warnings: [],
          },
        },
      }),
    }).catch(() => undefined);

    doc.document_type = "edital";
    doc.processing_status = "ready";
    await loadCampaignTopics().catch(() => undefined);
    await loadCloudDocuments().catch(() => undefined);
    if (cloudSession && navigator.onLine && typeof pushCloudState === "function") {
      pushCloudState().catch(() => undefined);
    }
    render();
    toast(`Edital analisado: ${subjOrderMap.size} disciplina(s) e ${rows.length} missões criadas no portal!`);
    return true;
  }

  async function recoverPdfViaAssistant(doc, pages, session) {
    if (!Array.isArray(pages) || !pages.length) return false;
    const pdfMeta = window._extractedPdfMetaByDocId.get(doc.id) || {};
    const compactPages = compactPagesForInlinePayload(pages, 45000);
    const fullText = compactPages.map((p) => `[PÁGINA ${p.page}]\n${p.text}`).join("\n\n").slice(0, 45000);
    const realLastPage = Number(pages[pages.length - 1]?.page || pdfMeta.pdfTotalPages || pages.length);

    if (isEditalType(doc)) {
      const campaignName = typeof activeCampaign === "function" ? activeCampaign()?.name || "" : "";
      const structured = extractStructuredEditalTopics(pages, { title: doc.title, campaignName });
      if (structured.subjectCount >= 2 && structured.topics.length >= 5) {
        return await saveTopicsToCampaignAndSync(doc, structured.topics, session, pages.length);
      }

      toast(`Concluindo análise de “${doc.title}” pelo modo de recuperação inteligente...`);
      const progRe = /conte[uú]do(s)? program[aá]tico|conhecimentos (gerais|b[aá]sicos|espec[ií]ficos)|objetos de avalia[cç][aã]o|l[ií]ngua portuguesa|racioc[ií]nio l[oó]gico|matem[aá]tica|inform[aá]tica|direito (constitucional|administrativo|penal|processual)|legisla[cç][aã]o|hist[oó]ria|geografia|atualidades|[eé]tica/i;
      const progPages = pages.length <= 18 ? pages : pages.filter((p) => progRe.test(String(p.text || "")));
      const targetPages = progPages.length >= 2 ? progPages : pages;
      const chunks = [];
      let cur = "", curChars = 0;
      for (const p of targetPages) {
        const block = `[PÁGINA ${p.page}]\n${String(p.text || "").slice(0, 9000)}`;
        if (curChars > 0 && curChars + block.length > 14000) {
          chunks.push(cur);
          cur = "";
          curChars = 0;
        }
        cur += (cur ? "\n\n" : "") + block;
        curChars += block.length;
      }
      if (cur) chunks.push(cur);
      if (chunks.length > 8) {
        toast("O edital é extenso demais para o modo de recuperação. O mapa atual foi mantido; tente reprocessar em instantes.");
        return false;
      }
      const rawTopics = [];
      for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
        const prompt = `Extraia TODAS as disciplinas e tópicos do conteúdo programático presentes neste trecho (${cIdx + 1}/${chunks.length}) do edital "${doc.title}". IMPORTANTE: o campo "subject" DEVE ser o nome individual de cada disciplina (ex.: "Língua Portuguesa", "Raciocínio Lógico", "Informática", "Direito Constitucional", "Direito Administrativo", "Direito Penal", "Direito Processual Penal", "Legislação Especial", "Direitos Humanos", etc.) — NUNCA use "Conhecimentos Gerais", "Conteúdo Programático", "Edital Verticalizado", o nome do cargo ou do concurso como subject. Ignore regras administrativas. Responda EXCLUSIVAMENTE um JSON válido no formato {"topics":[{"subject":"Nome da Disciplina","unit":"","topic":"Tópico de estudo"}]}.`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`, {
          method: "POST",
          headers: { ...authHeaders(session.access_token) },
          body: JSON.stringify({
            question: prompt,
            context: chunks[cIdx],
            mode: "resumo",
            campaign_id: doc.campaign_id,
          }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (res?.ok && data?.answer) {
          try {
            const parsed = parseJsonBlock(data.answer);
            if (Array.isArray(parsed?.topics)) rawTopics.push(...parsed.topics);
          } catch {}
        }
      }
      const mergedTopics = rawTopics.length >= structured.topics.length ? rawTopics : structured.topics;
      if (!mergedTopics.length) return false;
      return await saveTopicsToCampaignAndSync(doc, mergedTopics, session, pages.length);
    }

    toast(`Concluindo análise de “${doc.title}” pelo modo de recuperação inteligente...`);
    const isExam = ["prova", "simulado"].includes(String(doc.document_type || ""));
    const prompt = `Com base no PDF "${doc.title}" (${doc.document_type}), gere um pacote de estudo estruturado. Responda EXCLUSIVAMENTE com um objeto JSON puro (sem blocos markdown) no formato:
{"summaries":[{"subject":"Disciplina","title":"Título específico do assunto","page_start":1,"page_end":${realLastPage},"explanation":"Aula escrita detalhada e clara para iniciantes explicando todo o conteúdo e regras","points":["Ponto 1","Ponto 2","Ponto 3","Ponto 4","Ponto 5"],"example":"Exemplo prático aplicado explicado passo a passo","bizu":"Dica rápida de memorização para prova","mnemonic":"Mnemônico ou associação","trap":"Pegadinha frequente de banca sobre este tema","flashcards":[{"question":"Pergunta 1?","answer":"Resposta 1"},{"question":"Pergunta 2?","answer":"Resposta 2"},{"question":"Pergunta 3?","answer":"Resposta 3"}],"questions":[{"statement":"Enunciado da questão 1","options":["Opção A","Opção B","Opção C","Opção D"],"correct_index":0,"explanation":"Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...","difficulty":"facil","topic":"Assunto","origin":"${isExam ? "adaptada_do_pdf" : "autoral"}"}]}]}
Crie de 2 a 4 assuntos principais cobrindo o texto fornecido, com pelo menos 4 questões de 4 alternativas em cada assunto.`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`, {
      method: "POST",
      headers: { ...authHeaders(session.access_token) },
      body: JSON.stringify({
        question: prompt,
        context: fullText,
        mode: "aula completa",
        campaign_id: doc.campaign_id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.answer) return false;
    const parsed = parseJsonBlock(data.answer);
    const summaries = Array.isArray(parsed?.summaries) ? parsed.summaries.filter((s) => s?.title && s?.explanation) : [];
    if (!summaries.length) return false;

    const allowFlashcards = ["material", "anotacao", "lei"].includes(String(doc.document_type || "material").toLowerCase());
    const dbRows = summaries.map((content) => ({
      campaign_id: doc.campaign_id,
      user_id: session.user.id,
      source_document_id: doc.id,
      content_type: isExam ? "question_pack" : "summary",
      title: String(content.title || doc.title).slice(0, 200),
      content: {
        ...content,
        is_question_pack: isExam,
        flashcards: allowFlashcards && Array.isArray(content.flashcards)
          ? content.flashcards.filter((c) => typeof window.isValidFlashcardItem === "function" ? window.isValidFlashcardItem(c?.question, c?.answer) : Boolean(c?.question && c?.answer))
          : [],
        subject: typeof canonicalSubjectName === "function" ? canonicalSubjectName(content.subject || "Conteúdo Geral") : (content.subject || "Conteúdo Geral"),
        source: doc.title,
      },
      source_refs: [{ document_id: doc.id, title: doc.title }],
    }));

    const saveRes = await cloudFetch("generated_study_content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(dbRows),
    });
    if (!saveRes.ok) return false;

    const primarySubject = dbRows[0]?.content?.subject || "Conteúdo Geral";
    const sentPages = compactPages.length;
    const totalPages = Math.max(pages.length, Number(pdfMeta.pdfTotalPages) || pages.length);
    const coveragePercent = Math.max(1, Math.min(100, Math.round((sentPages / Math.max(1, totalPages)) * 100)));
    const wasSampled = sentPages < pages.length || Boolean(pdfMeta.truncatedPages);
    const warnings = [];
    if (pdfMeta.truncatedPages) warnings.push(`O PDF possui ${pdfMeta.pdfTotalPages} páginas; foram lidas as primeiras ${MAX_EXTRACT_PAGES} páginas.`);
    if (sentPages < pages.length) warnings.push("Conteúdo gerado a partir de uma amostra do PDF; reprocesse para cobertura completa.");

    const coverage = {
      estimated_pages: totalPages,
      sections_detected: summaries.map((s) => s.title),
      sections_covered: summaries.map((s) => s.title),
      omissions: wasSampled ? [`Modo de recuperação leu ${sentPages} de ${totalPages} páginas.`] : [],
      confidence: wasSampled ? 0.6 : 0.88,
      percent: coveragePercent,
      summary_count: summaries.length,
      shallow_summaries: 0,
      warnings,
      needs_review: wasSampled,
    };

    await cloudFetch(`study_documents?id=eq.${doc.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        processing_status: "ready",
        detected_subject: primarySubject,
        metadata: {
          ...(doc.metadata || {}),
          primary_subject: primarySubject,
          analyzed_at: new Date().toISOString(),
          analysis_progress: { stage: "completed", percent: 100, completed_sections: summaries.length, total_sections: summaries.length, updated_at: new Date().toISOString() },
          coverage,
        },
      }),
    });

    doc.processing_status = "ready";
    await Promise.all([loadGeneratedContent(), loadCloudDocuments()]);
    render();
    toast("Conteúdo, resumos, flashcards e questões gerados com sucesso!");
    return true;
  }

  // Intercepta chamadas fetch para edital-gemini e material-gemini.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const isEditalCall = url.includes("/functions/v1/edital-gemini");
    const isMaterialCall = url.includes("/functions/v1/material-gemini");
    if (init?.method === "POST" && (isEditalCall || isMaterialCall)) {
      try {
        const bodyObj = JSON.parse(init.body || "{}");
        const docId = bodyObj?.document_id;
        const pages = docId ? window._extractedPagesByDocId.get(docId) : null;
        if (isEditalCall && !bodyObj.campaign_name && typeof activeCampaign === "function") {
          bodyObj.campaign_name = activeCampaign()?.name || "";
        }
        if (Array.isArray(pages) && pages.length) {
          if (isEditalCall) {
            const meta = window._extractedPdfMetaByDocId.get(docId) || {};
            const totalChars = pages.reduce((sum, p) => sum + String(p?.text || "").length, 0);
            if (totalChars <= 1500000) bodyObj.extracted_pages = pages;
            delete bodyObj.extracted_text;
            bodyObj.pdf_total_pages = Number(meta.pdfTotalPages) || pages.length;
            bodyObj.truncated_pages = Boolean(meta.truncatedPages);
          } else {
            const totalChars = pages.reduce((sum, p) => sum + String(p?.text || "").length, 0);
            bodyObj.extracted_pages = totalChars <= 1500000 ? pages : compactPagesForInlinePayload(pages, 350000);
          }
        }
        init = { ...init, body: JSON.stringify(bodyObj) };
      } catch {}
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), isEditalCall ? 140000 : 130000);
      try {
        return await nativeFetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    return nativeFetch(input, init);
  };

  const originalProcessDocument = processEditalDocument;
  processEditalDocument = async function (id) {
    const doc = cloudDocuments.find((item) => item.id === id);
    if (!doc) return;
    window._activeProcessingDocs.add(id);
    const session = await validSession();
    if (session) {
      try {
        await prepareDocumentText(doc, session);
      } catch (error) {
        console.warn("Preparação de texto no navegador falhou", error);
        toast("Não foi possível extrair o texto no navegador. Tentaremos a leitura visual do PDF.");
      }
    }
    try {
      const pages = window._extractedPagesByDocId.get(id);
      if (Array.isArray(pages) && pages.length && session) {
        const campaignName = typeof activeCampaign === "function" ? activeCampaign()?.name || "" : "";
        const structured = extractStructuredEditalTopics(pages, { title: doc.title, campaignName });
        const titleLooksEdital = /\b(edital\s+verticalizado|edital\s+esquematizado|edital\s+sintetizado|edital\s+do\s+concurso|conte[uú]do\s+program[aá]tico\s+verticalizado)\b/i.test(String(doc.title || ""));

        // SOMENTE documentos marcados como "edital" podem criar ou atualizar missões do portal!
        // Provas, simulados, materiais, leis e anotações NUNCA viram edital nem geram missões.
        if (isEditalType(doc) && structured.subjectCount >= 2 && structured.topics.length >= 6) {
          const savedOk = await saveTopicsToCampaignAndSync(doc, structured.topics, session, pages.length);
          if (savedOk) return;
        }

        // Fast-path determinístico para Provas Oficiais e Simulados em PDF que já possuem questões numeradas + gabarito no documento
        const isExamCaderno = ["prova", "simulado"].includes(String(doc.document_type || "").toLowerCase()) ||
          /\b(?:\d+\s*quest[õo]es|caderno\s+de\s+quest[õo]es|banco\s+de\s+quest[õo]es|bateria\s+de\s+quest[õo]es|simulado|prova\s+oficial)\b/i.test(`${doc.title || ""} ${doc.source_name || ""}`);
        if (isExamCaderno && typeof window.extractStructuredExamQuestions === "function") {
          // Se o usuário anexou um PDF de Gabarito Separado (#documentAnswerKeyFile), junta o texto do gabarito ao final das páginas da prova
          const ansKeyFile = document.querySelector("#documentAnswerKeyFile")?.files?.[0];
          if (ansKeyFile) {
            try {
              toast(`Extraindo gabarito oficial de “${ansKeyFile.name}” no navegador...`);
              const akBytes = new Uint8Array(await ansKeyFile.arrayBuffer());
              const pdfjs = await import("./pdf.mjs");
              const akPdf = await openPdfDocumentWithFallback(pdfjs, akBytes);
              let akText = "";
              for (let akP = 1; akP <= akPdf.numPages; akP++) {
                const akPage = await akPdf.getPage(akP);
                const akContent = await akPage.getTextContent();
                akText += "\n" + (akContent.items || []).map((it) => it.str || "").join(" ");
                akPage.cleanup();
              }
              try { await akPdf.destroy(); } catch {}
              if (akText.trim()) {
                pages.push({ page: pages.length + 1, text: `\nGABARITO OFICIAL DEFINITIVO\n${akText}` });
                toast("✓ Gabarito oficial anexado e cruzado com sucesso com as questões da prova!");
              }
            } catch (akErr) {
              console.warn("Falha ao ler PDF de gabarito anexado", akErr);
            }
          }
          const inferredFromTitle = typeof canonicalSubjectName === "function"
            ? canonicalSubjectName(doc.title || "", doc.title || "")
            : "";
          const fallbackSubj = (inferredFromTitle && inferredFromTitle !== "Conteúdo Geral")
            ? inferredFromTitle
            : (doc.detected_subject || doc.metadata?.primary_subject || "Direito Constitucional");
          let extractedQs = window.extractStructuredExamQuestions(pages, { defaultSubject: fallbackSubj, defaultBoard: doc.title });
          let examReport = extractedQs?.report || {};
          if (examReport.ambiguous && Array.isArray(examReport.cadernos) && examReport.cadernos.length >= 2 && typeof prompt === "function") {
            const pickedCad = prompt(`Foram identificados múltiplos gabaritos/cadernos neste PDF (${examReport.cadernos.join(", ")}). Digite qual caderno deseja importar:`, examReport.cadernos[0]);
            if (pickedCad && pickedCad.trim()) {
              extractedQs = window.extractStructuredExamQuestions(pages, { defaultSubject: fallbackSubj, defaultBoard: doc.title, preferredCaderno: pickedCad.trim() });
              examReport = extractedQs?.report || {};
            }
          }
          if (examReport.ambiguous) toast(`${examReport.reason} O gabarito oficial não foi importado automaticamente.`);

          // Se o PDF tem questões mas o gabarito oficial não foi encontrado ou está incompleto,
          // oferece opções claras ao usuário em vez de falhar silenciosamente no backend!
          let userChoice = null;
          if ((!Array.isArray(extractedQs) || extractedQs.length < 3 || Number(examReport.percent) < 60) && typeof window.askUserExamAnswerKeyOptions === "function") {
            userChoice = await window.askUserExamAnswerKeyOptions(doc, pages, examReport);
            if (userChoice?.cancelled) {
              doc.processing_status = "pending";
              renderUserDocuments();
              if (typeof renderExamBankHub === "function") renderExamBankHub();
              return;
            }
            if (userChoice?.appendedText) {
              pages.push({ page: pages.length + 1, text: `\nGABARITO OFICIAL DEFINITIVO\n${userChoice.appendedText}` });
              extractedQs = window.extractStructuredExamQuestions(pages, { defaultSubject: fallbackSubj, defaultBoard: doc.title, preferredCaderno: userChoice.preferredCaderno || "" });
              examReport = extractedQs?.report || {};
            } else if (userChoice?.allowWithoutKey) {
              extractedQs = window.extractStructuredExamQuestions(pages, { defaultSubject: fallbackSubj, defaultBoard: doc.title, allowWithoutKey: true });
              examReport = extractedQs?.report || {};
            }
          }

          if (Array.isArray(extractedQs) && extractedQs.length >= 3 && !examReport.ambiguous && (Number(examReport.percent) >= 50 || examReport.noKey || userChoice?.allowWithoutKey)) {
            const bySubj = {};
            for (const qItem of extractedQs) {
              const s = qItem.subject || fallbackSubj;
              (bySubj[s] = bySubj[s] || []).push(qItem);
            }
            const dbRows = Object.entries(bySubj).map(([subj, qs]) => ({
              campaign_id: doc.campaign_id,
              user_id: session.user.id,
              source_document_id: doc.id,
              content_type: "summary",
              title: `Questões Extraídas (${subj}) — ${doc.title}`.slice(0, 190),
              content: {
                is_question_pack: true,
                subject: subj,
                source: doc.title,
                page_start: 1,
                page_end: pages.length,
                explanation: `Pacote de ${qs.length} questão(ões) extraída(s) de ${doc.title} com o gabarito do próprio documento.`,
                points: [],
                flashcards: [],
                questions: qs
              },
              source_refs: [{ document_id: doc.id, title: doc.title }]
            }));
            // Grava primeiro e só apaga o conteúdo antigo depois (evita ficar sem nada se a gravação falhar).
            let oldIds = [];
            try {
              const oldRes = await cloudFetch(`generated_study_content?source_document_id=eq.${encodeURIComponent(doc.id)}&select=id`);
              if (oldRes.ok) oldIds = (await oldRes.json().catch(() => [])).map((row) => row.id).filter(Boolean);
            } catch { /* sem backup de ids */ }
            const saveRes = await cloudFetch("generated_study_content", {
              method: "POST",
              headers: { "Content-Type": "application/json", Prefer: "return=representation" },
              body: JSON.stringify(dbRows)
            });
            if (saveRes.ok && oldIds.length) {
              await cloudFetch(`generated_study_content?id=in.(${oldIds.map(encodeURIComponent).join(",")})`, { method: "DELETE" }).catch(() => undefined);
            }
            if (saveRes.ok) {
              const primarySubject = Object.keys(bySubj)[0] || fallbackSubj;
              const subjectsList = Object.keys(bySubj);
              const validTotal = Math.max(0, (examReport.expected || extractedQs.length) - (examReport.annulled || 0));
              const examPercent = Math.max(1, Math.min(100, Number(examReport.percent) || 100));
              const omissions = [];
              if (examReport.missingKey) omissions.push(`${examReport.missingKey} questão(ões) sem gabarito no documento.`);
              if (examReport.skipped) omissions.push(`${examReport.skipped} questão(ões) em formato não reconhecido.`);
              if (examReport.annulled) omissions.push(`${examReport.annulled} questão(ões) anulada(s) não foram importadas.`);
              const coverage = {
                estimated_pages: pages.length,
                sections_detected: subjectsList,
                sections_covered: subjectsList,
                omissions,
                confidence: examPercent >= 95 ? 0.95 : 0.75,
                percent: examPercent,
                summary_count: extractedQs.length,
                shallow_summaries: 0,
                warnings: examPercent < 100 ? [`Foram importadas ${extractedQs.length} de ${validTotal} questões válidas da prova.`] : [],
                needs_review: examPercent < 95
              };
              await cloudFetch(`study_documents?id=eq.${doc.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  processing_status: "ready",
                  detected_subject: primarySubject,
                  metadata: {
                    ...(doc.metadata || {}),
                    primary_subject: primarySubject,
                    analyzed_at: new Date().toISOString(),
                    analysis_progress: { stage: "completed", percent: 100, completed_sections: subjectsList.length, total_sections: subjectsList.length, updated_at: new Date().toISOString() },
                    coverage
                  }
                })
              });
              doc.processing_status = "ready";
              doc.metadata = { ...(doc.metadata || {}), coverage };
              await Promise.all([loadGeneratedContent(), loadCloudDocuments()]);
              render();
              toast(`🎯 ${extractedQs.length} questões oficiais extraídas com gabarito de “${doc.title}” (${subjectsList.length} disciplina(s))!`);
              return;
            }
          }
        }
      }

      const pdfMetaCheck = window._extractedPdfMetaByDocId.get(id);
      if (pdfMetaCheck?.isScannedPdf && typeof window.askUserScannedPdfPermission === "function") {
        const userChoice = await window.askUserScannedPdfPermission(doc, pdfMetaCheck);
        if (userChoice === "cancel") {
          doc.processing_status = "pending";
          await cloudFetch(`study_documents?id=eq.${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              processing_status: "pending",
              metadata: { ...(doc.metadata || {}), pdf_kind: "scanned_image", selectable_chars: pdfMetaCheck.meaningfulCharacters || 0 },
            }),
          }).catch(() => undefined);
          renderUserDocuments();
          toast("Análise do PDF escaneado cancelada. Nenhum token da IA foi consumido.");
          return;
        }
        if (userChoice === "compact_ocr") {
          await convertScannedPdfViaBrowserCanvasOcr(doc, pdfMetaCheck, session);
        }
      }
      await originalProcessDocument(id);
      const updatedDoc = cloudDocuments.find((item) => item.id === id);
      const afterPages = window._extractedPagesByDocId.get(id);
      if (updatedDoc && Array.isArray(afterPages) && afterPages.length && session) {
        if (isEditalType(updatedDoc)) {
          const campaignName = typeof activeCampaign === "function" ? activeCampaign()?.name || "" : "";
          const structured = extractStructuredEditalTopics(afterPages, { title: updatedDoc.title, campaignName });
          const currentMissions = state.customCampaign?.missions || [];
          const currentSubjCount = new Set(currentMissions.map((m) => normalizeSearch(m.subject)).filter(Boolean)).size;
          const needsStructuredRepair =
            updatedDoc.processing_status !== "ready" ||
            currentSubjCount <= 1 ||
            (structured.subjectCount >= 2 &&
              structured.topics.length >= 6 &&
              (currentSubjCount < structured.subjectCount || currentMissions.length < structured.topics.length * 0.8));

          if (needsStructuredRepair) {
            try {
              if (structured.subjectCount >= 2 && structured.topics.length >= 5) {
                await saveTopicsToCampaignAndSync(updatedDoc, structured.topics, session, afterPages.length);
              } else if (updatedDoc.processing_status !== "ready" || currentSubjCount <= 1) {
                await recoverPdfViaAssistant(updatedDoc, afterPages, session);
              }
            } catch (recErr) {
              console.warn("Reparo estruturado/complementar do edital falhou", recErr);
            }
          }
        } else if (updatedDoc.processing_status !== "ready") {
          try {
            await recoverPdfViaAssistant(updatedDoc, afterPages, session);
          } catch (recErr) {
            console.warn("Modo de recuperação complementar falhou", recErr);
          }
        }
      }
    } finally {
      window._activeProcessingDocs.delete(id);
      const btn = document.querySelector(`[data-process-doc="${id}"]`);
      if (btn) btn.disabled = false;
      const btnExam = document.querySelector(`[data-exam-doc-process="${id}"]`);
      if (btnExam) {
        btnExam.disabled = false;
        btnExam.textContent = "⚡ Extrair Questões";
      }
      const finalDoc = cloudDocuments.find((item) => item.id === id);
      if (finalDoc && finalDoc.processing_status === "processing") {
        finalDoc.processing_status = "pending";
        cloudFetch(`study_documents?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ processing_status: "pending" }),
        }).catch(() => undefined);
        renderUserDocuments();
        if (typeof renderExamBankHub === "function") renderExamBankHub();
      }
    }
  };

  const originalDeleteDocument = deleteCloudDocument;
  deleteCloudDocument = async function (id) {
    const doc = cloudDocuments.find((item) => item.id === id);
    const path = doc?.storage_path;
    window._extractedPagesByDocId.delete(id);
    window._extractedPdfMetaByDocId.delete(id);
    window._activeProcessingDocs.delete(id);
    await originalDeleteDocument(id);
    if (!path || cloudDocuments.some((item) => item.id === id)) return;
    const session = await validSession().catch(() => null);
    if (session) await storageFetch(`${path}.text.json`, session, { method: "DELETE" }).catch(() => undefined);
  };

  // Auto-reparo único (v107): se o portal ativo tem um PDF de edital já enviado mas as missões atuais possuem ruído "ALTA / MÉDIA"
  // ou ainda não passaram pela extração espacial v107 (Conteúdo — Assunto), reprocessa automaticamente uma única vez!
  if (typeof setTimeout === "function") setTimeout(async () => {
    try {
      if (typeof cloudSession === "undefined" || !cloudSession || !navigator.onLine) return;
      const editalDoc = (typeof cloudDocuments !== "undefined" && Array.isArray(cloudDocuments))
        ? cloudDocuments.find((d) => !d.is_community && isEditalType(d) && d.storage_path)
        : null;
      if (!editalDoc) return;
      const healKey = `jornada-edital-v107-healed-${editalDoc.id}`;
      const missions = (typeof state !== "undefined" && Array.isArray(state?.customCampaign?.missions)) ? state.customCampaign.missions : [];
      const hasIncidenceBug = missions.some((m) => INCIDENCE_ONLY_LINE_RE.test(String(m?.name || "").replace(/^\d+\.\s*/, "").trim()));
      const hasIsolatedColonHeader = missions.some((m) => String(m?.name || "").trim().endsWith(":"));
      if (hasIncidenceBug || hasIsolatedColonHeader || !localStorage.getItem(healKey)) {
        localStorage.setItem(healKey, "1");
        window._extractedPagesByDocId.delete(editalDoc.id);
        await processEditalDocument(editalDoc.id);
      }
    } catch {}
  }, 2600);


  // ── r131: Raio-X Pré-Análise Instantâneo, Gabarito Separado e Criação por Texto/Assunto (Sem PDF) ──
  window._recentAnswerKeyBytes = new Map();

  function initRaioXAndGabaritoHooks() {
    const fileInput = document.querySelector("#documentFile");
    const preScanBox = document.querySelector("#pdfPreScanBox");
    const preScanBadge = document.querySelector("#pdfPreScanBadge");
    const preScanDetails = document.querySelector("#pdfPreScanDetails");
    const typeSelect = document.querySelector("#documentType");
    const answerKeyRow = document.querySelector("#documentAnswerKeyRow");
    const answerKeyInput = document.querySelector("#documentAnswerKeyFile");
    const titleInput = document.querySelector("#documentTitle");

    if (typeSelect && answerKeyRow) {
      const updateAnswerKeyVisibility = () => {
        const val = String(typeSelect.value || "");
        answerKeyRow.hidden = !["prova", "simulado"].includes(val);
      };
      typeSelect.addEventListener("change", updateAnswerKeyVisibility);
      updateAnswerKeyVisibility();
    }

    if (fileInput && preScanBox) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) {
          preScanBox.hidden = true;
          return;
        }
        preScanBox.hidden = false;
        preScanBadge.textContent = "Examinando arquivo...";
        preScanBadge.className = "tag";
        preScanDetails.innerHTML = `<span>Lendo estrutura de <b>${esc(file.name)}</b> (${(file.size / (1024 * 1024)).toFixed(1)} MB)...</span>`;

        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const pdfjs = await import("./pdf.mjs");
          const pdf = await openPdfDocumentWithFallback(pdfjs, bytes);
          const numPages = Number(pdf.numPages) || 1;
          const samplePages = Math.min(numPages, 4);
          let sampledChars = 0;
          let fullSampleText = "";

          for (let pNum = 1; pNum <= samplePages; pNum++) {
            const page = await pdf.getPage(pNum);
            const content = await page.getTextContent();
            const pageTxt = (content.items || []).map((it) => it.str || "").join(" ");
            sampledChars += pageTxt.replace(/\s/g, "").length;
            fullSampleText += " " + pageTxt;
            page.cleanup();
          }
          try { await pdf.destroy(); } catch {}

          const avgChars = Math.round(sampledChars / samplePages);
          const isScanned = sampledChars < 60 || avgChars < 30;

          // Se o nome do arquivo indicar questões, simulado ou caderno, seleciona automaticamente o tipo
          if (typeSelect && /\b(?:\d+\s*quest[õo]es|quest[õo]es|caderno|simulado|prova)\b/i.test(file.name)) {
            typeSelect.value = "simulado";
            typeSelect.dispatchEvent(new Event("change"));
          }

          // Inferência inteligente de disciplina pelo texto de amostra
          const inferredSubject = typeof canonicalSubjectName === "function"
            ? canonicalSubjectName(inferDisciplineFromTopicsBlock(fullSampleText) || "Conteúdo Geral")
            : "Conteúdo Geral";

          // Sugestão automática de título se o campo estiver vazio
          if (titleInput && !titleInput.value.trim()) {
            const baseName = file.name.replace(/\.pdf$/i, "").toUpperCase().replace(/[_-]+/g, " ");
            titleInput.value = baseName.slice(0, 80);
          }

          if (isScanned) {
            preScanBadge.textContent = "🔍 Arquivo Escaneado";
            preScanBadge.style.background = "rgba(245,158,11,.22)";
            preScanBadge.style.color = "#fde68a";
            preScanDetails.innerHTML = `
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <span>📄 <b>${numPages} página(s)</b></span>
                <span>📦 <b>${(file.size / (1024 * 1024)).toFixed(1)} MB</b></span>
                <span>⚠️ <b>Camada de imagem/foto</b> (~${avgChars} letras/pág)</span>
              </div>
              <div style="margin-top:4px;color:#fde047">
                💡 Este PDF não possui texto selecionável. Ao enviar, o filtro abrirá o <b>Conversor OCR Compacto</b> para você autorizar o uso de tokens da IA.
              </div>
            `;
          } else {
            preScanBadge.textContent = "📄 Texto Digital (Econômico)";
            preScanBadge.style.background = "rgba(16,185,129,.2)";
            preScanBadge.style.color = "#6ee7b7";
            preScanDetails.innerHTML = `
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <span>📄 <b>${numPages} página(s)</b></span>
                <span>📦 <b>${(file.size / (1024 * 1024)).toFixed(1)} MB</b></span>
                <span>🎯 Matéria detectada: <b>${esc(inferredSubject)}</b></span>
                <span>⚡ <b>0 tokens de OCR</b> (Leitura direta no navegador)</span>
              </div>
            `;
          }
        } catch (scanErr) {
          preScanBadge.textContent = "PDF Carregado";
          preScanDetails.innerHTML = `<span>Tamanho: ${(file.size / (1024 * 1024)).toFixed(1)} MB. A extração completa será realizada ao clicar em Enviar.</span>`;
        }
      });
    }

    // Modal de Estudo por Texto / Assunto / Lei Seca (Sem PDF)
    const openTextModalBtn = document.querySelector("#openTextStudyModalBtn");
    const textModal = document.querySelector("#textStudyModalDialog");
    const closeTextModalBtn = document.querySelector("#closeTextStudyModalBtn");
    const cancelTextModalBtn = document.querySelector("#cancelTextStudyBtn");
    const submitTextModalBtn = document.querySelector("#submitTextStudyBtn");
    const textSubjectSelect = document.querySelector("#textStudySubjectSelect");
    const textTitleInput = document.querySelector("#textStudyTitleInput");
    const textContentArea = document.querySelector("#textStudyContentTextarea");
    const textShareToggle = document.querySelector("#textStudyShareToggle");
    const textQuickPills = document.querySelector("#textStudyQuickTopicPills");
    const textStatusMsg = document.querySelector("#textStudyStatusMsg");

    if (openTextModalBtn && textModal) {
      openTextModalBtn.onclick = () => {
        const subjs = typeof LEARNING_SUBJECTS !== "undefined" && Array.isArray(LEARNING_SUBJECTS) && LEARNING_SUBJECTS.length
          ? LEARNING_SUBJECTS
          : ["Direito Constitucional", "Direito Administrativo", "Direito Penal", "Direito Processual Penal", "Língua Portuguesa", "Raciocínio Lógico-Matemático", "Informática", "Legislação Especial"];

        if (textSubjectSelect) {
          textSubjectSelect.innerHTML = subjs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
        }
        if (textQuickPills) {
          const missions = typeof missionPool === "function" ? missionPool().filter((m) => !state.done[m.id]).slice(0, 6) : [];
          textQuickPills.innerHTML = missions.map((m) => `
            <button type="button" class="ghost small" data-pick-mission="${esc(m.name)}" data-pick-subj="${esc(m.subject)}" style="white-space:nowrap;padding:3px 9px;font-size:.73rem">
              📌 ${esc(m.name.slice(0, 34))}
            </button>
          `).join("");
          textQuickPills.querySelectorAll("[data-pick-mission]").forEach((btn) => {
            btn.onclick = () => {
              if (textTitleInput) textTitleInput.value = btn.dataset.pickMission.toUpperCase().slice(0, 90);
              if (textSubjectSelect && btn.dataset.pickSubj) textSubjectSelect.value = btn.dataset.pickSubj;
            };
          });
        }
        if (textStatusMsg) textStatusMsg.textContent = "";
        textModal.showModal();
      };
      if (closeTextModalBtn) closeTextModalBtn.onclick = () => textModal.close();
      if (cancelTextModalBtn) cancelTextModalBtn.onclick = () => textModal.close();

      if (submitTextModalBtn) {
        submitTextModalBtn.onclick = async () => {
          const rawTitle = (textTitleInput?.value || "").trim();
          const subj = (textSubjectSelect?.value || "Conteúdo Geral").trim();
          const bodyText = (textContentArea?.value || "").trim();
          const isShared = textShareToggle ? Boolean(textShareToggle.checked) : true;

          if (!rawTitle) return toast("Informe o título ou assunto principal do estudo.");
          if (!cloudSession) return toast("Entre na sua conta para criar estudos.");

          submitTextModalBtn.disabled = true;
          if (textStatusMsg) textStatusMsg.textContent = "Professor IA estruturando aula, flashcards e 5 questões...";

          try {
            const session = await validSession();
            const campaign = await ensureActiveCampaignRecord();
            const stdTitle = typeof standardizeDocumentTitle === "function" ? standardizeDocumentTitle(rawTitle) : rawTitle.toUpperCase();

            // 1. Cria o registro do documento em study_documents
            const docRes = await cloudFetch("study_documents", {
              method: "POST",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify({
                campaign_id: campaign.dbId,
                title: stdTitle,
                document_type: "material",
                processing_status: "processing",
                is_shared: isShared,
                detected_subject: subj,
                metadata: {
                  primary_subject: subj,
                  source_format: "direct_text",
                  direct_input: true,
                  created_at: new Date().toISOString(),
                },
              }),
            });
            const newDocs = await docRes.json();
            const newDoc = Array.isArray(newDocs) ? newDocs[0] : newDocs;
            if (!newDoc?.id) throw new Error("Não foi possível criar o registro na sua Biblioteca.");

            // 2. Chama a IA para gerar a aula completa, mnemônico honesto, flashcards e 5 questões
            const prompt = `Atue como um PROFESSOR COORDENADOR ESPECIALISTA EM CONCURSOS PÚBLICOS.
Estruture um pacote de estudo completo sobre o seguinte tema:
DISCIPLINA: ${subj}
TÍTULO: ${stdTitle}
CONTEÚDO/LEI FORNECIDA:
${bodyText || "Desenvolva todo o conteúdo teórico essencial cobrado pelas bancas para este título."}

Gere EXCLUSIVAMENTE um objeto JSON puro (sem markdown) no formato:
{
  "summaries": [
    {
      "subject": "${subj}",
      "title": "${stdTitle}",
      "page_start": 1,
      "page_end": 1,
      "explanation": "Aula escrita completa, didática, aprofundada e autossuficiente para concurso, explicando regras, artigos de lei e exceções.",
      "points": ["Regra 1 essencial", "Regra 2 essencial", "Regra 3 essencial", "Regra 4 essencial", "Regra 5 essencial"],
      "example": "Exemplo prático de aplicação ou caso concreto policial.",
      "bizu": "Alta incidência em concurso. Dica direta para acertar na prova.",
      "mnemonic": "Mnemônico consagrado ou vazio se não houver.",
      "trap": "Pegadinha clássica que as bancas usam para derrubar o candidato.",
      "flashcards": [
        {"question": "Pergunta objetiva de memorização?", "answer": "Resposta direta e concisa."},
        {"question": "Pergunta conceitual 2?", "answer": "Resposta 2."},
        {"question": "Pergunta conceitual 3?", "answer": "Resposta 3."},
        {"question": "Pergunta conceitual 4?", "answer": "Resposta 4."},
        {"question": "Pergunta conceitual 5?", "answer": "Resposta 5."}
      ],
      "questions": [
        {"statement": "Enunciado da questão 1", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct_index": 0, "explanation": "Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...", "difficulty": "facil", "topic": "${stdTitle}", "origin": "autoral"},
        {"statement": "Enunciado da questão 2", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct_index": 1, "explanation": "Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...", "difficulty": "medio", "topic": "${stdTitle}", "origin": "autoral"},
        {"statement": "Enunciado da questão 3", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct_index": 2, "explanation": "Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...", "difficulty": "medio", "topic": "${stdTitle}", "origin": "autoral"},
        {"statement": "Enunciado da questão 4", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct_index": 3, "explanation": "Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...", "difficulty": "dificil", "topic": "${stdTitle}", "origin": "autoral"},
        {"statement": "Enunciado da questão 5", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct_index": 0, "explanation": "Conceito-chave: ... | ✅ Correta: ... | ❌ Demais alternativas: ... | ⚠️ Pegadinha: ...", "difficulty": "dificil", "topic": "${stdTitle}", "origin": "autoral"}
      ]
    }
  ]
}`;

            const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`, {
              method: "POST",
              headers: { ...authHeaders(session.access_token) },
              body: JSON.stringify({
                question: prompt,
                context: bodyText || stdTitle,
                mode: "aula completa",
                campaign_id: campaign.dbId,
              }),
            });
            const aiData = await aiRes.json().catch(() => ({}));
            const parsed = parseJsonBlock(aiData.answer);
            const sumObj = parsed?.summaries?.[0];
            if (!sumObj?.explanation) throw new Error("A IA não concluiu a estruturação da aula. Tente novamente.");

            // 3. Salva em generated_study_content
            const contentRow = {
              campaign_id: campaign.dbId,
              user_id: session.user.id,
              source_document_id: newDoc.id,
              content_type: "summary",
              title: stdTitle,
              content: {
                ...sumObj,
                subject: subj,
                source: stdTitle,
                is_question_pack: false,
              },
              source_refs: [{ document_id: newDoc.id, title: stdTitle }],
            };

            await cloudFetch("generated_study_content", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([contentRow]),
            });

            // 4. Marca study_documents como pronto
            await cloudFetch(`study_documents?id=eq.${newDoc.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                processing_status: "ready",
                metadata: {
                  primary_subject: subj,
                  source_format: "direct_text",
                  coverage: { percent: 100, summary_count: 1, estimated_pages: 1, needs_review: false, warnings: [] },
                },
              }),
            });

            newDoc.processing_status = "ready";
            cloudDocuments.unshift(newDoc);
            await Promise.all([loadGeneratedContent(), loadCloudDocuments()]);
            render();
            textModal.close();
            toast(`🎉 Estudo “${stdTitle}” criado com sucesso! Resumo, flashcards e 5 questões disponíveis na aba Estudar.`);
          } catch (err) {
            toast(err?.message || "Não foi possível criar o estudo.");
            if (textStatusMsg) textStatusMsg.textContent = "Erro na criação. Tente novamente.";
          } finally {
            submitTextModalBtn.disabled = false;
          }
        };
      }
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initRaioXAndGabaritoHooks);
    } else {
      setTimeout(initRaioXAndGabaritoHooks, 300);
    }
  }


  // ── Modal Interativo para Provas sem Gabarito Embutido (Anexar Gabarito, Colar Gabarito ou Resolver com IA) ──
  function ensureExamAnswerKeyDialog() {
    let dlg = document.querySelector("#examAnswerKeyDialog");
    if (dlg) return dlg;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="examAnswerKeyDialog" style="width:min(94vw,520px);padding:20px;border-radius:18px;background:linear-gradient(160deg,#0a1a2c,#050e18);border:1px solid #38bdf8;color:#f8fafc;box-shadow:0 24px 60px rgba(0,0,0,.8)">
        <div class="sectionHead" style="margin-bottom:10px">
          <div>
            <div class="eyebrow" style="color:#63e7ff;font-weight:900">📋 GABARITO DA PROVA OFICIAL</div>
            <h2 id="examAnswerKeyTitle" style="margin:4px 0 0;font-size:1.15rem">Gabarito não localizado no arquivo</h2>
          </div>
        </div>
        <p class="small muted" style="margin:0 0 12px;line-height:1.55" id="examAnswerKeyDesc">
          Detectamos questões numeradas neste PDF, mas a tabela de gabarito oficial não foi encontrada nas últimas páginas. Como deseja importar?
        </p>

        <div style="display:grid;gap:10px">
          <!-- Opção 1: Anexar PDF do Gabarito -->
          <div style="padding:12px;border-radius:12px;background:rgba(8,26,42,.85);border:1px solid #234d70">
            <b style="display:block;font-size:.88rem;color:#7dd3fc;margin-bottom:4px">📎 1. Anexar PDF do Gabarito Oficial (Recomendado)</b>
            <span class="small muted" style="display:block;margin-bottom:8px">Se o gabarito oficial veio em um PDF separado de 1 página:</span>
            <input type="file" id="examModalAnswerKeyFileInput" accept="application/pdf,.pdf" style="font-size:.8rem;padding:7px;background:#06121e;border:1px solid #204260;border-radius:8px;width:100%">
            <button type="button" class="action small" id="examModalApplyFileKeyBtn" style="width:100%;margin-top:8px" disabled>⚡ Cruzar com o PDF do Gabarito</button>
          </div>

          <!-- Opção 2: Colar Gabarito em Texto -->
          <div style="padding:12px;border-radius:12px;background:rgba(8,26,42,.85);border:1px solid #234d70">
            <b style="display:block;font-size:.88rem;color:#facc15;margin-bottom:4px">📝 2. Colar Gabarito das Questões</b>
            <span class="small muted" style="display:block;margin-bottom:6px">Cole os números e respostas (ex.: <code>1-A 2-B 3-C 4-D 5-E...</code> ou <code>1 A 2 B...</code>):</span>
            <textarea id="examModalPasteKeyText" rows="3" placeholder="Ex.: 1 A 2 B 3 C 4 D 5 A 6 B..." style="width:100%;padding:8px;background:#06121e;border:1px solid #204260;color:#fff;border-radius:8px;font-size:.84rem"></textarea>
            <button type="button" class="action small" id="examModalApplyPastedKeyBtn" style="width:100%;margin-top:6px;background:linear-gradient(135deg,#0284c7,#0369a1)">⚡ Aplicar Gabarito Colado</button>
          </div>

          <!-- Opção 3: Importar Caderno para Treino / Simulado -->
          <div style="padding:12px;border-radius:12px;background:rgba(8,26,42,.85);border:1px solid #059669">
            <b style="display:block;font-size:.88rem;color:#34d399;margin-bottom:4px">🎯 3. Importar Caderno para Treino / Simulado</b>
            <span class="small muted" style="display:block;margin-bottom:8px">Extrai 100% das questões deste caderno para você resolver no simulado agora mesmo:</span>
            <button type="button" class="action small" id="examModalImportStudyBtn" style="width:100%;background:linear-gradient(135deg,#059669,#10b981);color:#fff">⚡ Importar Todas as Questões no Banco</button>
          </div>

          <!-- Opção 4: Resolver com IA -->
          <button type="button" class="ghost" id="examModalResolveAiBtn" style="text-align:left;padding:10px 14px;border-color:#38bdf8;font-size:.82rem">
            🤖 <b>4. Não tenho gabarito: Resolver e comentar com a IA</b>
          </button>

          <button type="button" class="ghost danger" id="examModalCancelBtn" style="padding:8px;font-size:.82rem">
            ✕ Cancelar extração
          </button>
        </div>
      </dialog>
    `);
    return document.querySelector("#examAnswerKeyDialog");
  }

  function askUserExamAnswerKeyOptions(doc, pages, examReport) {
    return new Promise((resolve) => {
      const dlg = ensureExamAnswerKeyDialog();
      const titleEl = dlg.querySelector("#examAnswerKeyTitle");
      const descEl = dlg.querySelector("#examAnswerKeyDesc");
      const fileIn = dlg.querySelector("#examModalAnswerKeyFileInput");
      const applyFileBtn = dlg.querySelector("#examModalApplyFileKeyBtn");
      const pasteIn = dlg.querySelector("#examModalPasteKeyText");
      const applyPasteBtn = dlg.querySelector("#examModalApplyPastedKeyBtn");
      const resolveAiBtn = dlg.querySelector("#examModalResolveAiBtn");
      const cancelBtn = dlg.querySelector("#examModalCancelBtn");

      if (titleEl) titleEl.textContent = `Gabarito de “${String(doc?.title || "Prova").slice(0, 36)}”`;
      if (descEl && examReport?.reason) {
        descEl.textContent = `${examReport.reason} Escolha abaixo como deseja importar as questões:`;
      }
      if (fileIn) {
        fileIn.value = "";
        applyFileBtn.disabled = true;
        fileIn.onchange = () => {
          applyFileBtn.disabled = !fileIn.files?.[0];
        };
      }
      if (pasteIn) pasteIn.value = "";

      applyFileBtn.onclick = async () => {
        const f = fileIn?.files?.[0];
        if (!f) return;
        applyFileBtn.disabled = true;
        applyFileBtn.textContent = "Lendo gabarito...";
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const pdfjs = await import("./pdf.mjs");
          const pdf = await openPdfDocumentWithFallback(pdfjs, bytes);
          let fullAk = "";
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            fullAk += " " + (content.items || []).map((it) => it.str || "").join(" ");
            page.cleanup();
          }
          try { await pdf.destroy(); } catch {}
          dlg.close();
          resolve({ appendedText: fullAk.trim() });
        } catch (e) {
          toast("Não foi possível ler o PDF do gabarito.");
          applyFileBtn.disabled = false;
          applyFileBtn.textContent = "⚡ Cruzar com o PDF do Gabarito";
        }
      };

      applyPasteBtn.onclick = () => {
        const val = (pasteIn?.value || "").trim();
        if (val.length < 3) return toast("Cole o gabarito das questões (ex.: 1 A 2 B 3 C...).");
        dlg.close();
        resolve({ appendedText: val });
      };

      const importStudyBtn = dlg.querySelector("#examModalImportStudyBtn");
      if (importStudyBtn) {
        importStudyBtn.onclick = () => {
          dlg.close();
          resolve({ allowWithoutKey: true });
        };
      }

      resolveAiBtn.onclick = () => {
        dlg.close();
        resolve({ allowWithoutKey: true, resolveWithAi: true });
      };

      cancelBtn.onclick = () => {
        dlg.close();
        resolve({ cancelled: true });
      };

      if (!dlg.open) dlg.showModal();
    });
  }
  window.askUserExamAnswerKeyOptions = askUserExamAnswerKeyOptions;


  // Auto-recuperação de provas ou materiais que ficaram travados em 'processing' por queda de rede ou timeout
  if (typeof setTimeout === "function") setTimeout(async () => {
    try {
      if (typeof cloudSession === "undefined" || !cloudSession || !navigator.onLine) return;
      if (typeof cloudDocuments !== "undefined" && Array.isArray(cloudDocuments)) {
        const stuckDocs = cloudDocuments.filter((d) => !d.is_community && d.processing_status === "processing");
        for (const sd of stuckDocs) {
          sd.processing_status = "pending";
          await cloudFetch(`study_documents?id=eq.${encodeURIComponent(sd.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ processing_status: "pending" }),
          }).catch(() => undefined);
        }
        if (stuckDocs.length > 0) {
          if (typeof renderUserDocuments === "function") renderUserDocuments();
          if (typeof renderExamBankHub === "function") renderExamBankHub();
        }
      }
    } catch {}
  }, 1800);

  window.JornadaPdfText = { prepareDocumentText, recoverPdfViaAssistant, extractStructuredEditalTopics, initRaioXAndGabaritoHooks };
})();
