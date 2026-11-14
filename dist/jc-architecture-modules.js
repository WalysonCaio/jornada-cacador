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

  const profileSaveScopes=new Set();
  async function saveHunterProfileChanges(changes={}) {
    const scope=profileScope(),st=ownProfileState();
    if(!st)return {status:'account_not_ready'};
    const saveKey=`${scope.ownerId}:${scope.resetEpoch}`;
    if(profileSaveScopes.has(saveKey))return {status:'busy'};
    const clean=(value,max)=>String(value??'').trim().slice(0,max);
    const privacy=Object.fromEntries(['showAvatar','showStreak','showAccuracy','showHours','showTargetRole','showBadges','showBio'].map(key=>[key,changes.privacy?.[key]!==false]));
    const snapshot={name:clean(changes.name,50)||'Caçador',role:clean(changes.role,80),secondaryRole:clean(changes.secondaryRole,80),bio:clean(changes.bio,140),privacy,hidden:!!changes.hidden};
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
    const bioMotto = st.profileBioMotto || st.publicProfile?.bio || '“Disciplina diária, constância no ciclo e foco cirúrgico até a posse.”';
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
            <label class="field" style="margin:0">Lema de Estudos / Bio do Perfil<input type="text" id="jcEditBioInput" value="${profileHtml(bioMotto.replace(/^“|”$/g, ''))}" maxlength="140"></label>

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSocialProfileHooks);
  } else {
    setTimeout(bootSocialProfileHooks, 0);
  }
})();
