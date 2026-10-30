(function () {
  const MAX_EXTRACT_PAGES = 600;
  const extractionJobs = new Map();
  const isEditalType = (doc) => ["edital", "edital_concurso"].includes(String(doc?.document_type || ""));
  window._recentUploadedPdfBytes = window._recentUploadedPdfBytes || new Map();
  window._extractedPagesByDocId = window._extractedPagesByDocId || new Map();
  window._extractedPdfMetaByDocId = window._extractedPdfMetaByDocId || new Map();
  window._activeProcessingDocs = window._activeProcessingDocs || new Set();

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
      // text/plain é permitido nativamente pela policy do bucket study-documents (20261002_v56_guardrails.sql)
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

  async function recoverPdfViaAssistant(doc, pages, session) {
    if (!Array.isArray(pages) || !pages.length) return false;
    const pdfMeta = window._extractedPdfMetaByDocId.get(doc.id) || {};
    const compactPages = compactPagesForInlinePayload(pages, 45000);
    const fullText = compactPages.map((p) => `[PÁGINA ${p.page}]\n${p.text}`).join("\n\n").slice(0, 45000);
    const realLastPage = Number(pages[pages.length - 1]?.page || pdfMeta.pdfTotalPages || pages.length);
    toast(`Concluindo análise de “${doc.title}” pelo modo de recuperação inteligente...`);

    if (isEditalType(doc)) {
      const fullChars = pages.reduce((sum, p) => sum + String(p.text || "").length, 0);
      if (fullChars > 45000) {
        // O modo de recuperação lê só ~45 mil caracteres. Gerar o mapa a partir de uma amostra
        // deixaria disciplinas de fora e ainda marcaria o edital como concluído.
        toast("O edital é extenso demais para o modo de recuperação. O mapa atual foi mantido; tente reprocessar em instantes.");
        return false;
      }
      const prompt = `Extraia o conteúdo programático (disciplinas e tópicos de estudo) deste edital de concurso ("${doc.title}"). Ignore regras de inscrição, taxas e datas administrativas. Responda EXCLUSIVAMENTE um JSON válido no formato {"topics":[{"subject":"Nome da Disciplina","unit":"","topic":"Tópico de estudo"}]}.`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/assistente-pmpe`, {
        method: "POST",
        headers: { ...authHeaders(session.access_token) },
        body: JSON.stringify({
          question: prompt,
          context: fullText,
          mode: "resumo",
          campaign_id: doc.campaign_id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.answer) return false;
      const parsed = parseJsonBlock(data.answer);
      const topics = Array.isArray(parsed?.topics) ? parsed.topics.filter((t) => t?.subject && t?.topic).slice(0, 800) : [];
      if (!topics.length) return false;

      const topicsFilter = `campaign_id=eq.${doc.campaign_id}&user_id=eq.${session.user.id}`;
      let backupTopics = [];
      try {
        const backupRes = await cloudFetch(`campaign_topics?${topicsFilter}&select=campaign_id,user_id,subject,unit_name,topic,edital_order,subject_order,learning_order,difficulty,prerequisite_topic,pedagogical_reason`);
        if (backupRes.ok) backupTopics = await backupRes.json().catch(() => []);
      } catch {}

      const rows = topics.map((item, idx) => ({
        campaign_id: doc.campaign_id,
        user_id: session.user.id,
        subject: String(item.subject || "Edital").trim(),
        unit_name: String(item.unit || "").trim(),
        topic: String(item.topic || "").trim(),
        edital_order: idx,
        subject_order: 0,
        learning_order: idx,
        difficulty: "basic",
      }));

      const delRes = await cloudFetch(`campaign_topics?${topicsFilter}`, { method: "DELETE" }).catch(() => null);
      if (!delRes || !delRes.ok) return false;

      const insRes = await cloudFetch("campaign_topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      }).catch(() => null);

      if (!insRes || !insRes.ok) {
        if (Array.isArray(backupTopics) && backupTopics.length) {
          await cloudFetch("campaign_topics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(backupTopics),
          }).catch(() => undefined);
        }
        return false;
      }

      await cloudFetch(`study_documents?id=eq.${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ processing_status: "ready" }),
      });
      const previous = [...(state.customCampaign?.missions || [])];
      const prefix = state.activeCampaignId.replace(/[^a-z0-9]/gi, "").slice(-10);
      const missions = topics.map((item, i) => ({
        id: `${prefix}-ai-${i}`,
        si: null,
        ti: i,
        name: item.topic || item.name,
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
      toast("Edital analisado e missões sincronizadas com sucesso!");
      return true;
    }

    // Recuperação inteligente para Material, Lei, Prova ou Simulado
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
  // Edital: envia TODAS as páginas extraídas (sem amostragem) e o servidor analisa em trechos.
  // Material: mantém o envio compactado e o limite de 80 s.
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
        if (Array.isArray(pages) && pages.length) {
          if (isEditalCall) {
            const meta = window._extractedPdfMetaByDocId.get(docId) || {};
            const totalChars = pages.reduce((sum, p) => sum + String(p?.text || "").length, 0);
            // Acima de ~1,5 milhão de caracteres o servidor lê o arquivo .text.json salvo no Storage.
            if (totalChars <= 1500000) bodyObj.extracted_pages = pages;
            delete bodyObj.extracted_text;
            bodyObj.pdf_total_pages = Number(meta.pdfTotalPages) || pages.length;
            bodyObj.truncated_pages = Boolean(meta.truncatedPages);
          } else {
            const totalChars = pages.reduce((sum, p) => sum + String(p?.text || "").length, 0);
            bodyObj.extracted_pages = totalChars <= 1500000 ? pages : compactPagesForInlinePayload(pages, 350000);
          }
          init = { ...init, body: JSON.stringify(bodyObj) };
        }
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
      if (updatedDoc && updatedDoc.processing_status !== "ready" && Array.isArray(pages) && pages.length && session) {
        try {
          await recoverPdfViaAssistant(updatedDoc, pages, session);
        } catch (recErr) {
          console.warn("Modo de recuperação complementar falhou", recErr);
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

  window.JornadaPdfText = { prepareDocumentText, recoverPdfViaAssistant };
})();
