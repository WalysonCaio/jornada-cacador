/* ============================================================================
 * Jornada do Caçador — Arquitetura Modular, Perfil Social e medição dos filtros (r178)
 * Módulo 1: Telemetria local dos filtros (relógio monotônico + p50/p95)
 * Módulo 2: Catálogo de Identificadores Estáveis (Disciplina → Assunto → Subassunto)
 * Módulo 3: Biblioteca Inteligente & Fontes Externas Gratuitas Confiáveis
 * Módulo 4: Promotor de Questões do Usuário para Banco Nativo Organizado
 * Módulo 5: Hub Social "Meu Perfil", Foto no Topo/Ranking/Chat, Visita a Perfis e Privacidade Granular
 * ============================================================================ */
(function () {
  'use strict';

  const JC_MODULES = (window.JC_MODULES = window.JC_MODULES || {});

  // Helper seguro para ler variáveis globais declaradas com let no script inline (state, ALL_QUESTIONS, etc.)
  function getAppState() {
    try { if (typeof state === 'object' && state) return state; } catch (_e) {}
    return window.state || {};
  }
  function getAllQuestions() {
    try { if (typeof ALL_QUESTIONS !== 'undefined' && Array.isArray(ALL_QUESTIONS)) return ALL_QUESTIONS; } catch (_e) {}
    return Array.isArray(window.ALL_QUESTIONS) ? window.ALL_QUESTIONS : [];
  }
  function getAllSummaries() {
    try { if (typeof ALL_SUMMARIES !== 'undefined' && Array.isArray(ALL_SUMMARIES)) return ALL_SUMMARIES; } catch (_e) {}
    return Array.isArray(window.ALL_SUMMARIES) ? window.ALL_SUMMARIES : [];
  }
  function getAllFlashcards() {
    try { if (typeof ALL_FLASHCARDS !== 'undefined' && Array.isArray(ALL_FLASHCARDS)) return ALL_FLASHCARDS; } catch (_e) {}
    return Array.isArray(window.ALL_FLASHCARDS) ? window.ALL_FLASHCARDS : [];
  }
  function getCloudDocs() {
    try { if (typeof cloudDocuments !== 'undefined' && Array.isArray(cloudDocuments)) return cloudDocuments; } catch (_e) {}
    return Array.isArray(window.cloudDocuments) ? window.cloudDocuments : [];
  }

  // ── 1. TELEMETRIA DE PERFORMANCE (Medição real da aba Questões e Filtros) ──
  const perfSamples = [];
  const MAX_SAMPLES = 60;
  const pendingMeasurements = new Map();
  const telemetryScope = () => {
    const app = getAppState();
    return JSON.stringify([app._ownerUserId || 'guest', app.activeCampaignId || '', Number(app._resetEpoch || 0)]);
  };
  const telemetryClock = () => typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  function percentile(sortedArr, p) {
    if (!sortedArr.length) return null;
    const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.ceil((p / 100) * sortedArr.length) - 1));
    return Number(sortedArr[idx].toFixed(2));
  }
  function validPerfSample(sample, name, scope) {
    return sample && sample.scope === scope && (!name || sample.name === name) &&
      typeof sample.durationMs === 'number' && Number.isFinite(sample.durationMs) && sample.durationMs >= 0 &&
      Number.isInteger(sample.bankSize) && sample.bankSize >= 0;
  }
  JC_MODULES.telemetry = {
    samples: perfSamples,
    markStart(name = 'jc_questions_tab_open') {
      if (typeof name !== 'string' || !name || name.length > 100) return;
      const start = telemetryClock();
      if (!Number.isFinite(start)) return;
      const scope = telemetryScope();
      pendingMeasurements.set(name, { start, scope });
    },
    markEnd(name = 'jc_questions_tab_open') {
      const pending = pendingMeasurements.get(name);
      pendingMeasurements.delete(name);
      const scope = telemetryScope(), end = telemetryClock();
      if (!pending || pending.scope !== scope || !Number.isFinite(end) || end < pending.start) return null;
      const sample = {
        name, scope,
        durationMs: Number((end - pending.start).toFixed(2)),
        bankSize: getAllQuestions().length,
        timestamp: new Date().toISOString(),
        measurement: 'synchronous_filters_render'
      };
      perfSamples.push(sample);
      if (perfSamples.length > MAX_SAMPLES) perfSamples.shift();
      try { localStorage.setItem('jc_telemetry_questions_v2:' + scope, JSON.stringify(perfSamples.filter(s => s.scope === scope).slice(-25))); } catch (_e) {}
      return sample;
    },
    getStats(name = 'jc_questions_tab_open') {
      const scope = telemetryScope();
      let list = perfSamples.filter(s => validPerfSample(s, name, scope));
      if (!list.length) {
        try {
          const saved = JSON.parse(localStorage.getItem('jc_telemetry_questions_v2:' + scope) || '[]');
          if (Array.isArray(saved)) list = saved.filter(s => validPerfSample(s, name, scope)).slice(-25);
        } catch (_e) {}
      }
      const durations = list.map(s => s.durationMs).sort((a, b) => a - b);
      const p95 = percentile(durations, 95), last = list[list.length - 1] || null;
      return {
        count: durations.length, sampleCount: durations.length,
        p50Ms: percentile(durations, 50), p95Ms: p95,
        lastMs: last ? last.durationMs : null,
        bankSize: last ? last.bankSize : getAllQuestions().length,
        measurement: 'synchronous_filters_render',
        status: !durations.length ? 'SEM_AMOSTRAS' : p95 <= 120 ? 'BAIXA_LATENCIA_LOCAL' : p95 <= 300 ? 'LATENCIA_MODERADA' : 'LATENCIA_ALTA'
      };
    }
  };
  window.getQuestionsTabTelemetry = () => JC_MODULES.telemetry.getStats('jc_questions_tab_open');

  // ── 2. CATÁLOGO HIERÁRQUICO COM IDs ESTÁVEIS (Disciplina → Assunto → Subassunto) ──
  const STABLE_TAXONOMY = [
    {
      id: 'disc_port',
      name: 'Língua Portuguesa',
      aliases: ['portugues', 'lingua portuguesa', 'gramatica', 'interpretacao de texto'],
      topics: [
        { id: 'port_comp', name: 'Compreensão e Interpretação de Textos', subtopics: ['Inferência', 'Implícitos e Pressupostos', 'Reescrita de Frases'], keywords: ['compreensao', 'interpretacao', 'infere-se', 'depreende-se', 'texto'] },
        { id: 'port_tipol', name: 'Tipologias e Gêneros Textuais', subtopics: ['Narração', 'Dissertação Argumentativa', 'Injuntivo e Expositivo'], keywords: ['tipologia', 'genero textual', 'narrativo', 'argumentativo', 'injuntivo'] },
        { id: 'port_coes', name: 'Coesão e Coerência Textual', subtopics: ['Coesão Anafórica', 'Coesão Catafórica', 'Conectivos e Conjunções'], keywords: ['coesao', 'anaforico', 'cataforico', 'conector', 'conjuncao', 'posto que', 'conquanto'] },
        { id: 'port_crase', name: 'Emprego do Sinal Indicativo de Crase', subtopics: ['Casos Obrigatórios', 'Casos Proibidos', 'Casos Facultativos'], keywords: ['crase', 'acento grave'] },
        { id: 'port_conc', name: 'Concordância Verbal e Nominal', subtopics: ['Verbos Impessoais (Haver/Fazer)', 'Partícula Apassivadora', 'Sujeito Composto'], keywords: ['concordancia', 'impessoal', 'haver', 'sujeito'] },
        { id: 'port_reg', name: 'Regência Verbal e Nominal', subtopics: ['Verbos Visar, Assistir, Aspirar, Implicar', 'Pronomes Relativos (Onde/Aonde/Cujo)'], keywords: ['regencia', 'preposicao', 'cujo', 'aonde'] },
        { id: 'port_pont', name: 'Pontuação e Sintaxe do Período', subtopics: ['Uso da Vírgula', 'Orações Subordinadas Adjetivas', 'Aposto e Vocativo'], keywords: ['pontuacao', 'virgula', 'oracao subordinada', 'aposto', 'sintaxe'] },
        { id: 'port_redof', name: 'Redação Oficial (Manual da Presidência)', subtopics: ['Atributos da Redação Oficial', 'Padrão Ofício', 'Pronomes de Tratamento'], keywords: ['redacao oficial', 'manual da presidencia', 'vossa excelencia', 'padrao oficio'] }
      ]
    },
    {
      id: 'disc_rlm',
      name: 'Raciocínio Lógico-Matemático',
      aliases: ['raciocinio logico', 'rlm', 'logica matematica', 'matematica'],
      topics: [
        { id: 'rlm_prop', name: 'Proposições, Conectivos e Tabela-Verdade', subtopics: ['Condicional (Se... então)', 'Bicondicional', 'Tautologia, Contradição e Contingência'], keywords: ['proposicao', 'tabela-verdade', 'tautologia', 'contradicao', 'contingencia'] },
        { id: 'rlm_neg', name: 'Negação de Condicional e Leis de De Morgan', subtopics: ['Regra do MANÉ (P ∧ ~Q)', 'Contrapositiva (~Q → ~P)', 'Equivalência Disjuntiva (NEYMAR)'], keywords: ['negacao', 'condicional', 'equivalencia', 'mane', 'de morgan'] },
        { id: 'rlm_quant', name: 'Quantificadores e Diagramas Lógicos', subtopics: ['Negação de Todo / Nenhum / Algum (PEA)', 'Silogismos'], keywords: ['quantificador', 'todo', 'nenhum', 'algum', 'diagrama logico'] },
        { id: 'rlm_pombos', name: 'Princípio da Casa dos Pombos (Gavetas de Dirichlet)', subtopics: ['Certeza Mínima no Pior Caso'], keywords: ['casa dos pombos', 'certeza', 'sorteio', 'urna', 'gavetas'] },
        { id: 'rlm_comb', name: 'Análise Combinatória e Probabilidade', subtopics: ['Permutação', 'Arranjo vs. Combinação', 'Probabilidade da União e Condicional'], keywords: ['combinatoria', 'permutacao', 'arranjo', 'combinacao', 'probabilidade', 'anagrama'] }
      ]
    },
    {
      id: 'disc_info',
      name: 'Informática',
      aliases: ['informatica', 'noções de informatica', 'tecnologia da informacao'],
      topics: [
        { id: 'info_seg', name: 'Segurança da Informação e Malwares', subtopics: ['Pilares DICA', 'Vírus, Worm, Ransomware, Trojan, Spyware', 'Phishing e Engenharia Social'], keywords: ['ransomware', 'malware', 'phishing', 'criptografia', 'worm', 'seguranca da informacao', 'backup'] },
        { id: 'info_redes', name: 'Redes de Computadores, Internet e Intranet', subtopics: ['Protocolos TCP/IP, HTTP/HTTPS, DNS, SMTP', 'Intranet, Extranet e VPN', 'Navegadores e Modo Anônimo'], keywords: ['intranet', 'extranet', 'protocolo', 'https', 'navegador', 'computacao em nuvem', 'cloud'] },
        { id: 'info_so', name: 'Sistemas Operacionais e Suítes de Escritório', subtopics: ['Windows 10/11 e Atalhos', 'Word / Writer', 'Excel / Calc (Fórmulas PROCV, SE, SOMA)'], keywords: ['windows', 'linux', 'excel', 'calc', 'libreoffice', 'planilha', 'atalho'] }
      ]
    },
    {
      id: 'disc_hist_pe',
      name: 'História de Pernambuco',
      aliases: ['historia de pernambuco', 'historia pe'],
      topics: [
        { id: 'hpe_cap', name: 'Capitanias Hereditárias e Período Colonial', subtopics: ['Duarte Coelho e Nova Lusitânia', 'Economia Açucareira e Olinda'], keywords: ['capitanias hereditarias', 'duarte coelho', 'nova lusitania', 'massape', 'olinda'] },
        { id: 'hpe_hol', name: 'Invasões Holandesas e Insurreição Pernambucana', subtopics: ['Maurício de Nassau (1637-1644)', 'Batalhas dos Montes Guararapes (1648-1649)'], keywords: ['invasoes holandesas', 'mauricio de nassau', 'guararapes', 'insurreicao pernambucana', 'wic'] },
        { id: 'hpe_masc', name: 'Guerra dos Mascates (1710–1711)', subtopics: ['Olinda vs. Recife', 'Pelourinho e Autonomia Municipal'], keywords: ['mascates', 'olinda', 'pelourinho'] },
        { id: 'hpe_1817', name: 'Revolução Pernambucana de 1817', subtopics: ['Revolução dos Padres', 'Governo Provisório de 74 Dias', 'Lei Orgânica de 1817'], keywords: ['1817', 'revolucao pernambucana', 'revolucao dos padres', 'domingos jose martins'] },
        { id: 'hpe_1824', name: 'Confederação do Equador (1824) e Revolução Praieira (1848)', subtopics: ['Frei Caneca e Poder Moderador', 'Manifesto ao Mundo e Rua da Praia'], keywords: ['confederacao do equador', '1824', 'frei caneca', 'praieira', '1848', 'manifesto ao mundo'] }
      ]
    },
    {
      id: 'disc_geo_pe',
      name: 'Geografia de Pernambuco',
      aliases: ['geografia de pernambuco', 'geografia pe'],
      topics: [
        { id: 'gpe_meso', name: 'Mesorregiões, Relevo, Clima e Hidrografia de Pernambuco', subtopics: ['RMR, Zona da Mata, Agreste, Sertão e São Francisco', 'Planalto da Borborema e Rios Capibaribe/Ipojuca/São Francisco'], keywords: ['mesorregiao', 'borborema', 'agreste', 'sertao', 'zona da mata', 'capibaribe', 'suape', 'noronha'] }
      ]
    },
    {
      id: 'disc_const',
      name: 'Direito Constitucional',
      aliases: ['direito constitucional', 'constitucional', 'cf/88'],
      topics: [
        { id: 'const_princ', name: 'Princípios Fundamentais (Arts. 1º a 4º CF/88)', subtopics: ['Fundamentos SO-CI-DI-VA-PLU', 'Objetivos CON-GA-ERRA-PRO', 'Relações Internacionais'], keywords: ['fundamentos da republica', 'objetivos fundamentais', 'soberania', 'dignidade da pessoa humana', 'pluralismo politico'] },
        { id: 'const_art5', name: 'Direitos e Deveres Individuais e Coletivos (Art. 5º CF/88)', subtopics: ['Inviolabilidade Domiciliar', 'Direito de Reunião e Liberdade Religiosa', 'Remédios Constitucionais (HC, MS, MI, HD, AP)'], keywords: ['asilo inviolavel', 'reuniao', 'religiosa', 'habeas corpus', 'mandado de seguranca', 'acao popular', 'direitos fundamentais', 'art. 5'] },
        { id: 'const_adm', name: 'Administração Pública Constitucional (Arts. 37 a 41)', subtopics: ['Princípios LIMPE', 'Acumulação de Cargos', 'Responsabilidade Civil Objetiva (Art. 37, § 6º)'], keywords: ['limpe', 'art. 37', 'acumulacao de cargos', 'improbridade', 'estabilidade'] },
        { id: 'const_seg', name: 'Segurança Pública (Art. 144 CF/88)', subtopics: ['Polícia Federal, PRF, Polícias Civis, PM, CBM e Polícia Penal', 'Polícia Ostensiva vs. Polícia Judiciária'], keywords: ['art. 144', 'seguranca publica', 'policia ostensiva', 'policia penal', 'preservacao da ordem publica'] }
      ]
    },
    {
      id: 'disc_adm',
      name: 'Direito Administrativo',
      aliases: ['direito administrativo', 'administrativo'],
      topics: [
        { id: 'adm_atos', name: 'Atos Administrativos e Poderes da Administração', subtopics: ['Requisitos CO-FI-FO-MO-OB', 'Atributos PATI', 'Anulação vs. Revogação (Súmula 473 STF)', 'Poder de Polícia'], keywords: ['ato administrativo', 'poder de policia', 'anulacao', 'revogacao', 'discricionario', 'vinculado'] },
        { id: 'adm_org', name: 'Organização Administrativa (Direta e Indireta)', subtopics: ['Desconcentração vs. Descentralização', 'Autarquias, Fundações, EP e SEM'], keywords: ['desconcentracao', 'descentralizacao', 'autarquia', 'administracao indireta'] }
      ]
    },
    {
      id: 'disc_penal',
      name: 'Direito Penal',
      aliases: ['direito penal', 'penal', 'codigo penal'],
      topics: [
        { id: 'pen_teoria', name: 'Aplicação da Lei Penal e Teoria do Crime', subtopics: ['Tempo e Lugar do Crime (LUTI)', 'Excludentes de Ilicitude (Art. 23 CP)', 'Culpabilidade e Imputabilidade'], keywords: ['legitima defesa', 'estado de necessidade', 'estrito cumprimento', 'ilicitude', 'culpabilidade', 'tentativa'] },
        { id: 'pen_esp', name: 'Crimes contra a Pessoa, Patrimônio e Administração Pública', subtopics: ['Homicídio e Lesão Corporal', 'Furto, Roubo e Extorsão', 'Peculato, Concussão, Corrupção e Prevaricação'], keywords: ['peculato', 'concussao', 'corrupcao passiva', 'prevaricacao', 'homicidio', 'roubo'] }
      ]
    },
    {
      id: 'disc_cpp',
      name: 'Direito Processual Penal',
      aliases: ['direito processual penal', 'processual penal', 'processo penal', 'codigo de processo penal', 'cpp'],
      topics: [
        { id: 'cpp_ip', name: 'Inquérito Policial, Ação Penal e Prisões', subtopics: ['Características do IP', 'Prisão em Flagrante, Preventiva e Temporária', 'Cadeia de Custódia da Prova'], keywords: ['inquerito policial', 'prisao em flagrante', 'prisao preventiva', 'cadeia de custodia', 'acao penal'] }
      ]
    },
    {
      id: 'disc_extrav',
      name: 'Legislação Extravagante',
      aliases: ['legislacao extravagante', 'leis penais especiais', 'leis extravagantes'],
      topics: [
        { id: 'ext_tort', name: 'Lei de Tortura (Lei nº 9.455/1997)', subtopics: ['Tortura-Prova, Tortura-Castigo e Tortura-Omissão', 'Perda Automática do Cargo'], keywords: ['9.455', 'lei de tortura', 'tortura-castigo', 'tortura'] },
        { id: 'ext_abuso', name: 'Lei de Abuso de Autoridade (Lei nº 13.869/2019)', subtopics: ['Dolo Específico e Crime de Hermenêutica', 'Efeitos da Condenação (Reincidência)'], keywords: ['13.869', 'abuso de autoridade', 'mero capricho', 'hermeneutica'] },
        { id: 'ext_hed', name: 'Crimes Hediondos (8.072/90), Maria da Penha (11.340/06), Drogas (11.343/06) e ECA', subtopics: ['Rol Taxativo Hediondos', 'Medidas Protetivas de Urgência', 'Tráfico vs. Porte para Consumo'], keywords: ['8.072', 'hediondos', 'maria da penha', '11.340', '11.343', '8.069', 'eca', 'racismo', '7.716', 'lep', '7.210'] }
      ]
    },
    {
      id: 'disc_dh',
      name: 'Direitos Humanos',
      aliases: ['direitos humanos', 'dudh'],
      topics: [
        { id: 'dh_dudh', name: 'Declaração Universal dos Direitos Humanos (DUDH), Pacto de São José e Regras de Mandela', subtopics: ['Resolução 217-A ONU (1948)', 'Convenção Americana (1969)', 'Isolamento Prolongado (>15 dias)'], keywords: ['dudh', 'declaracao universal', 'pacto de sao jose', 'regras de mandela', 'geracoes de direitos'] }
      ]
    },
    {
      id: 'disc_mil',
      name: 'Direito Militar',
      aliases: ['direito militar', 'estatuto pmpe', 'legislacao institucional'],
      topics: [
        { id: 'mil_est', name: 'Estatuto dos Policiais Militares de PE (Lei 6.783/74) e Código Disciplinar (Lei 11.817/00)', subtopics: ['Hierarquia e Disciplina', 'Círculos Hierárquicos, Agregação, Reversão e Reforma'], keywords: ['6.783', '11.817', 'hierarquia', 'disciplina', 'circulos hierarquicos', 'pracas', 'agregacao'] }
      ]
    },
    {
      id: 'disc_etica',
      name: 'Ética no Serviço Público',
      aliases: ['etica no servico publico', 'etica', 'codigo de etica'],
      topics: [
        { id: 'etica_dec', name: 'Código de Ética Profissional (Decreto 1.171/1994), Conduta Pública e Improbidade (Lei 8.429/92)', subtopics: ['Comissão de Ética e Penalidade de Censura', 'Vedação ao Nepotismo (Súmula Vinculante 13)', 'Dolo Específico na Nova LIA (Lei 14.230/21)'], keywords: ['1.171', 'comissao de etica', 'censura', 'improbidade', '8.429', '14.230', 'nepotismo', 'moralidade'] }
      ]
    }
  ];

  JC_MODULES.taxonomy = {
    catalog: STABLE_TAXONOMY,
    resolveStableTaxonomy(subjectStr, topicStr = '', statementStr = '') {
      const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const sNorm = norm(subjectStr);
      const tNorm = norm(topicStr);
      const stNorm = norm(statementStr);
      const stableId = text => {
        let hash = 2166136261;
        for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
        return hash.toString(36);
      };
      const containsPhrase = (text, phrase) => Boolean(phrase && (` ${text} `).includes(` ${phrase} `));
      const declaredSubject = typeof subjectStr === 'string' ? subjectStr.trim() : '';
      const subjectAlias = sNorm.replace(/^(?:nocoes|conhecimentos) (?:basicas |basicos |gerais |especificos )?de /, '');
      // Taxonomy enriches the declared discipline; it must not reclassify an
      // unknown subject as Constitutional, or match "penal" inside CPP.
      let disc = STABLE_TAXONOMY.find(d => [norm(d.name), ...d.aliases.map(norm)].includes(sNorm) ||
        [norm(d.name), ...d.aliases.map(norm)].includes(subjectAlias));
      const manual = (typeof window.isHunterManualArtifact === 'function' && window.isHunterManualArtifact(declaredSubject)) ||
        /\b(?:manuais|manual(?: oficial)?) do cacador\b/.test(sNorm);
      const invalidSubject = !declaredSubject || !sNorm || manual || /^(?:geral|conteudo geral|conteudo|sem disciplina|nao classificado)$/.test(sNorm) ||
        /^(?:\d+|questao\b|questoes\b|simulado\b|caderno\b)/.test(sNorm) ||
        (typeof window.isInvalidTrailSubject === 'function' && window.isInvalidTrailSubject(declaredSubject));
      if (!disc && !invalidSubject) {
        // Preserve valid disciplines not yet present in this small catalogue,
        // e.g. Biologia and Física. Their IDs do not depend on array position.
        disc = {id: `disc_custom_${stableId(sNorm)}`, name: declaredSubject, topics: []};
      }
      if (!disc || manual) return {
        subjectId: 'disc_nao_classificada', subjectName: 'Conteúdo Geral',
        topicId: null, topicName: String(topicStr || '').trim() || 'Assunto não classificado',
        subtopics: [], needsReview: true, topicNeedsReview: true
      };

      const genericTopic = !tNorm || /^(?:questao|item)\s*\d*\b|^(?:geral|conteudo geral)$/.test(tNorm);
      const genericKeywords = new Set(['texto', 'todo', 'nenhum', 'algum', 'haver', 'sujeito', 'disciplina']);
      const candidates = disc.topics.map(tp => {
        let score = tNorm === norm(tp.name) ? 100 : 0;
        if (!genericTopic && tNorm.length >= 4 && containsPhrase(norm(tp.name), tNorm)) score += 60;
        for (const keyword of tp.keywords) {
          const key = norm(keyword);
          if (!genericTopic && containsPhrase(tNorm, key)) score += 12;
          else if (genericTopic && !genericKeywords.has(key) && (key.includes(' ') || key.length >= 5) && containsPhrase(stNorm, key)) score += 3;
        }
        return {topic: tp, score};
      }).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const bestTopic = best?.score > 0 && (!candidates[1] || candidates[1].score < best.score) ? best.topic : null;
      return {
        subjectId: disc.id,
        subjectName: disc.name,
        topicId: bestTopic ? bestTopic.id : (genericTopic ? null : `${disc.id}_custom_${stableId(tNorm)}`),
        topicName: bestTopic ? bestTopic.name : (String(topicStr || '').trim() || 'Assunto não classificado'),
        subtopics: bestTopic ? [...bestTopic.subtopics] : [],
        needsReview: false,
        topicNeedsReview: !bestTopic
      };
    }
  };
  window.resolveStableTaxonomy = (s, t, st) => JC_MODULES.taxonomy.resolveStableTaxonomy(s, t, st);

  // ── 3. BIBLIOTECA INTELIGENTE COM ACERVO EXTERNO CONFIÁVEL E GRATUITO ──
  const TRUSTED_EXTERNAL_SOURCES_BY_SUBJECT = {
    'Direito Constitucional': [
      { name: 'Constituição Federal de 1988 Compilada — Portal da Legislação (Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'A Constituição e o Supremo — Jurisprudência por Artigo (STF)', url: 'https://portal.stf.jus.br/constituicao-supremo/', badge: '⚖️ Jurisprudência STF' },
      { name: 'Senado Federal — Constituição em Miúdos e Edições Gratuitas', url: 'https://www2.senado.leg.br/bdsf/item/id/644333', badge: '📘 Biblioteca do Senado' }
    ],
    'Direito Administrativo': [
      { name: 'Lei de Improbidade Administrativa Atualizada (Lei 8.429/92 c/ Lei 14.230/21 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Nova Lei de Licitações e Contratos (Lei 14.133/2021 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Súmulas do Superior Tribunal de Justiça (STJ — Administrativo)', url: 'https://scon.stj.jus.br/SCON/sumstj/', badge: '⚖️ Súmulas STJ' }
    ],
    'Direito Penal': [
      { name: 'Código Penal Compilado (Decreto-Lei nº 2.848/1940 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Jurisprudência em Teses — Direito Penal (STJ)', url: 'https://scon.stj.jus.br/SCON/jt/', badge: '⚖️ Jurisprudência em Teses STJ' }
    ],
    'Direito Processual Penal': [
      { name: 'Código de Processo Penal Compilado (Decreto-Lei nº 3.689/1941 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Pacote Anticrime e Cadeia de Custódia (Lei nº 13.964/2019 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13964.htm', badge: '🏛️ Fonte Oficial Planalto' }
    ],
    'Legislação Extravagante': [
      { name: 'Lei de Tortura (Lei nº 9.455/1997 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Nova Lei de Abuso de Autoridade (Lei nº 13.869/2019 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Lei dos Crimes Hediondos (Lei nº 8.072/1990 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Lei Maria da Penha (Lei nº 11.340/2006 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Lei de Drogas (Lei nº 11.343/2006 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm', badge: '🏛️ Fonte Oficial Planalto' }
    ],
    'Direito Militar': [
      { name: 'Estatuto dos Policiais Militares de Pernambuco (Lei Estadual nº 6.783/1974 — Alepe Legis)', url: 'https://legis.alepe.pe.gov.br/texto.aspx?id=2713', badge: '🏛️ Alepe Legis PE' },
      { name: 'Código Disciplinar dos Militares de Pernambuco (Lei Estadual nº 11.817/2000 — Alepe Legis)', url: 'https://legis.alepe.pe.gov.br/texto.aspx?id=3702', badge: '🏛️ Alepe Legis PE' }
    ],
    'Direitos Humanos': [
      { name: 'Declaração Universal dos Direitos Humanos (DUDH 1948 — ONU Brasil)', url: 'https://brasil.un.org/pt-br/91601-declaracao-universal-dos-direitos-humanos', badge: '🌐 Nações Unidas (ONU)' },
      { name: 'Pacto de São José da Costa Rica (Decreto nº 678/1992 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/decreto/d0678.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Regras de Nelson Mandela — Tratamento de Reclusos (CNJ / ONU)', url: 'https://www.cnj.jus.br/wp-content/uploads/2019/09/a9426e51735a4d0d8501f06a4ba8b4de.pdf', badge: '⚖️ CNJ Oficial' }
    ],
    'História de Pernambuco': [
      { name: 'Revolução Pernambucana de 1817 — Acervo Histórico Fundação Joaquim Nabuco (Fundaj/MEC)', url: 'https://www.gov.br/fundaj/pt-br', badge: '🏛️ Fundação Joaquim Nabuco' },
      { name: 'História de Pernambuco (Capitanias, Invasões Holandesas, Mascates, 1817, 1824 e Praieira)', url: 'https://pt.wikipedia.org/wiki/Hist%C3%B3ria_de_Pernambuco', badge: '📚 Enciclopédia Aberta' },
      { name: 'Revolução Pernambucana de 1817 — Artigo Histórico Completo', url: 'https://pt.wikipedia.org/wiki/Revolu%C3%A7%C3%A3o_Pernambucana', badge: '📚 Enciclopédia Aberta' }
    ],
    'Geografia de Pernambuco': [
      { name: 'IBGE Cidades e Estados — Panorama Oficial de Pernambuco', url: 'https://cidades.ibge.gov.br/brasil/pe/panorama', badge: '📊 IBGE Oficial' },
      { name: 'Geografia de Pernambuco (Mesorregiões, Relevo, Clima e Hidrografia)', url: 'https://pt.wikipedia.org/wiki/Geografia_de_Pernambuco', badge: '📚 Enciclopédia Aberta' }
    ],
    'Língua Portuguesa': [
      { name: 'Manual de Redação da Presidência da República (3ª Edição Revista e Atualizada — Planalto)', url: 'https://www4.planalto.gov.br/centrodeestudos/assuntos/manual-de-redacao-da-presidencia-da-republica/manual-de-redacao.pdf', badge: '🏛️ Manual Oficial Planalto' },
      { name: 'Vocabulário Ortográfico da Língua Portuguesa (VOLP — Academia Brasileira de Letras)', url: 'https://www.academia.org.br/nossa-lingua/busca-no-vocabulario', badge: '📘 Academia Brasileira de Letras' }
    ],
    'Informática': [
      { name: 'Cartilha de Segurança para Internet — CERT.br / NIC.br (Malwares, Golpes, Criptografia e Backup)', url: 'https://cartilha.cert.br/livro/cartilha-seguranca-internet.pdf', badge: '🛡️ CERT.br Oficial' },
      { name: 'Documentação de Ajuda e Fórmulas do LibreOffice Calc / Writer (Português)', url: 'https://help.libreoffice.org/latest/pt-BR/text/shared/05/new_help.html', badge: '💻 Documentação Oficial' }
    ],
    'Raciocínio Lógico-Matemático': [
      { name: 'Portal da Matemática OBMEP / IMPA — Apostilas e Aulas Gratuitas de Lógica e Combinatória', url: 'https://portaldaobmep.impa.br/', badge: '📐 IMPA / OBMEP Oficial' },
      { name: 'Lógica Proposicional, Tabela-Verdade e Leis de De Morgan — Referência Aberta', url: 'https://pt.wikipedia.org/wiki/L%C3%B3gica_proposicional', badge: '📚 Enciclopédia Aberta' }
    ],
    'Ética no Serviço Público': [
      { name: 'Código de Ética Profissional do Servidor Público Federal (Decreto nº 1.171/1994 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/decreto/d1171.htm', badge: '🏛️ Fonte Oficial Planalto' },
      { name: 'Lei de Improbidade Administrativa Atualizada (Lei nº 8.429/1992 — Planalto)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm', badge: '🏛️ Fonte Oficial Planalto' }
    ]
  };

  JC_MODULES.smartLibrary = {
    getTrustedExternalSources(subject, topic = '') {
      const tax = JC_MODULES.taxonomy.resolveStableTaxonomy(subject, topic);
      if (tax.needsReview) return [];
      const list = TRUSTED_EXTERNAL_SOURCES_BY_SUBJECT[tax.subjectName] || [];
      const q = encodeURIComponent(`${subject} ${topic || ''} concurso`.trim());
      return [
        ...list,
        {
          name: `Pesquisar "${topic || subject}" na Wikipédia em português`,
          url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(topic || subject)}`,
          badge: '🔎 Busca Enciclopédica'
        },
        {
          name: `Pesquisar "${topic || subject}" no Google Acadêmico`,
          url: `https://scholar.google.com.br/scholar?q=${q}`,
          badge: '🎓 Google Acadêmico'
        }
      ];
    },
    async fetchLiveWikipediaTopicExtract(topic, subject) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
      const queryTerm = String(topic || subject || '').replace(/\b(item\s+\d+|topicos\s+essenciais\s+de)\b/gi, '').trim();
      if (!queryTerm) return null;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
      const requestOptions = controller ? {signal: controller.signal} : {};
      try {
        const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryTerm + ' ' + subject)}&utf8=&format=json&origin=*&srlimit=1`;
        const res = await fetch(searchUrl, requestOptions);
        if (!res.ok) return null;
        const data = await res.json();
        const firstHit = data?.query?.search?.[0];
        if (!firstHit?.title) return null;
        const sumUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit.title)}`;
        const sumRes = await fetch(sumUrl, requestOptions);
        if (!sumRes.ok) return null;
        const sumData = await sumRes.json();
        if (typeof sumData?.extract !== 'string' || !sumData.extract.trim()) return null;
        return {
          title: String(sumData.title || firstHit.title),
          extract: sumData.extract.slice(0, 20000),
          // The API response is external data, not an HTML-safe link. Build
          // the URL on the known HTTPS host rather than trusting pageUrl.
          pageUrl: `https://pt.wikipedia.org/wiki/${encodeURIComponent(sumData.title || firstHit.title)}`
        };
      } catch (_e) {
        return null;
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    }
  };
  window.getTrustedExternalSources = (s, t) => JC_MODULES.smartLibrary.getTrustedExternalSources(s, t);

  // ── 4. PROMOTOR DE QUESTÕES DO USUÁRIO PARA BANCO NATIVO ORGANIZADO ──
  function normalizeKey(str) {
    // Keep mathematical operators, punctuation and accents: 2+2 and 2-2
    // must never collapse into the same question/alternative fingerprint.
    return String(str || '').normalize('NFC').replace(/\s+/g, ' ').toLowerCase().trim();
  }

  function consolidatedOptionText(option) {
    if (typeof window.answerOptionText === 'function') return window.answerOptionText(option);
    const text = option.normalize('NFC').replace(/\s+/g, ' ').trim();
    return text.length <= 3 ? text : text.replace(/^(?:alternativa\s+|letra\s+|item\s+)?(?:\([A-Ea-e]\)|\[[A-Ea-e]\]|[A-Ea-e]\s*[\)\-–—:]|[A-Ea-e]\.\s+)\s*(?=\S)/i, '');
  }

  function promotedBankScope() {
    const st = getAppState();
    const session = typeof cloudSession !== 'undefined' ? cloudSession : window.cloudSession;
    return {
      userId: String(session?.user?.id || st._ownerUserId || 'guest'),
      campaignId: String(st.activeCampaignId || 'default'),
      resetEpoch: Number(st._resetEpoch || 0)
    };
  }

  function promotedBankStorageKey(scope = promotedBankScope()) {
    return `jc_promoted_native_bank_v2:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.campaignId)}:${scope.resetEpoch}`;
  }

  function consolidateUserQuestionsIntoNativeBank(options = { saveToStorage: true, showToast: true }) {
    options = { saveToStorage: true, showToast: true, ...options };
    const allQs = getAllQuestions();
    const baseNative = Array.isArray(window.NATIVE_POLICE_QUESTION_BANK) ? window.NATIVE_POLICE_QUESTION_BANK : [];
    const scope = promotedBankScope();
    const storageKey = promotedBankStorageKey(scope);
    const appState = getAppState();
    const session = typeof cloudSession !== 'undefined' ? cloudSession : window.cloudSession;
    const scopeReady = !session?.user?.id || !appState._ownerUserId || String(appState._ownerUserId) === scope.userId;
    const currentCampaign = (getAppState().campaigns || []).find(c => String(c.id) === scope.campaignId);
    const campaignIds = new Set([scope.campaignId, currentCampaign?.dbId].filter(Boolean).map(String));
    const nativeIds = new Set(baseNative.map(q => q?.id).filter(Boolean).map(String));
    // Rebuild from the current study cache, which already has owner/portal
    // isolation and recovery. Replaying an older export snapshot here would
    // resurrect deleted, annulled or corrected questions. v1/v2 snapshots
    // remain local copies; they are never a second source of study truth.

    const seenStatements = new Set();
    const seenIds = new Set();
    const unified = [];
    const bySubjectAndTopic = Object.create(null);
    const keyStatus = item => typeof window.answerKeyStatus === 'function' ? window.answerKeyStatus(item) : null;
    const stableQuestionId = text => {
      let hash = 2166136261;
      for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
      return hash.toString(36);
    };

    const registerItem = (q, sourceKind) => {
      if (!q || typeof q !== 'object') return;
      const itemOwner = q._ownerUserId || q.owner_user_id || q.user_id;
      if (sourceKind !== 'native' && itemOwner && String(itemOwner) !== scope.userId && !q.from_community && !q.is_community) return;
      if (sourceKind !== 'native' && q.campaignId && String(q.campaignId) !== scope.campaignId) return;
      if (sourceKind !== 'native' && q.campaign_id && !campaignIds.has(String(q.campaign_id)) && !q.from_community && !q.is_community) return;
      if (q.id && seenIds.has(String(q.id))) return;
      if (q.id) seenIds.add(String(q.id));
      if (q.answer_unknown || q.annulled || q.anulada || q.needs_review || q.classification_needs_review ||
          (q.key_source === 'ia_sugerido' && q.answer_key_validation !== 'revisado') ||
          /\[Gabarito sugerido pela IA\b/i.test(String(q.explanation || '')) && q.key_source !== 'manual_revisado' ||
          ['sem_gabarito', 'anulada'].includes(keyStatus(q)) ||
          (typeof window.isHunterManualArtifact === 'function' && window.isHunterManualArtifact(q))) return;
      const st = String(q.statement || q.question || '').trim();
      if (st.length < 15) return;
      const opts = Array.isArray(q.options) && q.options.every(o => typeof o === 'string') ? q.options.map(o => o.trim()) : [];
      if (opts.length < 2 || opts.length > 5 || opts.some(option => !option) || new Set(opts.map(consolidatedOptionText)).size !== opts.length) return;
      const rawKey = q.correct_index;
      const correctIndex = typeof rawKey === 'number' ? rawKey : typeof rawKey === 'string' && /^\d+$/.test(rawKey.trim()) ? Number(rawKey) : NaN;
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= opts.length) return;

      const tax = JC_MODULES.taxonomy
        ? JC_MODULES.taxonomy.resolveStableTaxonomy(q.subject, q.topic, st)
        : null;
      if (!tax || tax.needsReview) return;
      const fp = JSON.stringify([tax.subjectId, normalizeKey(q.topic), normalizeKey(st), opts.map(normalizeKey), correctIndex, q.origin || '', q.key_source || '']);
      if (seenStatements.has(fp)) return;
      seenStatements.add(fp);

      const enriched = {
        ...q,
        _fp: undefined,
        id: q.id || `local_${tax.subjectId}_${stableQuestionId(fp)}`,
        subject: tax.subjectName,
        subject_id: tax.subjectId,
        topic: (q.topic && q.topic.length >= 4 && !/^quest[aã]o\s*\d+/i.test(q.topic)) ? q.topic : tax.topicName,
        topic_id: tax.topicId,
        topic_needs_review: tax.topicNeedsReview,
        options: opts,
        correct_index: correctIndex,
        native: sourceKind === 'native' || sourceKind === 'current_native',
        promoted_to_native: sourceKind !== 'native' && sourceKind !== 'current_native',
        consolidated_source: sourceKind,
        // Organizing a user's question locally does not change its authorship.
        origin: q.origin || 'nao_informada'
      };

      unified.push(enriched);
      if (!bySubjectAndTopic[tax.subjectName]) {
        bySubjectAndTopic[tax.subjectName] = { subjectId: tax.subjectId, total: 0, topics: Object.create(null) };
      }
      bySubjectAndTopic[tax.subjectName].total++;
      const tName = enriched.topic;
      bySubjectAndTopic[tax.subjectName].topics[tName] = (bySubjectAndTopic[tax.subjectName].topics[tName] || 0) + 1;
    };

    // A current correction (including a withdrawn key) overrides its seed.
    // Register the current version first, even if it will be excluded.
    if (scopeReady) allQs.forEach(q => registerItem(q, q?.id && nativeIds.has(String(q.id)) ? 'current_native' : 'user'));
    baseNative.forEach(q => registerItem(q, 'native'));

    // Keep the original native bank and its internal v77 reference intact.
    // Imported/private questions must not become global seeds for other portals.
    let storageSaved = null;
    if (options.saveToStorage && scopeReady) {
      try {
        const userAdded = unified.filter(q => q.promoted_to_native);
        localStorage.setItem(storageKey, JSON.stringify({ version: 2, scope, questions: userAdded.slice(0, 600) }));
        storageSaved = true;
      } catch (_e) { storageSaved = false; }
      try {
        const stObj = getAppState();
        if (typeof window.persistToLocalDatabase === 'function' && stObj?.activeCampaignId) {
          window.persistToLocalDatabase(stObj.activeCampaignId);
        }
      } catch (_e) {}
    }

    if (options.showToast && typeof window.toast === 'function') {
      const subjCount = Object.keys(bySubjectAndTopic).length;
      window.toast(scopeReady
        ? `Banco local organizado: ${unified.length} questões em ${subjCount} disciplinas.${storageSaved === false ? ' Não foi possível salvar a cópia local; confira o espaço disponível.' : ''}`
        : 'Aguarde o carregamento dos dados da conta atual antes de organizar suas questões.');
    }

    return {
      total: unified.length,
      subjectsCount: Object.keys(bySubjectAndTopic).length,
      hierarchy: bySubjectAndTopic,
      questions: unified,
      storageSaved,
      scope,
      scopeReady
    };
  }

  function exportConsolidatedNativeBankJson() {
    const res = consolidateUserQuestionsIntoNativeBank({ saveToStorage: true, showToast: false });
    if (!res.scopeReady) {
      if (typeof window.toast === 'function') window.toast('Aguarde o carregamento dos dados da conta atual antes de exportar suas questões.');
      return null;
    }
    const payload = {
      schema_version: 'r178-scoped-local-bank',
      exported_at: new Date().toISOString(),
      total_questions: res.total,
      subjects_count: res.subjectsCount,
      hierarchy: res.hierarchy,
      questions: res.questions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `native-question-bank-consolidado-${res.total}q.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
    if (typeof window.toast === 'function') {
      window.toast(`📥 Arquivo native-question-bank-consolidado-${res.total}q.json exportado com sucesso!`);
    }
    return payload;
  }

  JC_MODULES.nativeBankPromoter = {
    consolidate: consolidateUserQuestionsIntoNativeBank,
    exportJson: exportConsolidatedNativeBankJson,
    storageKey: promotedBankStorageKey
  };
  window.consolidateUserQuestionsIntoNativeBank = consolidateUserQuestionsIntoNativeBank;
  window.exportConsolidatedNativeBankJson = exportConsolidatedNativeBankJson;

  // ── 5. HUB SOCIAL "MEU PERFIL", VISITA A PERFIS DO RANKING/CHAT E PRIVACIDADE GRANULAR ──
  function injectSocialProfileStyles() {
    if (document.getElementById('jc-social-profile-styles')) return;
    const style = document.createElement('style');
    style.id = 'jc-social-profile-styles';
    style.textContent = `
      /* Bolinha de Avatar no Topo da Tela Principal */
      .top #accountBtn.jcTopProfilePill {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 4px 12px 4px 5px !important;
        border-radius: 999px !important;
        background: linear-gradient(135deg, rgba(16,36,58,0.95), rgba(8,20,34,0.95)) !important;
        border: 1px solid rgba(89, 230, 255, 0.42) !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), 0 0 10px rgba(89, 230, 255, 0.14) !important;
        min-height: 40px !important;
        max-width: 225px !important;
        transition: transform 0.18s ease, border-color 0.18s ease !important;
      }
      .top #accountBtn.jcTopProfilePill:hover {
        border-color: #59e6ff !important;
        transform: translateY(-1px);
      }
      .top #accountBtn.jcTopProfilePill::before {
        content: none !important;
        display: none !important;
      }
      .jcHeaderAvatarCircle {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #59e6ff;
        background: linear-gradient(135deg, #0ea5e9, #1e3a8a);
        color: #ffffff;
        font-weight: 900;
        font-size: 0.78rem;
        display: inline-grid;
        place-items: center;
        flex: 0 0 30px;
        box-shadow: 0 0 8px rgba(89, 230, 255, 0.45);
        overflow: hidden;
      }
      .jcHeaderAvatarCircle img, .rankAvatar img, .slGuildMsgAvatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        display: block;
      }
      .jcHeaderProfileName {
        font-size: 0.82rem;
        font-weight: 800;
        color: #f8fafc;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 719px) {
        .top #accountBtn.jcTopProfilePill {
          width: 40px !important;
          max-width: 40px !important;
          height: 40px !important;
          padding: 0 !important;
          justify-content: center !important;
          border-radius: 50% !important;
        }
        .top #accountBtn.jcTopProfilePill .jcHeaderProfileName {
          display: none !important;
        }
        .top #accountBtn.jcTopProfilePill .jcHeaderAvatarCircle {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
        }
      }

      /* Hub Social Meu Perfil (Estilo Facebook / Gamer Solo Leveling) */
      .jcProfileSocialCard {
        border-radius: 22px;
        overflow: hidden;
        background: linear-gradient(160deg, #0c1b2c, #07111d);
        border: 1px solid rgba(89, 230, 255, 0.28);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        margin-bottom: 16px;
      }
      .jcProfileCoverBanner {
        height: 185px;
        background: linear-gradient(180deg, rgba(5, 12, 22, 0.25) 0%, rgba(5, 12, 22, 0.9) 100%), url('bancas-boss-banner.webp') center 28% / cover no-repeat;
        position: relative;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        padding: 14px 16px;
      }
      .jcCoverTopBtns {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        z-index: 2;
      }
      .jcProfileHeaderBody {
        padding: 0 22px 20px;
        position: relative;
      }
      .jcProfileMainRow {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-top: -54px;
        flex-wrap: wrap;
      }
      .jcProfileAvatarIdentity {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
      }
      .jcProfileAvatarLargeWrap {
        position: relative;
        width: 112px;
        height: 112px;
        border-radius: 50%;
        border: 4px solid #091624;
        outline: 2px solid #59e6ff;
        background: linear-gradient(135deg, #0284c7, #0f172a);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65), 0 0 22px rgba(89, 230, 255, 0.35);
        display: grid;
        place-items: center;
        font-size: 2.3rem;
        font-weight: 900;
        color: #fff;
        overflow: hidden;
        flex: 0 0 112px;
        z-index: 3;
      }
      .jcProfileAvatarLargeWrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .jcAvatarChangeLabel {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(4, 12, 22, 0.84);
        color: #59e6ff;
        font-size: 0.67rem;
        font-weight: 800;
        text-align: center;
        padding: 4px 0;
        cursor: pointer;
        transition: background 0.2s;
      }
      .jcAvatarChangeLabel:hover {
        background: rgba(14, 165, 233, 0.92);
        color: #fff;
      }
      .jcProfileTitleBlock h2 {
        margin: 0;
        font-size: 1.45rem;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .jcProfileRoleBadge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.16);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #7dd3fc;
        font-size: 0.75rem;
        font-weight: 800;
      }
      .jcProfileBioMotto {
        margin: 8px 0 0;
        font-size: 0.88rem;
        color: #cbd5e1;
        font-style: italic;
      }
      .jcProfileStatsStrip {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid rgba(56, 189, 248, 0.18);
      }
      .jcProfileStatItem {
        background: rgba(6, 16, 28, 0.72);
        border: 1px solid rgba(45, 78, 108, 0.7);
        border-radius: 14px;
        padding: 11px 10px;
        text-align: center;
      }
      .jcProfileStatItem b {
        display: block;
        font-size: 1.15rem;
        color: #59e6ff;
      }
      .jcProfileStatItem span {
        font-size: 0.7rem;
        color: #94a3b8;
      }
      .jcProfileTwoCols {
        display: grid;
        grid-template-columns: 1fr 1.45fr;
        gap: 14px;
        align-items: start;
      }
      .jcBoardStatRow {
        display: grid;
        gap: 5px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(7, 18, 31, 0.75);
        border: 1px solid rgba(45, 78, 108, 0.65);
        margin-bottom: 8px;
      }
      .jcPrivacyCheckRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 11px;
        background: rgba(7, 18, 31, 0.75);
        border: 1px solid rgba(45, 78, 108, 0.6);
        font-size: 0.81rem;
        cursor: pointer;
      }
      .jcPrivacyCheckRow input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #38bdf8;
      }
      .jcClickableHunter {
        cursor: pointer;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .jcClickableHunter:hover {
        border-color: #59e6ff !important;
      }
      @media (max-width: 760px) {
        .jcProfileCoverBanner {
          height: 145px;
          padding: 10px 12px;
          align-items: flex-start;
          justify-content: flex-end;
        }
        .jcCoverTopBtns button {
          font-size: 0.68rem !important;
          padding: 5px 8px !important;
        }
        .jcProfileHeaderBody { padding: 0 14px 16px; }
        .jcProfileAvatarLargeWrap { width: 86px; height: 86px; flex: 0 0 86px; font-size: 1.7rem; }
        .jcProfileMainRow { margin-top: -38px; }
        .jcProfileStatsStrip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .jcProfileTwoCols { grid-template-columns: 1fr; }
      }
      body.lightAppTheme .jcProfileSocialCard {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08) !important;
      }
      body.lightAppTheme .jcProfileStatItem,
      body.lightAppTheme .jcBoardStatRow,
      body.lightAppTheme .jcPrivacyCheckRow {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
      }
      body.lightAppTheme .jcProfileBioMotto {
        color: #334155 !important;
      }
      body.lightAppTheme .top #accountBtn.jcTopProfilePill {
        background: #ffffff !important;
        border-color: #0284c7 !important;
      }
      body.lightAppTheme .jcHeaderProfileName {
        color: #0f172a !important;
      }
    `;
    document.head.appendChild(style);
  }

  function profileHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function profileAvatarUrl(value) {
    const text=String(value||'').trim();
    if(!text||text.length>300000)return '';
    if(/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text))return text;
    try { const url=new URL(text); return url.protocol==='https:' ? url.href : ''; } catch { return ''; }
  }

  function profileMetric(value) {
    if(value===null||value===undefined||value==='')return null;
    const number=Number(value);
    return Number.isFinite(number)&&number>=0?number:null;
  }

  function profileOwnerId() {
    const session=typeof cloudSession!=='undefined'?cloudSession:window.cloudSession;
    return String(session?.user?.id||'guest');
  }
  function ownProfileState() {
    const current=getAppState(),owner=profileOwnerId();
    if(owner==='guest')return current._ownerUserId&&current._ownerUserId!=='guest'?null:current;
    return current._ownerUserId===owner?current:null;
  }
  function profileScope() {
    return {ownerId:profileOwnerId(),resetEpoch:Number(getAppState()?._resetEpoch||0)};
  }
  function profileScopeMatches(scope) {
    return Boolean(scope&&scope.ownerId===profileOwnerId()&&scope.resetEpoch===Number(getAppState()?._resetEpoch||0)&&ownProfileState());
  }
  function profileCacheKey(kind,ownerId=profileOwnerId(),resetEpoch=Number(getAppState()?._resetEpoch||0)) {
    return `jc-profile-v178:${encodeURIComponent(ownerId)}:${resetEpoch}:${kind}`;
  }
  function readProfileCache(kind) {
    try {
      // Legacy keys have no owner and cannot safely be attributed to an account.
      localStorage.removeItem('jc_profile_avatar_v1');
      localStorage.removeItem('jc_profile_display_name_v1');
      return localStorage.getItem(profileCacheKey(kind))||'';
    } catch { return ''; }
  }
  function writeProfileCache(kind,value,scope=profileScope()) {
    if(!profileScopeMatches(scope))return false;
    try {
      if(value)localStorage.setItem(profileCacheKey(kind,scope.ownerId,scope.resetEpoch),value);
      else localStorage.removeItem(profileCacheKey(kind,scope.ownerId,scope.resetEpoch));
      return true;
    } catch { return false; }
  }

  function getHunterInitials(name) {
    const clean = String(name || 'Caçador').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase() || 'JC';
  }

  function getHunterAvatarDataUrl() {
    const st=ownProfileState();
    if(!st)return '';
    return profileAvatarUrl(st.profileAvatarDataUrl||st.publicProfile?.avatar||readProfileCache('avatar'));
  }
  window.getHunterAvatarDataUrl=getHunterAvatarDataUrl;

  function setHunterAvatarDataUrl(dataUrl,scope=profileScope()) {
    if(!profileScopeMatches(scope))return false;
    const avatar=profileAvatarUrl(dataUrl);
    if(dataUrl&&!avatar)return false;
    const st=ownProfileState();
    st.profileAvatarDataUrl=avatar;
    st.publicProfile=st.publicProfile||{};
    st.publicProfile.avatar=avatar;
    writeProfileCache('avatar',avatar,scope);
    try{if(typeof save==='function')save();}catch{return false;}
    if(typeof cloudSession==='object'&&cloudSession&&navigator.onLine&&typeof pushCloudState==='function') {
      Promise.resolve(pushCloudState()).catch(()=>{});
    }
    decorateTopHeaderAvatarPill();
    return true;
  }

  function getHunterDisplayName() {
    const st=ownProfileState();
    const sess=typeof cloudSession!=='undefined'?cloudSession:window.cloudSession;
    const metaName=sess?.user?.user_metadata?.full_name||sess?.user?.user_metadata?.name||'';
    return String((st&&(st.profileDisplayName||st.publicProfile?.name||readProfileCache('name')))||metaName||'Caçador').trim().slice(0,50)||'Caçador';
  }

  function getPrivacyConfig() {
    const st=ownProfileState()||{};
    const p = st.publicProfile?.privacy || {};
    return {
      hiddenFromRanking: Boolean(st.publicProfile?.hidden),
      showAvatar: p.showAvatar !== false,
      showStreak: p.showStreak !== false,
      showAccuracy: p.showAccuracy !== false,
      showHours: p.showHours !== false,
      showTargetRole: p.showTargetRole !== false,
      showBadges: p.showBadges !== false,
      showBio: p.showBio !== false
    };
  }

  function renderHunterAvatarHtml(itemOrName, isMe = false, extraAvatarUrl = '') {
    const item=typeof itemOrName==='object'&&itemOrName?itemOrName:{};
    const name=typeof itemOrName==='object'?(item.name||item.author_name||'Caçador'):String(itemOrName||'Caçador');
    const initials=profileHtml(getHunterInitials(name));
    const showAvatar=isMe?getPrivacyConfig().showAvatar:item.privacy?.showAvatar!==false;
    if(!showAvatar)return `<span>${initials}</span>`;
    const avatar=profileAvatarUrl(isMe?getHunterAvatarDataUrl():(item.avatar||item.avatar_url||extraAvatarUrl));
    return avatar?`<img src="${profileHtml(avatar)}" alt="Foto de ${profileHtml(name)}" referrerpolicy="no-referrer">`:`<span>${initials}</span>`;
  }
  window.renderHunterAvatarHtml = renderHunterAvatarHtml;

  function decorateTopHeaderAvatarPill() {
    injectSocialProfileStyles();
    const btn = document.getElementById('accountBtn');
    if (!btn) return;
    const avatarUrl = getHunterAvatarDataUrl();
    const name = getHunterDisplayName();
    btn.classList.add('jcTopProfilePill');
    btn.title = `Meu Perfil de Caçador (${name})`;
    const avatarInner = avatarUrl
      ? `<img src="${profileHtml(avatarUrl)}" alt="Foto de perfil de ${profileHtml(name)}" referrerpolicy="no-referrer">`
      : `<span>${profileHtml(getHunterInitials(name))}</span>`;
    btn.innerHTML = `<span class="jcHeaderAvatarCircle" id="topHeaderAvatarCircle">${avatarInner}</span><span class="jcHeaderProfileName">${profileHtml(name)}</span>`;
    btn.onclick = (e) => {
      e?.preventDefault?.();
      if (typeof openView === 'function') openView('profile');
    };
  }

  // Retira apenas pares de aspas externos; preserva as citações dentro da bio.
  function normalizeHunterBio(value) {
    let text=String(value??'').trim();
    const pairs=[['“','”'],['"','"'],['‘','’'],["'","'"]];
    for(let n=0;n<8;n++) {
      const pair=pairs.find(([left,right])=>text.length>=2&&text.startsWith(left)&&text.endsWith(right));
      if(!pair)break;
      text=text.slice(pair[0].length,-pair[1].length).trim();
    }
    return text.slice(0,140);
  }

  const profileSaveScopes=new Set();
  async function saveHunterProfileChanges(changes={}) {
    const scope=profileScope(),st=ownProfileState();
    if(!st)return {status:'account_not_ready'};
    const saveKey=`${scope.ownerId}:${scope.resetEpoch}`;
    if(profileSaveScopes.has(saveKey))return {status:'busy'};
    const clean=(value,max)=>String(value??'').trim().slice(0,max);
    const privacy=Object.fromEntries(['showAvatar','showStreak','showAccuracy','showHours','showTargetRole','showBadges','showBio'].map(key=>[key,changes.privacy?.[key]!==false]));
    const snapshot={name:clean(changes.name,50)||'Caçador',role:clean(changes.role,80),secondaryRole:clean(changes.secondaryRole,80),bio:normalizeHunterBio(changes.bio),privacy,hidden:!!changes.hidden};
    st.profileDisplayName=snapshot.name;st.profileTargetRole=snapshot.role;
    st.profileCity=clean(changes.city,50);st.profileBioMotto=snapshot.bio;
    st.publicProfile={...(st.publicProfile||{}),...snapshot,avatar:getHunterAvatarDataUrl()};
    writeProfileCache('name',snapshot.name,scope);
    const beforeRevision=Number(st._serverRevision||0);
    try{if(typeof save==='function')save();}catch{return {status:'storage_error'};}
    if(!navigator.onLine||scope.ownerId==='guest'||typeof pushCloudState!=='function')return {status:'pending'};
    profileSaveScopes.add(saveKey);
    try {
      const confirmed=await pushCloudState();
      if(!profileScopeMatches(scope))return {status:'account_changed'};
      const current=ownProfileState(),publicData=current.publicProfile||{};
      const matches=['name','role','secondaryRole','bio','hidden'].every(key=>publicData[key]===snapshot[key])&&JSON.stringify(publicData.privacy||{})===JSON.stringify(snapshot.privacy);
      return {status:confirmed===true&&!current._dirty&&Number(current._serverRevision||0)>beforeRevision&&matches&&current.profileCity===clean(changes.city,50)?'synced':'pending'};
    } catch { return {status:profileScopeMatches(scope)?'pending':'account_changed'}; }
    finally { profileSaveScopes.delete(saveKey); }
  }

  // Modal de Visita ao Perfil Público de Outro Caçador (Ranking / Chat da Guilda)
  function openPublicHunterProfileVisitorModal(hunterData) {
    if (!hunterData) return;
    if (hunterData.is_me) {
      if (typeof openView === 'function') openView('profile');
      return;
    }
    let dlg = document.getElementById('jcPublicHunterVisitorDialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'jcPublicHunterVisitorDialog';
      dlg.style.cssText = 'width:min(94vw,540px);padding:0;border-radius:22px;overflow:hidden;background:#081523;border:1px solid rgba(89,230,255,0.45);color:#f8fafc;box-shadow:0 24px 64px rgba(0,0,0,0.8)';
      document.body.appendChild(dlg);
    }

    const rawName=String(hunterData.name||hunterData.author_name||'Caçador da Guilda').trim().slice(0,100);
    const hName = profileHtml(rawName);
    const hRole = profileHtml(String(hunterData.role || hunterData.author_role || 'Cargo não informado').trim());
    const hSecRole = profileHtml(String(hunterData.secondary_role || '').trim());
    const hXp = profileMetric(hunterData.xp ?? hunterData.author_xp) ?? 0;
    const hStreak = profileMetric(hunterData.streak);
    const hBestStreak = hStreak===null?null:Math.max(hStreak, profileMetric(hunterData.best_streak)??hStreak);
    const hAcc = profileMetric(hunterData.accuracy);
    const hMissions = profileMetric(hunterData.missions_done);
    const hHours = profileMetric(hunterData.hours);
    const hRankLabel = profileHtml(typeof level === 'function' ? (level(hXp, false)?.label || 'Caçador') : 'Caçador Ativo');
    const hBio = profileHtml(hunterData.bio || 'Bio não informada.');
    const hPriv = hunterData.privacy || {};
    const avatarHtml = renderHunterAvatarHtml(hunterData, false);

    dlg.innerHTML = `
      <div style="height:125px;background:linear-gradient(180deg,rgba(4,10,18,0.2),rgba(4,10,18,0.92)),url('bancas-boss-banner.webp') center 30%/cover no-repeat;display:flex;justify-content:space-between;align-items:flex-start;padding:12px 16px">
        <span class="tag" style="background:rgba(4,12,22,0.85);color:#59e6ff;border:1px solid rgba(89,230,255,0.35)">👤 Perfil Público do Caçador</span>
        <button type="button" class="ghost small" id="jcCloseVisitorProfileBtn" style="width:auto;padding:5px 12px;background:rgba(4,12,22,0.85);color:#fff">✕ Fechar</button>
      </div>
      <div style="padding:0 20px 20px">
        <div style="display:flex;align-items:flex-end;gap:14px;margin-top:-42px;flex-wrap:wrap">
          <div style="width:86px;height:86px;border-radius:50%;border:4px solid #081523;outline:2px solid #59e6ff;background:linear-gradient(135deg,#0284c7,#1e3a8a);display:grid;place-items:center;font-size:1.85rem;font-weight:900;color:#fff;overflow:hidden;flex:0 0 86px">
            ${avatarHtml}
          </div>
          <div style="flex:1;min-width:180px">
            <h3 style="margin:0;font-size:1.28rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>${hName}</span>
              <span class="jcProfileRoleBadge">🛡️ ${hRankLabel}</span>
            </h3>
            ${hPriv.showTargetRole !== false ? `
              <div class="small" style="color:#7dd3fc;margin-top:4px;font-weight:700">
                🎯 Foco: ${hRole}${hSecRole ? ` · 🛡️ 2º Alvo: ${hSecRole}` : ''}
              </div>
            ` : '<div class="small muted" style="margin-top:4px">🔒 Cargo-alvo ocultado pelo usuário</div>'}
          </div>
        </div>

        ${hPriv.showBio !== false ? `<p class="jcProfileBioMotto" style="margin-top:10px">${hBio}</p>` : ''}

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px">
          <div class="jcProfileStatItem">
            <b>⚡ ${hXp} XP</b>
            <span>Experiência na Guilda</span>
          </div>
          <div class="jcProfileStatItem">
            <b style="color:#fbbf24">${hPriv.showStreak !== false ? (hStreak===null?'Não informado':`🔥 ${hStreak} dias (Rec: ${hBestStreak}d)`) : '🔒 Privado'}</b>
            <span>Ofensiva de Estudos</span>
          </div>
          <div class="jcProfileStatItem">
            <b style="color:#34d399">${hPriv.showAccuracy !== false ? `${hAcc===null?'Sem precisão informada':`🎯 ${Math.min(100,hAcc)}%`} (${hMissions===null?'missões não informadas':`${hMissions} missões`})` : '🔒 Privado'}</b>
            <span>Precisão &amp; Missões</span>
          </div>
          <div class="jcProfileStatItem">
            <b>${hPriv.showHours !== false ? (hHours===null?'Não informado':`⏱️ ${hHours}h`) : '🔒 Privado'}</b>
            <span>Horas registradas</span>
          </div>
        </div>

        ${hPriv.showBadges !== false ? `
          <div style="margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(6,16,28,0.75);border:1px solid rgba(45,78,108,0.65)">
            <div class="small muted" style="margin-bottom:6px;font-weight:800">🏅 Insígnias Visíveis do Caçador</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${hMissions >= 1 ? '<span class="tag">✓ Recruta Ativo</span>' : ''}
              ${hStreak >= 3 ? '<span class="tag" style="color:#fbbf24">🔥 Fogo Constante (3d+)</span>' : ''}
              ${hXp >= 1000 ? '<span class="tag" style="color:#34d399">⚡ Veterano (1.000+ XP)</span>' : ''}
              ${hAcc >= 70 && hMissions >= 3 ? '<span class="tag" style="color:#6ee7b7">🎯 Mira Precisa (70%+)</span>' : ''}
            </div>
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          ${hunterData.user_id && hunterData.user_id !== 'local' ? `
            <button type="button" class="action" id="jcVisitorChallengeDuelBtn" style="flex:1">⚔️ Desafiar ${profileHtml(rawName.split(' ')[0])} para Duelo X1</button>
          ` : ''}
          <button type="button" class="ghost" id="jcVisitorCloseBottomBtn" style="flex:1">Voltar</button>
        </div>
      </div>
    `;

    dlg.querySelector('#jcCloseVisitorProfileBtn').onclick = () => dlg.close();
    dlg.querySelector('#jcVisitorCloseBottomBtn').onclick = () => dlg.close();
    const duelBtn = dlg.querySelector('#jcVisitorChallengeDuelBtn');
    if (duelBtn) {
      duelBtn.onclick = () => {
        dlg.close();
        try {
          const challBtn = Array.from(document.querySelectorAll('[data-challenge-from-rank]')).find(button=>String(button.dataset.challengeFromRank||'').startsWith(`${hunterData.user_id}|`));
          if (challBtn) { challBtn.click(); return; }
        } catch (_e) {}
        if (typeof openView === 'function') openView('duel');
      };
    }
    if (!dlg.open) dlg.showModal();
  }
  window.openPublicHunterProfileVisitorModal = openPublicHunterProfileVisitorModal;

  function computeBoardAccuracyStats() {
    const allQs = getAllQuestions();
    const st = ownProfileState();
    if(!st)return [];
    const fpMap = st.answeredQuestionFingerprints || {};
    const boards = {};
    for (const q of allQs) {
      const bName = String(q.board || 'Banca não informada').trim();
      const normBoard = /cebraspe|cespe/i.test(bName) ? 'Cebraspe'
        : /fgv/i.test(bName) ? 'FGV Conhecimento'
        : /upenet|iaupe/i.test(bName) ? 'UPENET / IAUPE'
        : /ibfc/i.test(bName) ? 'IBFC'
        : /idecan/i.test(bName) ? 'IDECAN'
        : /aocp/i.test(bName) ? 'Instituto AOCP'
        : bName;
      if (!boards[normBoard]) boards[normBoard] = { totalAvailable: 0, answered: 0, correct: 0 };
      boards[normBoard].totalAvailable++;
      const keyStatus=typeof window.answerKeyStatus==='function'?window.answerKeyStatus(q):'';
      if (typeof questionFingerprint === 'function' && !['sem_gabarito','provisorio','anulada'].includes(keyStatus)) {
        const fp = questionFingerprint(q);
        if (fpMap[fp] === 'correct') {
          boards[normBoard].answered++;
          boards[normBoard].correct++;
        } else if (fpMap[fp] === 'wrong') {
          boards[normBoard].answered++;
        }
      }
    }
    return Object.entries(boards)
      .map(([board, data]) => ({
        board,
        ...data,
        pct: data.answered > 0 ? Math.round((data.correct / data.answered) * 100) : null
      }))
      .sort((a, b) => b.answered - a.answered || b.totalAvailable - a.totalAvailable);
  }

  function ensureProfileViewSectionExists() {
    injectSocialProfileStyles();
    let sec = document.getElementById('profile');
    if (!sec) {
      const mainEl = document.querySelector('main.app');
      if (!mainEl) return null;
      sec = document.createElement('section');
      sec.className = 'view';
      sec.id = 'profile';
      const footerEl = mainEl.querySelector('footer.appLegalFooter');
      if (footerEl) mainEl.insertBefore(sec, footerEl);
      else mainEl.appendChild(sec);
    } else {
      // Garante que #profile sempre fique ANTES do rodapé dentro de main.app!
      const mainEl = document.querySelector('main.app');
      const footerEl = mainEl?.querySelector('footer.appLegalFooter');
      if (mainEl && footerEl && sec.parentElement !== mainEl) {
        mainEl.insertBefore(sec, footerEl);
      }
    }
    const menuGrid = document.querySelector('#moreDialog .menuGrid');
    if (menuGrid && !menuGrid.querySelector('[data-menu-view="profile"]')) {
      menuGrid.insertAdjacentHTML('afterbegin', `<button class="menuItem" data-menu-view="profile">👤<span>Meu Perfil Social</span></button>`);
      const pBtn = menuGrid.querySelector('[data-menu-view="profile"]');
      if (pBtn) {
        pBtn.onclick = () => {
          document.getElementById('moreDialog')?.close();
          if (typeof openView === 'function') openView('profile');
        };
      }
    }
    return sec;
  }

  function renderHunterProfileHub() {
    const sec = ensureProfileViewSectionExists();
    if (!sec) return;
    const st = ownProfileState();
    if(!st){sec.innerHTML='<div class="empty">Aguardando carregar os dados desta conta…</div>';return;}
    const renderScope=profileScope();
    try { if (typeof refreshStreak === 'function') refreshStreak(); } catch (_e) {}
    try { if (typeof syncHunterStatsSnapshot === 'function') syncHunterStatsSnapshot(); } catch (_e) {}
    const allQs = getAllQuestions();
    const allSums = getAllSummaries();
    const allCards = getAllFlashcards();
    const priv = getPrivacyConfig();

    const name = getHunterDisplayName();
    const avatarUrl = getHunterAvatarDataUrl();
    const camp = typeof activeCampaign === 'function' ? activeCampaign() : null;
    const targetRole = st.profileTargetRole || st.publicProfile?.role || camp?.name || '';
    const secRole = st.publicProfile?.secondaryRole || '';
    const bioMotto = normalizeHunterBio(st.profileBioMotto || st.publicProfile?.bio || 'Disciplina diária, constância no ciclo e foco cirúrgico até a posse.');
    const cityState = st.profileCity || '';

    const totalXp = profileMetric(typeof xp === 'function' ? xp() : st.hunterStats?.xp)??0;
    const pool = typeof missionPool === 'function' ? missionPool() : [];
    const doneMissions = pool.filter(m => st.done?.[m.id]).length;
    const editalPct = pool.length ? Math.round((doneMissions / pool.length) * 100) : 0;
    const rankObj = typeof level === 'function' ? level(totalXp, pool.length > 0 && doneMissions === pool.length) : { label: 'C II - Caçador Experiente' };

    const scores = (Array.isArray(st.scores)?st.scores:[]).filter(s => s&&(!s.campaignId || s.campaignId === st.activeCampaignId));
    const scoreTotal = scores.reduce((acc, s) => acc + (profileMetric(s.total)??0), 0);
    const scoreCorr = scores.reduce((acc, s) => acc + Math.min(profileMetric(s.correct)??0,profileMetric(s.total)??0), 0);
    const tracked = st.questionStatsByCampaign?.[st.activeCampaignId] || {};
    const qTotal = Math.max(scoreTotal, profileMetric(tracked.total)??0);
    const qCorr = Math.min(qTotal,(profileMetric(tracked.total)??0) > scoreTotal ? (profileMetric(tracked.correct)??0) : scoreCorr);
    const accuracy = qTotal > 0 ? Math.max(0,Math.min(100,Math.round((qCorr / qTotal) * 100))) : null;

    const totalFocusSeconds = Object.values(st.studyByDay || {}).reduce((acc, v) => acc + (profileMetric(v)??0), 0);
    const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);
    const streak = Math.max(profileMetric(st.streak)??0, profileMetric(st.hunterStats?.streak)??0);
    const bestStreak = Math.max(streak, profileMetric(st.bestStreak)??0, profileMetric(st.hunterStats?.bestStreak)??0);
    const bossesWon = Object.keys(st.bosses || {}).length;

    const boardStats = computeBoardAccuracyStats();
    const telemetry = JC_MODULES.telemetry ? JC_MODULES.telemetry.getStats() : {};
    const sampleCount=Number(telemetry.sampleCount??telemetry.count??0);
    const speedLabel=sampleCount>0&&Number.isFinite(telemetry.p50Ms)?`renderização dos filtros locais: p50 ${Math.round(telemetry.p50Ms)} ms (${sampleCount} amostras)`:'Filtros locais: ainda sem medição';
    const syncLabel=profileOwnerId()==='guest'?'Salvo neste aparelho':st._dirty?'Sincronização pendente':Number(st._serverRevision)>0?'Último estado confirmado':'Aguardando confirmação';
    const avatarHtml = renderHunterAvatarHtml(name,true);

    sec.innerHTML = `
      <div class="jcProfileSocialCard">
        <div class="jcProfileCoverBanner">
          <div class="jcCoverTopBtns">
            <button type="button" class="ghost small" id="jcOpenAccountModalFromProfileBtn" style="width:auto;background:rgba(4,12,22,0.85);border-color:rgba(89,230,255,0.45);color:#fff;font-size:.75rem">⚙️ Conta, Senha &amp; Sincronização</button>
            <button type="button" class="ghost small" id="jcOpenPersonalAiFromProfileBtn" style="width:auto;background:rgba(4,12,22,0.85);border-color:rgba(52,211,153,0.45);color:#6ee7b7;font-size:.75rem">🔑 Chave IA Pessoal</button>
          </div>
        </div>
        <div class="jcProfileHeaderBody">
          <div class="jcProfileMainRow">
            <div class="jcProfileAvatarIdentity">
              <div class="jcProfileAvatarLargeWrap">
                ${avatarHtml}
                <label class="jcAvatarChangeLabel" title="Enviar foto de perfil do seu aparelho">
                  📷 Foto
                  <input type="file" id="jcProfileAvatarInput" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                </label>
              </div>
              <div class="jcProfileTitleBlock">
                <div class="eyebrow" style="color:#59e6ff;font-weight:900">PERFIL OFICIAL DO CAÇADOR</div>
                <h2>
                  <span>${profileHtml(name)}</span>
                  <span class="jcProfileRoleBadge">🛡️ ${profileHtml(rankObj.label)}</span>
                </h2>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;font-size:.82rem;color:#94a3b8">
                  <span>🎯 <b>Cargo Pretendido:</b> <strong style="color:#f8fafc">${profileHtml(targetRole)}</strong>${secRole ? ` · 🛡️ <b>2º Alvo:</b> <strong style="color:#cbd5e1">${profileHtml(secRole)}</strong>` : ''}</span>
                  <span>·</span>
                  <span>📍 ${profileHtml(cityState)}</span>
                </div>
                <p class="jcProfileBioMotto">${profileHtml(bioMotto)}</p>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="action small" id="jcEditSocialProfileBtn" style="width:auto;padding:8px 14px;font-size:.8rem">✏️ Editar Perfil &amp; Privacidade</button>
              ${avatarUrl ? `<button type="button" class="ghost small" id="jcRemoveAvatarBtn" style="width:auto;padding:8px 11px;font-size:.76rem">🗑️ Remover Foto</button>` : ''}
            </div>
          </div>

          <div id="jcEditProfileDrawer" hidden style="margin-top:16px;padding:16px;border-radius:16px;background:rgba(6,16,28,0.94);border:1px solid rgba(89,230,255,0.4);display:grid;gap:12px">
            <div class="eyebrow" style="color:#38bdf8">1. IDENTIDADE E CARGO PRETENDIDO</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
              <label class="field" style="margin:0">Seu Nome de Exibição (Perfil &amp; Ranking)<input type="text" id="jcEditNameInput" value="${profileHtml(name)}" maxlength="50"></label>
              <label class="field" style="margin:0">1º Concurso / Cargo Pretendido<input type="text" id="jcEditRoleInput" value="${profileHtml(targetRole)}" maxlength="80" placeholder="Ex.: PMPE — Soldado"></label>
              <label class="field" style="margin:0">2º Concurso (Opcional)<input type="text" id="jcEditSecRoleInput" value="${profileHtml(secRole)}" maxlength="80" placeholder="Ex.: CBMPE / PPPE"></label>
              <label class="field" style="margin:0">Cidade / Estado<input type="text" id="jcEditCityInput" value="${profileHtml(cityState)}" maxlength="50"></label>
            </div>
            <label class="field" style="margin:0">Lema de Estudos / Bio do Perfil<input type="text" id="jcEditBioInput" value="${profileHtml(bioMotto)}" maxlength="140"></label>

            <div class="eyebrow" style="color:#34d399;margin-top:4px">2. PRIVACIDADE DO SEU PERFIL PÚBLICO (O QUE OUTROS USUÁRIOS PODEM VER AO CLICAR EM VOCÊ)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px">
              <label class="jcPrivacyCheckRow"><span>📷 Mostrar minha Foto de Perfil no Ranking e Chat</span><input type="checkbox" id="jcPrivAvatar" ${priv.showAvatar ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow"><span>🔥 Mostrar minha Ofensiva (Dias Seguidos)</span><input type="checkbox" id="jcPrivStreak" ${priv.showStreak ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow"><span>🎯 Mostrar minha Taxa de Acerto (%) e Missões</span><input type="checkbox" id="jcPrivAccuracy" ${priv.showAccuracy ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow"><span>⏱️ Mostrar minhas Horas de Estudo</span><input type="checkbox" id="jcPrivHours" ${priv.showHours ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow"><span>🛡️ Mostrar meu Cargo Pretendido / Concurso</span><input type="checkbox" id="jcPrivRole" ${priv.showTargetRole ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow"><span>🏅 Mostrar minhas Insígnias e Bio</span><input type="checkbox" id="jcPrivBadges" ${priv.showBadges ? 'checked' : ''}></label>
              <label class="jcPrivacyCheckRow" style="grid-column:1/-1;border-color:rgba(244,63,94,0.4)"><span>🕵️ Modo Invisível Completo: Ocultar meu perfil da lista do Ranking Geral</span><input type="checkbox" id="jcPrivHiddenAll" ${priv.hiddenFromRanking ? 'checked' : ''}></label>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
              <button type="button" class="ghost small" id="jcCancelEditProfileBtn" style="width:auto">Cancelar</button>
              <button type="button" class="action small" id="jcSaveEditProfileBtn" style="width:auto">💾 Salvar Perfil &amp; Privacidade</button>
            </div>
          </div>

          <div class="jcProfileStatsStrip">
            <div class="jcProfileStatItem"><b>${totalXp} XP</b><span>Experiência Total</span></div>
            <div class="jcProfileStatItem"><b style="color:#fbbf24">🔥 ${streak}d</b><span>Ofensiva (Recorde: ${bestStreak}d)</span></div>
            <div class="jcProfileStatItem"><b style="color:#34d399">${accuracy===null?'Sem respostas':`${accuracy}%`}</b><span>Precisão (${qCorr}/${qTotal})</span></div>
            <div class="jcProfileStatItem"><b>${totalFocusHours}h</b><span>Horas Líquidas</span></div>
            <div class="jcProfileStatItem"><b>${editalPct}%</b><span>Cobertura (${doneMissions}/${pool.length})</span></div>
            <div class="jcProfileStatItem"><b style="color:#f43f5e">🏆 ${bossesWon}</b><span>Chefes Derrotados</span></div>
          </div>
        </div>
      </div>

      <div class="jcProfileTwoCols">
        <div style="display:grid;gap:14px">
          <div class="card" style="margin:0">
            <div class="sectionHead"><h2>📋 Apresentação &amp; Sincronia Real</h2><span class="tag">${syncLabel}</span></div>
            <div class="list" style="gap:8px;font-size:.84rem">
              <div class="topic"><span>🎯 <b>Portal Ativo:</b> ${profileHtml(camp?.name || 'Nenhum portal ativo')} (${doneMissions} missões cumpridas)</span></div>
              <div class="topic"><span>📚 <b>Acervo no Aparelho:</b> <b>${allQs.length} questões</b> · <b>${allSums.length} resumos</b> · <b>${allCards.length} flashcards</b></span></div>
              <div class="topic"><span>🔒 <b>Privacidade no Ranking:</b> ${priv.hiddenFromRanking ? 'Oculto (Modo Invisível)' : 'Visível para a Guilda (com filtros personalizados)'}</span></div>
              <div class="topic"><span>⚡ <b>Medição dos filtros:</b> ${speedLabel}</span></div>
            </div>
            <div style="display:grid;gap:8px;margin-top:12px">
              <button type="button" class="action small" id="jcProfileConsolidateNativeBtn" style="width:100%">🏛️ Organizar minhas ${allQs.length} questões</button>
              <button type="button" class="ghost small" id="jcProfileExportNativeJsonBtn" style="width:100%">📥 Baixar meu banco organizado (.json)</button>
            </div>
          </div>

          <div class="card" style="margin:0">
            <div class="sectionHead"><h2>🏅 Insígnias Desbloqueadas</h2><span class="tag">Carreira</span></div>
            <div class="achievementGrid">
              <div class="achievement ${doneMissions >= 1 ? 'unlocked' : ''}"><b>${doneMissions >= 1 ? '✓' : '◈'} Recruta Ativo</b><span class="small muted">1ª missão cumprida (${doneMissions} feitas)</span></div>
              <div class="achievement ${streak >= 3 ? 'unlocked' : ''}"><b>${streak >= 3 ? '✓' : '◈'} Fogo Constante</b><span class="small muted">3+ dias seguidos (atual: ${streak}d)</span></div>
              <div class="achievement ${qTotal >= 30 ? 'unlocked' : ''}"><b>${qTotal >= 30 ? '✓' : '◈'} Atirador de Questões</b><span class="small muted">30+ resolvidas (atual: ${qTotal})</span></div>
              <div class="achievement ${accuracy >= 60 && qTotal >= 10 ? 'unlocked' : ''}"><b>${accuracy >= 60 && qTotal >= 10 ? '✓' : '◈'} Mira Calibrada</b><span class="small muted">60%+ precisão (atual: ${accuracy===null?'Sem respostas':`${accuracy}%`})</span></div>
            </div>
          </div>
        </div>

        <div style="display:grid;gap:14px">
          <div class="card" style="margin:0">
            <div class="sectionHead">
              <div>
                <h2>🎯 Desempenho por Banca Examinadora</h2>
                <p class="small muted" style="margin:2px 0 0">Estatísticas separadas por organizadora (AOCP, Cebraspe, UPENET, FGV)</p>
              </div>
              <span class="tag">${boardStats.length} bancas</span>
            </div>
            <div>
              ${boardStats.length ? boardStats.map(b => {
                const pctVal = b.pct !== null ? b.pct : 0;
                const barColor = b.pct === null ? '#334155' : pctVal >= 70 ? '#10b981' : pctVal >= 50 ? '#f59e0b' : '#ef4444';
                return `
                  <div class="jcBoardStatRow">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.83rem">
                      <b>🏛️ ${profileHtml(b.board)}</b>
                      <span class="small" style="color:${b.pct === null ? '#94a3b8' : barColor};font-weight:800">
                        ${b.pct !== null ? `${b.pct}% de acerto (${b.correct}/${b.answered} resolvidas · ${b.totalAvailable} no banco)` : `${b.totalAvailable} questões disponíveis no seu banco`}
                      </span>
                    </div>
                    <div class="bar" style="height:8px;margin-top:4px"><div class="fill" style="width:${b.pct !== null ? Math.max(6, pctVal) : 12}%;background:${barColor}"></div></div>
                  </div>
                `;
              }).join('') : '<div class="empty">Nenhuma questão carregada ainda neste portal.</div>'}
            </div>
          </div>

          <div class="card" style="margin:0">
            <div class="sectionHead">
              <div>
                <h2>📊 Domínio por Disciplina do Edital</h2>
                <p class="small muted" style="margin:2px 0 0">Progresso de missões estudadas e tópicos dominados</p>
              </div>
              <button type="button" class="ghost small" id="jcProfileGoQuestionsBtn" style="width:auto;padding:5px 10px;font-size:.75rem">Ir para Questões →</button>
            </div>
            <div class="list">
              ${(() => {
                const bySubj = pool.reduce((acc, m) => { (acc[m.subject] = acc[m.subject] || []).push(m); return acc; }, {});
                const entries = Object.entries(bySubj);
                if (!entries.length) return '<div class="empty">Envie seu edital na Biblioteca para visualizar o domínio por disciplina.</div>';
                return entries.map(([subj, items]) => {
                  const dCnt = items.filter(m => st.done?.[m.id]).length;
                  const p = items.length ? Math.round((dCnt / items.length) * 100) : 0;
                  return `
                    <div class="jcBoardStatRow">
                      <div style="display:flex;justify-content:space-between;font-size:.82rem">
                        <b>${profileHtml(subj)}</b>
                        <span>${dCnt}/${items.length} tópicos (${p}%)</span>
                      </div>
                      <div class="bar" style="height:7px;margin-top:4px"><div class="fill" style="width:${p}%"></div></div>
                    </div>
                  `;
                }).join('');
              })()}
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind events
    const avatarIn = document.getElementById('jcProfileAvatarInput');
    if (avatarIn) avatarIn.onchange = (e) => {
      const file=e.target.files?.[0],scope=renderScope;
      if(!file||!profileScopeMatches(scope))return;
      const notify=message=>{if(profileScopeMatches(scope)&&typeof toast==='function')toast(message);};
      if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>5*1024*1024){notify('Escolha uma imagem PNG, JPEG, WebP ou GIF de até 5 MB.');return;}
      const reader=new FileReader();
      reader.onerror=()=>notify('Não foi possível ler a foto. Tente outro arquivo.');
      reader.onload=()=>{
        if(!profileScopeMatches(scope))return;
        const img=new Image();
        img.onerror=()=>notify('A imagem não pôde ser aberta. Tente outro arquivo.');
        img.onload=()=>{
          if(!profileScopeMatches(scope))return;
          try{
            const cnv=document.createElement('canvas'),size=200;
            cnv.width=size;cnv.height=size;
            const ctx=cnv.getContext('2d'),minSide=Math.min(img.width,img.height);
            if(!ctx||!minSide)throw new Error('invalid image');
            ctx.drawImage(img,(img.width-minSide)/2,(img.height-minSide)/2,minSide,minSide,0,0,size,size);
            if(!setHunterAvatarDataUrl(cnv.toDataURL('image/webp',0.82),scope))throw new Error('invalid avatar');
            renderHunterProfileHub();
            notify('Foto salva no aparelho. A sincronização será confirmada pela conta.');
          }catch{notify('Não foi possível salvar a foto. Tente outra imagem.');}
        };
        img.src=String(reader.result||'');
      };
      reader.readAsDataURL(file);
    };
    const remBtn=document.getElementById('jcRemoveAvatarBtn');
    if(remBtn)remBtn.onclick=()=>{
      if(!setHunterAvatarDataUrl('',renderScope))return;
      renderHunterProfileHub();
      if(typeof toast==='function')toast('Foto removida neste aparelho.');
    };

    const editBtn = document.getElementById('jcEditSocialProfileBtn');
    const drawer = document.getElementById('jcEditProfileDrawer');
    if (editBtn && drawer) {
      editBtn.onclick = () => { drawer.hidden = !drawer.hidden; };
    }
    const cancelBtn = document.getElementById('jcCancelEditProfileBtn');
    if (cancelBtn && drawer) {
      cancelBtn.onclick = () => { drawer.hidden = true; };
    }
    const saveProfBtn=document.getElementById('jcSaveEditProfileBtn');
    if(saveProfBtn)saveProfBtn.onclick=async()=>{
      if(!profileScopeMatches(renderScope))return;
      saveProfBtn.disabled=true;
      try{
        const value=id=>document.getElementById(id)?.value||'';
        const checked=id=>Boolean(document.getElementById(id)?.checked);
        const result=await saveHunterProfileChanges({
          name:value('jcEditNameInput'),role:value('jcEditRoleInput'),secondaryRole:value('jcEditSecRoleInput'),city:value('jcEditCityInput'),bio:value('jcEditBioInput'),
          hidden:checked('jcPrivHiddenAll'),privacy:{showAvatar:checked('jcPrivAvatar'),showStreak:checked('jcPrivStreak'),showAccuracy:checked('jcPrivAccuracy'),showHours:checked('jcPrivHours'),showTargetRole:checked('jcPrivRole'),showBadges:checked('jcPrivBadges'),showBio:checked('jcPrivBadges')}
        });
        if(!profileScopeMatches(renderScope))return;
        decorateTopHeaderAvatarPill();renderHunterProfileHub();
        if(typeof toast==='function')toast(result.status==='synced'?'Perfil e privacidade confirmados na nuvem.':result.status==='busy'?'Já existe um salvamento em andamento.':result.status==='storage_error'?'Não foi possível gravar no aparelho. Mantenha a página aberta e tente novamente.':'Perfil salvo no aparelho; sincronização pendente.');
      }finally{saveProfBtn.disabled=false;}
    };

    const accModalBtn = document.getElementById('jcOpenAccountModalFromProfileBtn');
    if (accModalBtn) {
      accModalBtn.onclick = () => {
        const dlg = document.getElementById('accountDialog');
        if (dlg) dlg.showModal();
      };
    }

    const aiModalBtn = document.getElementById('jcOpenPersonalAiFromProfileBtn');
    if (aiModalBtn) {
      aiModalBtn.onclick = () => {
        if (typeof window.openPersonalAiSettings === 'function') window.openPersonalAiSettings();
      };
    }

    const consBtn = document.getElementById('jcProfileConsolidateNativeBtn');
    if (consBtn) {
      consBtn.onclick = () => {
        if (typeof window.consolidateUserQuestionsIntoNativeBank === 'function') {
          window.consolidateUserQuestionsIntoNativeBank({ saveToStorage: true, showToast: true });
          renderHunterProfileHub();
        }
      };
    }

    const expBtn = document.getElementById('jcProfileExportNativeJsonBtn');
    if (expBtn) {
      expBtn.onclick = () => {
        if (typeof window.exportConsolidatedNativeBankJson === 'function') {
          window.exportConsolidatedNativeBankJson();
        }
      };
    }

    const goQBtn = document.getElementById('jcProfileGoQuestionsBtn');
    if (goQBtn) {
      goQBtn.onclick = () => {
        if (typeof openView === 'function') openView('report');
      };
    }
  }

  JC_MODULES.socialProfile = {
    decorateHeader: decorateTopHeaderAvatarPill,
    renderProfile: renderHunterProfileHub,
    computeBoardStats: computeBoardAccuracyStats,
    openVisitorModal: openPublicHunterProfileVisitorModal,
    saveChanges: saveHunterProfileChanges
  };
  window.renderHunterProfileHub = renderHunterProfileHub;
  window.decorateTopHeaderAvatarPill = decorateTopHeaderAvatarPill;

  function bootSocialProfileHooks() {
    ensureProfileViewSectionExists();
    decorateTopHeaderAvatarPill();

    if (typeof window.updateAccountUI === 'function' && !window.updateAccountUI._jcProfileHooked) {
      const origUpdate = window.updateAccountUI;
      window.updateAccountUI = function () {
        origUpdate.apply(this, arguments);
        decorateTopHeaderAvatarPill();
      };
      window.updateAccountUI._jcProfileHooked = true;
    }

    if (typeof window.openView === 'function' && !window.openView._jcProfileHooked) {
      const origOpenView = window.openView;
      window.openView = function (id) {
        ensureProfileViewSectionExists();
        origOpenView.apply(this, arguments);
        if (id === 'profile') {
          renderHunterProfileHub();
          document.title = 'Meu Perfil — Jornada do Caçador';
        }
      };
      window.openView._jcProfileHooked = true;
    }
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSocialProfileHooks);
  } else {
    setTimeout(bootSocialProfileHooks, 0);
  }
})();

/* ============================================================================
 * Módulo 7 (r178): Redesign Clean UI (Inspirado em Caveira / Linear / Shadcn),
 * Sidebar Lateral Retrátil (Expandida / Somente Ícones), Topbar Focus Timer Pill
 * (00:00:00) e Modo Foco Tela Cheia Imersivo Responsivo (Desktop & Mobile)
 * ============================================================================ */
(function () {
  'use strict';

  const JC_MODULES = (window.JC_MODULES = window.JC_MODULES || {});
  let wakeLockSentinel = null;
  let wakeLockDesired = false;
  let wakeLockGeneration = 0;
  let wakeLockRequest = null;
  let focusReturnElement = null;
  let focusBackground = [];
  let focusPreviousOverflow = '';
  let focusFullscreenOwned = false;
  let focusNativeActive = false;
  let focusFullscreenRequest = null;
  let focusControlPending = false;

  function focusPreference(key) {
    try { return localStorage.getItem(key); } catch (_e) { return null; }
  }
  function preferredCleanMode() {
    const current = focusPreference('jc_caveira_clean_mode_v1');
    if (current === '0' || current === '1') return current === '1';
    return focusPreference('jc_clean_ux_v1') !== 'detailed';
  }

  function formatHHMMSS(totalSeconds) {
    const number = Number(totalSeconds);
    const sec = Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  async function requestScreenWakeLock(enable) {
    const desired = Boolean(enable);
    if (wakeLockDesired !== desired) wakeLockGeneration++;
    wakeLockDesired = desired;
    if (!desired) {
      const previous = wakeLockSentinel;
      wakeLockSentinel = null;
      try { await previous?.release(); } catch (_e) {}
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.wakeLock || document.visibilityState === 'hidden') return;
    if (wakeLockSentinel) return;
    if (wakeLockRequest) {
      try { await wakeLockRequest; } catch (_e) {}
      if (wakeLockDesired && !wakeLockSentinel && !wakeLockRequest) return requestScreenWakeLock(true);
      return;
    }
    const generation = wakeLockGeneration;
    let request;
    try {
      request = navigator.wakeLock.request('screen');
      wakeLockRequest = request;
      const sentinel = await request;
      if (wakeLockRequest === request) wakeLockRequest = null;
      const overlay = document.getElementById('jcFullscreenFocusOverlay');
      if (!wakeLockDesired || generation !== wakeLockGeneration || !overlay || overlay.hidden || document.visibilityState === 'hidden') {
        try { await sentinel.release(); } catch (_e) {}
        return;
      }
      wakeLockSentinel = sentinel;
      sentinel.addEventListener?.('release', () => { if (wakeLockSentinel === sentinel) wakeLockSentinel = null; });
    } catch (_e) {
      // A recusa da API não impede a leitura ou o funcionamento do cronômetro.
    } finally {
      if (wakeLockRequest === request) wakeLockRequest = null;
    }
  }

  function injectCaveiraCleanUiStyles() {
    if (document.getElementById('jc-caveira-clean-ui-styles')) return;
    const st = document.createElement('style');
    st.id = 'jc-caveira-clean-ui-styles';
    st.textContent = `
      /* ── 1. SIDEBAR LATERAL RETRÁTIL NO DESKTOP (Padrão app.caveira.com / Linear) ── */
      .jcSideRail {
        display: none;
      }
      @media (min-width: 960px) {
        body.jcHasSidebar {
          padding-left: 232px;
          transition: padding-left 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body.jcHasSidebar.jcSidebarCollapsed {
          padding-left: 68px;
        }
        body.jcHasSidebar main.app {
          width: min(100%, 1180px) !important;
          max-width: 1180px !important;
          padding-top: 14px !important;
        }
        /* Esconde a barra .tabs horizontal no desktop quando a Sidebar está ativa (mantém no DOM p/ testes) */
        body.jcHasSidebar main.app > nav.tabs {
          display: none !important;
        }
        .jcSideRail {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 232px;
          background: #08111d;
          border-right: 1px solid rgba(56, 189, 248, 0.16);
          z-index: 45;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 14px 10px;
          transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 8px 0 28px rgba(0, 0, 0, 0.35);
          user-select: none;
        }
        body.jcSidebarCollapsed .jcSideRail {
          width: 68px;
          padding: 14px 8px;
        }
        .jcSideBrandRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 6px 14px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          margin-bottom: 10px;
        }
        .jcSideBrandLogo {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          cursor: pointer;
        }
        .jcSideBrandLogo img {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          flex: 0 0 34px;
        }
        .jcSideBrandTitle {
          font-size: 0.92rem;
          font-weight: 900;
          color: #f8fafc;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.02em;
        }
        body.jcSidebarCollapsed .jcSideBrandTitle {
          display: none;
        }
        .jcSideCollapseBtn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 29, 46, 0.8);
          color: #94a3b8;
          display: grid;
          place-items: center;
          font-size: 0.85rem;
          cursor: pointer;
          flex: 0 0 30px;
          transition: color 0.15s, border-color 0.15s;
        }
        .jcSideCollapseBtn:hover {
          color: #59e6ff;
          border-color: #59e6ff;
        }
        body.jcSidebarCollapsed .jcSideBrandRow {
          flex-direction: column;
          gap: 8px;
          padding-bottom: 10px;
        }
        .jcSideNavList {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .jcSideNavBtn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 11px;
          border: 1px solid transparent;
          background: transparent;
          color: #94a3b8;
          font-size: 0.84rem;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
          transition: background 0.16s, color 0.16s, border-color 0.16s;
          white-space: nowrap;
        }
        .jcSideNavBtn:hover {
          background: rgba(19, 42, 66, 0.65);
          color: #e2e8f0;
        }
        .jcSideNavBtn.active {
          background: linear-gradient(90deg, rgba(22, 122, 255, 0.22), rgba(89, 230, 255, 0.08));
          color: #59e6ff;
          border-color: rgba(89, 230, 255, 0.32);
          box-shadow: inset 3px 0 0 #59e6ff;
        }
        .jcSideNavIcon {
          width: 22px;
          height: 22px;
          display: inline-grid;
          place-items: center;
          font-size: 1.08rem;
          flex: 0 0 22px;
          font-style: normal;
        }
        .jcSideNavLabel {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .jcSideNavBadge {
          margin-left: auto;
          padding: 2px 6px;
          border-radius: 99px;
          font-size: 0.62rem;
          font-weight: 900;
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        body.jcSidebarCollapsed .jcSideNavBtn {
          justify-content: center;
          padding: 11px 0;
        }
        body.jcSidebarCollapsed .jcSideNavLabel,
        body.jcSidebarCollapsed .jcSideNavBadge,
        body.jcSidebarCollapsed .jcSideSectionTitle {
          display: none;
        }
        .jcSideSectionTitle {
          font-size: 0.64rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #475569;
          padding: 10px 12px 4px;
        }
        .jcSideFooter {
          padding-top: 10px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        body.lightAppTheme .jcSideRail {
          background: #ffffff !important;
          border-right-color: #e2e8f0 !important;
          box-shadow: 4px 0 18px rgba(15, 23, 42, 0.05) !important;
        }
        body.lightAppTheme .jcSideBrandTitle { color: #0f172a !important; }
        body.lightAppTheme .jcSideNavBtn { color: #475569 !important; }
        body.lightAppTheme .jcSideNavBtn:hover { background: #f1f5f9 !important; color: #0f172a !important; }
        body.lightAppTheme .jcSideNavBtn.active {
          background: #e0f2fe !important;
          color: #0284c7 !important;
          border-color: #bae6fd !important;
          box-shadow: inset 3px 0 0 #0284c7 !important;
        }
      }

      /* ── 2. CRONÔMETRO COMPACTO NO TOPO (Estilo Caveira: ⏱ ⏹ ↻ | 00:00:00 [ ]) ── */
      .jcTopTimerPill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #071220;
        border: 1px solid rgba(89, 230, 255, 0.28);
        border-radius: 12px;
        padding: 4px 7px;
        height: 40px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.28);
      }
      .jcTopTimerPill.isRunning {
        border-color: #34d399;
        box-shadow: 0 0 14px rgba(52, 211, 153, 0.22);
      }
      .jcTopTimerBtn {
        width: 28px;
        height: 28px;
        border-radius: 7px;
        border: 0;
        background: transparent;
        color: #94a3b8;
        display: inline-grid;
        place-items: center;
        font-size: 0.88rem;
        cursor: pointer;
        padding: 0;
        transition: background 0.15s, color 0.15s;
      }
      .jcTopTimerBtn:hover {
        background: rgba(56, 189, 248, 0.16);
        color: #f8fafc;
      }
      .jcTopTimerBtn.playBtn.active {
        color: #34d399;
        background: rgba(16, 185, 129, 0.16);
      }
      .jcTopTimerDivider {
        width: 1px;
        height: 18px;
        background: rgba(148, 163, 184, 0.22);
        margin: 0 3px;
      }
      .jcTopTimerDigits {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-variant-numeric: tabular-nums;
        font-weight: 800;
        font-size: 0.94rem;
        color: #f8fafc;
        letter-spacing: 0.03em;
        padding: 0 5px;
        cursor: pointer;
        white-space: nowrap;
      }
      .jcTopTimerPill.isRunning .jcTopTimerDigits {
        color: #34d399;
      }
      .jcTopTimerExpandBtn {
        width: 29px;
        height: 29px;
        border-radius: 7px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        background: rgba(15, 31, 49, 0.9);
        color: #e2e8f0;
        display: inline-grid;
        place-items: center;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 0;
        transition: border-color 0.15s, background 0.15s, color 0.15s;
      }
      .jcTopTimerExpandBtn:hover {
        border-color: #59e6ff;
        color: #59e6ff;
        background: rgba(14, 165, 233, 0.15);
      }
      .jcTopXpPill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 0 10px;
        height: 40px;
        border-radius: 12px;
        background: rgba(15, 29, 46, 0.88);
        border: 1px solid rgba(247, 189, 67, 0.32);
        color: #f8fafc;
        font-size: 0.82rem;
        font-weight: 800;
        white-space: nowrap;
      }
      .jcTopXpPill i {
        font-style: normal;
        color: #f7bd43;
      }
      .jcTopUtilityRow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        margin-right: 8px;
      }
      @media (max-width: 760px) {
        header.top, .top {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 6px 8px !important;
          padding: 10px 12px !important;
          height: auto !important;
        }
        .top > .brand {
          order: 1 !important;
          flex: 1 1 calc(100% - 118px) !important;
          min-width: 0 !important;
          max-width: calc(100% - 118px) !important;
        }
        .top > .brand h1 {
          font-size: 0.96rem !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .top > .accountArea {
          order: 2 !important;
          flex: 0 0 auto !important;
          margin-left: auto !important;
        }
        .jcTopUtilityRow {
          order: 3 !important;
          flex: 0 0 100% !important;
          width: 100% !important;
          margin: 2px 0 0 0 !important;
          padding-top: 7px !important;
          border-top: 1px solid rgba(56, 189, 248, 0.16) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
        }
        .jcTopTimerPill {
          height: 36px !important;
          padding: 3px 8px !important;
          gap: 4px !important;
          flex: 1 1 auto !important;
          justify-content: space-between !important;
        }
        .jcTopTimerDigits {
          font-size: 0.88rem !important;
          padding: 0 4px !important;
        }
        .jcTopXpPill {
          display: inline-flex !important;
          height: 36px !important;
          padding: 0 10px !important;
          font-size: 0.78rem !important;
          flex: 0 0 auto !important;
        }
      }
      body.lightAppTheme .jcTopTimerPill,
      body.lightAppTheme .jcTopXpPill {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
        box-shadow: none !important;
      }
      body.lightAppTheme .jcTopTimerDigits { color: #0f172a !important; }
      body.lightAppTheme .jcTopTimerExpandBtn {
        background: #ffffff !important;
        border-color: #94a3b8 !important;
        color: #0f172a !important;
      }

      /* ── 3. MODO FOCO TELA CHEIA IMERSIVO (Estilo Caveira: Fundo Escuro Limpo, Ícone Central, Relógio Gigante Legível) ── */
      .jcFullscreenFocusModal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: radial-gradient(circle at 50% 35%, #161d2a 0%, #0b0f17 65%, #06090f 100%);
        color: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        user-select: none;
        animation: jcFadeInFocus 0.22s ease-out;
      }
      .jcFullscreenFocusModal[hidden] {
        display: none !important;
      }
      @keyframes jcFadeInFocus {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
      .jcFocusCenterEmblem {
        width: clamp(68px, 11vw, 96px);
        height: clamp(68px, 11vw, 96px);
        margin-bottom: 14px;
        filter: drop-shadow(0 0 24px rgba(89, 230, 255, 0.35));
        transition: transform 0.3s ease;
      }
      .jcFullscreenFocusModal.isRunning .jcFocusCenterEmblem {
        animation: jcPulseEmblem 2.8s infinite ease-in-out;
      }
      @keyframes jcPulseEmblem {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 22px rgba(52, 211, 153, 0.4)); }
        50% { transform: scale(1.05); filter: drop-shadow(0 0 36px rgba(89, 230, 255, 0.65)); }
      }
      .jcFocusMissionPill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(15, 29, 46, 0.75);
        border: 1px solid rgba(89, 230, 255, 0.28);
        color: #93c5fd;
        font-size: clamp(0.76rem, 1.8vw, 0.9rem);
        font-weight: 700;
        max-width: min(90vw, 560px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 10px;
      }
      .jcFocusGiantDigits {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-variant-numeric: tabular-nums;
        font-weight: 800;
        font-size: clamp(3.4rem, 13.5vw, 7.6rem);
        line-height: 1.05;
        letter-spacing: 0.02em;
        color: #ffffff;
        text-shadow: 0 8px 34px rgba(0, 0, 0, 0.65);
        margin: 6px 0 20px;
      }
      .jcFullscreenFocusModal.isRunning .jcFocusGiantDigits {
        color: #ecfdf5;
        text-shadow: 0 0 38px rgba(52, 211, 153, 0.28);
      }
      .jcFocusControlsBar {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        padding: 10px 20px;
        border-radius: 16px;
        background: rgba(15, 23, 36, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5);
      }
      .jcFocusCtrlBtn {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(30, 41, 59, 0.75);
        color: #e2e8f0;
        display: inline-grid;
        place-items: center;
        font-size: 1.22rem;
        cursor: pointer;
        transition: all 0.16s ease;
      }
      .jcFocusCtrlBtn:hover {
        border-color: #59e6ff;
        color: #ffffff;
        background: rgba(14, 165, 233, 0.25);
        transform: translateY(-1px);
      }
      .jcFocusCtrlBtn.primaryPlay {
        width: 56px;
        height: 56px;
        border-radius: 15px;
        background: linear-gradient(135deg, #10b981, #059669);
        border-color: #34d399;
        color: #ffffff;
        font-size: 1.4rem;
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
      }
      .jcFocusCtrlBtn.primaryPlay.paused {
        background: linear-gradient(135deg, #0ea5e9, #2563eb);
        border-color: #59e6ff;
        box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
      }
      .jcFocusCtrlDivider {
        width: 1px;
        height: 28px;
        background: rgba(148, 163, 184, 0.25);
      }
      .jcFocusModeSwitchRow {
        display: flex;
        gap: 8px;
        margin-top: 20px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .jcFocusModeChip {
        padding: 6px 13px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 36, 0.65);
        color: #94a3b8;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
      }
      .jcFocusModeChip.active {
        border-color: #59e6ff;
        color: #59e6ff;
        background: rgba(14, 165, 233, 0.14);
      }
      .jcFocusBottomMeta {
        margin-top: 16px;
        font-size: 0.8rem;
        color: #64748b;
      }
      @media (max-height: 500px) and (orientation: landscape) {
        .jcFocusCenterEmblem { width: 48px; height: 48px; margin-bottom: 6px; }
        .jcFocusGiantDigits { font-size: clamp(2.8rem, 11vw, 4.5rem); margin: 2px 0 10px; }
        .jcFocusModeSwitchRow { margin-top: 10px; }
      }

      .jcFullscreenFocusModal { box-sizing:border-box; max-height:100dvh; overflow-y:auto; overscroll-behavior:contain; padding:max(16px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
      .jcFocusGiantDigits { font-size:clamp(2rem, 11vw, 7.6rem); max-width:100%; white-space:nowrap; letter-spacing:.01em; }
      .jcFocusControlsBar { box-sizing:border-box; max-width:100%; flex-wrap:wrap; justify-content:center; gap:10px; padding:10px 12px; }
      .jcFocusBottomMeta { color:#cbd5e1; max-width:100%; line-height:1.5; }
      .jcTopTimerDigits { width:auto; min-width:0; border:0; background:transparent; }
      .jcTopUtilityRow { min-width:0; max-width:100%; flex-wrap:wrap; }
      .jcTopTimerPill { min-width:0; max-width:100%; }
      .jcTopXpPill { max-width:100%; min-width:0; overflow:hidden; }
      #jcTopXpValue { overflow:hidden; text-overflow:ellipsis; }
      .jcFocusCtrlBtn:focus-visible, .jcFocusModeChip:focus-visible, .jcTopTimerDigits:focus-visible, .jcSideNavBtn:focus-visible { outline:3px solid #65e7ff; outline-offset:3px; }
      body.lightAppTheme .jcFullscreenFocusModal { background:radial-gradient(circle at 50% 35%,#ffffff 0%,#f1f5f9 100%); color:#0f172a; }
      body.lightAppTheme .jcFocusGiantDigits, body.lightAppTheme .jcFullscreenFocusModal.isRunning .jcFocusGiantDigits { color:#0f172a; text-shadow:none; }
      body.lightAppTheme .jcFocusMissionPill, body.lightAppTheme .jcFocusControlsBar, body.lightAppTheme .jcFocusCtrlBtn, body.lightAppTheme .jcFocusModeChip { background:#fff; color:#0f172a; border-color:#64748b; box-shadow:none; }
      body.lightAppTheme .jcFocusModeChip.active { background:#e0f2fe; color:#075985; border-color:#0369a1; }
      body.lightAppTheme .jcFocusCtrlBtn.primaryPlay { background:#0369a1; color:#fff; border-color:#0369a1; }
      body.lightAppTheme .jcFocusBottomMeta, body.lightAppTheme .jcTopTimerBtn { color:#334155; }
      body.lightAppTheme .jcTopTimerBtn:hover { background:#e0f2fe; color:#0f172a; }
      body.lightAppTheme .jcTopTimerBtn.playBtn.active { background:#cffafe; color:#075985; }
      body.lightAppTheme .jcFocusCtrlBtn:focus-visible, body.lightAppTheme .jcFocusModeChip:focus-visible, body.lightAppTheme .jcTopTimerDigits:focus-visible { outline-color:#075985; }
      @media (max-width:760px) {
        .jcTopTimerPill { flex:1 1 240px !important; }
        .jcTopXpPill { flex:0 1 auto !important; }
        .top > .accountArea { max-width:118px; min-width:0; flex-wrap:wrap; justify-content:flex-end; }
        .top > .accountArea #accountBtn { max-width:76px; overflow:hidden; text-overflow:ellipsis; }
      }
      @media (max-width:360px) {
        .jcFocusControlsBar { gap:8px; padding:8px; }
        .jcFocusCtrlBtn { width:42px; height:42px; }
        .jcFocusCtrlBtn.primaryPlay { width:48px; height:48px; }
      }
      @media (max-height:350px) {
        .jcFullscreenFocusModal { justify-content:flex-start; }
        .jcFocusCenterEmblem { display:none; }
        .jcFocusModeSwitchRow { margin-top:8px; }
      }
      @media (prefers-reduced-motion:reduce) {
        .jcFullscreenFocusModal, .jcFocusCenterEmblem, .jcSideRail, body.jcHasSidebar { animation:none !important; transition:none !important; }
      }

      /* ── 4. DESPOLUIÇÃO VISUAL PROFUNDA ("CLEAN DASHBOARD MODE" PADRÃO) ── */
      body.jcCleanDashboard .jcDecorativeDescription {
        display: none !important;
      }
      body.jcCleanDashboard .card {
        border-radius: 16px !important;
        padding: 16px 18px !important;
        border-color: rgba(51, 78, 104, 0.55) !important;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18) !important;
      }
      body.jcCleanDashboard section.hero {
        padding: 16px 20px !important;
        margin-bottom: 14px !important;
        border-radius: 18px !important;
      }
      body.jcCleanDashboard .jcAccordionDrawer {
        border-radius: 15px;
        background: var(--panel, #0b1624);
        border: 1px solid rgba(51, 78, 104, 0.55);
        margin-bottom: 12px;
        overflow: hidden;
      }
      body.jcCleanDashboard .jcAccordionDrawer > summary {
        list-style: none;
        padding: 13px 16px;
        font-weight: 800;
        font-size: 0.9rem;
        color: #e2e8f0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        user-select: none;
      }
      body.jcCleanDashboard .jcAccordionDrawer > summary::-webkit-details-marker {
        display: none;
      }
      body.jcCleanDashboard .jcAccordionDrawer > summary::after {
        content: "▾ Expandir";
        font-size: 0.74rem;
        font-weight: 700;
        color: #59e6ff;
        padding: 3px 9px;
        border-radius: 99px;
        background: rgba(56, 189, 248, 0.12);
      }
      body.jcCleanDashboard .jcAccordionDrawer[open] > summary::after {
        content: "▴ Recolher";
      }
      body.jcCleanDashboard .jcAccordionDrawerBody {
        padding: 0 14px 14px;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
      }
      body.lightAppTheme.jcCleanDashboard .jcAccordionDrawer {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
      }
      body.lightAppTheme.jcCleanDashboard .jcAccordionDrawer > summary {
        color: #0f172a !important;
      }
    `;
    document.head.appendChild(st);
  }

  // Estado do modo de exibição do cronômetro ('countdown' = regressivo do bloco | 'elapsed' = progressivo do dia)
  let focusDisplayMode = focusPreference('jc_focus_display_mode_v1') === 'elapsed' ? 'elapsed' : 'countdown';

  function getFocusSecondsToDisplay() {
    const st = typeof state === 'object' && state ? state : (window.state || {});
    const rem = typeof timerLeft === 'number' ? timerLeft : 3000;
    const blockTotal = typeof focusBlockSeconds === 'function' ? focusBlockSeconds() : 3000;
    if (focusDisplayMode === 'elapsed') {
      const todayKey = typeof localDayKey === 'function' ? localDayKey() : new Date().toISOString().slice(0, 10);
      const studiedToday = Number(st.studyByDay?.[todayKey] || 0);
      return studiedToday;
    }
    // Se ainda não iniciou o foco (parado no topo do bloco), exibe o tempo restante formatado em HH:MM:SS
    return Math.max(0, rem);
  }

  function updateAllFocusTimerDisplays() {
    const isRunning = Boolean(typeof timerRun !== 'undefined' && timerRun);
    const secs = getFocusSecondsToDisplay();
    const formatted = formatHHMMSS(secs);

    // 1. Atualiza o relógio principal da aba Hoje (#clock) em formato HH:MM:SS legível
    const mainClock = document.getElementById('clock');
    if (mainClock) {
      mainClock.textContent = formatted;
    }

    // 2. Atualiza a pílula do topo (#jcTopTimerPill)
    const topPill = document.getElementById('jcTopTimerPill');
    const topDigits = document.getElementById('jcTopTimerDigits');
    const topPlayBtn = document.getElementById('jcTopTimerPlayBtn');
    if (topPill) topPill.classList.toggle('isRunning', isRunning);
    if (topDigits) topDigits.textContent = formatted;
    if (topPlayBtn) {
      topPlayBtn.classList.toggle('active', isRunning);
      topPlayBtn.innerHTML = isRunning ? '⏸' : '⏱';
      topPlayBtn.title = isRunning ? 'Pausar cronômetro de foco' : 'Iniciar cronômetro de foco';
    }

    // 3. Atualiza o XP pill do topo
    const topXpVal = document.getElementById('jcTopXpValue');
    if (topXpVal && typeof xp === 'function') {
      topXpVal.textContent = `${xp()} XP`;
    }

    // 4. Atualiza o Overlay de Tela Cheia (#jcFullscreenFocusOverlay)
    const fsModal = document.getElementById('jcFullscreenFocusOverlay');
    if (fsModal && !fsModal.hidden) {
      fsModal.classList.toggle('isRunning', isRunning);
      const fsDigits = document.getElementById('jcFocusGiantDigits');
      if (fsDigits) fsDigits.textContent = formatted;
      const fsPlayBtn = document.getElementById('jcFsPlayPauseBtn');
      if (fsPlayBtn) {
        fsPlayBtn.classList.toggle('paused', !isRunning);
        fsPlayBtn.innerHTML = isRunning ? '⏸' : '▶';
        fsPlayBtn.title = isRunning ? 'Pausar Foco (Espaço)' : 'Iniciar Foco (Espaço)';
      }
      const fsMeta = document.getElementById('jcFocusBottomMeta');
      if (fsMeta) {
        const st = typeof state === 'object' && state ? state : (window.state || {});
        const todayKey = typeof localDayKey === 'function' ? localDayKey() : new Date().toISOString().slice(0, 10);
        const studiedMin = Math.floor(Number(st.studyByDay?.[todayKey] || 0) / 60);
        const targetMin = Number(st.settings?.dailyMinutes || 180);
        fsMeta.textContent = `Estudado hoje: ${studiedMin} min de ${targetMin} min · Pressione ESC para sair da tela cheia`;
      }
    }
  }

  function runFocusTimerControl(action) {
    if (focusControlPending) return;
    focusControlPending = true;
    let result;
    try {
      if (action === 'reset') result = document.getElementById('timerReset')?.click();
      else if (action === 'toggle' || (typeof timerRun !== 'undefined' && timerRun)) {
        if (typeof toggleTimer === 'function') result = toggleTimer();
        else result = document.getElementById('timerToggle')?.click();
      }
    } catch (error) {
      if (typeof window.toast === 'function') window.toast(error?.message || 'Não foi possível atualizar o cronômetro.');
    }
    updateAllFocusTimerDisplays();
    Promise.resolve(result).catch(error => {
      if (typeof window.toast === 'function') window.toast(error?.message || 'Não foi possível atualizar o cronômetro.');
    }).finally(() => { focusControlPending = false; updateAllFocusTimerDisplays(); });
  }

  function focusOverlayControls(modal) {
    return [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => !element.hidden && !element.disabled && (typeof element.getClientRects !== 'function' || element.getClientRects().length > 0));
  }

  function openFullscreenFocusTimer() {
    ensureFullscreenFocusModalExists();
    const modal = document.getElementById('jcFullscreenFocusOverlay');
    if (!modal) return;
    const firstOpening = modal.hidden;
    if (firstOpening) {
      focusReturnElement = document.activeElement;
      focusPreviousOverflow = document.body.style.overflow || '';
      focusBackground = [...(document.body.children || [])].filter(element => element !== modal && !['SCRIPT','STYLE'].includes(element.tagName)).map(element => ({ element, inert: Boolean(element.inert), hidden: element.getAttribute?.('aria-hidden') }));
      focusBackground.forEach(({ element }) => { element.inert = true; element.setAttribute?.('aria-hidden', 'true'); });
      document.body.style.overflow = 'hidden';
      document.body.classList.add('jcFocusOverlayOpen');
    }
    const missionEl = document.getElementById('jcFocusMissionLabel');
    if (missionEl) {
      try {
        const st = typeof state === 'object' && state ? state : (window.state || {});
        const pool = typeof missionPool === 'function' ? missionPool() : [];
        const curM = pool.find(m => m.id === st.daily);
        missionEl.textContent = curM ? `🎯 ${curM.subject} — ${curM.name}` : '⚔️ Modo Foco Imersivo · Jornada do Caçador';
      } catch (_e) {}
    }
    modal.hidden = false;
    modal.classList.add('open');
    updateAllFocusTimerDisplays();
    document.getElementById('jcFsPlayPauseBtn')?.focus?.();
    requestScreenWakeLock(true);
    focusNativeActive = Boolean(document.fullscreenElement);
    if (document.documentElement.requestFullscreen && !document.fullscreenElement && !focusFullscreenRequest) {
      try {
        const request = Promise.resolve(document.documentElement.requestFullscreen());
        focusFullscreenRequest = request;
        request.then(() => {
          if (modal.hidden) {
            if (document.fullscreenElement === document.documentElement) document.exitFullscreen?.().catch?.(() => {});
          } else {
            focusFullscreenOwned = document.fullscreenElement === document.documentElement;
            focusNativeActive = Boolean(document.fullscreenElement);
          }
        }).catch(() => {}).finally(() => { if (focusFullscreenRequest === request) focusFullscreenRequest = null; });
      } catch (_e) {}
    }
  }

  function closeFullscreenFocusTimer() {
    const modal = document.getElementById('jcFullscreenFocusOverlay');
    const wasOpen = modal && !modal.hidden;
    if (modal) { modal.hidden = true; modal.classList.remove('open'); }
    requestScreenWakeLock(false);
    if (wasOpen) {
      focusBackground.forEach(({ element, inert, hidden }) => {
        element.inert = inert;
        if (hidden === null || hidden === undefined) element.removeAttribute?.('aria-hidden');
        else element.setAttribute?.('aria-hidden', hidden);
      });
      focusBackground = [];
      document.body.style.overflow = focusPreviousOverflow;
      document.body.classList.remove('jcFocusOverlayOpen');
      if (focusReturnElement?.isConnected !== false) focusReturnElement?.focus?.();
      focusReturnElement = null;
    }
    try {
      if (focusFullscreenOwned && document.fullscreenElement && document.exitFullscreen) Promise.resolve(document.exitFullscreen()).catch(() => {});
    } catch (_e) {}
    focusFullscreenOwned = false;
    focusNativeActive = false;
  }

  window.openFullscreenFocusTimer = openFullscreenFocusTimer;
  window.closeFullscreenFocusTimer = closeFullscreenFocusTimer;

  function ensureFullscreenFocusModalExists() {
    if (document.getElementById('jcFullscreenFocusOverlay')) return;
    const modal = document.createElement('div');
    modal.id = 'jcFullscreenFocusOverlay';
    modal.className = 'jcFullscreenFocusModal';
    modal.hidden = true;
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Cronômetro de foco em tela cheia');
    modal.innerHTML = `
      <img src="icon.svg" alt="Emblema Jornada do Caçador" class="jcFocusCenterEmblem" onerror="this.onerror=null;this.src='icon-192.png'">
      <div class="jcFocusMissionPill" id="jcFocusMissionLabel">⚔️ Modo Foco Imersivo · Jornada do Caçador</div>
      <div class="jcFocusGiantDigits" id="jcFocusGiantDigits">00:50:00</div>
      <div class="jcFocusControlsBar">
        <button type="button" class="jcFocusCtrlBtn primaryPlay paused" id="jcFsPlayPauseBtn" title="Iniciar / Pausar Foco">▶</button>
        <button type="button" class="jcFocusCtrlBtn" id="jcFsStopBtn" title="Parar e salvar sessão">⏹</button>
        <button type="button" class="jcFocusCtrlBtn" id="jcFsResetBtn" title="Reiniciar bloco">↻</button>
        <span class="jcFocusCtrlDivider"></span>
        <button type="button" class="jcFocusCtrlBtn" id="jcFsExitFullscreenBtn" title="Sair da tela cheia (ESC)">⤡</button>
      </div>
      <div class="jcFocusModeSwitchRow">
        <button type="button" class="jcFocusModeChip ${focusDisplayMode === 'countdown' ? 'active' : ''}" data-jc-focus-mode="countdown">⏳ Contagem Regressiva do Bloco</button>
        <button type="button" class="jcFocusModeChip ${focusDisplayMode === 'elapsed' ? 'active' : ''}" data-jc-focus-mode="elapsed">⏱️ Tempo Líquido Acumulado Hoje</button>
      </div>
      <div class="jcFocusBottomMeta" id="jcFocusBottomMeta">Estudado hoje: 0 min · Pressione ESC para sair da tela cheia</div>
    `;
    document.body.appendChild(modal);

    document.getElementById('jcFsPlayPauseBtn').onclick = () => runFocusTimerControl('toggle');
    document.getElementById('jcFsStopBtn').onclick = () => runFocusTimerControl('stop');
    document.getElementById('jcFsResetBtn').onclick = () => runFocusTimerControl('reset');
    document.getElementById('jcFsExitFullscreenBtn').onclick = () => closeFullscreenFocusTimer();

    modal.querySelectorAll('[data-jc-focus-mode]').forEach(chip => {
      chip.onclick = () => {
        focusDisplayMode = chip.dataset.jcFocusMode || 'countdown';
        try { localStorage.setItem('jc_focus_display_mode_v1', focusDisplayMode); } catch (_e) {}
        modal.querySelectorAll('[data-jc-focus-mode]').forEach(c => c.classList.toggle('active', c === chip));
        updateAllFocusTimerDisplays();
      };
    });

    document.addEventListener('keydown', (e) => {
      if (modal.hidden || e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault(); closeFullscreenFocusTimer(); return;
      }
      const active = document.activeElement;
      if (e.key === 'Tab') {
        const controls = focusOverlayControls(modal), first = controls[0], last = controls[controls.length - 1];
        if (!first) { e.preventDefault(); modal.focus?.(); }
        else if (e.shiftKey && (active === first || !modal.contains?.(active))) { e.preventDefault(); last.focus?.(); }
        else if (!e.shiftKey && (active === last || !modal.contains?.(active))) { e.preventDefault(); first.focus?.(); }
        return;
      }
      const interactive = ['INPUT','TEXTAREA','SELECT','BUTTON','A','SUMMARY'].includes(active?.tagName || '') || active?.isContentEditable || active?.closest?.('[contenteditable="true"],[contenteditable=""]');
      if (e.key === ' ' && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !interactive && !e.defaultPrevented) {
        e.preventDefault(); runFocusTimerControl('toggle');
      }
    });
    document.addEventListener('focusin', event => {
      if (!modal.hidden && !modal.contains?.(event.target)) (focusOverlayControls(modal)[0] || modal).focus?.();
    });
    document.addEventListener('fullscreenchange', () => {
      if (modal.hidden) return;
      if (document.fullscreenElement) {
        focusNativeActive = true;
        if (focusFullscreenRequest && document.fullscreenElement === document.documentElement) focusFullscreenOwned = true;
      } else if (focusNativeActive) closeFullscreenFocusTimer();
    });
    document.addEventListener('visibilitychange', () => {
      if (!modal.hidden) requestScreenWakeLock(document.visibilityState !== 'hidden');
    });
  }

  function ensureTopHeaderFocusTimerBar() {
    const accountArea = document.querySelector('.top .accountArea');
    if (!accountArea || document.getElementById('jcTopTimerPill')) return;

    const timerPillHtml = `
      <div class="jcTopTimerPill" id="jcTopTimerPill" title="Cronômetro de Foco (Clique nos números ou no ícone de expandir para Tela Cheia)">
        <button type="button" class="jcTopTimerBtn playBtn" id="jcTopTimerPlayBtn" aria-label="Iniciar ou pausar foco" title="Iniciar / Pausar Foco">⏱</button>
        <button type="button" class="jcTopTimerBtn stopBtn" id="jcTopTimerStopBtn" aria-label="Pausar foco" title="Pausar Foco">⏹</button>
        <button type="button" class="jcTopTimerBtn resetBtn" id="jcTopTimerResetBtn" aria-label="Reiniciar bloco" title="Reiniciar Bloco">↻</button>
        <span class="jcTopTimerDivider"></span>
        <button type="button" class="jcTopTimerDigits" id="jcTopTimerDigits" aria-label="Abrir cronômetro em tela cheia">00:50:00</button>
        <button type="button" class="jcTopTimerExpandBtn" id="jcTopTimerExpandBtn" aria-label="Expandir cronômetro em tela cheia" title="Modo Foco em Tela Cheia (Estilo Caveira)">⛶</button>
      </div>
      <div class="jcTopXpPill" id="jcTopXpPill" title="Sua Experiência Acumulada">
        <i>⚡</i><span id="jcTopXpValue">0 XP</span>
      </div>
    `;
    const topBarEl = accountArea.parentElement || document.querySelector('.top');
    if (topBarEl && topBarEl.insertBefore) {
      const uRow = document.createElement('div');
      uRow.id = 'jcTopMobileUtilityRow';
      uRow.className = 'jcTopUtilityRow';
      uRow.innerHTML = timerPillHtml;
      topBarEl.insertBefore(uRow, accountArea);
    } else {
      accountArea.insertAdjacentHTML('afterbegin', timerPillHtml);
    }

    document.getElementById('jcTopTimerPlayBtn').onclick = () => runFocusTimerControl('toggle');
    document.getElementById('jcTopTimerStopBtn').onclick = () => runFocusTimerControl('stop');
    document.getElementById('jcTopTimerResetBtn').onclick = () => runFocusTimerControl('reset');
    document.getElementById('jcTopTimerDigits').onclick = () => openFullscreenFocusTimer();
    document.getElementById('jcTopTimerExpandBtn').onclick = () => openFullscreenFocusTimer();

    // Também adiciona botão de "⛶ Tela Cheia" dentro do card do cronômetro na aba Hoje
    const timerCardHead = document.querySelector('#today .card.timer .sectionHead');
    if (timerCardHead && !document.getElementById('jcTodayCardFullscreenBtn')) {
      timerCardHead.insertAdjacentHTML('beforeend', `<button type="button" class="ghost small" id="jcTodayCardFullscreenBtn" style="width:auto;padding:5px 10px;font-size:.75rem;border-color:#59e6ff;color:#59e6ff" title="Abrir cronômetro gigante em tela cheia">⛶ Tela Cheia</button>`);
      document.getElementById('jcTodayCardFullscreenBtn').onclick = () => openFullscreenFocusTimer();
    }
  }

  function ensureCollapsibleDesktopSidebar() {
    if (document.getElementById('jcCollapsibleSidebar')) return;
    const isCollapsed = focusPreference('jc_sidebar_collapsed_v1') === '1';
    document.body.classList.add('jcHasSidebar');
    document.body.classList.toggle('jcSidebarCollapsed', isCollapsed);

    const navItems = [
      { section: 'Principal' },
      { view: 'today', icon: '🏠', label: 'Home / Missão' },
      { view: 'map', icon: '🗓️', label: 'Cronograma & Edital' },
      { view: 'report', icon: '🎯', label: 'Questões & Simulados', badge: 'Foco' },
      { view: 'study', icon: '📖', label: 'Resumos & Flashcards' },
      { view: 'review', icon: '🔁', label: 'Revisão 1·7·30' },
      { section: 'Tático & IA' },
      { view: 'library', icon: '📂', label: 'PDFs & Biblioteca' },
      { view: 'assistant', icon: '🧙‍♂️', label: 'Invocador IA' },
      { view: 'study:laws', icon: '⚖️', label: 'Leis & Textos', badge: 'Lei Seca' },
      { view: 'learning', icon: '🗺️', label: 'Trilha Tática' },
      { view: 'essay', icon: '✍️', label: 'Redação Policial' },
      { view: 'taf', icon: '💪', label: 'Painel TAF' },
      { section: 'Comunidade' },
      { view: 'duel', icon: '⚔️', label: 'Arena Duelo X1', badge: 'PvP' },
      { view: 'ranking', icon: '🏆', label: 'Ranking Geral' },
      { view: 'profile:tactical', icon: '📊', label: 'Painel Tático' },
      { view: 'profile', icon: '👤', label: 'Meu Perfil Social' }
    ];

    const rail = document.createElement('aside');
    rail.id = 'jcCollapsibleSidebar';
    rail.className = 'jcSideRail';
    rail.setAttribute('aria-label', 'Menu lateral de navegação');

    rail.innerHTML = `
      <div class="jcSideBrandRow">
        <div class="jcSideBrandLogo" id="jcSideBrandHomeClick" title="Voltar para o Início">
          <img src="icon.svg" alt="Brasão" onerror="this.onerror=null;this.src='icon-192.png'">
          <span class="jcSideBrandTitle">Jornada Caçador</span>
        </div>
        <button type="button" class="jcSideCollapseBtn" id="jcSideCollapseToggleBtn" title="Recolher / Expandir Menu Lateral">
          ${isCollapsed ? '»' : '«'}
        </button>
      </div>
      <div class="jcSideNavList" id="jcSideNavList">
        ${navItems.map(item => {
          if (item.section) {
            return `<div class="jcSideSectionTitle">${item.section}</div>`;
          }
          return `
            <button type="button" class="jcSideNavBtn ${item.view === 'today' ? 'active' : ''}" data-jc-side-view="${item.view}" title="${item.label}">
              <i class="jcSideNavIcon">${item.icon}</i>
              <span class="jcSideNavLabel">${item.label}</span>
              ${item.badge ? `<span class="jcSideNavBadge">${item.badge}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
      <div class="jcSideFooter">
        <button type="button" class="jcSideNavBtn" id="jcSideCleanModeToggleBtn" title="Alternar Modo Limpo / Detalhado">
          <i class="jcSideNavIcon">✨</i>
          <span class="jcSideNavLabel">Visual Limpo Ativo</span>
        </button>
        <button type="button" class="jcSideNavBtn" id="jcSideThemeToggleBtn" title="Alternar Tema Claro / Escuro">
          <i class="jcSideNavIcon">☀️</i>
          <span class="jcSideNavLabel">Tema Claro / Escuro</span>
        </button>
        <button type="button" class="jcSideNavBtn" id="jcSideMoreMenuBtn" title="Configurações e Backup">
          <i class="jcSideNavIcon">⚙️</i>
          <span class="jcSideNavLabel">Configurações</span>
        </button>
      </div>
    `;
    document.body.prepend(rail);

    document.getElementById('jcSideBrandHomeClick').onclick = () => {
      if (typeof openView === 'function') openView('today');
    };
    const collapseBtn = document.getElementById('jcSideCollapseToggleBtn');
    collapseBtn.onclick = () => {
      const next = !document.body.classList.contains('jcSidebarCollapsed');
      document.body.classList.toggle('jcSidebarCollapsed', next);
      collapseBtn.textContent = next ? '»' : '«';
      try { localStorage.setItem('jc_sidebar_collapsed_v1', next ? '1' : '0'); } catch (_e) {}
    };

    rail.querySelectorAll('[data-jc-side-view]').forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.jcSideView || '';
        if (target === 'study:laws') {
          if (typeof openView === 'function') openView('study');
          if (typeof window.openSmartLawsSubtab === 'function') window.openSmartLawsSubtab();
          syncSidebarActiveState('study:laws');
          return;
        }
        if (target === 'profile:tactical') {
          if (typeof openView === 'function') openView('profile');
          if (window.JC_MODULES && window.JC_MODULES.caveiraFullSuiteR179) {
            window.JC_MODULES.caveiraFullSuiteR179.mountPainelTaticoInProfile();
          }
          setTimeout(() => {
            const tp = document.getElementById('jcTacticalPanelSection');
            if (tp && tp.scrollIntoView) tp.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
          syncSidebarActiveState('profile:tactical');
          return;
        }
        if (target && typeof openView === 'function') {
          openView(target);
        }
      };
    });

    document.getElementById('jcSideThemeToggleBtn').onclick = () => {
      document.getElementById('globalThemeToggleBtn')?.click();
    };
    document.getElementById('jcSideMoreMenuBtn').onclick = () => {
      document.getElementById('moreDialog')?.showModal();
    };
    const cleanBtn = document.getElementById('jcSideCleanModeToggleBtn');
    cleanBtn.onclick = () => {
      const nextClean = !document.body.classList.contains('jcCleanDashboard');
      applyCaveiraCleanDashboardMode(nextClean);
    };
  }

  function syncSidebarActiveState(viewId) {
    const rail = document.getElementById('jcCollapsibleSidebar');
    if (!rail) return;
    rail.querySelectorAll('[data-jc-side-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.jcSideView === viewId);
    });
  }

  // Agrupa cartões secundários da aba Hoje (Plano Diário, Histórico Diário, Missão Semanal) em uma gaveta retrátil limpa
  function organizeTodaySecondaryCardsIntoDrawer() {
    const todaySec = document.getElementById('today');
    if (!todaySec || document.getElementById('jcTodaySecondaryAccordion')) return;

    const planCard = document.getElementById('dailyPlan')?.closest('.card');
    const histCard = document.getElementById('dailyHistory')?.closest('.card');
    const weekCard = document.getElementById('weeklyMission')?.closest('.card');
    if (!planCard && !histCard && !weekCard) return;

    const details = document.createElement('details');
    details.id = 'jcTodaySecondaryAccordion';
    details.className = 'jcAccordionDrawer';
    details.innerHTML = `
      <summary>
        <span>📊 Plano Diário Detalhado, Histórico de Missões &amp; Meta Semanal</span>
      </summary>
      <div class="jcAccordionDrawerBody" id="jcTodaySecondaryDrawerBody"></div>
    `;
    todaySec.appendChild(details);
    const body = document.getElementById('jcTodaySecondaryDrawerBody');
    if (planCard) body.appendChild(planCard);
    if (histCard) body.appendChild(histCard);
    if (weekCard) body.appendChild(weekCard);
  }

  function applyCaveiraCleanDashboardMode(enable = true, showNotice = false) {
    const isClean = Boolean(enable);
    document.body.classList.toggle('jcCleanDashboard', isClean);
    document.body.classList.toggle('compactCleanUx', isClean);
    try {
      localStorage.setItem('jc_caveira_clean_mode_v1', isClean ? '1' : '0');
      localStorage.setItem('jc_clean_ux_v1', isClean ? 'clean' : 'detailed');
    } catch (_e) {}
    const lbl = document.querySelector('#jcSideCleanModeToggleBtn .jcSideNavLabel');
    if (lbl) lbl.textContent = isClean ? 'Visual Limpo: ON' : 'Visual Limpo: OFF';
    const side = document.getElementById('jcSideCleanModeToggleBtn');
    side?.setAttribute?.('aria-pressed', String(isClean));
    const btn = document.getElementById('cleanUxToggleBtn');
    if (btn) {
      btn.innerHTML = isClean ? '📖<span>Textos Detalhados</span>' : '✨<span>Visual Enxuto</span>';
      btn.title = isClean ? 'Visual limpo ativado. Mostrar detalhes.' : 'Modo detalhado ativado. Recolher elementos decorativos.';
      btn.setAttribute?.('aria-pressed', String(isClean));
    }
    const settings = document.getElementById('settingsCleanUxToggleBtn');
    if (settings) {
      settings.textContent = isClean ? '📖 Alternar para Modo Detalhado (Mostrar textos explicativos)' : '✨ Alternar para Visual Enxuto (Sem poluição visual)';
      settings.setAttribute?.('aria-pressed', String(isClean));
    }
    if (isClean) organizeTodaySecondaryCardsIntoDrawer();
    for (const id of ['jcTodaySecondaryAccordion','jcReportSecondaryAccordion']) {
      const drawer = document.getElementById(id);
      if (drawer) drawer.open = !isClean;
    }
    if (showNotice && typeof window.toast === 'function') window.toast(isClean
      ? '✨ Visual Limpo ativado: banners decorativos e detalhes secundários recolhidos. Avisos e fontes continuam visíveis.'
      : '📖 Modo detalhado ativado: banners e seções secundárias expandidos.');
    return isClean;
  }

  window.applyCaveiraCleanDashboardMode = applyCaveiraCleanDashboardMode;

  function bootCaveiraUiAndFullscreenTimer() {
    injectCaveiraCleanUiStyles();
    ensureFullscreenFocusModalExists();
    ensureTopHeaderFocusTimerBar();
    ensureCollapsibleDesktopSidebar();

    const preferClean = preferredCleanMode();
    applyCaveiraCleanDashboardMode(preferClean);
    updateAllFocusTimerDisplays();

    // Hook em tickClock para atualizar em tempo real (a cada segundo) a pílula do topo e o relógio gigante de tela cheia
    if (typeof window.tickClock === 'function' && !window.tickClock._jcFullscreenHooked) {
      const prevTick = window.tickClock;
      window.tickClock = function () {
        prevTick.apply(this, arguments);
        updateAllFocusTimerDisplays();
      };
      window.tickClock._jcFullscreenHooked = true;
    }

    // Hook em openView para destacar o item ativo na Sidebar Lateral
    if (typeof window.openView === 'function' && !window.openView._jcSidebarHooked) {
      const prevOpen = window.openView;
      window.openView = function (id) {
        prevOpen.apply(this, arguments);
        syncSidebarActiveState(id);
        updateAllFocusTimerDisplays();
        if (window.JC_MODULES && window.JC_MODULES.caveiraFullSuiteR179) {
          try { window.JC_MODULES.caveiraFullSuiteR179.init(); } catch (_e) {}
        }
      };
      window.openView._jcSidebarHooked = true;
    }
  }

  JC_MODULES.caveiraCleanUi = {
    openFullscreenTimer: openFullscreenFocusTimer,
    closeFullscreenTimer: closeFullscreenFocusTimer,
    formatHHMMSS,
    applyCleanMode: applyCaveiraCleanDashboardMode,
    updateDisplays: updateAllFocusTimerDisplays
  };

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCaveiraUiAndFullscreenTimer);
  } else {
    setTimeout(bootCaveiraUiAndFullscreenTimer, 0);
  }
})();



// ============================================================================
// MÓDULO 8 (r180): SUITE COMPLETA JORNADA DO CAÇADOR (PALETA OFICIAL AZUL-ABISSAL & CIANO,
// PASTAS RETRÁTEIS POR DISCIPLINA, SINCRONIA DE ABAS E BASE EXTERNA COMPLETA DE LEIS & TEXTOS)
// ============================================================================
(function initCaveiraFullSuiteR179() {
  const LAWS_FAV_KEY = 'jc_laws_favorites_v180';
  const LAWS_HIGHLIGHT_KEY = 'jc_laws_highlights_v180';
  const LAWS_FOLDERS_OPEN_KEY = 'jc_laws_folders_open_v180';
  const LAWS_EXTERNAL_CACHE_KEY = 'jc_external_laws_fulltext_v180';
  const LAWS_CUSTOM_IMPORTED_KEY = 'jc_custom_external_laws_v180';

  const NATIVE_SMART_LAWS = [
    // 1. DIREITO CONSTITUCIONAL
    {
      id: 'law-cf88-art1-5',
      discipline: 'Direito Constitucional',
      title: 'Constituição Federal de 1988 — Títulos I e II: Princípios Fundamentais e Direitos e Garantias Fundamentais (Arts. 1º ao 17)',
      badge: 'Texto Integral + Base Externa',
      wikisourceTitle: 'Constituição_da_República_Federativa_do_Brasil_de_1988',
      wikipediaTitle: 'Constituição_brasileira_de_1988',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
      sourceName: 'Planalto / Wikisource Jurídico',
      articles: [
        'Art. 1º A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I - a soberania; II - a cidadania; III - a dignidade da pessoa humana; IV - os valores sociais do trabalho e da livre iniciativa; V - o pluralismo político. Parágrafo único. Todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente, nos termos desta Constituição.',
        'Art. 2º São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.',
        'Art. 3º Constituem objetivos fundamentais da República Federativa do Brasil: I - construir uma sociedade livre, justa e solidária; II - garantir o desenvolvimento nacional; III - erradicar a pobreza e a marginalização e reduzir as desigualdades sociais e regionais; IV - promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação.',
        'Art. 4º A República Federativa do Brasil rege-se nas suas relações internacionais pelos seguintes princípios: I - independência nacional; II - prevalência dos direitos humanos; III - autodeterminação dos povos; IV - não-intervenção; V - igualdade entre os Estados; VI - defesa da paz; VII - solução pacífica dos conflitos; VIII - repúdio ao terrorismo e ao racismo; IX - cooperação entre os povos para o progresso da humanidade; X - concessão de asilo político.',
        'Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade: I - homens e mulheres são iguais em direitos e obrigações; II - ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei; III - ninguém será submetido a tortura nem a tratamento desumano ou degradante.',
        'Art. 5º, XI - a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, salvo em caso de flagrante delito ou desastre, ou para prestar socorro, ou, durante o dia, por determinação judicial.',
        'Art. 5º, XII - é inviolável o sigilo da correspondência e das comunicações telegráficas, de dados e das comunicações telefônicas, salvo, no último caso, por ordem judicial, nas hipóteses e na forma que a lei estabelecer para fins de investigação criminal ou instrução processual penal.',
        'Art. 5º, XVI - todos podem reunir-se pacificamente, sem armas, em locais abertos ao público, independentemente de autorização, desde que não frustrem outra reunião anteriormente convocada para o mesmo local, sendo apenas exigido prévio aviso à autoridade competente.',
        'Art. 5º, XXXV - a lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito; XXXIX - não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal; XL - a lei penal não retroagirá, salvo para beneficiar o réu.',
        'Art. 5º, XLII - a prática do racismo constitui crime inafiançável e imprescritível, sujeito à pena de reclusão; XLIII - a lei considerará crimes inafiançáveis e insuscetíveis de graça ou anistia a prática da tortura, o tráfico ilícito de entorpecentes e drogas afins, o terrorismo e os definidos como crimes hediondos; XLIV - constitui crime inafiançável e imprescritível a ação de grupos armados, civis ou militares, contra a ordem constitucional e o Estado Democrático.',
        'Art. 5º, LXI - ninguém será preso senão em flagrante delito ou por ordem escrita e fundamentada de autoridade judiciária competente, salvo nos casos de transgressão militar ou crime propriamente militar, definidos em lei.',
        'Art. 5º, LXIII - o preso será informado de seus direitos, entre os quais o de permanecer calado, sendo-lhe assegurada a assistência da família e de advogado; LXVIII - conceder-se-á habeas corpus sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação em sua liberdade de locomoção, por ilegalidade ou abuso de poder.'
      ]
    },
    {
      id: 'law-cf88-art37-144',
      discipline: 'Direito Constitucional',
      title: 'Constituição Federal de 1988 — Administração Pública (Arts. 37 a 42) e Segurança Pública (Art. 144)',
      badge: 'Carreiras Policiais',
      wikisourceTitle: 'Constituição_da_República_Federativa_do_Brasil_de_1988',
      wikipediaTitle: 'Segurança_pública_no_Brasil',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#art144',
      sourceName: 'Planalto / Wikisource Jurídico',
      articles: [
        'Art. 37. A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE).',
        'Art. 37, § 6º As pessoas jurídicas de direito público e as de direito privado prestadoras de serviços públicos responderão pelos danos que seus agentes, nessa qualidade, causarem a terceiros, assegurado o direito de regresso contra o responsável nos casos de dolo ou culpa.',
        'Art. 42. Os membros das Polícias Militares e Corpos de Bombeiros Militares, instituições organizadas com base na hierarquia e disciplina, são militares dos Estados, do Distrito Federal e dos Territórios.',
        'Art. 144. A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos (Rol Taxativo): I - polícia federal; II - polícia rodoviária federal; III - polícia ferroviária federal; IV - polícias civis; V - polícias militares e corpos de bombeiros militares; VI - polícias penais federal, estaduais e distrital.',
        'Art. 144, § 4º Às polícias civis, dirigidas por delegados de polícia de carreira, incumbem, ressalvada a competência da União, as funções de polícia judiciária e a apuração de infrações penais, exceto as militares.',
        'Art. 144, § 5º Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.',
        'Art. 144, § 5º-A. Às polícias penais, vinculadas ao órgão administrador do sistema penal da unidade federativa a que pertencem, cabe a segurança dos estabelecimentos penais.',
        'Art. 144, § 6º As polícias militares e os corpos de bombeiros militares, forças auxiliares e reserva do Exército subordinam-se, juntamente com as polícias civis e as polícias penais estaduais e distrital, aos Governadores dos Estados, do Distrito Federal e dos Territórios.'
      ]
    },
    // 2. DIREITO ADMINISTRATIVO
    {
      id: 'law-adm-improbidade-8429',
      discipline: 'Direito Administrativo',
      title: 'Lei nº 8.429/1992 (Atualizada pela Lei nº 14.230/2021) — Lei de Improbidade Administrativa',
      badge: 'Base Externa Planalto',
      wikisourceTitle: 'Lei_Federal_do_Brasil_8429_de_1992',
      wikipediaTitle: 'Improbidade_administrativa',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
      sourceName: 'Planalto / Wikisource',
      articles: [
        'Art. 1º O sistema de responsabilização por atos de improbidade administrativa tutelará a probidade na organização do Estado e no exercício de suas funções, como forma de assegurar a integridade do patrimônio público e social, nos termos desta Lei.',
        'Art. 1º, § 1º Consideram-se atos de improbidade administrativa as condutas dolosas tipificadas nos arts. 9º, 10 e 11 desta Lei, ressalvados tipos previstos em leis especiais. § 2º Considera-se dolo a vontade livre e consciente de alcançar o resultado ilícito tipificado nos arts. 9º, 10 e 11 desta Lei, não bastando a voluntariedade do agente.',
        'Art. 9º Constitui ato de improbidade administrativa importando em enriquecimento ilícito auferir, mediante a prática de ato doloso, qualquer tipo de vantagem patrimonial indevida em razão do exercício de cargo, de mandato, de função, de emprego ou de atividade nas entidades referidas no art. 1º desta Lei (Penas: perda dos bens/valores acrescidos, perda da função, suspensão dos direitos políticos até 14 anos, multa equivalente ao acréscimo e proibição de contratar até 14 anos).',
        'Art. 10. Constitui ato de improbidade administrativa que causa lesão ao erário qualquer ação ou omissão dolosa, que enseje, efetiva e comprovadamente, perda patrimonial, desvio, apropriação, malbaratamento ou dilapidação dos bens ou haveres das entidades (Penas: ressarcimento do dano, perda da função, suspensão dos direitos políticos até 12 anos, multa equivalente ao dano e proibição de contratar até 12 anos).',
        'Art. 11. Constitui ato de improbidade administrativa que atenta contra os princípios da administração pública a ação ou omissão dolosa que viole os deveres de honestidade, de imparcialidade e de legalidade, caracterizada por uma das seguintes condutas (Rol Taxativo — Penas: multa de até 24x a remuneração e proibição de contratar por até 4 anos).',
        'Art. 23. A ação para a aplicação das sanções previstas nesta Lei prescreve em 8 (oito) anos, contados a partir da ocorrência do fato ou, no caso de infrações permanentes, do dia em que cessou a permanência.'
      ]
    },
    {
      id: 'law-adm-licitacoes-14133',
      discipline: 'Direito Administrativo',
      title: 'Lei nº 14.133/2021 — Nova Lei de Licitações e Contratos Administrativos',
      badge: 'Base Externa Planalto',
      wikisourceTitle: 'Lei_Federal_do_Brasil_14133_de_2021',
      wikipediaTitle: 'Licitação_no_Brasil',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
      sourceName: 'Planalto / Câmara dos Deputados',
      articles: [
        'Art. 5º Na aplicação desta Lei, serão observados os princípios da legalidade, da impessoalidade, da moralidade, da publicidade, da eficiência, do interesse público, da probidade administrativa, da igualdade, do planejamento, da transparência, da eficácia, da segregação de funções, da motivação, da vinculação ao edital, do julgamento objetivo, da segurança jurídica, da razoabilidade, da competitividade, da proporcionalidade, da celeridade, da economicidade e do desenvolvimento nacional sustentável.',
        'Art. 28. São modalidades de licitação: I - pregão; II - concorrência; III - concurso; IV - leilão; V - diálogo competitivo. § 2º É vedada a criação de outras modalidades de licitação ou, ainda, a combinação daquelas referidas no caput deste artigo.',
        'Art. 74 (Inexigibilidade de Licitação): É inexigível a licitação quando inviável a competição, em especial nos casos de: I - aquisição de materiais, de equipamentos ou de gêneros ou contratação de serviços que só possam ser fornecidos por produtor, empresa ou representante comercial exclusivos; II - contratação de profissional do setor artístico, diretamente ou por meio de empresário exclusivo, desde que consagrado pela crítica especializada ou pela opinião pública; III - serviços técnicos especializados de natureza predominantemente intelectual com profissionais ou empresas de notória especialização.'
      ]
    },
    // 3. DIREITO PENAL
    {
      id: 'law-penal-parte-geral-e-adm',
      discipline: 'Direito Penal',
      title: 'Código Penal (Decreto-Lei nº 2.848/1940) — Parte Geral (Arts. 1º a 31) e Crimes contra a Administração Pública (Arts. 312 a 337)',
      badge: 'Base Externa Integral',
      wikisourceTitle: 'Código_Penal_do_Brasil',
      wikipediaTitle: 'Código_Penal_brasileiro_de_1940',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
      sourceName: 'Planalto / Wikisource Jurídico',
      articles: [
        'Art. 1º (Anterioridade da Lei): Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal. Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime, cessando em virtude dela a execução e os efeitos penais da sentença condenatória.',
        'Art. 23 (Exclusão de ilicitude): Não há crime quando o agente pratica o fato: I - em estado de necessidade; II - em legítima defesa; III - em estrito cumprimento de dever legal ou no exercício regular de direito. Parágrafo único. O agente, em qualquer das hipóteses deste artigo, responderá pelo excesso doloso ou culposo.',
        'Art. 25 (Legítima defesa): Entende-se em legítima defesa quem, usando moderadamente dos meios necessários, repele injusta agressão, atual ou iminente, a direito seu ou de outrem. Parágrafo único. Observados os requisitos previstos no caput deste artigo, considera-se também em legítima defesa o agente de segurança pública que repele agressão ou risco de agressão a vítima mantida refém durante a prática de crimes.',
        'Art. 312 (Peculato): Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio. § 2º Peculato culposo: se o funcionário concorre culposamente para o crime de outrem. § 3º No peculato culposo, a reparação do dano, se precede à sentença irrecorrível, extingue a punibilidade; se lhe é posterior, reduz de metade a pena imposta.',
        'Art. 316 (Concussão): Exigir, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida. Pena: reclusão, de 2 a 12 anos, e multa.',
        'Art. 317 (Corrupção passiva): Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem.',
        'Art. 319 (Prevaricação): Retardar ou deixar de praticar, indevidamente, ato de ofício, ou praticá-lo contra disposição expressa de lei, para satisfazer interesse ou sentimento pessoal.',
        'Art. 320 (Condescendência criminosa): Deixar o funcionário, por indulgência, de responsabilizar subordinado que cometeu infração no exercício do cargo ou, quando lhe falte competência, não levar o fato ao conhecimento da autoridade competente.'
      ]
    },
    // 4. DIREITO PROCESSUAL PENAL
    {
      id: 'law-cpp-inquerito-prisao',
      discipline: 'Direito Processual Penal',
      title: 'Código de Processo Penal (Decreto-Lei nº 3.689/1941) — Inquérito Policial (Arts. 4º a 23), Prova e Prisão em Flagrante (Arts. 282 a 316)',
      badge: 'Base Externa Integral',
      wikisourceTitle: 'Código_de_Processo_Penal_do_Brasil',
      wikipediaTitle: 'Inquérito_policial',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm',
      sourceName: 'Planalto / Wikisource Jurídico',
      articles: [
        'Art. 4º A polícia judiciária será exercida pelas autoridades policiais no território de suas respectivas circunscrições e terá por fim a apuração das infrações penais e da sua autoria.',
        'Art. 5º Nos crimes de ação pública o inquérito policial será iniciado: I - de ofício; II - mediante requisição da autoridade judiciária ou do Ministério Público, ou a requerimento do ofendido ou de quem tiver qualidade para representá-lo.',
        'Art. 10. O inquérito deverá terminar no prazo de 10 dias, se o indiciado tiver sido preso em flagrante, ou estiver preso preventivamente, contado o prazo, nesta hipótese, a partir do dia em que se executar a ordem de prisão, ou no prazo de 30 dias, quando estiver solto, mediante fiança ou sem ela.',
        'Art. 14. O ofendido, ou seu representante legal, e o indiciado poderão requerer qualquer diligência, que será realizada, ou não, a juízo da autoridade (caráter inquisitivo e discricionário).',
        'Art. 17. A autoridade policial não poderá mandar arquivar autos de inquérito.',
        'Art. 301. Qualquer do povo poderá e as autoridades policiais e seus agentes deverão prender quem quer que seja encontrado em flagrante delito.',
        'Art. 302. Considera-se em flagrante delito quem: I - está cometendo a infração penal; II - acaba de cometê-la; III - é perseguido, logo após, pela autoridade, pelo ofendido ou por qualquer pessoa, em situação que faça presumir ser autor da infração; IV - é encontrado, logo depois, com instrumentos, armas, objetos ou papéis que façam presumir ser ele autor da infração.'
      ]
    },
    // 5. DIREITO MILITAR
    {
      id: 'law-penal-militar-cpm-cppm',
      discipline: 'Direito Militar',
      title: 'Código Penal Militar (Decreto-Lei nº 1.001/69), CPPM (Decreto-Lei nº 1.002/69) e Estatuto PMPE (Lei Estadual nº 6.783/74)',
      badge: 'PMPE / CBMPE Oficial',
      wikisourceTitle: 'Código_Penal_Militar_do_Brasil_(1969)',
      wikipediaTitle: 'Direito_penal_militar',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm',
      sourceName: 'Planalto / Alepe Legis PE',
      articles: [
        'CPM, Art. 9º Consideram-se crimes militares, em tempo de paz: II - os crimes previstos neste Código e os previstos na legislação penal, quando praticados: a) por militar em situação de atividade ou assemelhado, contra militar na mesma situação ou assemelhado; b) por militar em situação de atividade, em lugar sujeito à administração militar, contra militar da reserva, ou reformado, ou contra civil; c) por militar em serviço ou atuando em razão da função.',
        'CPM, Art. 149 (Motim): Reunirem-se militares ou assemelhados: I - agindo contra a ordem recebida de superior, ou negando-se a cumpri-la; II - recusando obediência a superior, quando estejam agindo sem ordem ou praticando violência; IV - ocupando quartel, fortaleza, aeródromo ou navio militar.',
        'CPM, Art. 163 (Recusa de Obediência): Recusar obedecer a ordem do superior sobre assunto ou matéria de serviço, ou relativamente a dever imposto em lei, regulamento ou instrução: Pena - detenção, de um a dois anos, se o fato não constitui crime mais grave.',
        'CPM, Art. 187 (Deserção): Ausentar-se o militar, sem licença, da unidade em que serve, ou do lugar em que deve permanecer, por mais de oito dias: Pena - detenção, de seis meses a dois anos; se oficial, a pena é agravada.',
        'Lei Estadual PE nº 6.783/74 (Estatuto PMPE), Art. 2º A Polícia Militar de Pernambuco, subordinada operacionalmente à Secretaria de Defesa Social, é uma instituição permanente, força auxiliar e reserva do Exército, organizada com base na hierarquia e na disciplina.',
        'Lei Estadual PE nº 6.783/74, Art. 12 e 13: A hierarquia policial-militar é a ordenação da autoridade em níveis diferentes (postos para Oficiais e graduações para Praças). A disciplina é a rigorosa observância e o acatamento integral das leis, regulamentos, normas e disposições.'
      ]
    },
    // 6. LEGISLAÇÃO EXTRAVAGANTE
    {
      id: 'law-extrav-pacote-policial',
      discipline: 'Legislação Extravagante',
      title: 'Pacote Policial Completo: Abuso de Autoridade (Lei 13.869/19), Tortura (Lei 9.455/97), Maria da Penha (Lei 11.340/06), Desarmamento (Lei 10.826/03) e Drogas (Lei 11.343/06)',
      badge: 'Base Externa Planalto',
      wikisourceTitle: 'Lei_Federal_do_Brasil_11340_de_2006',
      wikipediaTitle: 'Lei_Maria_da_Penha',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',
      sourceName: 'Planalto / Wikisource Jurídico',
      articles: [
        'Lei nº 13.869/19 (Abuso de Autoridade), Art. 1º, § 1º As condutas descritas nesta Lei constituem crime de abuso de autoridade quando praticadas pelo agente com a finalidade específica de prejudicar outrem ou beneficiar a si mesmo ou a terceiro, ou, ainda, por mero capricho ou satisfação pessoal. § 2º A divergência na interpretação de lei ou na avaliação de fatos e provas não configura abuso de autoridade.',
        'Lei nº 9.455/97 (Tortura), Art. 1º Constitui crime de tortura: I - constranger alguém com emprego de violência ou grave ameaça, causando-lhe sofrimento físico ou mental: a) com o fim de obter informação, declaração ou confissão da vítima ou de terceira pessoa; b) para provocar ação ou omissão de natureza criminosa; c) em razão de discriminação racial ou religiosa. § 2º Aquele que se omite em face dessas condutas, quando tinha o dever de evitá-las ou apurá-las, incorre na pena de detenção de 1 a 4 anos.',
        'Lei nº 11.340/06 (Maria da Penha), Art. 5º Configura violência doméstica e familiar contra a mulher qualquer ação ou omissão baseada no gênero que lhe cause morte, lesão, sofrimento físico, sexual ou psicológico e dano moral ou patrimonial (Art. 7º: formas física, psicológica, sexual, patrimonial e moral). Art. 16: Nas ações penais públicas condicionadas à representação da ofendida, só será admitida a renúncia à representação perante o juiz, em audiência especialmente designada com tal finalidade, antes do recebimento da denúncia e ouvido o Ministério Público.',
        'Lei nº 10.826/03 (Estatuto do Desarmamento), Arts. 12, 14 e 16: Posse irregular de arma de uso permitido (Art. 12 — detenção, no interior de residência ou dependência desta, ou no local de trabalho, desde que titular/responsável legal); Porte ilegal de arma de uso permitido (Art. 14 — reclusão, fora de casa/trabalho); Posse ou porte ilegal de arma de fogo de uso restrito ou proibido (Art. 16 — reclusão; equiparado a hediondo quando de uso proibido).',
        'Lei nº 11.343/06 (Lei de Drogas), Art. 28 (Porte para consumo pessoal — penas: advertência, prestação de serviços à comunidade e medida educativa, sem pena privativa de liberdade!) e Art. 33 (Tráfico de Drogas — 18 verbos nucleares; § 4º Tráfico privilegiado: réu primário, bons antecedentes, não se dedique a atividades criminosas nem integre organização criminosa — redução de 1/6 a 2/3, afastando a hediondez conforme STF).'
      ]
    },
    // 7. DIREITOS HUMANOS
    {
      id: 'law-dh-dudh-pacto-mandela',
      discipline: 'Direitos Humanos',
      title: 'Declaração Universal dos Direitos Humanos (ONU, 1948), Pacto de São José da Costa Rica (Decreto 678/92) e Regras de Mandela',
      badge: 'ONU / Planalto',
      wikisourceTitle: 'Declaração_Universal_dos_Direitos_Humanos',
      wikipediaTitle: 'Declaração_Universal_dos_Direitos_Humanos',
      officialUrl: 'https://www.planalto.gov.br/ccivil_03/decreto/d0678.htm',
      sourceName: 'ONU / Wikisource / Planalto',
      articles: [
        'DUDH, Artigo 1º: Todos os seres humanos nascem livres e iguais em dignidade e em direitos. Dotados de razão e de consciência, devem agir uns para com os outros em espírito de fraternidade.',
        'DUDH, Artigo 3º: Todo indivíduo tem direito à vida, à liberdade e à segurança pessoal. Artigo 5º: Ninguém será submetido a tortura nem a penas ou tratamentos cruéis, desumanos ou degradantes.',
        'DUDH, Artigo 11: Todo ser humano acusado de um ato delituoso tem o direito de ser presumido inocente até que a sua culpabilidade tenha sido provada de acordo com a lei, em julgamento público no qual lhe tenham sido asseguradas todas as garantias necessárias à sua defesa.',
        'DUDH, Artigo 14: 1. Toda pessoa, vítima de perseguição, tem o direito de procurar e de gozar asilo em outros países. 2. Este direito não pode ser invocado em caso de perseguição legitimamente motivada por crimes de direito comum ou por atos contrários aos objetivos e princípios das Nações Unidas.',
        'Pacto de São José da Costa Rica (CADH), Art. 4º (Direito à Vida — protegido, em geral, desde a concepção; não se restabelecerá a pena de morte nos Estados que a hajam abolido) e Art. 7º, item 7 (Ninguém deve ser detido por dívidas, exceto os mandados de autoridade judiciária competente expedidos em virtude de inadimplemento de obrigação alimentar).'
      ]
    },
    // 8. HISTÓRIA DE PERNAMBUCO
    {
      id: 'law-hist-pe-ciclos-revolucoes',
      discipline: 'História de Pernambuco',
      title: 'Textos-Base Completos: Capitania de Pernambuco, Invasões Holandesas (1630–1654), Guerra dos Mascates (1710), Revoluções de 1817, 1824 e Praieira (1848)',
      badge: 'Base Externa Wikipedia/Fundaj',
      wikisourceTitle: '',
      wikipediaTitle: 'História_de_Pernambuco',
      officialUrl: 'https://pt.wikipedia.org/wiki/Hist%C3%B3ria_de_Pernambuco',
      sourceName: 'Wikipedia Acadêmica / Acervo Fundaj PE',
      articles: [
        '1. Capitania de Pernambuco (Nova Lusitânia, 1534): Doada a Duarte Coelho Pereira, prosperou graças ao solo de massapê na Zona da Mata, clima tropical úmido, proximidade com os portos europeus e implantação dos engenhos de açúcar com sede político-administrativa em Olinda.',
        '2. Invasões Holandesas e Brasil Holandês (1630–1654): Motivadas pela União Ibérica (1580–1640) e pelo bloqueio espanhol ao comércio açucareiro flamengo, a WIC invadiu Olinda e Recife em 1630. O governo de Maurício de Nassau (1637–1644) urbanizou a Cidade Maurícia (Recife), concedeu empréstimos aos senhores de engenho e promoveu relativa tolerância religiosa. A cobrança das dívidas após a saída de Nassau desencadeou a Insurreição Pernambucana (1645–1654), culminando nas Batalhas dos Montes Guararapes (1648 e 1649).',
        '3. Guerra dos Mascates (1710–1711): Conflito nativista entre a aristocracia açucareira de Olinda (endividada) e os comerciantes portugueses do Recife ("mascates") após a Carta Régia que elevou o Recife à condição de vila autônoma com pelourinho e Câmara Municipal própria.',
        '4. Revolução Pernambucana de 1817 (Revolução dos Padres): Movimento republicano, separatista e antiabsolutista contra o arrocho fiscal da Corte de D. João VI no Rio de Janeiro. Foi o único movimento emancipacionista do período colonial/joanino a superar a fase conspiratória e governar Pernambuco por 74 dias através de um Governo Provisório e da Lei Orgânica de 1817.',
        '5. Confederação do Equador (1824) e Revolução Praieira (1848–1850): Em 1824, Pernambuco liderou a reação republicana e federalista contra a dissolução da Constituinte e a Constituição Outorgada de D. Pedro I (Poder Moderador), tendo Frei Caneca como principal líder e mártir. Em 1848, a Revolução Praieira (Partido da Praia / Diário Novo) insurgiu-se contra o monopólio político da família Cavalcanti e o monopólio do comércio a retalho pelos portugueses, lançando o Manifesto ao Mundo redigido por Borges da Fonseca.'
      ]
    },
    // 9. GEOGRAFIA DE PERNAMBUCO
    {
      id: 'law-geo-pe-mesorregioes-relevo',
      discipline: 'Geografia de Pernambuco',
      title: 'Textos-Base Completos: Mesorregiões de Pernambuco, Relevo (Borborema), Clima, Vegetação e Bacias Hidrográficas (IBGE / APAC)',
      badge: 'Base Externa IBGE/Wikipedia',
      wikisourceTitle: '',
      wikipediaTitle: 'Geografia_de_Pernambuco',
      officialUrl: 'https://cidades.ibge.gov.br/brasil/pe/panorama',
      sourceName: 'IBGE Cidades / Wikipedia Acadêmica',
      articles: [
        '1. Divisão Mesorregional de Pernambuco (IBGE): O estado divide-se em 5 mesorregiões geográficas: Região Metropolitana do Recife (RMR), Zona da Mata (Mata Norte e Mata Sul), Agreste, Sertão Pernambucano e Sertão do São Francisco (onde se situa o polo de fruticultura irrigada de Petrolina). Além do território continental, integra Pernambuco o Arquipélago de Fernando de Noronha (distrito estadual).',
        '2. Relevo e Clima: Da costa para o interior, sucedem-se a Planície Costeira (clima tropical úmido As, chuvas concentradas no outono-inverno, domínio da Mata Atlântica e manguezais), o Planalto da Borborema no Agreste (clima de transição, brejos de altitude úmidos na encosta oriental de barlavento e sotavento seco devido à barreira orográfica da Borborema) e a Depressão Sertaneja no Sertão (clima semiárido BSh, vegetação de Caatinga xerófila e rios intermitentes/temporários, exceto o Rio São Francisco que é perene).',
        '3. Hidrografia: Destacam-se as bacias litorâneas (Capibaribe, Beberibe, Ipojuca, Una, Sirinhaém, Goiana) e as bacias sertanejas tributárias do Rio São Francisco (Pajeú, Moxotó, Brígida, Garças).'
      ]
    },
    // 10. INFORMÁTICA
    {
      id: 'law-info-marco-civil-lgpd-seguranca',
      discipline: 'Informática',
      title: 'Legislação e Segurança Digital: Marco Civil da Internet (Lei 12.965/14), LGPD (Lei 13.709/18) e Cartilha de Segurança CERT.br',
      badge: 'Base Externa Planalto/CERT.br',
      wikisourceTitle: 'Lei_Federal_do_Brasil_12965_de_2014',
      wikipediaTitle: 'Segurança_da_informação',
      officialUrl: 'https://cartilha.cert.br/fasciculos/',
      sourceName: 'CERT.br / Planalto / Wikipedia',
      articles: [
        '1. Pilares da Segurança da Informação (DICA / CID): Disponibilidade (acesso autorizado sempre que necessário), Integridade (dados não alterados indevidamente), Confidencialidade (acesso restrito a pessoas autorizadas) e Autenticidade (garantia da identidade da origem), somados ao Não-Repúdio (irretratabilidade).',
        '2. Códigos Maliciosos (Malwares — CERT.br): Vírus (depende de execução de arquivo hospedeiro), Worm (propaga-se automaticamente pela rede explorando vulnerabilidades sem precisar de hospedeiro), Ransomware (sequestra dados via criptografia — Crypto — ou bloqueio de tela — Locker — exigindo resgate), Trojan/Cavalo de Troia (parece legítimo mas executa funções ocultas), Spyware (Keylogger captura teclas digitadas; Screenlogger captura a tela na posição do cursor).',
        '3. Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD): Art. 4º, III — A LGPD NÃO se aplica ao tratamento de dados pessoais realizado para fins exclusivos de segurança pública, defesa nacional, segurança do Estado ou atividades de investigação e repressão de infrações penais (que são regidos por legislação específica).'
      ]
    }
  ];

  // O acervo de leis é pessoal por conta/reset e pode ser reutilizado nos seus portais.
  // Chaves antigas sem proprietário permanecem intactas, mas não são atribuídas a outra conta.
  const LAWS_INTERNAL_KEY = 'jc_internal_laws_db_r182';
  const OFFICIAL_LAW_IMPORTS = [
    {id:'cf88',title:'Constituição Federal de 1988',discipline:'Direito Constitucional'},
    {id:'cp',title:'Código Penal',discipline:'Direito Penal'},
    {id:'cpp',title:'Código de Processo Penal',discipline:'Direito Processual Penal'},
    {id:'cpm',title:'Código Penal Militar',discipline:'Direito Penal Militar'},
    {id:'cppm',title:'Código de Processo Penal Militar',discipline:'Direito Processual Penal Militar'},
    {id:'improbidade',title:'Lei de Improbidade Administrativa',discipline:'Direito Administrativo'},
    {id:'licitacoes',title:'Lei de Licitações e Contratos',discipline:'Direito Administrativo'},
    {id:'abuso',title:'Lei de Abuso de Autoridade',discipline:'Legislação Extravagante'},
    {id:'tortura',title:'Lei dos Crimes de Tortura',discipline:'Legislação Extravagante'},
    {id:'maria-da-penha',title:'Lei Maria da Penha',discipline:'Legislação Extravagante'},
    {id:'desarmamento',title:'Estatuto do Desarmamento',discipline:'Legislação Extravagante'},
    {id:'drogas',title:'Lei de Drogas',discipline:'Legislação Extravagante'},
    {id:'estatuto-pmpe',title:'Estatuto dos Policiais Militares de Pernambuco',discipline:'Direito Militar'}
  ];
  const OFFICIAL_LAW_SEEDS = {
    'law-cf88-art1-5':['cf88'],'law-cf88-art37-144':['cf88'],
    'law-adm-improbidade-8429':['improbidade'],'law-adm-licitacoes-14133':['licitacoes'],
    'law-penal-parte-geral-e-adm':['cp'],'law-cpp-inquerito-prisao':['cpp'],
    'law-penal-militar-cpm-cppm':['cpm','cppm','estatuto-pmpe'],
    'law-extrav-pacote-policial':['abuso','tortura','maria-da-penha','desarmamento','drogas']
  };
  const LAW_READER_PAGE_SIZE = 60;
  let lawsMemory = null;
  let lawsUiScope = '';
  let lawsSyncMessage = '';
  let lawReaderPage = 0;
  function lawSession() {
    try { if (typeof cloudSession !== 'undefined') return cloudSession; } catch (_e) {}
    return typeof window !== 'undefined' ? window.cloudSession || null : null;
  }
  function lawScope() {
    const st = getAppStateSafe(), session = lawSession();
    const userId = String(session?.user?.id || 'guest'), owner = String(st._ownerUserId || '');
    return {userId, resetEpoch:Number(st._resetEpoch || 0), campaignId:String(st.activeCampaignId || ''), ready:!owner || owner===userId};
  }
  function lawScopeKey(scope = lawScope()) { return JSON.stringify([scope.userId,scope.resetEpoch]); }
  function lawScopeCurrent(scope) {
    const now=lawScope();
    return scope.ready&&now.ready&&now.userId===scope.userId&&now.resetEpoch===scope.resetEpoch&&now.campaignId===scope.campaignId;
  }
  function lawStorageKey(base,scope=lawScope()) { return `${base}:r182:${encodeURIComponent(scope.userId)}:${scope.resetEpoch}`; }
  function readLawStore(base,fallback,scope=lawScope()) {
    if(!scope.ready)return fallback;
    try{const value=JSON.parse(localStorage.getItem(lawStorageKey(base,scope))||'null');return value===null?fallback:value;}catch(_e){return fallback;}
  }
  function writeLawStore(base,value,scope=lawScope()) {
    if(!lawScopeCurrent(scope))return false;
    try{localStorage.setItem(lawStorageKey(base,scope),JSON.stringify(value));return true;}catch(_e){return false;}
  }
  function lawEscape(value) { return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function safeLawUrl(value) {
    try{const url=new URL(String(value||'')),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||!(host.endsWith('.gov.br')||host.endsWith('.leg.br')||['pt.wikipedia.org','pt.wikisource.org','cartilha.cert.br'].includes(host)))return '';return url.href;}catch(_e){return '';}
  }
  function officialLawSource(value) {
    try{const url=new URL(safeLawUrl(value));return ['www.planalto.gov.br','planalto.gov.br','www2.camara.leg.br','www.camara.leg.br','legis.alepe.pe.gov.br'].includes(url.hostname.toLowerCase())?url.href:'';}catch(_e){return '';}
  }
  function normalizeLawRecord(value,isNative=false) {
    if(!value||typeof value!=='object'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,179}$/.test(String(value.id||''))||!Array.isArray(value.articles))return null;
    const rawArticles=value.articles.filter(text=>typeof text==='string'&&text.trim());
    const official=!isNative&&value.content_kind==='official_document_extraction'&&value.full_document===true&&OFFICIAL_LAW_IMPORTS.some(item=>item.id===value.law_id)&&officialLawSource(value.sourceUrl||value.source_url)&&/^[a-f0-9]{64}$/i.test(String(value.content_hash||''));
    if(official&&(rawArticles.length>30000||rawArticles.reduce((n,text)=>n+text.length,0)>6*1024*1024))return null;
    const articles=official?rawArticles.slice():rawArticles.slice(0,1000).map(text=>text.slice(0,20000));
    if(!articles.length)return null;
    const external=!official&&!isNative&&(value.content_kind==='external_excerpt'||String(value.id).startsWith('ext-law-'));
    const kind=official?'official_document_extraction':external?'external_excerpt':'selection';
    let title=String(value.title||'Seleção para estudo').replace(/Textos-Base Completos:/gi,'Seleção de textos:').replace(/Pacote Policial Completo:/gi,'Seleção de legislação policial:').replace(/\s*\(Importado da Base Externa Completa\)/gi,'').slice(0,500);
    if(String(value.id)==='law-cf88-art1-5')title='Constituição Federal de 1988 — seleção dos arts. 1º a 5º';
    return {
      id:String(value.id),discipline:String(value.discipline||'Legislação Extravagante').slice(0,150),title,articles,content_kind:kind,
      badge:official?'Texto extraído da fonte oficial':external?'Trecho externo · conferir fonte':'Seleção de dispositivos e notas',
      coverage:official?'Os parágrafos textuais extraídos da resposta HTML da fonte oficial foram preservados. Imagens, OCR e anexos externos não são incluídos. Isso não certifica vigência, consolidação ou revisão editorial.':external?'Trecho de fonte externa; não é conferência oficial nem garantia de integralidade.':'Seleção local de dispositivos e notas; não é texto integral. Confira a vigência e a redação na referência.',
      sourceName:official?String(value.sourceName||value.source_name||'Fonte oficial').slice(0,200):external?String(value.sourceName||value.source_name||'Fonte externa não revisada').slice(0,200):'Seleção local · referência informada',
      sourceUrl:safeLawUrl(value.sourceUrl||value.source_url||value.officialUrl),
      sourceVersion:String(value.sourceVersion||value.source_version||'r182-selection-1').slice(0,160),
      fetchedAt:String(value.fetchedAt||value.retrieved_at||'').slice(0,50),
      law_id:official?String(value.law_id):'',full_document:official,content_hash:official?String(value.content_hash).toLowerCase():'',
      sourceWarnings:official&&Array.isArray(value.sourceWarnings)?value.sourceWarnings.filter(text=>typeof text==='string').slice(0,8).map(text=>text.slice(0,2000)):[],
      wikisourceTitle:String(value.wikisourceTitle||'').slice(0,250),wikipediaTitle:String(value.wikipediaTitle||'').slice(0,250),
      contentTruncated:official?false:!!value.contentTruncated||rawArticles.length>1000||rawArticles.some(text=>text.length>20000),
      updatedAt:String(value.updatedAt||value.updated_at||''),is_public:typeof value.is_public==='boolean'?value.is_public:true,
      external:!official&&value.external&&typeof value.external==='object'?{source:String(value.external.source||'').slice(0,200),sourceUrl:safeLawUrl(value.external.sourceUrl),fetchedAt:String(value.external.fetchedAt||'').slice(0,50),truncated:!!value.external.truncated}:null
    };
  }
  function getLawMemory(scope=lawScope()) {
    const key=lawScopeKey(scope);
    if(!lawsMemory||lawsMemory.key!==key){
      const stored=readLawStore(LAWS_INTERNAL_KEY,{},scope),custom=readLawStore(LAWS_CUSTOM_IMPORTED_KEY,[],scope),external=readLawStore(LAWS_EXTERNAL_CACHE_KEY,{},scope);
      lawsMemory={key,laws:Array.isArray(stored?.laws)?stored.laws.map(law=>normalizeLawRecord(law)).filter(Boolean):[],custom:Array.isArray(custom)?custom.map(law=>normalizeLawRecord(law)).filter(Boolean):[],external:external&&typeof external==='object'&&!Array.isArray(external)?external:{},pending:!!stored?.pending,revision:0,loadPromise:null,loaded:false,lastAttempt:0,syncing:false,localLoaded:false,localPromise:null,officialImports:new Map()};
    }
    return lawsMemory;
  }
  function getFavLaws(){const value=readLawStore(LAWS_FAV_KEY,[]);return Array.isArray(value)?value.filter(id=>typeof id==='string'):[];}
  function setFavLaws(arr){return writeLawStore(LAWS_FAV_KEY,Array.isArray(arr)?arr.filter(id=>typeof id==='string'):[]);}
  function getHighlightedArticles(){const value=readLawStore(LAWS_HIGHLIGHT_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function toggleHighlightArticle(key){const map=getHighlightedArticles();if(Object.hasOwn(map,key))delete map[key];else Object.defineProperty(map,key,{value:true,configurable:true,enumerable:true,writable:true});if(!writeLawStore(LAWS_HIGHLIGHT_KEY,map)&&typeof window.toast==='function')window.toast('O grifo não pôde ser salvo neste aparelho.');return Boolean(map[key]);}
  function getLawsFoldersOpenState(){const value=readLawStore(LAWS_FOLDERS_OPEN_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function setLawsFolderOpenState(key,open){const map=getLawsFoldersOpenState();Object.defineProperty(map,key,{value:!!open,configurable:true,enumerable:true,writable:true});return writeLawStore(LAWS_FOLDERS_OPEN_KEY,map);}
  function getExternalFullTextCache(){return lawScope().ready?getLawMemory().external:{};}
  function saveExternalFullTextCache(id,text,scope=lawScope()){if(!lawScopeCurrent(scope))return false;const mem=getLawMemory(scope);Object.defineProperty(mem.external,id,{value:text,configurable:true,enumerable:true,writable:true});mem.pending=true;mem.revision++;return writeLawStore(LAWS_EXTERNAL_CACHE_KEY,mem.external,scope);}
  function getCustomImportedLaws(){return lawScope().ready?getLawMemory().custom.slice():[];}
  function saveCustomImportedLaw(value,scope=lawScope()){const law=normalizeLawRecord(value);if(!law||!lawScopeCurrent(scope))return false;const mem=getLawMemory(scope);mem.custom=[law,...mem.custom.filter(item=>item.id!==law.id)].slice(0,80);mem.pending=true;mem.revision++;return writeLawStore(LAWS_CUSTOM_IMPORTED_KEY,mem.custom,scope);}
  function getAllLawsCombined(){const scope=lawScope(),byId=new Map(NATIVE_SMART_LAWS.map(law=>normalizeLawRecord(law,true)).filter(Boolean).map(law=>[law.id,law]));if(scope.ready)for(const law of [...getLawMemory(scope).laws,...getCustomImportedLaws()])byId.set(law.id,law);return [...byId.values()];}
  function materializeLaw(value){const law=normalizeLawRecord(value);if(!law)return null;if(law.full_document)return law;const ext=getExternalFullTextCache()[law.id];if(ext&&Array.isArray(ext.paragraphs)){law.articles=[...new Set([...law.articles,...ext.paragraphs.filter(text=>typeof text==='string')])].slice(0,1000);law.external={source:String(ext.source||''),sourceUrl:safeLawUrl(ext.sourceUrl),fetchedAt:String(ext.fetchedAt||''),truncated:!!ext.truncated};}return law;}
  function applyLawUiScope(){const scope=lawScope(),key=`${lawScopeKey(scope)}|${scope.campaignId}|${scope.ready}`;if(lawsUiScope!==key){lawsUiScope=key;activeLawModalItem=null;activeLawExternalLoading=false;lawsSearchQuery='';lawsFilterFavOnly=false;lawsSyncMessage='';lawReaderPage=0;}return scope;}
  function lawLocalPayload(mem){return {laws:mem.laws,custom:mem.custom,external:mem.external,pending:mem.pending};}
  function lawIndexedDb(mode,scope,payload){
    if(typeof indexedDB==='undefined'||!scope.ready)return Promise.resolve(mode==='read'?null:false);
    return new Promise(resolve=>{
      let db,done=false;
      const finish=value=>{if(done)return;done=true;try{db?.close();}catch(_e){}resolve(value);};
      try{
        const request=indexedDB.open('jc-laws-library-v1',1);
        request.onupgradeneeded=()=>{const opened=request.result;if(!opened.objectStoreNames.contains('libraries'))opened.createObjectStore('libraries',{keyPath:'key'});};
        request.onerror=()=>finish(mode==='read'?null:false);
        request.onblocked=()=>finish(mode==='read'?null:false);
        request.onsuccess=()=>{
          db=request.result;if(!lawScopeCurrent(scope))return finish(mode==='read'?null:false);
          const tx=db.transaction('libraries',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('libraries');
          tx.onabort=tx.onerror=()=>finish(mode==='read'?null:false);
          if(mode==='read'){const get=store.get(lawScopeKey(scope));let result=null;get.onsuccess=()=>{result=get.result?.payload||null;};tx.oncomplete=()=>finish(result);}
          else{store.put({key:lawScopeKey(scope),userId:scope.userId,resetEpoch:scope.resetEpoch,payload});tx.oncomplete=()=>finish(true);}
        };
      }catch(_e){finish(mode==='read'?null:false);}
    });
  }
  async function loadLawLocalLibrary(scope=lawScope()){
    if(!lawScopeCurrent(scope)||typeof indexedDB==='undefined')return false;
    const mem=getLawMemory(scope);if(mem.localLoaded)return false;if(mem.localPromise)return mem.localPromise;
    const revision=mem.revision;
    const job=(async()=>{
      const stored=await lawIndexedDb('read',scope);
      if(!lawScopeCurrent(scope))return false;
      mem.localLoaded=true;if(!stored||typeof stored!=='object')return false;
      const incoming=Array.isArray(stored.laws)?stored.laws.map(law=>normalizeLawRecord(law)).filter(Boolean):[];
      const custom=Array.isArray(stored.custom)?stored.custom.map(law=>normalizeLawRecord(law)).filter(Boolean):[];
      const newer=mem.revision!==revision;
      mem.laws=[...new Map((newer?[...incoming,...mem.laws]:[...mem.laws,...incoming]).map(law=>[law.id,law])).values()];
      mem.custom=[...new Map((newer?[...custom,...mem.custom]:[...mem.custom,...custom]).map(law=>[law.id,law])).values()];
      mem.external={...(stored.external&&typeof stored.external==='object'?stored.external:{}),...mem.external};mem.pending=mem.pending||!!stored.pending;
      return true;
    })();
    mem.localPromise=job;try{return await job;}finally{if(mem.localPromise===job)mem.localPromise=null;}
  }
  async function persistLawLibrary(scope=lawScope()){
    if(!lawScopeCurrent(scope))return false;
    const mem=getLawMemory(scope),payload=lawLocalPayload(mem);
    let fastSaved=false;const serialized=JSON.stringify(payload);
    // Livros grandes usam IndexedDB; não estouram a cota síncrona de localStorage.
    if(serialized.length<=512*1024)fastSaved=writeLawStore(LAWS_INTERNAL_KEY,payload,scope);
    const indexedSaved=typeof indexedDB!=='undefined'?await lawIndexedDb('write',scope,payload):false;
    return lawScopeCurrent(scope)&&Boolean(fastSaved||indexedSaved);
  }
  async function loadLawsFromUserDatabase(force=false){
    const scope=lawScope(),session=lawSession();if(!scope.ready)return false;
    const mem=getLawMemory(scope);
    const cloudAvailable=scope.userId!=='guest'&&session?.access_token&&typeof cloudFetch==='function'&&(typeof navigator==='undefined'||navigator.onLine);
    if(!cloudAvailable){const local=typeof indexedDB!=='undefined'?await loadLawLocalLibrary(scope):false;if(local&&typeof document!=='undefined'){const panel=document.getElementById('laws');if(panel)renderSmartLawsPanelContent(panel);}return local;}
    if(mem.loadPromise)return mem.loadPromise;
    if(!force&&(mem.loaded||Date.now()-mem.lastAttempt<30000))return false;
    mem.lastAttempt=Date.now();
    const job=(async()=>{
      try{
        if(typeof indexedDB!=='undefined')await loadLawLocalLibrary(scope);
        if(!lawScopeCurrent(scope))return false;const revision=mem.revision;
        const res=await cloudFetch(`study_laws_bank?user_id=eq.${encodeURIComponent(scope.userId)}&select=id,user_id,discipline,title,badge,source_name,source_url,source_version,content_kind,metadata,articles,is_public,updated_at&order=id&limit=500`,{headers:typeof authHeaders==='function'?authHeaders(session.access_token):{Authorization:`Bearer ${session.access_token}`}});
        if(!lawScopeCurrent(scope))return false;if(!res?.ok)throw new Error('Não foi possível recuperar suas leis.');
        const rows=await res.json();if(!lawScopeCurrent(scope))return false;if(!Array.isArray(rows))throw new Error('Resposta inválida ao carregar leis.');
        const incoming=rows.filter(row=>row.user_id===scope.userId).map(row=>normalizeLawRecord({...row,...(row.metadata||{}),sourceUrl:row.source_url,sourceVersion:row.source_version,sourceName:row.source_name,content_kind:row.content_kind,updatedAt:row.updated_at})).filter(Boolean);
        mem.laws=[...new Map((mem.pending||mem.revision!==revision?[...incoming,...mem.laws,...mem.custom]:[...mem.laws,...incoming]).map(law=>[law.id,law])).values()];mem.loaded=true;
        const localSaved=typeof indexedDB!=='undefined'?await persistLawLibrary(scope):writeLawStore(LAWS_INTERNAL_KEY,{laws:mem.laws,pending:mem.pending},scope);
        if(!lawScopeCurrent(scope))return false;
        lawsSyncMessage=localSaved?'Leis da sua conta carregadas; cópia local disponível.':'Leis da sua conta carregadas; não foi possível gravar a cópia local.';
        if(typeof document!=='undefined'){const panel=document.getElementById('laws');if(panel)renderSmartLawsPanelContent(panel);}return true;
      }catch(_e){if(lawScopeCurrent(scope))lawsSyncMessage='Não foi possível recuperar as leis da conta; a seleção local continua disponível. Confira a conexão e a migração v109.';return false;}
    })();
    mem.loadPromise=job;try{return await job;}finally{if(mem.loadPromise===job)mem.loadPromise=null;}
  }
  function officialLawIdsFor(value){if(value?.full_document&&value.law_id)return[value.law_id];return OFFICIAL_LAW_SEEDS[value?.id]||[];}
  async function verifyOfficialLawHash(articles,expected){
    if(!Array.isArray(articles)||!articles.length||articles.some(text=>typeof text!=='string'||!text.trim())||!globalThis.crypto?.subtle||typeof TextEncoder==='undefined')return false;
    const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(articles)));
    return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')===String(expected||'').toLowerCase();
  }
  async function importOfficialLawToLibrary(lawId,showToast=true){
    const id=String(lawId||''),scope=lawScope(),initialSession=lawSession();
    if(!OFFICIAL_LAW_IMPORTS.some(item=>item.id===id))return {status:'failed',error:'Escolha um diploma do catálogo oficial.'};
    if(!scope.ready)return{status:'cancelled'};
    if(scope.userId==='guest'||!initialSession?.access_token)return{status:'failed',error:'Entre na sua conta para importar o documento da fonte oficial.'};
    if(typeof navigator!=='undefined'&&!navigator.onLine)return{status:'failed',error:'Conecte-se para consultar a fonte oficial. Os textos já salvos continuam disponíveis.'};
    const mem=getLawMemory(scope);if(mem.officialImports.has(id))return mem.officialImports.get(id);
    const previous=mem.officialImportTail;
    const job=(async()=>{
      let timer;
      try{
        // Mantém as importações/gravações de diplomas distintos na ordem dos cliques.
        if(previous)await previous;
        if(!lawScopeCurrent(scope))return{status:'cancelled'};
        const session=typeof validSession==='function'?await validSession():initialSession;
        if(!lawScopeCurrent(scope)||session?.user?.id!==scope.userId||!session?.access_token)return{status:'cancelled'};
        const base=typeof SUPABASE_URL==='string'?SUPABASE_URL:window.SUPABASE_URL;
        if(!base)throw new Error('Endereço do serviço de leis não configurado.');
        const controller=typeof AbortController==='function'?new AbortController():null;
        timer=setTimeout(()=>controller?.abort(),30000);
        const response=await fetch(`${base}/functions/v1/leis-oficiais`,{method:'POST',signal:controller?.signal,headers:{...(typeof authHeaders==='function'?authHeaders(session.access_token):{Authorization:`Bearer ${session.access_token}`}),'Content-Type':'application/json'},body:JSON.stringify({law_id:id})});
        if(!lawScopeCurrent(scope))return{status:'cancelled'};
        const data=await response.json();if(!lawScopeCurrent(scope))return{status:'cancelled'};
        if(!response.ok)throw new Error(response.status===404?'Publique a função leis-oficiais para usar esta importação.':String(data?.error||'A fonte oficial não confirmou o documento.'));
        const raw=data?.law;
        if(!raw||raw.law_id!==id||raw.id!==`official-${id}`||raw.full_document!==true||raw.content_kind!=='official_document_extraction'||!Array.isArray(raw.articles||raw.paragraphs)||!officialLawSource(raw.source_url)||!/^[a-f0-9]{64}$/i.test(String(raw.content_hash||''))||!String(raw.source_version||'').trim())throw new Error('A resposta da fonte oficial está incompleta; nenhum texto foi marcado como integral.');
        if(!await verifyOfficialLawHash(raw.articles||raw.paragraphs,raw.content_hash))throw new Error('O conteúdo recebido não corresponde ao resumo SHA-256 informado. Nenhum documento foi importado.');
        if(!lawScopeCurrent(scope))return{status:'cancelled'};
        const law=normalizeLawRecord({...raw,articles:raw.articles||raw.paragraphs,sourceUrl:raw.source_url,sourceVersion:raw.source_version,fetchedAt:raw.retrieved_at,sourceWarnings:data.warnings});
        if(!law||!law.full_document)throw new Error('O documento ultrapassou o limite suportado ou veio inválido. Nenhum trecho foi salvo como se fosse o documento completo.');
        mem.laws=[law,...mem.laws.filter(item=>item.id!==law.id)];mem.pending=true;mem.revision++;
        const result=await syncAllLawsToUserDatabase(false,law.id);
        if(!lawScopeCurrent(scope))return{status:'cancelled'};
        const warnings=Array.isArray(data.warnings)?data.warnings.filter(text=>typeof text==='string').slice(0,8):[];
        lawsSyncMessage=result.cloudSaved?`${law.title}: documento da fonte oficial salvo na conta${result.localSaved?' e neste aparelho':''}. Confira a versão e a vigência na referência.`:result.localSaved?`${law.title}: documento salvo neste aparelho; envio à conta pendente.`:`${law.title}: disponível somente nesta sessão; não foi possível confirmar o salvamento.`;
        if(warnings.length)lawsSyncMessage+=' '+warnings.join(' ');
        if(showToast&&typeof window.toast==='function')window.toast(lawsSyncMessage);
        return{...result,law,warnings};
      }catch(error){
        if(!lawScopeCurrent(scope))return{status:'cancelled'};
        const message=error?.name==='AbortError'?'A consulta à fonte oficial excedeu o prazo; tente novamente.':String(error?.message||'Não foi possível importar o documento oficial.');
        lawsSyncMessage=message;if(showToast&&typeof window.toast==='function')window.toast(message);return{status:'failed',error:message};
      }finally{if(timer)clearTimeout(timer);}
    })();
    mem.officialImports.set(id,job);mem.officialImportTail=job;
    try{return await job;}finally{if(mem.officialImports.get(id)===job)mem.officialImports.delete(id);if(mem.officialImportTail===job)mem.officialImportTail=null;}
  }
  async function importAllOfficialLaws(){
    const scope=lawScope(),mem=getLawMemory(scope);if(!scope.ready||mem.importingAll)return{status:'busy',imported:0};
    mem.importingAll=true;let imported=0,failed=0;
    try{for(const item of OFFICIAL_LAW_IMPORTS){if(!lawScopeCurrent(scope))return{status:'cancelled',imported,failed};lawsSyncMessage=`Importando ${imported+failed+1}/${OFFICIAL_LAW_IMPORTS.length}: ${item.title}...`;if(typeof document!=='undefined'){const panel=document.getElementById('laws');if(panel)renderSmartLawsPanelContent(panel);}const result=await importOfficialLawToLibrary(item.id,false);if(result.status==='cancelled')return{status:'cancelled',imported,failed};if(result.cloudSaved||result.localSaved)imported++;else failed++;}
      lawsSyncMessage=`Importação concluída: ${imported} documentos com salvamento confirmado; ${failed} não confirmados. As seleções anteriores foram preservadas.`;if(typeof window.toast==='function')window.toast(lawsSyncMessage);return{status:failed?'partial':'synced',imported,failed};
    }finally{mem.importingAll=false;}
  }
  // Consulta enciclopédica complementar: não é substituta do diploma oficial.
  async function withLawFetchDeadline(run){const controller=typeof AbortController==='function'?new AbortController():null,deadline=Date.now()+8000,timer=typeof setTimeout==='function'?setTimeout(()=>controller?.abort(),8000):null;const request=async url=>{if(Date.now()>=deadline)throw new Error('Tempo de consulta excedido.');const response=await fetch(url,{signal:controller?.signal});if(!response.ok)throw new Error('Fonte externa indisponível.');const data=await response.json();if(Date.now()>=deadline)throw new Error('Tempo de consulta excedido.');return data;};try{return await run(request);}finally{if(timer!==null&&typeof clearTimeout==='function')clearTimeout(timer);}}
  function lawParagraphs(extract,max=180){const all=String(extract||'').split(/\n+/).map(line=>line.trim()).filter(line=>line.length>=35&&!/^=+.*=+$/.test(line));return{paragraphs:all.slice(0,max).map(line=>line.slice(0,20000)),truncated:all.length>max||all.some(line=>line.length>20000)};}
  async function fetchExternalCompleteLawText(lawItem){const scope=lawScope();if(!scope.ready||!lawItem||typeof fetch!=='function')return null;const cached=getExternalFullTextCache()[lawItem.id];if(cached&&Array.isArray(cached.paragraphs)&&cached.paragraphs.length)return cached;const sources=[];if(lawItem.wikisourceTitle)sources.push({host:'pt.wikisource.org',title:lawItem.wikisourceTitle,source:'Wikisource · texto complementar não revisado'});if(lawItem.wikipediaTitle)sources.push({host:'pt.wikipedia.org',title:lawItem.wikipediaTitle,source:'Wikipédia · texto enciclopédico não revisado'});return withLawFetchDeadline(async request=>{for(const item of sources){try{const data=await request(`https://${item.host}/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(item.title)}&format=json&origin=*`);if(!lawScopeCurrent(scope))return null;const first=Object.values(data?.query?.pages||{})[0],parsed=lawParagraphs(first?.extract);if(!parsed.paragraphs.length)continue;const payload={...parsed,source:item.source,sourceUrl:`https://${item.host}/wiki/${encodeURIComponent(item.title.replace(/ /g,'_'))}`,fetchedAt:new Date().toISOString()};payload.localSaved=saveExternalFullTextCache(lawItem.id,payload,scope);return payload;}catch(_e){if(!lawScopeCurrent(scope))return null;}}return null;});}
  async function searchAndImportExternalLawOrText(queryStr,targetDiscipline='Legislação Extravagante'){const query=String(queryStr||'').trim(),scope=lawScope();if(!query||!scope.ready||typeof fetch!=='function')return null;return withLawFetchDeadline(async request=>{for(const target of [{host:'pt.wikisource.org',label:'Wikisource · fonte externa não revisada'},{host:'pt.wikipedia.org',label:'Wikipédia · fonte enciclopédica não revisada'}]){try{const search=await request(`https://${target.host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`);if(!lawScopeCurrent(scope))return null;const hit=search?.query?.search?.[0];if(!hit?.title)continue;const data=await request(`https://${target.host}/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(hit.title)}&format=json&origin=*`);if(!lawScopeCurrent(scope))return null;const parsed=lawParagraphs(Object.values(data?.query?.pages||{})[0]?.extract,150);if(!parsed.paragraphs.length)continue;const law=normalizeLawRecord({id:`ext-law-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,discipline:targetDiscipline,title:String(hit.title),content_kind:'external_excerpt',sourceName:target.label,sourceUrl:`https://${target.host}/wiki/${encodeURIComponent(String(hit.title).replace(/ /g,'_'))}`,fetchedAt:new Date().toISOString(),articles:parsed.paragraphs,contentTruncated:parsed.truncated,wikisourceTitle:target.host.includes('wikisource')?hit.title:'',wikipediaTitle:target.host.includes('wikipedia')?hit.title:''});const localSaved=saveCustomImportedLaw(law,scope);return{...law,localSaved};}catch(_e){if(!lawScopeCurrent(scope))return null;}}return null;});}

  function getAppStateSafe() {
    try { if (typeof state === 'object' && state) return state; } catch (_e) {}
    return (typeof window !== 'undefined' && window.state) ? window.state : {};
  }

  function injectR180HunterStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    let style = document.getElementById('jcCaveiraSuiteR179Styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'jcCaveiraSuiteR179Styles';
      document.head.appendChild(style);
    }
    style.textContent = `
      /* === 1. Sincronia e Alinhamento das 5 Abas de Estudo (.studyTabs) em Linha Única === */
      #study .studyTabs,
      #study .studyTabs.smartEnabled {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 6px !important;
        align-items: center !important;
      }
      @media (max-width: 640px) {
        #study .studyTabs,
        #study .studyTabs.smartEnabled {
          display: flex !important;
          overflow-x: auto !important;
          scrollbar-width: none;
        }
        #study .studyTabs .studyTab {
          flex: 1 0 auto !important;
          padding: 9px 10px !important;
          font-size: 0.75rem !important;
          white-space: nowrap !important;
        }
      }
      /* Nunca exibir Manuais do Caçador na barra de Resumos */
      #openManuaisCacadorBtn {
        display: none !important;
      }

      /* === 2. Efeito Real e Imediato do Modo Visual Limpo (body.jcCleanDashboard) === */
      body.jcCleanDashboard .slBannerCard,
      body.jcCleanDashboard #slTrailHeroBanner,
      body.jcCleanDashboard #slBossesRaidBanner,
      body.jcCleanDashboard #slStudyHeroBanner,
      body.jcCleanDashboard .caveiraSprintBanner {
        display: none !important;
      }
      body.jcCleanDashboard .jcDecorativeDescription {
        display: none !important;
      }
      body.jcCleanDashboard .card:not(.hero) {
        padding: 14px 16px !important;
      }

      /* === 3. Paleta Oficial Jornada do Caçador (Azul-Abissal #0a1626 + Ciano Elétrico #38bdf8 / #65e7ff) === */
      .jcCaveiraTopCards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }
      @media (max-width: 860px) {
        .jcCaveiraTopCards {
          grid-template-columns: 1fr;
        }
      }
      .jcCaveiraActionCard {
        background: linear-gradient(155deg, rgba(11, 24, 41, 0.95), rgba(7, 15, 27, 0.98));
        border: 1px solid rgba(56, 189, 248, 0.24);
        border-radius: 14px;
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        box-shadow: 0 10px 26px rgba(2, 8, 20, 0.35);
        transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
      }
      .jcCaveiraActionCard:hover {
        border-color: rgba(101, 231, 255, 0.55);
        box-shadow: 0 12px 28px rgba(14, 165, 233, 0.18);
        transform: translateY(-1px);
      }
      .jcCaveiraActionTitle {
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #f0f9ff;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .jcCaveiraActionSub {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: #93c5fd;
        opacity: 0.85;
        line-height: 1.42;
      }
      .jcCaveiraActionBtn,
      .jcCaveiraActionBtn.olive {
        align-self: flex-start;
        min-width: 142px;
        padding: 9px 18px;
        border-radius: 10px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border: 1px solid rgba(101, 231, 255, 0.5);
        background: linear-gradient(135deg, #65e7ff, #34aee9);
        color: #06131f;
        box-shadow: 0 6px 18px rgba(52, 174, 233, 0.24);
        cursor: pointer;
        text-align: center;
        transition: filter 0.15s ease, transform 0.15s ease;
      }
      .jcCaveiraActionBtn:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      .jcCaveiraSectionTitle {
        font-size: 0.98rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #e0f2fe;
        margin: 18px 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .jcCaveiraOverviewBox {
        background: linear-gradient(155deg, rgba(10, 22, 38, 0.95), rgba(6, 14, 25, 0.98));
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 18px;
        box-shadow: 0 10px 26px rgba(2, 8, 20, 0.32);
      }
      .jcCaveiraOverviewGrid {
        display: grid;
        grid-template-columns: 1.3fr 1fr 1fr;
        gap: 16px;
        align-items: stretch;
      }
      @media (max-width: 860px) {
        .jcCaveiraOverviewGrid {
          grid-template-columns: 1fr;
        }
      }
      .jcCaveiraBigNumber {
        font-size: 3.1rem;
        font-weight: 900;
        line-height: 1;
        color: #65e7ff;
        margin: 10px 0 16px;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 0 18px rgba(101, 231, 255, 0.25);
      }
      .jcCaveiraStatBox {
        border-radius: 12px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 132px;
      }
      .jcCaveiraStatBox.green {
        background: linear-gradient(145deg, rgba(6, 78, 59, 0.42), rgba(4, 47, 46, 0.65));
        border: 1px solid rgba(52, 211, 153, 0.38);
        color: #ecfdf5;
      }
      .jcCaveiraStatBox.blue {
        background: linear-gradient(145deg, rgba(12, 74, 110, 0.48), rgba(7, 38, 64, 0.72));
        border: 1px solid rgba(56, 189, 248, 0.42);
        color: #f0f9ff;
      }
      .jcCaveiraTwoCols {
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: 16px;
        margin-bottom: 18px;
      }
      @media (max-width: 860px) {
        .jcCaveiraTwoCols {
          grid-template-columns: 1fr;
        }
      }

      /* === 4. Painel Tático na Identidade Jornada do Caçador === */
      .jcTacticalWrap {
        background: linear-gradient(160deg, rgba(9, 20, 36, 0.96), rgba(6, 13, 24, 0.99));
        border: 1px solid rgba(56, 189, 248, 0.26);
        border-radius: 16px;
        padding: 20px;
        margin-top: 18px;
        box-shadow: 0 12px 30px rgba(2, 8, 20, 0.4);
      }
      .jcTacticalSegment {
        display: inline-flex;
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 10px;
        overflow: hidden;
        background: #071220;
        padding: 3px;
        gap: 4px;
      }
      .jcTacticalSegBtn {
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: #94a3b8;
        padding: 7px 16px;
        font-size: 0.81rem;
        font-weight: 800;
        cursor: pointer;
      }
      .jcTacticalSegBtn.active {
        background: linear-gradient(135deg, #65e7ff, #34aee9);
        color: #06131f;
      }
      .jcTacticalPeriodBar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        border-bottom: 1px solid rgba(56, 189, 248, 0.18);
        margin: 16px 0 18px;
        padding-bottom: 2px;
      }
      .jcTacticalPeriodBtn {
        background: transparent;
        border: 0;
        border-bottom: 2.5px solid transparent;
        color: #94a3b8;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 8px 12px;
        cursor: pointer;
      }
      .jcTacticalPeriodBtn.active {
        color: #65e7ff;
        border-bottom-color: #65e7ff;
      }

      /* === 5. Funil de 3 Chevrons dos Flashcards na Paleta Ciano/Azul === */
      .jcChevronStageWrap {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 8px 0;
      }
      .jcChevronColumn {
        width: 62px;
        height: 172px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 12px 4px;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #f0f9ff;
        position: relative;
        clip-path: polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%, 18% 50%);
      }
      .jcChevronColumn.stage1 { background: linear-gradient(180deg, #1e293b, #0f172a); border: 1px solid rgba(148,163,184,0.3); }
      .jcChevronColumn.stage2 { background: linear-gradient(180deg, #0369a1, #0c4a6e); }
      .jcChevronColumn.stage3 { background: linear-gradient(180deg, #0ea5e9, #0284c7); color: #04101c; }
      .jcChevronVertLabel {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
        font-size: 0.65rem;
        letter-spacing: 0.06em;
      }

      /* === 6. Central de Leis & Textos com Pastas Retráteis Idênticas a Resumos (.libraryFolder) === */
      .jcLawRowItem {
        background: rgba(11, 25, 43, 0.9);
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 12px;
        padding: 13px 16px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        transition: border-color 0.16s ease;
      }
      .jcLawRowItem:hover {
        border-color: rgba(101, 231, 255, 0.55);
      }
      .jcLawStartBtn {
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(2, 132, 199, 0.28));
        border: 1px solid rgba(101, 231, 255, 0.45);
        color: #65e7ff;
        padding: 7px 14px;
        border-radius: 9px;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: pointer;
        white-space: nowrap;
      }
      .jcLawStartBtn:hover {
        background: linear-gradient(135deg, #65e7ff, #34aee9);
        color: #06131f;
      }

      /* === 7. Pílulas Rápidas de Questões e Rodapé da Questão na Paleta Oficial === */
      .jcQuestionStatusPills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0 14px;
      }
      .jcQStatusPill {
        background: rgba(10, 23, 39, 0.9);
        border: 1px solid rgba(56, 189, 248, 0.26);
        color: #cbd5e1;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        cursor: pointer;
      }
      .jcQStatusPill.active {
        background: linear-gradient(135deg, #65e7ff, #34aee9);
        border-color: #65e7ff;
        color: #06131f;
      }
      .jcQuestionCaveiraFooter {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(56, 189, 248, 0.2);
      }
      .jcQCaveiraToolBtn {
        background: rgba(12, 26, 44, 0.75);
        border: 1px solid rgba(56, 189, 248, 0.22);
        color: #bae6fd;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 6px 11px;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .jcQCaveiraToolBtn:hover {
        background: rgba(56, 189, 248, 0.18);
        border-color: #65e7ff;
        color: #ffffff;
      }

      
      /* === 9. Responsividade Mobile-First Avançada (r181 — Corrige Telas 360px a 760px) === */
      html, body {
        max-width: 100vw;
        overflow-x: hidden;
      }
      @media (max-width: 760px) {
        main.app, .app {
          padding-bottom: calc(118px + env(safe-area-inset-bottom)) !important;
        }
        #slGuildChatFab, .slGuildChatFab {
          bottom: calc(74px + env(safe-area-inset-bottom)) !important;
          right: 12px !important;
          z-index: 38 !important;
        }
        /* Banner de Perfil no Celular: evita que botões flutuem sobre a arte de fundo */
        .jcProfileCoverBanner {
          height: 128px !important;
          align-items: flex-end !important;
          justify-content: flex-end !important;
          padding: 8px 10px !important;
        }
        .jcCoverTopBtns {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          justify-content: flex-end !important;
        }
        .jcCoverTopBtns button {
          font-size: 0.66rem !important;
          padding: 5px 8px !important;
        }
        /* Flashcards e Painel Tático empilhados sem espremer no celular */
        #jcFlashcardsDashboardHub .jcCaveiraOverviewBox > div {
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }
        #jcTacticalPanelSection .jcTacticalPeriodBar {
          justify-content: flex-start !important;
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
          padding-bottom: 6px !important;
        }
        #jcTacticalPanelSection .jcTacticalPeriodBtn {
          white-space: nowrap !important;
          flex: 0 0 auto !important;
        }
        #laws .jcLawRowItem {
          flex-direction: column !important;
          align-items: flex-start !important;
        }
        #laws .jcLawRowItem > div:last-child {
          width: 100% !important;
          display: flex !important;
          justify-content: space-between !important;
        }
      }

      /* === 8. Suporte Completo ao Tema Claro (body.lightAppTheme) === */
      body.lightAppTheme .jcCaveiraActionCard,
      body.lightAppTheme .jcCaveiraOverviewBox,
      body.lightAppTheme .jcTacticalWrap,
      body.lightAppTheme .jcLawRowItem {
        background: #ffffff !important;
        border: 1.5px solid #94a3b8 !important;
        color: #090d16 !important;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06) !important;
      }
      body.lightAppTheme .jcCaveiraActionTitle,
      body.lightAppTheme .jcCaveiraSectionTitle,
      body.lightAppTheme .jcCaveiraBigNumber {
        color: #0369a1 !important;
        text-shadow: none !important;
      }
      body.lightAppTheme .jcCaveiraActionSub {
        color: #1e293b !important;
        font-weight: 600 !important;
      }
      body.lightAppTheme .jcCaveiraActionBtn {
        background: #0284c7 !important;
        border-color: #0369a1 !important;
        color: #ffffff !important;
      }
      body.lightAppTheme .jcCaveiraStatBox.green {
        background: #ecfdf5 !important;
        border: 1.5px solid #10b981 !important;
        color: #064e3b !important;
      }
      body.lightAppTheme .jcCaveiraStatBox.blue {
        background: #e0f2fe !important;
        border: 1.5px solid #0284c7 !important;
        color: #0c4a6e !important;
      }
      body.lightAppTheme .jcTacticalSegment {
        background: #e2e8f0 !important;
        border-color: #94a3b8 !important;
      }
      body.lightAppTheme .jcTacticalSegBtn {
        color: #0f172a !important;
      }
      body.lightAppTheme .jcTacticalSegBtn.active {
        background: #0284c7 !important;
        color: #ffffff !important;
      }
      body.lightAppTheme .jcTacticalPeriodBtn {
        color: #334155 !important;
      }
      body.lightAppTheme .jcTacticalPeriodBtn.active {
        color: #0284c7 !important;
        border-bottom-color: #0284c7 !important;
      }
      body.lightAppTheme .jcQStatusPill {
        background: #ffffff !important;
        border: 1.5px solid #64748b !important;
        color: #0f172a !important;
      }
      body.lightAppTheme .jcQStatusPill.active {
        background: #0284c7 !important;
        border-color: #0369a1 !important;
        color: #ffffff !important;
      }
      body.lightAppTheme .jcLawStartBtn {
        background: #e0f2fe !important;
        border: 1.5px solid #0284c7 !important;
        color: #0369a1 !important;
      }
      body.lightAppTheme .jcQCaveiraToolBtn {
        color: #0f172a !important;
        border: 1px solid #94a3b8 !important;
        background: #f8fafc !important;
      }
    `;
  }

  // 1) Renovação Automática de Vidas da Trilha a cada 20 min + Cronômetro ao Vivo no Selo
  function tickTrailHearts20MinRegen() {
    if (typeof document === 'undefined') return;
    const st = getAppStateSafe();
    if (!st.learning) st.learning = { hearts: 3, xp: 0, done: {} };
    if (typeof window.availableTrailHearts === 'function') {
      try { window.availableTrailHearts(); } catch (_e) {}
    }
    const h = Number.isInteger(st.learning.hearts) ? st.learning.hearts : 3;
    const badge = document.getElementById('trailHeartsStatusBadge');
    if (badge) {
      const heartsIcons = '♥'.repeat(Math.max(0, h)) + '♡'.repeat(Math.max(0, 3 - h));
      if (h < 3 && st.learning.heartCooldownUntil) {
        const remSec = Math.max(0, Math.ceil((Number(st.learning.heartCooldownUntil) - Date.now()) / 1000));
        const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
        const ss = String(remSec % 60).padStart(2, '0');
        badge.textContent = `${heartsIcons} ${h}/3 vidas · ⏱ +1 em ${mm}:${ss}`;
        badge.title = 'As vidas da Trilha Tática são renovadas automaticamente a cada 20 minutos';
      } else {
        badge.textContent = `${heartsIcons} ${h}/3 vidas`;
      }
    }
  }

  // 2) Hub de Redação Policial na Paleta Oficial da Jornada do Caçador
  // Dados dos hubs: cada indicador declara sua fonte, período e unidade de contagem.
  const caveiraMetricHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function caveiraMetricScope() {
    const st = getAppStateSafe();
    let session, knownSession = false;
    try { if (typeof cloudSession !== 'undefined') { session = cloudSession; knownSession = true; } } catch (_e) {}
    if (!knownSession && typeof window !== 'undefined' && Object.prototype.hasOwnProperty.call(window, 'cloudSession')) { session = window.cloudSession; knownSession = true; }
    const userId = session?.user?.id || st._ownerUserId || 'guest';
    const ready = !(session?.user?.id && st._ownerUserId !== session.user.id) && !(knownSession && !session?.user?.id && st._ownerUserId);
    let campaign = null;
    try { if (typeof activeCampaign === 'function') campaign = activeCampaign(); } catch (_e) {}
    campaign = campaign || (st.campaigns || []).find(item => item.id === st.activeCampaignId) || null;
    const campaignIds = new Set([st.activeCampaignId, campaign?.id, campaign?.dbId].filter(Boolean).map(String));
    return { st, userId: String(userId), ready, campaignIds, singleCampaign: Array.isArray(st.campaigns) && st.campaigns.length === 1 };
  }
  function caveiraMetricBelongs(item, scope, allowLegacy = false) {
    if (!scope.ready || !item || typeof item !== 'object') return false;
    const owner = item.user_id || item.userId || item._ownerUserId;
    if (owner && String(owner) !== scope.userId) return false;
    const campaignId = item.campaign_id || item.campaignId;
    return campaignId ? scope.campaignIds.has(String(campaignId)) : Boolean(allowLegacy && scope.singleCampaign);
  }
  function caveiraMetricDate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) ? stamp : null;
  }
  function caveiraMetricPeriod(days, now = Date.now()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (days !== 9999) start.setDate(start.getDate() - Math.max(0, Number(days || 1) - 1));
    return { start: days === 9999 ? -Infinity : start.getTime(), end: now };
  }
  function caveiraMetricInPeriod(value, range) {
    const at = caveiraMetricDate(value);
    return at !== null && at >= range.start && at <= range.end;
  }
  function caveiraMetricMissions(scope) {
    if (!scope.ready) return [];
    try { if (typeof missionPool === 'function') return missionPool() || []; } catch (_e) {}
    return Array.isArray(scope.st.customCampaign?.missions) ? scope.st.customCampaign.missions : [];
  }
  function caveiraMetricFlashcards(scope) {
    let deck = [];
    try { if (typeof ALL_FLASHCARDS !== 'undefined' && Array.isArray(ALL_FLASHCARDS)) deck = ALL_FLASHCARDS; } catch (_e) {}
    if (!deck.length && Array.isArray(window.ALL_FLASHCARDS)) deck = window.ALL_FLASHCARDS;
    const progress = scope.st.flashProgress && typeof scope.st.flashProgress === 'object' ? scope.st.flashProgress : {};
    const seen = new Set(), cards = [];
    let unscoped = 0;
    if (!scope.ready) return { cards, unscoped, deckCount: 0 };
    deck.forEach((card, index) => {
      if (!Array.isArray(card) || card.length < 3 || !String(card[1] || '').trim() || !String(card[2] || '').trim() || /manuais do ca[cç]ador/i.test(String(card[0] || ''))) return;
      let key;
      try { if (typeof fcKey === 'function') key = fcKey(card); } catch (_e) {}
      if (!key) { const text = String(card[1]).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160); let hash = 5381; for (let k = 0; k < text.length; k++) hash = ((hash << 5) + hash + text.charCodeAt(k)) >>> 0; key = 'f' + hash.toString(36); }
      if (seen.has(key)) return;
      seen.add(key);
      const item = progress[key] || progress[index];
      let rating = null;
      if (item && caveiraMetricBelongs(item, scope, true) && ['hard','medium','easy'].includes(item.level)) rating = item;
      else if (item) unscoped++;
      cards.push({ key, subject: String(card[0] || 'Disciplina não informada'), rating });
    });
    return { cards, unscoped, deckCount: cards.length };
  }
  function caveiraMetricEssays(scope) {
    if (!scope.ready) return [];
    let rows = [];
    try { if (typeof cloudEssays !== 'undefined' && Array.isArray(cloudEssays)) rows = cloudEssays; } catch (_e) {}
    if (!rows.length && Array.isArray(window.cloudEssays)) rows = window.cloudEssays;
    return rows.filter(item => caveiraMetricBelongs(item, scope, true)).map(item => {
      const raw = item.result?.score;
      const score = item.processing_status === 'ready' && typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : null;
      return { ...item, metricScore: score };
    }).sort((left, right) => (caveiraMetricDate(right.created_at) || 0) - (caveiraMetricDate(left.created_at) || 0));
  }
  function caveiraMetricTactical(scope, mode, days) {
    const range = caveiraMetricPeriod(days), rows = [], missions = caveiraMetricMissions(scope);
    let omitted = 0;
    if (!scope.ready) return { rows, omitted };
    if (mode === 'flashcards') {
      const flash = caveiraMetricFlashcards(scope);
      omitted += flash.unscoped;
      flash.cards.forEach(card => {
        if (!card.rating) return;
        if (!caveiraMetricDate(card.rating.date)) { omitted++; return; }
        if (caveiraMetricInPeriod(card.rating.date, range)) rows.push({ subject: card.subject, total: 1, correct: card.rating.level === 'easy' ? 1 : 0, date: card.rating.date });
      });
    } else if (mode === 'edital') {
      missions.forEach(mission => {
        const completedAt = scope.st.done?.[mission.id];
        if (!completedAt) return;
        if (!caveiraMetricDate(completedAt)) { omitted++; return; }
        if (caveiraMetricInPeriod(completedAt, range)) rows.push({ subject: mission.subject || 'Disciplina não informada', total: 1, correct: 1, date: completedAt });
      });
    } else {
      const byMission = new Map(missions.map(mission => [String(mission.id), mission]));
      (Array.isArray(scope.st.scores) ? scope.st.scores : []).forEach(score => {
        const legacyMission = byMission.get(String(score?.id));
        if (!caveiraMetricBelongs(score, scope, Boolean(legacyMission))) { omitted++; return; }
        const total = score.total, correct = score.correct;
        if (!Number.isInteger(total) || total <= 0 || !Number.isInteger(correct) || correct < 0 || correct > total || !caveiraMetricDate(score.date)) { omitted++; return; }
        if (caveiraMetricInPeriod(score.date, range)) rows.push({ subject: score.subject || legacyMission?.subject || 'Disciplina não informada', total, correct, date: score.date });
      });
    }
    return { rows: rows.filter(row => !/manuais do ca[cç]ador/i.test(String(row.subject))), omitted };
  }
  let caveiraMetricsRefreshQueued = false;
  function ensureCaveiraMetricsHooks() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const refresh = () => {
      if (caveiraMetricsRefreshQueued) return;
      caveiraMetricsRefreshQueued = true;
      const run = () => {
        caveiraMetricsRefreshQueued = false;
        const active = document.querySelector?.('.view.active')?.id;
        if (active === 'essay') mountCaveiraEssayHub();
        if (active === 'profile') mountPainelTaticoInProfile();
        if (active === 'study') mountCaveiraFlashcardsHub();
      };
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
      else Promise.resolve().then(run);
    };
    if (!window._jcCaveiraMetricsEventsBound) {
      window._jcCaveiraMetricsEventsBound = true;
      document.addEventListener?.('flashcards:graded', refresh);
      document.addEventListener?.('visibilitychange', refresh);
      window.addEventListener?.('storage', refresh);
    }
    for (const name of ['renderEssays','renderCard','render','renderViewById','applyServerState','save']) {
      const base = window[name];
      if (typeof base !== 'function' || base._jcCaveiraMetricsHooked) continue;
      const wrapped = function(...args) { const result = base.apply(this, args); refresh(); return result; };
      wrapped._jcCaveiraMetricsHooked = true;
      window[name] = wrapped;
    }
  }

  function mountCaveiraEssayHub() {
    if (typeof document === 'undefined') return;
    const essaySec = document.getElementById('essay');
    if (!essaySec) return;
    ensureCaveiraMetricsHooks();
    const scope = caveiraMetricScope();
    const essays = caveiraMetricEssays(scope);
    const totalSent = essays.length;
    const graded = essays.filter(e => e.metricScore !== null);
    const scores = graded.map(e => e.metricScore);
    const inProcessing = essays.filter(e => ['pending','processing'].includes(e.processing_status)).length;
    const bestPct = scores.length ? Math.max(...scores) : null;
    const avgPct = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    let hub = document.getElementById('jcEssayDashboardHub');
    if (!hub) {
      hub = document.createElement('div');
      hub.id = 'jcEssayDashboardHub';
      const head = essaySec.querySelector('.sectionHead');
      if (head && head.nextSibling) {
        essaySec.insertBefore(hub, head.nextSibling);
      } else {
        essaySec.insertBefore(hub, essaySec.firstChild);
      }
    }

    const last10 = scores.slice(0, 10).reverse();
    const pts = last10.map((val, idx) => {
      const x = 40 + idx * 36;
      const y = 140 - Math.round((Math.min(100, Math.max(0, val)) / 100) * 110);
      return `${x},${y}`;
    }).join(' ');

    const circlesHtml = last10.map((val, idx) => {
      const x = 40 + idx * 36;
      const y = 140 - Math.round((Math.min(100, Math.max(0, val)) / 100) * 110);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#65e7ff" stroke="#06131f" stroke-width="1.5"><title>Envio ${idx + 1}: ${val}%</title></circle>`;
    }).join('');

    const recentRows = essays.slice(0, 4).map((e, i) => {
      const pct = e.metricScore;
      const statuses = {pending:'Aguardando correção',processing:'Em correção',ready:'Conferir resultado',error:'Falha na correção'};
      const status = pct !== null ? pct + '/100' : (statuses[e.processing_status] || 'Situação não informada');
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.18);margin-bottom:8px;">
          <div>
            <b style="font-size:.84rem;display:block;">${caveiraMetricHtml(String(e.title || e.theme || 'Redação #' + (essays.length - i)).slice(0, 48))}</b>
            <span style="font-size:.73rem;color:#94a3b8;">${caveiraMetricHtml(e.board || 'Critérios gerais')} · ${caveiraMetricHtml(caveiraMetricDate(e.created_at) !== null ? new Date(e.created_at).toLocaleDateString('pt-BR') : 'Data não informada')}</span>
          </div>
          <span class="tag" style="font-weight:800;">${caveiraMetricHtml(status)}</span>
        </div>
      `;
    }).join('') || `<p class="small muted" style="margin:18px 0;">${scope.ready ? 'Nenhuma redação enviada neste portal. Clique em ACESSAR para escrever ou enviar seu rascunho.' : 'Aguarde o carregamento da conta atual.'}</p>`;

    hub.innerHTML = `
      <div class="jcCaveiraTopCards">
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">✍️ ENVIAR REDAÇÃO</div>
            <div class="jcCaveiraActionSub">ESCOLHA O FORMATO (DIGITADA OU FOTO/PDF) E ENVIE PARA CORREÇÃO</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcEssayFocusFormBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">📋 ACOMPANHAR</div>
            <div class="jcCaveiraActionSub">VEJA STATUS, NOTA POR CRITÉRIO E FEEDBACK DOS SEUS ENVIOS</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcEssayFocusHistoryBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">🧙‍♂️ TEMAS DO INVOCADOR</div>
            <div class="jcCaveiraActionSub">SORTEIE TEMA POLICIAL COM TEXTOS MOTIVADORES I E II NA HORA</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcEssayTriggerThemeBtn">SORTEAR TEMA</button>
        </div>
      </div>

      <div class="jcCaveiraSectionTitle">📊 MEU DESEMPENHO</div>
      <div class="jcCaveiraOverviewBox">
        <div class="jcCaveiraOverviewGrid">
          <div>
            <div style="font-size:.92rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;">VISÃO GERAL</div>
            <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;">TOTAL DE REDAÇÕES ENVIADAS</div>
            <div class="jcCaveiraBigNumber">${totalSent}</div>
            <div style="display:grid;gap:5px;font-size:.76rem;font-weight:700;">
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#38bdf8;margin-right:6px;"></span>${totalSent} ENVIADAS</div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#eab308;margin-right:6px;"></span>${inProcessing} AGUARDANDO / EM CORREÇÃO</div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10b981;margin-right:6px;"></span>${graded.length} CORRIGIDAS</div>
            </div>
          </div>
          <div class="jcCaveiraStatBox green">
            <span style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">MELHOR NOTA ESTIMADA</span>
            <strong style="font-size:2.1rem;font-weight:800;font-variant-numeric:tabular-nums;">${bestPct === null ? '—' : bestPct + '/100'}</strong>
          </div>
          <div class="jcCaveiraStatBox blue">
            <span style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">MÉDIA GERAL</span>
            <strong style="font-size:2.1rem;font-weight:800;font-variant-numeric:tabular-nums;">${avgPct === null ? '—' : avgPct + '/100'}</strong>
          </div>
        </div>
        <div style="font-size:.73rem;color:#94a3b8;margin-top:10px;">${graded.length} correção(ões) com nota válida, entre ${totalSent} envio(s) carregados deste portal. Notas estimadas para fins pedagógicos.</div>
      </div>

      <div class="jcCaveiraTwoCols">
        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
          <div style="font-size:.9rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">ÚLTIMOS ENVIOS (EVOLUÇÃO 0–100%)</div>
          <svg viewBox="0 0 400 165" style="width:100%;height:160px;overflow:visible;">
            <line x1="32" y1="30" x2="385" y2="30" stroke="rgba(56,189,248,0.16)" stroke-dasharray="3,3"/>
            <line x1="32" y1="85" x2="385" y2="85" stroke="rgba(56,189,248,0.16)" stroke-dasharray="3,3"/>
            <line x1="32" y1="140" x2="385" y2="140" stroke="rgba(56,189,248,0.35)"/>
            <text x="6" y="34" fill="#94a3b8" font-size="10">100</text>
            <text x="12" y="88" fill="#94a3b8" font-size="10">50</text>
            <text x="18" y="143" fill="#94a3b8" font-size="10">0</text>
            ${pts ? `<polyline fill="none" stroke="#65e7ff" stroke-width="2.5" points="${pts}"/>` : ''}
            ${circlesHtml}
          </svg>
        </div>
        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:.9rem;font-weight:800;text-transform:uppercase;">HISTÓRICO</span>
            <button type="button" class="ghost small" id="jcEssaySeeAllBtn" style="padding:4px 10px;font-size:.72rem;">VER TUDO →</button>
          </div>
          ${recentRows}
        </div>
      </div>
    `;

    const focusFormBtn = document.getElementById('jcEssayFocusFormBtn');
    if (focusFormBtn) {
      focusFormBtn.onclick = () => {
        const titleInput = document.getElementById('essayTitle');
        if (titleInput) {
          titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          titleInput.focus();
        }
      };
    }
    const focusHistBtn = document.getElementById('jcEssayFocusHistoryBtn');
    const seeAllBtn = document.getElementById('jcEssaySeeAllBtn');
    const scrollToList = () => {
      const listEl = document.getElementById('essayList');
      if (listEl && listEl.scrollIntoView) listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (focusHistBtn) focusHistBtn.onclick = scrollToList;
    if (seeAllBtn) seeAllBtn.onclick = scrollToList;

    const triggerThemeBtn = document.getElementById('jcEssayTriggerThemeBtn');
    if (triggerThemeBtn) {
      triggerThemeBtn.textContent = document.getElementById('generateAiEssayThemeBtn') ? 'GERAR TEMA COM IA' : 'SORTEAR TEMA';
      triggerThemeBtn.onclick = () => {
        const aiBtn = document.getElementById('generateAiEssayThemeBtn') || document.getElementById('suggestEssayThemeBtn');
        if (!aiBtn) { if (typeof window.toast === 'function') window.toast('A geração de temas ainda está carregando. Tente novamente.'); return; }
        aiBtn.click();
        const box = document.getElementById('essayMotivatingBox') || document.getElementById('essayTheme');
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }

  // 3) Painel Tático Interativo no Perfil Social
  let tacticalTabMode = 'questions';
  let tacticalPeriodDays = 30;

  function mountPainelTaticoInProfile() {
    if (typeof document === 'undefined') return;
    const profRoot = document.getElementById('profileHubRoot') || document.getElementById('profile');
    if (!profRoot) return;

    let sec = document.getElementById('jcTacticalPanelSection');
    if (!sec) {
      sec = document.createElement('div');
      sec.id = 'jcTacticalPanelSection';
      sec.className = 'jcTacticalWrap';
      profRoot.appendChild(sec);
    }

    ensureCaveiraMetricsHooks();
    const scope = caveiraMetricScope();
    const snapshot = caveiraMetricTactical(scope, tacticalTabMode, tacticalPeriodDays);
    const byDisc = new Map();
    snapshot.rows.forEach(entry => {
      const dName = String(entry.subject || 'Disciplina não informada');
      const cur = byDisc.get(dName) || {total:0,correct:0,wrong:0};
      cur.total += entry.total; cur.correct += entry.correct; cur.wrong += entry.total - entry.correct;
      byDisc.set(dName, cur);
    });
    let totalRight = 0, totalWrong = 0;
    byDisc.forEach(value => { totalRight += value.correct; totalWrong += value.wrong; });
    const grandTotal = totalRight + totalWrong;
    const accPct = grandTotal > 0 ? Math.round(totalRight / grandTotal * 100) : null;
    const isFlash = tacticalTabMode === 'flashcards', isEdital = tacticalTabMode === 'edital';
    const rightLabel = isFlash ? 'Marcados fáceis' : isEdital ? 'Concluídas' : 'Acertadas';
    const wrongLabel = isFlash ? 'Médios / difíceis' : isEdital ? 'Sem avaliação de acerto' : 'Não acertadas';
    const unitLabel = isFlash ? 'Cartões avaliados' : isEdital ? 'Missões concluídas' : 'Itens em treinos concluídos';
    const rateLabel = isFlash ? 'marcados fáceis' : isEdital ? 'conclusões, sem nota de domínio' : 'de acerto';
    const sourceNote = isFlash
      ? 'Conta cartões únicos do portal cuja última avaliação está no período; não soma revisões anteriores nem comprova retenção.'
      : isEdital ? 'Conclusões de missões do portal com data registrada. Concluir uma missão não comprova domínio do conteúdo.'
      : 'Usa treinos concluídos com data e portal identificados. Repetições podem estar incluídas; este histórico não distingue a primeira tentativa. Itens não acertados podem incluir respostas em branco.';
    const timeline = [...snapshot.rows].sort((a,b) => Date.parse(a.date) - Date.parse(b.date)).slice(-10);
    const graphMax = Math.max(1, ...timeline.map(row => Math.max(row.correct, row.total - row.correct)));
    const hitPoints = timeline.map((row,index) => ({x:38 + index * 35, y:135 - row.correct / graphMax * 105, v:row.correct}));
    const missPoints = timeline.map((row,index) => ({x:38 + index * 35, y:135 - (row.total - row.correct) / graphMax * 105, v:row.total - row.correct}));
    const hitLine = hitPoints.map(point => `${point.x},${point.y}`).join(' ');
    const missLine = missPoints.map(point => `${point.x},${point.y}`).join(' ');
    const rowsHtml = [...byDisc.entries()].sort((a,b) => b[1].total - a[1].total).slice(0,12).map(([disc,data]) => {
      const pct = Math.round(data.correct / data.total * 100);
      return `<div style="display:grid;grid-template-columns:2fr 0.7fr 1.1fr 1fr;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(56,189,248,0.14);font-size:.82rem;">
        <div style="font-weight:700;">${caveiraMetricHtml(disc)}</div><div>${data.total}</div>
        <div>${data.correct}${isEdital ? '' : ' / ' + data.wrong}</div><div>${isEdital ? 'Concluídas' : pct + '%'}</div></div>`;
    }).join('') || `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:.83rem;">${scope.ready ? 'Sem registros válidos desta modalidade no período e portal selecionados.' : 'Aguarde o carregamento da conta atual.'}</div>`;

    const periods = [
      { d: 1, label: 'HOJE' },
      { d: 7, label: '7 DIAS' },
      { d: 15, label: '15 DIAS' },
      { d: 30, label: '30 DIAS' },
      { d: 90, label: 'TRÊS MESES' },
      { d: 180, label: 'SEIS MESES' },
      { d: 365, label: '1 ANO' },
      { d: 9999, label: 'TODO O HISTÓRICO' }
    ];

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
        <div>
          <div class="eyebrow" style="color:#65e7ff;">TELEMETRIA DE COMBATE · JORNADA DO CAÇADOR</div>
          <h3 style="margin:2px 0 0;font-size:1.15rem;text-transform:uppercase;letter-spacing:.04em;">📊 PAINEL TÁTICO</h3>
        </div>
        <div class="jcTacticalSegment">
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'questions' ? 'active' : ''}" data-tact-mode="questions">Questões</button>
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'flashcards' ? 'active' : ''}" data-tact-mode="flashcards">Flashcards</button>
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'edital' ? 'active' : ''}" data-tact-mode="edital">Turmas &amp; Edital</button>
        </div>
      </div>

      <div class="jcTacticalPeriodBar">
        ${periods.map(p => `<button type="button" class="jcTacticalPeriodBtn ${tacticalPeriodDays === p.d ? 'active' : ''}" data-tact-days="${p.d}">${p.label}</button>`).join('')}
      </div>

      <div class="jcCaveiraTwoCols">
        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
          <div style="font-size:.86rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">${caveiraMetricHtml(rightLabel)}${isEdital ? '' : ' × ' + caveiraMetricHtml(wrongLabel)}</div>
          <svg viewBox="0 0 390 165" style="width:100%;height:160px;overflow:visible;">
            <line x1="30" y1="30" x2="370" y2="30" stroke="rgba(56,189,248,0.16)" stroke-dasharray="3,3"/>
            <line x1="30" y1="82" x2="370" y2="82" stroke="rgba(56,189,248,0.16)" stroke-dasharray="3,3"/>
            <line x1="30" y1="135" x2="370" y2="135" stroke="rgba(56,189,248,0.35)"/>
            <polyline fill="none" stroke="#65e7ff" stroke-width="2.2" points="${hitLine}"/>
            <polyline fill="none" stroke="#f43f5e" stroke-width="2.2" points="${missLine}"/>
            ${hitPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#65e7ff"/>`).join('')}
            ${missPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#f43f5e"/>`).join('')}
          </svg>
          <div style="display:flex;justify-content:center;gap:18px;font-size:.76rem;font-weight:700;margin-top:6px;">
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#65e7ff;margin-right:5px;"></span>${caveiraMetricHtml(rightLabel)} (${totalRight})</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#f43f5e;margin-right:5px;"></span>${caveiraMetricHtml(wrongLabel)}${isEdital ? '' : ' (' + totalWrong + ')'}</span>
          </div>
        </div>

        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="font-size:.86rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">TOTAL DO PERÍODO</div>
          <div style="display:flex;align-items:center;justify-content:space-around;gap:16px;padding:12px 0;">
            <div style="text-align:center;">
              <div style="font-size:2.4rem;font-weight:900;color:#65e7ff;font-variant-numeric:tabular-nums;">${grandTotal}</div>
              <div style="font-size:.73rem;color:#94a3b8;text-transform:uppercase;">${caveiraMetricHtml(unitLabel)} · ${accPct === null ? 'sem amostra' : isEdital ? 'sem nota de domínio' : accPct + '% ' + caveiraMetricHtml(rateLabel)}</div>
            </div>
            <div style="display:grid;gap:8px;font-size:.82rem;font-weight:700;">
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#65e7ff;margin-right:6px;"></span>${caveiraMetricHtml(rightLabel)}: <b>${totalRight}</b></div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f43f5e;margin-right:6px;"></span>${caveiraMetricHtml(wrongLabel)}${isEdital ? '' : ': <b>' + totalWrong + '</b>'}</div>
            </div>
          </div>
          <div style="height:10px;border-radius:999px;background:rgba(244,63,94,0.28);overflow:hidden;">
            <div style="width:${accPct === null || isEdital ? 0 : accPct}%;height:100%;background:linear-gradient(90deg,#38bdf8,#65e7ff);"></div>
          </div>
        </div>
      </div>

      <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
        <div style="font-size:.88rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">ANÁLISE DE PERFORMANCE</div>
        <div style="display:grid;grid-template-columns:2fr 0.7fr 1.1fr 1fr;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(56,189,248,0.22);font-size:.75rem;color:#94a3b8;font-weight:800;text-transform:uppercase;">
          <div>Disciplina / Assunto</div>
          <div>Total</div>
          <div>${caveiraMetricHtml(rightLabel)}${isEdital ? '' : ' / ' + caveiraMetricHtml(wrongLabel)}</div>
          <div>${isEdital ? 'Registro' : 'Proporção'}</div>
        </div>
        ${rowsHtml}
        <p class="small muted" style="padding:10px 12px;margin:0;">${caveiraMetricHtml(sourceNote)}${snapshot.omitted ? ' ' + snapshot.omitted + ' registro(s) sem data, escopo ou estrutura válida ficaram fora do indicador.' : ''}</p>
      </div>
    `;

    sec.querySelectorAll('[data-tact-mode]').forEach((btn) => {
      btn.onclick = () => {
        tacticalTabMode = btn.getAttribute('data-tact-mode') || 'questions';
        mountPainelTaticoInProfile();
      };
    });
    sec.querySelectorAll('[data-tact-days]').forEach((btn) => {
      btn.onclick = () => {
        tacticalPeriodDays = Number(btn.getAttribute('data-tact-days') || 30);
        mountPainelTaticoInProfile();
      };
    });
  }

  // 4) Hub de Flashcards com Funil de 3 Chevrons na Paleta Oficial
  function mountCaveiraFlashcardsHub() {
    if (typeof document === 'undefined') return;
    const cardsPanel = document.getElementById('cards');
    if (!cardsPanel) return;

    ensureCaveiraMetricsHooks();
    const scope = caveiraMetricScope(), flash = caveiraMetricFlashcards(scope);
    const deck = flash.cards;
    let inReview = 0, shortMem = 0, longMem = 0;
    deck.forEach(({rating}) => {
      if (!rating) return;
      if (rating.level === 'easy') longMem++;
      else if (rating.level === 'medium') shortMem++;
      else inReview++;
    });
    const totalSolved = inReview + shortMem + longMem;
    const dueCount = deck.filter(({rating}) => !rating || rating.level === 'hard' || !Number.isFinite(Date.parse(rating.nextDue || '')) || Date.parse(rating.nextDue) <= Date.now()).length;

    let hub = document.getElementById('jcFlashcardsDashboardHub');
    if (!hub) {
      hub = document.createElement('div');
      hub.id = 'jcFlashcardsDashboardHub';
      cardsPanel.insertBefore(hub, cardsPanel.firstChild);
    }

    hub.innerHTML = `
      <div class="jcCaveiraTopCards">
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">📖 CONTINUAR MEUS FLASHCARDS</div>
            <div class="jcCaveiraActionSub">RETOME OS CARTÕES DO FILTRO ATUAL</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashFocusDeckBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">⚔️ TODOS OS FLASHCARDS</div>
            <div class="jcCaveiraActionSub">CARDS TÁTICOS DAS DISCIPLINAS DO EDITAL (${deck.length})</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashFilterAllBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">🔄 REVISÃO 1·7·30</div>
            <div class="jcCaveiraActionSub">CARTÕES NOVOS, VENCIDOS OU DIFÍCEIS (${dueCount} PARA REVISAR)</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashOpenReviewBtn">ACESSAR</button>
        </div>
      </div>

      <div class="jcCaveiraSectionTitle">📊 MEU DESEMPENHO — FLASHCARDS</div>
      <div class="jcCaveiraOverviewBox">
        <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:20px;align-items:center;">
          <div>
            <div style="font-size:.95rem;font-weight:800;text-transform:uppercase;">VISÃO GERAL</div>
            <div style="font-size:.74rem;color:#94a3b8;">Cartões distintos com avaliação registrada</div>
            <div class="jcCaveiraBigNumber">${totalSolved}</div>
            <div style="display:grid;gap:6px;font-size:.76rem;font-weight:700;">
              <div>🔹 <b>${inReview}</b> EM REVISÃO</div>
              <div>🔹 <b>${shortMem}</b> MARCADOS MÉDIOS</div>
              <div>🔹 <b>${longMem}</b> MARCADOS FÁCEIS</div>
            </div>
          </div>
          <div class="jcChevronStageWrap" aria-label="Última autoavaliação dos flashcards">
            <div class="jcChevronColumn stage1">
              <span class="jcChevronVertLabel">EM REVISÃO</span>
              <b>${inReview}</b>
            </div>
            <div class="jcChevronColumn stage2">
              <span class="jcChevronVertLabel">MÉDIOS</span>
              <b>${shortMem}</b>
            </div>
            <div class="jcChevronColumn stage3">
              <span class="jcChevronVertLabel">FÁCEIS</span>
              <b>${longMem}</b>
            </div>
          </div>
        </div>
        <p class="small muted" style="margin:10px 0 0;">${scope.ready ? 'Última autoavaliação dos cartões deste portal; fácil, médio e difícil não comprovam retenção.' : 'Aguarde o carregamento da conta atual.'}${flash.unscoped ? ' ' + flash.unscoped + ' avaliação(ões) antiga(s) sem escopo compatível não foram atribuídas a este portal.' : ''}</p>
      </div>
    `;

    const focusBtn = document.getElementById('jcFlashFocusDeckBtn');
    const allBtn = document.getElementById('jcFlashFilterAllBtn');
    const revBtn = document.getElementById('jcFlashOpenReviewBtn');
    const scrollCard = () => {
      const fc = document.getElementById('flashcard');
      if (fc && fc.scrollIntoView) fc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    if (focusBtn) focusBtn.onclick = scrollCard;
    if (allBtn) {
      allBtn.onclick = () => {
        const cf = document.getElementById('cardFilter');
        const due = document.getElementById('flashDueOnlyToggle');
        if (due) { due.checked = false; due.dispatchEvent(new Event('change')); }
        if (cf) { cf.value = 'all'; cf.dispatchEvent(new Event('change')); }
        scrollCard();
      };
    }
    if (revBtn) {
      revBtn.onclick = () => {
        const due = document.getElementById('flashDueOnlyToggle');
        if (!due) { if (typeof window.toast === 'function') window.toast('O filtro de revisão ainda está carregando. Tente novamente.'); return; }
        due.checked = true;
        due.dispatchEvent(new Event('change'));
        scrollCard();
      };
    }
  }

  // 5) Central de Leis & Textos (seleções e trechos externos identificados)
  let lawsFilterFavOnly = false;
  let lawsSearchQuery = '';
  let activeLawModalItem = null;
  let activeLawExternalLoading = false;

  function switchStudySubtab(targetSubtab) {
    if (typeof document === 'undefined') return;
    const studySec = document.getElementById('study');
    if (!studySec) return;
    studySec.querySelectorAll('.studyTab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-study') === targetSubtab);
    });
    studySec.querySelectorAll('.studyPanel').forEach(p => {
      p.classList.toggle('active', p.id === targetSubtab);
    });
    if (targetSubtab === 'notebook' && typeof window.setupCanvasNotebook === 'function') {
      try { window.setupCanvasNotebook(); } catch (_e) {}
    }
    if (targetSubtab === 'smart' && typeof window.renderSmartNotebookPanel === 'function') {
      window.renderSmartNotebookPanel();
    }
    if (targetSubtab === 'laws') {
      renderSmartLawsPanelContent(document.getElementById('laws'));
    }
  }

  function mountCaveiraSmartLawsHub() {
    if (typeof document === 'undefined') return;
    const studySec = document.getElementById('study');
    if (!studySec) return;
    applyLawUiScope();
    document.getElementById('openManuaisCacadorBtn')?.remove();
    document.getElementById('jcQuickOpenLawsFromSummariesBtn')?.remove();
    const tabsWrap = studySec.querySelector('.studyTabs');
    if (tabsWrap) {
      tabsWrap.classList.add('smartEnabled');
      if (!document.getElementById('jcStudyLawsTabBtn')) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'studyTab'; btn.id = 'jcStudyLawsTabBtn';
        btn.setAttribute('data-study', 'laws'); btn.textContent = '⚖️ Leis & Textos'; tabsWrap.appendChild(btn);
      }
      if (!tabsWrap._jcUnifiedTabsBound) {
        tabsWrap._jcUnifiedTabsBound = true;
        tabsWrap.addEventListener('click', ev => {
          const button = ev.target?.closest?.('.studyTab[data-study]');
          if (button) switchStudySubtab(button.getAttribute('data-study'));
        });
      }
    }
    let panel = document.getElementById('laws');
    if (!panel) { panel = document.createElement('div'); panel.className = 'studyPanel'; panel.id = 'laws'; studySec.appendChild(panel); }
    renderSmartLawsPanelContent(panel);
    loadLawsFromUserDatabase(false);
  }
  function openSmartLawsSubtab() {
    if (typeof document === 'undefined') return;
    mountCaveiraSmartLawsHub(); switchStudySubtab('laws');
  }
  if (typeof window !== 'undefined') window.openSmartLawsSubtab = openSmartLawsSubtab;

  function renderSmartLawsPanelContent(lawsPanel) {
    if (typeof document === 'undefined') return;
    lawsPanel = lawsPanel || document.getElementById('laws');
    if (!lawsPanel) return;
    const scope = applyLawUiScope(), allLaws = getAllLawsCombined();
    const favs = new Set(getFavLaws()), openMap = getLawsFoldersOpenState();
    const qNorm = String(lawsSearchQuery || '').trim().toLowerCase();
    const grouped = new Map();
    for (const law of allLaws) {
      if (lawsFilterFavOnly && !favs.has(law.id)) continue;
      if (qNorm && !`${law.discipline} ${law.title} ${law.articles.join(' ')}`.toLowerCase().includes(qNorm)) continue;
      if (!grouped.has(law.discipline)) grouped.set(law.discipline, []);
      grouped.get(law.discipline).push(law);
    }
    const groupsHtml = [...grouped].map(([disc, items]) => {
      const discKey = disc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
      const isOpen = Boolean(openMap[discKey] === true || qNorm.length > 0);
      const rows = isOpen ? items.map(law => `<div class="jcLawRowItem"><div style="display:flex;gap:10px;align-items:center"><button type="button" class="ghost small" data-law-fav="${lawEscape(law.id)}" title="Favoritar seleção">${favs.has(law.id) ? '⭐' : '☆'}</button><div><strong>${lawEscape(law.title)}</strong><div class="small muted">${lawEscape(law.sourceName)} · ${lawEscape(law.badge)}</div></div></div><button type="button" class="jcLawStartBtn" data-law-open="${lawEscape(law.id)}">📖 Ler seleção</button></div>`).join('') : '';
      return `<section class="libraryFolder ${isOpen ? 'open' : ''}" data-law-folder="${lawEscape(discKey)}"><button type="button" class="folderHead" data-law-folder-toggle="${lawEscape(discKey)}" aria-expanded="${isOpen}"><span>▤ ${lawEscape(disc)}</span><span class="tag">${items.length} seleções</span></button><div class="folderBody" style="display:${isOpen ? 'block' : 'none'}">${rows}</div></section>`;
    }).join('') || '<div class="empty">Nenhuma seleção encontrada neste filtro.</div>';
    lawsPanel.innerHTML = `<div class="jcCaveiraOverviewBox" style="padding:14px 16px;margin-bottom:14px"><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between"><div><button type="button" class="ghost small ${!lawsFilterFavOnly ? 'active' : ''}" id="jcLawsTabAllBtn">📋 Todas (${allLaws.length})</button><button type="button" class="ghost small ${lawsFilterFavOnly ? 'active' : ''}" id="jcLawsTabFavBtn">⭐ Favoritos (${favs.size})</button></div><button type="button" class="ghost small" id="jcSyncAllLawsToDbBtn">💾 Salvar acervo</button></div><p class="small muted">As seleções locais não são edições integrais revisadas. Você pode importar documentos de fontes oficiais; confira a versão e a vigência na referência.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><label for="jcOfficialLawSelect">Documento oficial</label><select id="jcOfficialLawSelect" style="min-width:160px;flex:1">${OFFICIAL_LAW_IMPORTS.map(item=>`<option value="${lawEscape(item.id)}">${lawEscape(item.title)}</option>`).join('')}</select><button type="button" class="ghost small" id="jcImportOfficialLawBtn">Importar documento</button><button type="button" class="ghost small" id="jcImportAllOfficialLawsBtn">Importar catálogo (13)</button></div><p class="small" role="status">${lawEscape(lawsSyncMessage)}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="search" id="jcLawsSearchInput" value="${lawEscape(lawsSearchQuery)}" placeholder="Buscar lei ou dispositivo..." style="min-width:160px;flex:1"><button type="button" class="jcCaveiraActionBtn" id="jcImportExternalLawBtn">🌐 Buscar trecho externo</button></div></div>${activeLawModalItem ? renderActiveLawReaderHtml(activeLawModalItem) : ''}<div class="libraryFolders" id="jcLawsAccordionContainer">${groupsHtml}</div>`;
    const find = id => lawsPanel.querySelector?.(`#${id}`) || document.getElementById(id);
    const redraw = () => { if (lawScopeCurrent(scope)) renderSmartLawsPanelContent(lawsPanel); };
    const bind = (id, fn) => { const el = find(id); if (el) el.onclick = fn; };
    bind('jcLawsTabAllBtn', () => { lawsFilterFavOnly = false; redraw(); });
    bind('jcLawsTabFavBtn', () => { lawsFilterFavOnly = true; redraw(); });
    bind('jcSyncAllLawsToDbBtn', async () => { if(!lawScopeCurrent(scope))return;await syncAllLawsToUserDatabase(true); redraw(); });
    bind('jcSaveSingleLawToDbBtn', async () => { if(!lawScopeCurrent(scope))return;await syncAllLawsToUserDatabase(true, activeLawModalItem?.id); redraw(); });
    const importAndShow=async id=>{
      if(!lawScopeCurrent(scope))return;
      lawsSyncMessage='Consultando o documento na fonte oficial...';redraw();
      const result=await importOfficialLawToLibrary(id);
      if(!lawScopeCurrent(scope))return;
      if(result.law){activeLawModalItem=result.law;lawReaderPage=0;}
      else if(result.error)lawsSyncMessage=result.error;
      redraw();
    };
    bind('jcImportOfficialLawBtn',()=>importAndShow(find('jcOfficialLawSelect')?.value||'cf88'));
    bind('jcImportAllOfficialLawsBtn',async()=>{if(!lawScopeCurrent(scope))return;await importAllOfficialLaws();redraw();});
    lawsPanel.querySelectorAll('[data-law-import-official]').forEach(btn=>{btn.onclick=()=>importAndShow(btn.getAttribute('data-law-import-official'));});
    bind('jcLawReaderPrevBtn',()=>{if(!lawScopeCurrent(scope))return;lawReaderPage=Math.max(0,lawReaderPage-1);redraw();});
    bind('jcLawReaderNextBtn',()=>{if(!lawScopeCurrent(scope))return;lawReaderPage++;redraw();});
    const search = find('jcLawsSearchInput');
    if (search) search.oninput = () => {
      const pos = search.selectionStart; lawsSearchQuery = search.value; redraw();
      const next = find('jcLawsSearchInput'); next?.focus?.(); try { next?.setSelectionRange?.(pos, pos); } catch (_e) {}
    };
    bind('jcImportExternalLawBtn', async () => {
      const query = String(find('jcLawsSearchInput')?.value || (typeof prompt === 'function' ? prompt('Informe a lei ou o texto que deseja consultar em fonte externa:') || '' : '')).trim();
      if (!query || !lawScopeCurrent(scope)) return;
      lawsSyncMessage = 'Consultando fonte externa...'; redraw();
      const imported = await searchAndImportExternalLawOrText(query, 'Legislação Extravagante');
      if (!lawScopeCurrent(scope)) return;
      if (imported) {
        activeLawModalItem = imported;
        lawsSyncMessage = imported.localSaved ? 'Trecho externo importado e salvo neste aparelho; confira a fonte.' : 'Trecho externo disponível nesta sessão; a cópia local não pôde ser gravada.';
      } else lawsSyncMessage = 'Não foi possível consultar a fonte externa. Tente novamente.';
      redraw();
    });
    lawsPanel.querySelectorAll('[data-law-folder-toggle]').forEach(btn => { btn.onclick = () => {
      if (!lawScopeCurrent(scope)) return;
      const key = btn.getAttribute('data-law-folder-toggle');
      if (!setLawsFolderOpenState(key, !getLawsFoldersOpenState()[key])) lawsSyncMessage = 'Não foi possível salvar a preferência neste aparelho.';
      redraw();
    }; });
    lawsPanel.querySelectorAll('[data-law-fav]').forEach(btn => { btn.onclick = () => {
      if (!lawScopeCurrent(scope)) return;
      const id = btn.getAttribute('data-law-fav'), current = new Set(getFavLaws());
      if (current.has(id)) current.delete(id); else current.add(id);
      if (!setFavLaws([...current])) lawsSyncMessage = 'Não foi possível salvar o favorito neste aparelho.';
      redraw();
    }; });
    lawsPanel.querySelectorAll('[data-law-open]').forEach(btn => { btn.onclick = () => {
      if (!lawScopeCurrent(scope)) return;
      activeLawModalItem = getAllLawsCombined().find(law => law.id === btn.getAttribute('data-law-open')) || null;
      activeLawExternalLoading = false; lawReaderPage=0; redraw();
    }; });
    bind('jcCloseLawReaderBtn', () => { if(!lawScopeCurrent(scope))return;activeLawModalItem = null; activeLawExternalLoading = false; redraw(); });
    bind('jcFetchLawComplementBtn', async () => {
      const item = activeLawModalItem;
      if (!item || !lawScopeCurrent(scope) || activeLawExternalLoading) return;
      activeLawExternalLoading = true; redraw();
      try {
        const result = await fetchExternalCompleteLawText(item);
        if (!lawScopeCurrent(scope)) return;
        lawsSyncMessage = result ? (result.localSaved ? 'Trecho complementar salvo neste aparelho; confira a fonte.' : 'Trecho complementar disponível nesta sessão; não foi possível gravá-lo no aparelho.') : 'A fonte externa não retornou um trecho disponível. Tente novamente.';
      } finally {
        if (lawScopeCurrent(scope)) { activeLawExternalLoading = false; redraw(); }
      }
    });
    lawsPanel.querySelectorAll('[data-law-highlight]').forEach(btn => { btn.onclick = () => { if (lawScopeCurrent(scope)) { toggleHighlightArticle(btn.getAttribute('data-law-highlight')); redraw(); } }; });
    bind('jcInvokeLawAiBtn', () => {
      const item = activeLawModalItem;
      if (!item || !lawScopeCurrent(scope)) return;
      if (typeof window.openView === 'function') window.openView('assistant');
      const input = document.getElementById('aiQuestion');
      if (input) { input.value = `Crie questões autorais sobre a seleção "${item.title}". Identifique sugestões de gabarito e cite os dispositivos utilizados; não as apresente como questões oficiais.`; input.focus(); }
    });
  }

  function renderActiveLawReaderHtml(value) {
    const law = materializeLaw(value);
    if (!law) return '<div class="empty">Seleção indisponível.</div>';
    const highlights=getHighlightedArticles(), url=safeLawUrl(law.sourceUrl), extUrl=safeLawUrl(law.external?.sourceUrl);
    const totalPages=Math.max(1,Math.ceil(law.articles.length/LAW_READER_PAGE_SIZE));
    lawReaderPage=Math.min(totalPages-1,Math.max(0,Math.floor(Number(lawReaderPage)||0)));
    const first=lawReaderPage*LAW_READER_PAGE_SIZE, visible=law.articles.slice(first,first+LAW_READER_PAGE_SIZE);
    const officialActions=officialLawIdsFor(law).map(id=>`<button type="button" class="ghost small" data-law-import-official="${lawEscape(id)}">${law.full_document?'Atualizar':'Importar'} ${lawEscape(OFFICIAL_LAW_IMPORTS.find(item=>item.id===id)?.title||id)} da fonte oficial</button>`).join('');
    const paragraphs=visible.map((article,offset)=>{
      const key=`${law.id}:${first+offset}`, highlighted=!!highlights[key];
      return `<div style="padding:12px;border-radius:10px;border:1px solid ${highlighted?'#eab308':'rgba(56,189,248,.2)'};background:${highlighted?'rgba(234,179,8,.16)':'rgba(8,19,34,.75)'};display:flex;gap:12px"><p style="margin:0;line-height:1.58;flex:1;white-space:pre-wrap">${lawEscape(article)}</p><button type="button" class="ghost small" data-law-highlight="${lawEscape(key)}">${highlighted?'🖍️ Grifado':'🖍️ Grifar'}</button></div>`;
    }).join('');
    return `<div class="jcCaveiraOverviewBox" id="jcActiveLawReaderBox" style="border:1.5px solid #65e7ff;margin-bottom:18px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between"><div><span class="tag">${lawEscape(law.discipline)} · ${lawEscape(law.badge)}</span><h3>${lawEscape(law.title)}</h3></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="ghost small" id="jcSaveSingleLawToDbBtn">💾 Salvar texto</button><button type="button" class="action small" id="jcInvokeLawAiBtn">🧙‍♂️ Invocar questões</button><button type="button" class="ghost small" id="jcCloseLawReaderBtn">✕ Fechar leitura</button></div></div>
      <p class="small muted">${lawEscape(law.coverage)} Versão: ${lawEscape(law.sourceVersion)}.</p>
      ${law.sourceWarnings?.length?`<p class="small">${law.sourceWarnings.map(lawEscape).join(' ')}</p>`:''}
      <p class="small">${lawEscape(law.sourceName)} ${url?`<a href="${lawEscape(url)}" target="_blank" rel="noopener noreferrer">Consultar referência</a>`:'· referência documental não informada'}${law.external?`<br>${lawEscape(law.external.source)} · ${lawEscape(law.external.fetchedAt)}${law.external.truncated?' · trecho limitado':''}${extUrl?` · <a href="${lawEscape(extUrl)}" target="_blank" rel="noopener noreferrer">Consultar fonte complementar</a>`:''}`:''}</p>
      ${law.full_document?`<p class="small" style="overflow-wrap:anywhere">Recuperado em: ${lawEscape(law.fetchedAt)} · SHA-256: ${lawEscape(law.content_hash)}</p>`:''}
      ${law.contentTruncated?'<p class="small">Conteúdo limitado ao trecho importado.</p>':''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${officialActions}${!law.full_document?`<button type="button" class="ghost small" id="jcFetchLawComplementBtn" ${activeLawExternalLoading?'disabled':''}>${activeLawExternalLoading?'Consultando fonte...':'Consultar complemento externo'}</button>`:''}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px"><button type="button" class="ghost small" id="jcLawReaderPrevBtn" ${lawReaderPage===0?'disabled':''}>Anterior</button><span role="status">Página ${lawReaderPage+1}/${totalPages} · blocos ${first+1}–${Math.min(first+LAW_READER_PAGE_SIZE,law.articles.length)} de ${law.articles.length}</span><button type="button" class="ghost small" id="jcLawReaderNextBtn" ${lawReaderPage===totalPages-1?'disabled':''}>Próxima</button></div>
      <div style="display:grid;gap:10px;max-height:540px;overflow-y:auto;margin-top:12px">${paragraphs}</div></div>`;
  }

  // 6) Pílulas Rápidas de Status na Aba Questões + Barra Inferior da Questão com Invocador
  function mountCaveiraQuestionBankEnhancements() {
    if (typeof document === 'undefined') return;
    const notify = message => { if (typeof window.toast === 'function') window.toast(message); };
    const getBattle = () => {
      try { if (typeof activeQuestions === 'object' && activeQuestions) return activeQuestions; } catch (_e) {}
      return window.activeQuestions || null;
    };
    const scopeKey = () => {
      const st = getAppStateSafe();
      let session;
      try { if (typeof cloudSession !== 'undefined') session = cloudSession; } catch (_e) {}
      const userId = session?.user?.id || st._ownerUserId || 'guest';
      if ((session?.user?.id && st._ownerUserId !== userId) || (!session?.user?.id && st._ownerUserId)) return null;
      return JSON.stringify([userId, st.activeCampaignId || '', Number(st._resetEpoch || 0)]);
    };
    const captureContext = () => {
      const battle = getBattle(), item = battle?.questions?.[battle.current], scope = scopeKey();
      return battle && item && scope ? { battle, item, scope, index: battle.current } : null;
    };
    const shown = window.showQuestion;
    if (typeof shown === 'function' && !shown._jcQuestionActionsHooked) {
      const wrapped = function(...args) {
        const result = shown.apply(this, args);
        window._jcQuestionActionContext = captureContext();
        mountCaveiraQuestionBankEnhancements();
        return result;
      };
      wrapped._jcQuestionActionsHooked = true;
      window.showQuestion = wrapped;
    }
    const currentQuestion = () => {
      const captured = window._jcQuestionActionContext, current = captureContext();
      const dialog = document.getElementById('questionDialog');
      return captured && current && dialog?.open && captured.scope === current.scope && captured.battle === current.battle && captured.item === current.item && captured.index === current.index ? current : null;
    };
    const pauseForNavigation = () => {
      if (typeof window.saveActiveQuestionSession !== 'function' || !window.saveActiveQuestionSession()) {
        notify('Não foi possível salvar o treino. Libere espaço antes de sair para outro conteúdo.');
        return false;
      }
      document.getElementById('questionDialog')?.close();
      try { if (typeof activeQuestions !== 'undefined') activeQuestions = null; } catch (_e) {}
      window.activeQuestions = null;
      window._jcQuestionActionContext = null;
      window.checkAndOfferSavedQuestionSessionResume?.();
      return true;
    };
    const reportSec = document.getElementById('report');
    if (reportSec && !document.getElementById('jcCaveiraQuestionStatusPills')) {
      const trainer = reportSec.querySelector('.questionTrainer') || reportSec.querySelector('.card');
      const filtersWrap = reportSec.querySelector('.questionFilters');
      if (trainer && filtersWrap) {
        const pillsBar = document.createElement('div');
        pillsBar.id = 'jcCaveiraQuestionStatusPills';
        pillsBar.className = 'jcQuestionStatusPills';
        pillsBar.innerHTML = `
          <button type="button" class="jcQStatusPill active" data-q-status-pill="all">Todas</button>
          <button type="button" class="jcQStatusPill" data-q-status-pill="solved">Resolvidas</button>
          <button type="button" class="jcQStatusPill" data-q-status-pill="unsolved">Não resolvidas</button>
          <button type="button" class="jcQStatusPill" data-q-status-pill="right">Acertei</button>
          <button type="button" class="jcQStatusPill" data-q-status-pill="wrong">Errei</button>
        `;
        filtersWrap.parentElement.insertBefore(pillsBar, filtersWrap);
        pillsBar.querySelectorAll('[data-q-status-pill]').forEach(btn => {
          btn.onclick = () => {
            const status = btn.getAttribute('data-q-status-pill');
            const histSel = document.getElementById('questionHistoryFilter');
            const mapVal = { all: 'all', solved: 'answered', unsolved: 'unanswered', right: 'correct', wrong: 'wrong' };
            if (!histSel || !mapVal[status] || ![...histSel.options].some(option => option.value === mapVal[status])) { notify('O filtro de questões ainda está carregando. Tente novamente.'); return; }
            histSel.value = mapVal[status];
            histSel.dispatchEvent(new Event('change'));
            pillsBar.querySelectorAll('[data-q-status-pill]').forEach(button => button.classList.toggle('active', button === btn));
          };
        });
      }
    }
    const statusBar = document.getElementById('jcCaveiraQuestionStatusPills'), history = document.getElementById('questionHistoryFilter');
    if (statusBar && history) {
      const syncPills = () => {
        const selected = { all:'all', answered:'solved', unanswered:'unsolved', correct:'right', wrong:'wrong' }[history.value];
        statusBar.querySelectorAll('[data-q-status-pill]').forEach(button => button.classList.toggle('active', button.getAttribute('data-q-status-pill') === selected));
      };
      if (!history._jcPillsBound) { history._jcPillsBound = true; history.addEventListener('change', syncPills); }
      syncPills();
    }
    const qDialog = document.getElementById('questionDialog');
    const qBox = qDialog ? qDialog.querySelector('.questionBox') || qDialog.querySelector('.modernQuestionBox') : null;
    const qFeedback = document.getElementById('questionFeedback');
    if (qBox && qFeedback && !document.getElementById('jcCaveiraQuestionToolbar')) {
      const bar = document.createElement('div');
      bar.id = 'jcCaveiraQuestionToolbar';
      bar.className = 'jcQuestionCaveiraFooter';
      bar.innerHTML = `
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarInvocadorBtn" title="Abrir o Invocador com a questão atual">🧙‍♂️ INVOCADOR</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarProfCommentBtn" title="Ver o comentário e a origem informada da questão">💬 COMENTÁRIO DA QUESTÃO</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarTheoryBtn" title="Ler a teoria da disciplina e do assunto desta questão">📖 TEORIA &amp; LEI</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarNotebookBtn" title="Abrir suas anotações e questões salvas">📓 CADERNOS</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarNotesBtn" title="Salvar a questão atual nas suas anotações">✏️ ANOTAÇÕES</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarStatsBtn" title="Ver seu histórico registrado nesta questão">📈 MEU HISTÓRICO</button>
      `;
      qBox.insertBefore(bar, qFeedback);
      document.getElementById('jcQBarInvocadorBtn').onclick = () => {
        if (!currentQuestion()) return notify('Abra uma questão da conta e do portal atuais.');
        const qap = document.getElementById('askQapInstructorBtn');
        if (!qap) return notify('Responda a questão para abrir o Invocador com a análise do gabarito.');
        if (pauseForNavigation()) qap.click();
      };
      document.getElementById('jcQBarProfCommentBtn').onclick = () => {
        if (!currentQuestion()) return notify('Abra uma questão da conta e do portal atuais.');
        const feedback = document.getElementById('questionFeedback');
        if (feedback?.textContent?.trim()) feedback.scrollIntoView({ behavior:'smooth', block:'nearest' });
        else notify('Responda a questão para revelar o comentário do material e a situação do gabarito.');
      };
      document.getElementById('jcQBarTheoryBtn').onclick = () => {
        const context = currentQuestion();
        if (!context) return notify('Abra uma questão da conta e do portal atuais.');
        if (typeof window.openTheoryForSubjectAndTopic !== 'function') return notify('A teoria ainda está carregando. Tente novamente.');
        const {subject,topic} = context.item;
        if (pauseForNavigation()) window.openTheoryForSubjectAndTopic(subject,topic || '');
      };
      document.getElementById('jcQBarNotebookBtn').onclick = () => {
        if (!currentQuestion()) return notify('Abra uma questão da conta e do portal atuais.');
        if (typeof window.switchStudySubtab !== 'function' || typeof window.openView !== 'function') return notify('O caderno ainda está carregando. Tente novamente.');
        if (pauseForNavigation()) { window.openView('study'); window.switchStudySubtab('notes'); }
      };
      document.getElementById('jcQBarNotesBtn').onclick = () => {
        const context = currentQuestion();
        if (!context) return notify('Abra uma questão da conta e do portal atuais.');
        if (typeof window.saveCurrentQuestionToNotes !== 'function') return notify('As anotações ainda estão carregando. Tente novamente.');
        window.saveCurrentQuestionToNotes(context.item);
      };
      document.getElementById('jcQBarStatsBtn').onclick = () => {
        if (!currentQuestion()) return notify('Abra uma questão da conta e do portal atuais.');
        const stats = document.getElementById('questionFeedback')?.querySelector('.communityOptionStatsBar');
        if (stats) stats.scrollIntoView({ behavior:'smooth',block:'center' });
        else notify('Responda a questão para consultar seu histórico local de alternativas. Ausência de registros não é uma estatística da comunidade.');
      };
    }
    const qapBtn = document.getElementById('askQapInstructorBtn');
    if (qapBtn && !qapBtn.textContent.includes('Invocador')) qapBtn.textContent = '🧙‍♂️ Invocador';
  }


  // ==========================================================================
  // r182: salvamento confirmado das seleções por conta e carregamento protegido.
  // A conferência das questões abaixo não altera conteúdo ou comprova revisão factual.
  // ==========================================================================
  async function syncAllLawsToUserDatabase(showToast = true, lawId = null) {
    const scope = lawScope(), session = lawSession();
    if (!scope.ready) return {status: 'cancelled', total: 0, localSaved: false, cloudSaved: 0};
    if (typeof indexedDB !== 'undefined') await loadLawLocalLibrary(scope);
    if (!lawScopeCurrent(scope)) return {status: 'cancelled', total: 0, localSaved: false, cloudSaved: 0};
    const mem = getLawMemory(scope);
    if (mem.syncing) return {status: 'busy', total: 0, localSaved: false, cloudSaved: 0};
    const selected = getAllLawsCombined().filter(law => !lawId || law.id === lawId).map(materializeLaw).filter(Boolean);
    if (!selected.length) return {status: 'empty', total: 0, localSaved: false, cloudSaved: 0};
    mem.syncing = true;
    let cloudSaved = 0, localSaved = false, cloudError = '';
    const merged = new Map([...mem.laws, ...selected].map(law => [law.id, law]));
    mem.laws = [...merged.values()]; mem.pending = true; mem.revision++;
    const revision = mem.revision;
    localSaved = await persistLawLibrary(scope);
    if (!lawScopeCurrent(scope)) { mem.syncing=false; return {status:'cancelled',total:selected.length,localSaved:false,cloudSaved:0}; }
    try {
      if (scope.userId !== 'guest' && session?.access_token && typeof cloudFetch === 'function' && (typeof navigator === 'undefined' || navigator.onLine)) {
        const rows = selected.map(law => ({
          id: law.id, user_id: scope.userId, discipline: law.discipline, title: law.title,
          badge: law.badge, source_name: law.sourceName, source_url: law.sourceUrl,
          source_version: law.sourceVersion, content_kind: law.content_kind,
          metadata: {coverage: law.coverage, fetchedAt: law.fetchedAt, external: law.external, contentTruncated: law.contentTruncated, wikisourceTitle: law.wikisourceTitle, wikipediaTitle: law.wikipediaTitle, law_id:law.law_id, full_document:law.full_document, content_hash:law.content_hash, sourceWarnings:law.sourceWarnings},
          articles: law.articles, is_public: law.is_public, updated_at: new Date().toISOString()
        }));
        const response = await cloudFetch('study_laws_bank?on_conflict=user_id,id', {
          method: 'POST', headers: {...(typeof authHeaders === 'function' ? authHeaders(session.access_token) : {Authorization: `Bearer ${session.access_token}`}), Prefer: 'resolution=merge-duplicates,return=minimal'}, body: JSON.stringify(rows)
        });
        if (!lawScopeCurrent(scope)) return {status: 'cancelled', total: selected.length, localSaved, cloudSaved: 0};
        if (!response?.ok) throw new Error('A gravação na conta não foi confirmada.');
        cloudSaved = rows.length;
        if (mem.revision === revision) {
          mem.pending = false;
          const confirmedIds = new Set(rows.map(row => row.id));
          mem.custom = mem.custom.filter(law => !confirmedIds.has(law.id));
          writeLawStore(LAWS_CUSTOM_IMPORTED_KEY, mem.custom, scope);
          localSaved = await persistLawLibrary(scope) || localSaved;
        }
      }
    } catch (_e) {
      if (!lawScopeCurrent(scope)) return {status: 'cancelled', total: selected.length, localSaved, cloudSaved: 0};
      cloudError = 'Confira a conexão e se a migração v109 foi aplicada.';
    } finally { mem.syncing = false; }
    if (!lawScopeCurrent(scope)) return {status: 'cancelled', total: selected.length, localSaved, cloudSaved};
    const status = cloudSaved ? (localSaved ? 'synced' : 'cloud_only') : localSaved ? 'local_pending' : 'failed';
    lawsSyncMessage = status === 'synced' ? `${cloudSaved} seleções salvas na conta e neste aparelho.`
      : status === 'cloud_only' ? `${cloudSaved} seleções salvas na conta; a cópia local não pôde ser gravada.`
      : status === 'local_pending' ? `${selected.length} seleções salvas neste aparelho; sincronização pendente. ${cloudError}`
      : `Não foi possível salvar as seleções. Confira o espaço disponível e a conexão. ${cloudError}`;
    if (showToast && typeof window.toast === 'function') window.toast(lawsSyncMessage);
    return {status, total: selected.length, cloudSaved, localSaved, pending: !cloudSaved};
  }
  if (typeof window !== 'undefined') {
    window.syncAllLawsToUserDatabase = syncAllLawsToUserDatabase;
    window.loadLawsFromUserDatabase = loadLawsFromUserDatabase;
  }

  // Conferência estrutural e de metadados. Não altera questões nem comprova a verdade do conteúdo.
  // O nome público anterior permanece para compatibilidade com os atalhos existentes.
  function auditAndEnrichAllQuestionsPedagogy(questionsList) {
    const list = Array.isArray(questionsList)
      ? questionsList
      : (typeof ALL_QUESTIONS !== 'undefined' && Array.isArray(ALL_QUESTIONS)
        ? ALL_QUESTIONS : (typeof window !== 'undefined' && Array.isArray(window.ALL_QUESTIONS) ? window.ALL_QUESTIONS : []));
    const report = {
      total: list.length, structurallyValidCount: 0, validCount: 0, readyCount: 0,
      pendingKeyCount: 0, suggestedKeyCount: 0, annulledCount: 0,
      invalidStructureCount: 0, excludedManualCount: 0,
      classificationReviewCount: 0, missingExplanationCount: 0,
      explanationReviewCount: 0, issueCount: 0, questionIssueCount: 0,
      // A conferência é somente leitura: nenhum conteúdo é enriquecido ou corrigido automaticamente.
      enrichedCount: 0, fixedSubjectCount: 0, fixedTopicCount: 0,
      issues: [], issuesTruncated: false,
      scope: 'structural_metadata', factualReviewVerified: false,
      label: 'Conferência estrutural e de metadados — revisão factual não comprovada'
    };
    const normalize = value => String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const optionText = value => (typeof value === 'string' || typeof value === 'number')
      ? normalize(value).replace(/^(?:\(?[A-E]\)|[A-E][.)])\s*/i, '').toLocaleLowerCase('pt-BR') : '';
    const genericSubject = value => typeof value !== 'string' || !normalize(value) || /^(?:simulado|prova|quest[oõ]es|caderno|conte[uú]do geral)(?:\b|\s)/i.test(normalize(value));
    const genericTopic = value => typeof value !== 'string' || !normalize(value) || /^(?:quest[aã]o\s*\d+|item\s*\d+|geral|simulado.*|conte[uú]do geral)$/i.test(normalize(value));
    const isManual = item => {
      if (typeof window !== 'undefined' && typeof window.isPlatformManualStudyArtifact === 'function') return Boolean(window.isPlatformManualStudyArtifact(item));
      return /manuais do ca[cç]ador/i.test([item?.subject, item?.category, item?.title].join(' '));
    };
    for (let index = 0; index < list.length; index++) {
      const item = list[index], problems = [];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        report.invalidStructureCount++;
        problems.push('invalid_question');
      } else if (isManual(item)) {
        report.excludedManualCount++;
        problems.push('platform_manual');
      } else {
        const options = Array.isArray(item.options) ? item.options : [];
        const normalizedOptions = options.map(optionText);
        const validStructure = typeof item.statement === 'string' && Boolean(normalize(item.statement)) && options.length >= 2 && options.length <= 5 &&
          normalizedOptions.every(Boolean) && new Set(normalizedOptions).size === options.length;
        if (validStructure) report.structurallyValidCount++;
        else { report.invalidStructureCount++; problems.push('invalid_structure'); }

        const raw = item.correct_index;
        const validIndex = (typeof raw === 'number' || typeof raw === 'string') && normalize(raw) !== '' &&
          Number.isInteger(Number(raw)) && Number(raw) >= 0 && Number(raw) < options.length;
        const manuallyReviewed = item.key_source === 'manual_revisado' && item.answer_key_validation === 'revisado';
        const suggested = !manuallyReviewed && ((item.key_source === 'ia_sugerido' && item.answer_key_validation !== 'revisado') ||
          /^\s*(?:🤖\s*)?\[?Gabarito sugerido (?:pela|por) IA\b/i.test(String(item.explanation || '')));
        const annulled = Boolean(item.annulled || item.anulada);
        const usableKey = validStructure && validIndex && !item.answer_unknown && !suggested && !annulled;
        if (annulled) { report.annulledCount++; problems.push('annulled'); }
        else if (validStructure && !usableKey) { report.pendingKeyCount++; problems.push('pending_answer_key'); }
        if (suggested) { report.suggestedKeyCount++; problems.push('suggested_answer_key'); }
        if (usableKey) report.validCount++;

        const needsClassification = genericSubject(item.subject) || genericTopic(item.topic) || item.classification_needs_review === true;
        if (needsClassification) { report.classificationReviewCount++; problems.push('classification_review'); }
        const missingExplanation = !normalize(item.explanation || item.comment);
        if (missingExplanation) { report.missingExplanationCount++; problems.push('missing_explanation'); }
        const explanationReview = item.explanation_needs_review === true;
        if (explanationReview) { report.explanationReviewCount++; problems.push('explanation_review'); }
        if (usableKey && !needsClassification && !missingExplanation && !explanationReview) report.readyCount++;
      }
      if (problems.length) {
        report.issueCount += problems.length;
        report.questionIssueCount++;
        if (report.issues.length < 200) report.issues.push({ index, questionId: normalize(item?.id).slice(0, 160), problems });
        else report.issuesTruncated = true;
      }
    }
    report.structurallyReadyPct = list.length ? Math.round(report.readyCount * 10000 / list.length) / 100 : 0;
    // Compatibilidade: porcentagem de estrutura/metadados completos, nunca um selo de revisão pedagógica.
    report.pedagogicallyReadyPct = report.structurallyReadyPct;
    report.status = !list.length ? 'sem_questoes' : report.questionIssueCount ? 'pendencias_identificadas' : 'estrutura_completa';
    if (typeof window !== 'undefined') window._lastQuestionPedagogyAudit = report;
    return report;
  }
  if (typeof window !== 'undefined') {
    window.auditAndEnrichAllQuestionsPedagogy = auditAndEnrichAllQuestionsPedagogy;
    window.getQuestionBankPedagogicalAuditReport = () => auditAndEnrichAllQuestionsPedagogy();
  }

  function initAllR179() {
    injectR180HunterStyles();
    tickTrailHearts20MinRegen();
    mountCaveiraEssayHub();
    mountPainelTaticoInProfile();
    mountCaveiraFlashcardsHub();
    mountCaveiraSmartLawsHub();
    mountCaveiraQuestionBankEnhancements();
    auditAndEnrichAllQuestionsPedagogy();
    loadLawsFromUserDatabase(false);
  }

  if (typeof window !== 'undefined') {
    window.JC_MODULES = window.JC_MODULES || {};
    window.JC_MODULES.caveiraFullSuiteR179 = {
      init: initAllR179,
      tickTrailHearts20MinRegen,
      mountCaveiraEssayHub,
      mountPainelTaticoInProfile,
      mountCaveiraFlashcardsHub,
      mountCaveiraSmartLawsHub,
      openSmartLawsSubtab,
      switchStudySubtab,
      importOfficialLawToLibrary,
      importAllOfficialLaws,
      OFFICIAL_LAW_IMPORTS,
      fetchExternalCompleteLawText,
      searchAndImportExternalLawOrText,
      syncAllLawsToUserDatabase,
      auditAndEnrichAllQuestionsPedagogy,
      mountCaveiraQuestionBankEnhancements,
      NATIVE_SMART_LAWS
    };

    if (typeof document !== 'undefined') {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initAllR179, 60));
      } else {
        setTimeout(initAllR179, 60);
      }
      if (typeof setInterval === 'function') setInterval(tickTrailHearts20MinRegen, 1000);
    }
  }
})();
