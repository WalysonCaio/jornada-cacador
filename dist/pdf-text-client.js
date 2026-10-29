(function () {
  const extractionJobs = new Map();
  const isEditalType = (doc) => ["edital", "edital_concurso"].includes(String(doc?.document_type || ""));
  window._recentUploadedPdfBytes = window._recentUploadedPdfBytes || new Map();

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
    const response = await storageFetch(`${path}.text.json`, session);
    if (response.ok) return true;
    return false;
  }

  async function extractAndUploadText(doc, session) {
    if (!doc?.storage_path) return false;
    if (await sidecarAlreadyExists(doc.storage_path, session)) return true;

    toast(`Preparando o texto de “${doc.title}” no navegador. Você pode aguardar nesta tela.`);
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
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const pages = [];
    let meaningfulCharacters = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items || []) {
        if (!item || typeof item.str !== "string") continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      text = text.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      meaningfulCharacters += text.replace(/\s/g, "").length;
      pages.push({ page: pageNumber, text });
      page.cleanup();
      if (pageNumber % 3 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await pdf.destroy();

    const minChars = isEditalType(doc) ? Math.max(250, pages.length * 20) : Math.max(300, pages.length * 35);
    if (!pages.length || meaningfulCharacters < minChars) {
      console.info("PDF sem camada de texto suficiente; será usada a leitura visual.", { pages: pages.length, meaningfulCharacters });
      return false;
    }

    const payload = JSON.stringify({
      version: 1,
      generated_at: new Date().toISOString(),
      total_pages: pages.length,
      meaningful_characters: meaningfulCharacters,
      pages,
    });
    const upload = await storageFetch(`${doc.storage_path}.text.json`, session, {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
      body: payload,
    });
    if (!upload.ok) {
      const detail = await upload.json().catch(() => ({}));
      throw new Error(detail.message || detail.error || "Não foi possível salvar o texto preparado.");
    }
    console.info("Texto do PDF preparado no navegador", { pages: pages.length, meaningfulCharacters });
    return true;
  }

  async function prepareDocumentText(doc, session) {
    if (!doc?.storage_path) return false;
    if (!extractionJobs.has(doc.id)) {
      extractionJobs.set(doc.id, extractAndUploadText(doc, session).finally(() => extractionJobs.delete(doc.id)));
    }
    return extractionJobs.get(doc.id);
  }

  const originalProcessDocument = processEditalDocument;
  processEditalDocument = async function (id) {
    const doc = cloudDocuments.find((item) => item.id === id);
    if (doc) {
      const session = await validSession();
      if (session) {
        try {
          await prepareDocumentText(doc, session);
        } catch (error) {
          console.warn("Preparação de texto no navegador falhou", error);
          toast("Não foi possível extrair o texto no navegador. Tentaremos a leitura visual do PDF.");
        }
      }
    }
    return originalProcessDocument(id);
  };

  const originalDeleteDocument = deleteCloudDocument;
  deleteCloudDocument = async function (id) {
    const doc = cloudDocuments.find((item) => item.id === id);
    const path = doc?.storage_path;
    await originalDeleteDocument(id);
    if (!path || cloudDocuments.some((item) => item.id === id)) return;
    const session = await validSession().catch(() => null);
    if (session) await storageFetch(`${path}.text.json`, session, { method: "DELETE" }).catch(() => undefined);
  };

  window.JornadaPdfText = { prepareDocumentText };
})();
