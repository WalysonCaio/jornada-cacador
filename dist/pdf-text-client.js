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
  const TABLE_CHROME_LINE_RE = /^(leitura|-?\s*letra|da\s+lei|leitura\s*-\s*letra\s+da\s+lei|quest[oõ]|es|quest[oõ]es|acerto|s\s*\(\%\).*|acertos\s*\(\%\).*|tempo|revis[aã]|o|revis[aã]o|teoria|resumo|videoaula|pdf|status|conclu[ií]do|\(\%\))$/i;
  const ADMIN_ONLY_RE = /^(inscri(c|ç)(a|ã)o|cronograma|remunera(c|ç)(a|ã)o|vagas?|isen(c|ç)(a|ã)o|taxa de inscri(c|ç)(a|ã)o|resultado|recursos?|exame m[eé]dico|teste de aptid(a|ã)o f[ií]sica|investiga(c|ç)(a|ã)o social|documentos?|matr[ií]cula|curso de forma(c|ç)(a|ã)o)$/i;

  const GENERIC_SUBJECT_RE = /^(edital(\s+verticalizado|\s+do\s+concurso|\s+de\s+abertura|\s+esquematizado|\s+sintetizado|\s+n[ºo°]?\s*[\d\/.-]+)?.*|ciclo\s*\d+.*|conte[uú]do(s)?\s*program[aá]tico(s)?|conhecimentos?\s*(gerais|b[aá]sicos|espec[ií]ficos|complementares|t[eé]cnicos|profissionais)?|objetos?\s*de\s*avalia[cç][aã]o|disciplinas?|mat[eé]rias?|programa(s)?|anexo\s*[ivxlcdm\d]*.*|bloco\s*[ivxlcdm\d]*.*|m[oó]dulo\s*[ivxlcdm\d]*.*|parte\s*[ivxlcdm\d]*.*|geral|comum\s+a\s+todos.*|cargo\s*\d*.*|pol[ií]cia\s*(penal|militar|civil|federal|rodovi[aá]ria|cient[ií]fica|legislativa|judicial).*|corpo\s+de\s+bombeiros.*|guarda\s+(municipal|civil).*|agente\s+(penitenci[aá]rio|de\s+pol[ií]cia|socioeducativo).*|soldado.*|oficial.*|pm\s*pe.*|pp\s*pe.*|pc\s*pe.*|cbm\s*pe.*|prf.*|pf.*)$/i;

  const KNOWN_SUBJECT_HEADER_RE = /^(?:disciplina\s*:\s*|mat[eé]ria\s*:\s*)?(?:[ivxlcdm\d]{1,4}\s*[.\-–—)]\s*)?(l[ií]ngua\s+portuguesa|portugu[eê]s|interpreta[cç][aã]o\s+de\s+textos?|reda[cç][aã]o(\s+oficial|\s+discursiva)?|[eé]tica(\s+no\s+servi[cç]o\s+p[uú]blico|\s+na\s+administra[cç][aã]o\s+p[uú]blica|\s+p[uú]blica|\s+e\s+cidadania)?|racioc[ií]nio\s+l[oó]gico(\s*[-e/]\s*matem[aá]tico|\s+quantitativo)?|matem[aá]tica(\s+financeira|\s+b[aá]sica|\s+e\s+racioc[ií]nio\s+l[oó]gico)?|estat[ií]stica|(no[cç][oõ]es\s+de\s+)?inform[aá]tica|tecnologia\s+da\s+informa[cç][aã]o(\s+e\s+comunica[cç][aã]o)?|atualidades(\s*\(.*\)|\s+e\s+conhecimentos\s+gerais)?|conhecimentos\s+regionais.*|hist[oó]ria(\s+de\s+pernambuco|\s+do\s+brasil|\s+geral)?|geografia(\s+de\s+pernambuco|\s+do\s+brasil|\s+geral)?|(no[cç][oõ]es\s+de\s+)?direito\s+(constitucional|administrativo|penal(\s+militar)?|processual\s+penal(\s+militar)?|militar|civil|processual\s+civil|tribut[aá]rio|previdenci[aá]rio|eleitoral|do\s+trabalho|ambiental|financeiro|empresarial|consumidor|internacional|humanos).*|direitos?\s+humanos(\s+e\s+participa[cç][aã]o\s+social|\s+e\s+cidadania|\s+e\s+legisla[cç][aã]o.*)?|legisla[cç][aã]o\s+(estadual|especial|extravagante|institucional|penal(\s+especial)?|espec[ií]fica|municipal|de\s+tr[aâ]nsito|aplicada|pertinente|penitenci[aá]ria|do\s+sistema\s+prisional).*|leis?\s+(especiais|extravagantes|penais\s+especiais).*|estatuto.*|criminologia|(no[cç][oõ]es\s+de\s+)?criminologia|(no[cç][oõ]es\s+de\s+)?medicina\s+legal|(no[cç][oõ]es\s+de\s+)?administra[cç][aã]o(\s+p[uú]blica|\s+geral|\s+financeira\s+e\s+or[cç]ament[aá]ria)?|afo|arquivologia|(no[cç][oõ]es\s+de\s+)?arquivologia|contabilidade(\s+geral|\s+p[uú]blica)?|economia|l[ií]ngua\s+(inglesa|espanhola|estrangeira).*|ingl[eê]s|espanhol|f[ií]sica|qu[ií]mica|biologia|anatomia\s+humana|primeiros\s+socorros|defesa\s+civil)$/i;

  function sanitizeWatermarkText(value) {
    return String(value ?? "")
      .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "")
      .replace(/\b(?:cpf\s*:?\s*)?\d{3}\.?\d{3}\.?\d{3}[-./]\d{2}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isGenericSubjectName(value, campaignName = "", docTitle = "") {
    const s = normalizeSearch(value).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return true;
    if (KNOWN_SUBJECT_HEADER_RE.test(String(value ?? "").trim())) return false;
    if (GENERIC_SUBJECT_RE.test(s)) return true;
    const camp = normalizeSearch(campaignName).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (camp && (s === camp || (camp.length >= 4 && s.includes(camp)) || (s.length >= 4 && camp.includes(s)))) return true;
    const title = normalizeSearch(docTitle).replace(/\.pdf$/i, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (title && (s === title || (title.length >= 5 && s.includes(title)))) return true;
    return false;
  }

  function cleanEditalPageLines(pageText) {
    const rawLines = String(pageText ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const removeIdx = new Set();
    for (let i = 0; i < rawLines.length; i++) {
      if (EMAIL_LINE_RE.test(rawLines[i]) || CPF_LINE_RE.test(rawLines[i])) {
        removeIdx.add(i);
        if (i > 0 && EMAIL_LINE_RE.test(rawLines[i]) && !/\d/.test(rawLines[i - 1]) && rawLines[i - 1].length <= 65) {
          const prev = rawLines[i - 1];
          if (!KNOWN_SUBJECT_HEADER_RE.test(prev) && !GENERIC_SUBJECT_RE.test(normalizeSearch(prev))) {
            removeIdx.add(i - 1);
          }
        }
      }
    }
    const out = [];
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

  function splitNumberedTopicBlock(topic) {
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

  function isSubjectHeaderLine(line, nextLine, campaignName = "", docTitle = "") {
    const s = String(line || "").replace(/^\s*(?:disciplina|mat[eé]ria)\s*:\s*/i, "").trim();
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

  function extractStructuredEditalTopics(pages, options = {}) {
    if (!Array.isArray(pages) || !pages.length) {
      return { isVerticalized: false, subjectCount: 0, topics: [], meta: {} };
    }
    const campaignName = options.campaignName || "";
    const docTitle = options.title || "";
    const fullRawText = pages.map((p) => String(p?.text || "")).join("\n");
    const isVerticalizedHint = /verticalizado|ciclo\s*\d+|leitura\s*-\s*letra\s+da\s+lei|acertos\s*\(\%\)/i.test(`${docTitle}\n${fullRawText.slice(0, 4000)}`);

    const allLines = [];
    for (const p of pages) {
      allLines.push(...cleanEditalPageLines(p?.text || ""));
    }

    const rawExtracted = [];
    const perSubjectDisplayCount = new Map();
    let currentSubject = "";
    let currentTableNum = 0;
    let currentTopicParts = [];

    const flushTopic = () => {
      if (!currentSubject || !currentTopicParts.length) return;
      const rawBody = sanitizeWatermarkText(currentTopicParts.join(" ").replace(/\s+/g, " ").replace(/-\s+/g, "-").trim());
      currentTopicParts = [];
      if (rawBody.length < 3) return;
      const subKey = normalizeSearch(currentSubject);
      if (ADMIN_ONLY_RE.test(normalizeSearch(rawBody)) || normalizeSearch(rawBody) === subKey) return;
      const pieces = splitNumberedTopicBlock(rawBody);
      for (const piece of pieces) {
        const stripped = piece.replace(/^\d{1,2}\s*(?:[.\-)]\s*|\s+)/, "").trim();
        if (stripped.length < 2) continue;
        const nextCount = (perSubjectDisplayCount.get(subKey) || 0) + 1;
        perSubjectDisplayCount.set(subKey, nextCount);
        rawExtracted.push({
          subject: currentSubject,
          topic: `${nextCount}. ${stripped}`,
        });
      }
    };

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const nextLine = allLines[i + 1] || "";
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
      list.push({ subject: subjectDisplay.get(subjectKey), topic: item.topic, subjectKey });
      bySubject.set(subjectKey, list);
    }

    const topics = [];
    let globalIdx = 0;
    for (const [subjectKey, list] of bySubject.entries()) {
      const sOrder = subjectOrder.get(subjectKey) || 0;
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
        if (Array.isArray(payload?.pages) && payload.pages.length) {
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
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./pdf.worker.mjs", document.baseURI).href;
    const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false });
    let pdf;
    try {
      pdf = await withTimeout(loadingTask.promise, 25000, "PDF_OPEN_TIMEOUT");
    } catch (openErr) {
      try { await loadingTask.destroy(); } catch {}
      throw openErr;
    }

    const pdfTotalPages = Number(pdf.numPages) || 0;
    const maxPages = Math.min(pdfTotalPages, MAX_EXTRACT_PAGES);
    const truncatedPages = pdfTotalPages > maxPages;
    const pages = [];
    let meaningfulCharacters = 0;

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      try {
        const page = await withTimeout(pdf.getPage(pageNumber), 4500, "PAGE_TIMEOUT");
        const content = await page.getTextContent();
        let text = "";
        for (const item of content.items || []) {
          if (!item || typeof item.str !== "string") continue;
          text += item.str;
          text += item.hasEOL ? "\n" : " ";
        }
        text = text.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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

    if (!pages.length || meaningfulCharacters < 120) {
      console.info("PDF sem camada de texto selecionável suficiente; será usada a leitura visual.", { pages: pages.length, meaningfulCharacters });
      return false;
    }

    window._extractedPagesByDocId.set(doc.id, pages);
    window._extractedPdfMetaByDocId.set(doc.id, { pdfTotalPages, truncatedPages });

    const payload = JSON.stringify({
      version: 1,
      generated_at: new Date().toISOString(),
      total_pages: pages.length,
      pdf_total_pages: pdfTotalPages,
      truncated_pages: truncatedPages,
      meaningful_characters: meaningfulCharacters,
      pages,
    });
    try {
      let sidecarRes = await storageFetch(`${doc.storage_path}.text.json`, session, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8", "x-upsert": "true" },
        body: payload,
      });
      if (!sidecarRes.ok) {
        sidecarRes = await storageFetch(`${doc.storage_path}.text.json`, session, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-upsert": "true" },
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
    if (oldSubjects.size > newSubjects.size && backupTopics.length > topics.length && oldSubjects.size >= 2) {
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

    const delRes = await cloudFetch(`campaign_topics?${topicsFilter}`, { method: "DELETE" }).catch(() => null);
    if (!delRes || !delRes.ok) return false;

    const insRes = await cloudFetch("campaign_topics?on_conflict=campaign_id,subject,topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify(rows),
    }).catch(() => null);

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
      return false;
    }

    await cloudFetch(`study_documents?id=eq.${doc.id}`, {
      method: "PATCH",
      body: JSON.stringify({
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

    const previous = [...(state.customCampaign?.missions || [])];
    const prefix = state.activeCampaignId.replace(/[^a-z0-9]/gi, "").slice(-10);
    const missions = rows.map((item, i) => ({
      id: `${prefix}-ai-${i}`,
      si: null,
      ti: i,
      name: item.topic,
      subject: item.subject || "Edital",
    }));
    if (typeof reconcileMissionProgress === "function") reconcileMissionProgress(previous, missions);
    state.customCampaign = { name: activeCampaign()?.name || "Campanha", missions };
    if (activeCampaign()) activeCampaign().customCampaign = state.customCampaign;
    save();
    await loadCampaignTopics();
    doc.processing_status = "ready";
    await loadCloudDocuments();
    render();
    toast(`Edital analisado: ${subjOrderMap.size} disciplina(s) e ${rows.length} missões sincronizadas com sucesso!`);
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
      if (chunks.length > 6) {
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

    const dbRows = summaries.map((content) => ({
      campaign_id: doc.campaign_id,
      user_id: session.user.id,
      source_document_id: doc.id,
      content_type: "summary",
      title: String(content.title || doc.title).slice(0, 200),
      content: {
        ...content,
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
      await originalProcessDocument(id);
      const updatedDoc = cloudDocuments.find((item) => item.id === id);
      const pages = window._extractedPagesByDocId.get(id);
      if (updatedDoc && Array.isArray(pages) && pages.length && session) {
        if (isEditalType(updatedDoc)) {
          const campaignName = typeof activeCampaign === "function" ? activeCampaign()?.name || "" : "";
          const structured = extractStructuredEditalTopics(pages, { title: updatedDoc.title, campaignName });
          const currentMissions = state.customCampaign?.missions || [];
          const currentSubjCount = new Set(currentMissions.map((m) => normalizeSearch(m.subject)).filter(Boolean)).size;
          const needsStructuredRepair =
            updatedDoc.processing_status !== "ready" ||
            (structured.subjectCount >= 2 &&
              structured.topics.length >= 6 &&
              (currentSubjCount < structured.subjectCount || currentMissions.length < structured.topics.length * 0.8));

          if (needsStructuredRepair) {
            try {
              if (structured.subjectCount >= 2 && structured.topics.length >= 5) {
                await saveTopicsToCampaignAndSync(updatedDoc, structured.topics, session, pages.length);
              } else if (updatedDoc.processing_status !== "ready") {
                await recoverPdfViaAssistant(updatedDoc, pages, session);
              }
            } catch (recErr) {
              console.warn("Reparo estruturado/complementar do edital falhou", recErr);
            }
          }
        } else if (updatedDoc.processing_status !== "ready") {
          try {
            await recoverPdfViaAssistant(updatedDoc, pages, session);
          } catch (recErr) {
            console.warn("Modo de recuperação complementar falhou", recErr);
          }
        }
      }
    } finally {
      window._activeProcessingDocs.delete(id);
      const btn = document.querySelector(`[data-process-doc="${id}"]`);
      if (btn) btn.disabled = false;
      const finalDoc = cloudDocuments.find((item) => item.id === id);
      if (finalDoc && finalDoc.processing_status === "processing") {
        finalDoc.processing_status = "pending";
        cloudFetch(`study_documents?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ processing_status: "pending" }),
        }).catch(() => undefined);
        renderUserDocuments();
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

  window.JornadaPdfText = { prepareDocumentText, recoverPdfViaAssistant, extractStructuredEditalTopics };
})();
