/* ============================================================================
 * Jornada do Caçador — Arquitetura Modular, Performance O(1) & Perfil Social (r177)
 * Módulo 1: Telemetria de Performance (performance.mark / measure + p50/p95)
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

  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 0;
    const idx = Math.min(sortedArr.length - 1, Math.max(0, Math.ceil((p / 100) * sortedArr.length) - 1));
    return Number(sortedArr[idx].toFixed(2));
  }

  JC_MODULES.telemetry = {
    samples: perfSamples,
    markStart(name = 'jc_questions_tab_open') {
      try {
        if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
          performance.mark(`${name}_start`);
        }
      } catch (_e) {}
      this._lastStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    },
    markEnd(name = 'jc_questions_tab_open', meta = {}) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let durationMs = Math.max(0.1, now - (this._lastStart || now));
      try {
        if (typeof performance !== 'undefined' && typeof performance.mark === 'function' && typeof performance.measure === 'function') {
          performance.mark(`${name}_end`);
          const m = performance.measure(name, `${name}_start`, `${name}_end`);
          if (m && Number.isFinite(m.duration) && m.duration > 0) {
            durationMs = m.duration;
          }
        }
      } catch (_e) {}
      const bankSize = getAllQuestions().length;
      const sample = {
        name,
        durationMs: Number(durationMs.toFixed(2)),
        bankSize,
        timestamp: new Date().toISOString(),
        ...meta
      };
      perfSamples.push(sample);
      if (perfSamples.length > MAX_SAMPLES) perfSamples.shift();
      try {
        localStorage.setItem('jc_telemetry_questions_v1', JSON.stringify(perfSamples.slice(-25)));
      } catch (_e) {}
      return sample;
    },
    getStats(name = 'jc_questions_tab_open') {
      let list = perfSamples.filter(s => !name || s.name === name);
      if (!list.length) {
        try {
          const saved = JSON.parse(localStorage.getItem('jc_telemetry_questions_v1') || '[]');
          if (Array.isArray(saved)) list = saved.filter(s => !name || s.name === name);
        } catch (_e) {}
      }
      const durations = list.map(s => Number(s.durationMs) || 0).filter(d => d > 0).sort((a, b) => a - b);
      const p50 = percentile(durations, 50);
      const p95 = percentile(durations, 95);
      const last = list[list.length - 1] || null;
      return {
        count: durations.length,
        p50Ms: p50,
        p95Ms: p95,
        lastMs: last ? last.durationMs : 0,
        bankSize: last ? last.bankSize : getAllQuestions().length,
        status: p95 <= 120 ? 'OTIMO_60FPS' : p95 <= 300 ? 'BOM' : 'ATENCAO_CELULAR_FRACO'
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
      aliases: ['direito processual penal', 'processo penal', 'cpp'],
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
      const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
      const sNorm = norm(subjectStr);
      const tNorm = norm(topicStr);
      const stNorm = norm(statementStr);
      const combined = `${tNorm} ${stNorm}`;

      let disc = STABLE_TAXONOMY.find(d => norm(d.name) === sNorm || d.aliases.some(a => sNorm.includes(a)));
      if (!disc) {
        let bestDisc = null, bestScore = 0;
        for (const d of STABLE_TAXONOMY) {
          let sc = 0;
          for (const tp of d.topics) {
            for (const kw of tp.keywords) {
              if (combined.includes(norm(kw))) sc += 2;
            }
          }
          if (sc > bestScore) { bestScore = sc; bestDisc = d; }
        }
        disc = bestScore >= 2 ? bestDisc : STABLE_TAXONOMY[5];
      }

      let bestTopic = disc.topics[0];
      let bestTopicScore = -1;
      for (const tp of disc.topics) {
        let sc = 0;
        if (tNorm && norm(tp.name).includes(tNorm)) sc += 6;
        for (const kw of tp.keywords) {
          if (combined.includes(norm(kw))) sc += 3;
        }
        if (sc > bestTopicScore) {
          bestTopicScore = sc;
          bestTopic = tp;
        }
      }

      return {
        subjectId: disc.id,
        subjectName: disc.name,
        topicId: bestTopic ? bestTopic.id : `${disc.id}_gen`,
        topicName: bestTopic ? bestTopic.name : (topicStr || `Tópicos Essenciais de ${disc.name}`),
        subtopics: bestTopic ? bestTopic.subtopics : []
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
      const list = TRUSTED_EXTERNAL_SOURCES_BY_SUBJECT[subject] || TRUSTED_EXTERNAL_SOURCES_BY_SUBJECT['Direito Constitucional'] || [];
      const q = encodeURIComponent(`${subject} ${topic || ''} concurso`.trim());
      return [
        ...list,
        {
          name: `Pesquisar "${topic || subject}" na Wikipédia Acadêmica em Português`,
          url: `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(topic || subject)}`,
          badge: '🔎 Busca Enciclopédica'
        },
        {
          name: `Pesquisar "${topic || subject}" no Google Acadêmico / Doutrina Aberta`,
          url: `https://scholar.google.com.br/scholar?q=${q}`,
          badge: '🎓 Google Acadêmico'
        }
      ];
    },
    async fetchLiveWikipediaTopicExtract(topic, subject) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
      const queryTerm = String(topic || subject || '').replace(/\b(item\s+\d+|topicos\s+essenciais\s+de)\b/gi, '').trim();
      if (!queryTerm) return null;
      try {
        const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryTerm + ' ' + subject)}&utf8=&format=json&origin=*&srlimit=1`;
        const res = await fetch(searchUrl);
        if (!res.ok) return null;
        const data = await res.json();
        const firstHit = data?.query?.search?.[0];
        if (!firstHit?.title) return null;
        const sumUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit.title)}`;
        const sumRes = await fetch(sumUrl);
        if (!sumRes.ok) return null;
        const sumData = await sumRes.json();
        if (!sumData?.extract) return null;
        return {
          title: sumData.title,
          extract: sumData.extract,
          pageUrl: sumData?.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(firstHit.title)}`
        };
      } catch (_e) {
        return null;
      }
    }
  };
  window.getTrustedExternalSources = (s, t) => JC_MODULES.smartLibrary.getTrustedExternalSources(s, t);

  // ── 4. PROMOTOR DE QUESTÕES DO USUÁRIO PARA BANCO NATIVO ORGANIZADO ──
  function normalizeKey(str) {
    return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function consolidateUserQuestionsIntoNativeBank(options = { saveToStorage: true, showToast: true }) {
    const allQs = getAllQuestions();
    const baseNative = Array.isArray(window.NATIVE_POLICE_QUESTION_BANK) ? window.NATIVE_POLICE_QUESTION_BANK : [];
    let savedPromoted = [];
    try {
      savedPromoted = JSON.parse(localStorage.getItem('jc_promoted_native_bank_v1') || '[]');
      if (!Array.isArray(savedPromoted)) savedPromoted = [];
    } catch (_e) { savedPromoted = []; }

    const seenStatements = new Set();
    const unified = [];
    const bySubjectAndTopic = {};

    const registerItem = (q, forceNative = false) => {
      if (!q || typeof q !== 'object') return;
      const st = String(q.statement || q.question || '').trim();
      if (st.length < 15) return;
      const opts = Array.isArray(q.options) ? q.options.map(o => String(o || '').trim()).filter(Boolean) : [];
      if (opts.length < 2 || opts.length > 5) return;
      const fp = normalizeKey(st).slice(0, 180);
      if (!fp || seenStatements.has(fp)) return;
      seenStatements.add(fp);

      const tax = JC_MODULES.taxonomy
        ? JC_MODULES.taxonomy.resolveStableTaxonomy(q.subject, q.topic, st)
        : { subjectId: 'disc_geral', subjectName: q.subject || 'Conteúdo Geral', topicId: 'top_geral', topicName: q.topic || 'Geral' };

      const enriched = {
        ...q,
        id: q.id || `nat_${tax.subjectId}_${unified.length + 1}`,
        subject: tax.subjectName,
        subject_id: tax.subjectId,
        topic: (q.topic && q.topic.length >= 4 && !/^quest[aã]o\s*\d+/i.test(q.topic)) ? q.topic : tax.topicName,
        topic_id: tax.topicId,
        options: opts,
        correct_index: Number.isInteger(Number(q.correct_index)) ? Number(q.correct_index) : 0,
        native: true,
        promoted_to_native: forceNative || Boolean(q.promoted_to_native),
        origin: q.origin === 'oficial' ? 'oficial' : 'nativo'
      };

      unified.push(enriched);
      if (!bySubjectAndTopic[tax.subjectName]) {
        bySubjectAndTopic[tax.subjectName] = { subjectId: tax.subjectId, total: 0, topics: {} };
      }
      bySubjectAndTopic[tax.subjectName].total++;
      const tName = enriched.topic;
      bySubjectAndTopic[tax.subjectName].topics[tName] = (bySubjectAndTopic[tax.subjectName].topics[tName] || 0) + 1;
    };

    baseNative.forEach(q => registerItem(q, false));
    savedPromoted.forEach(q => registerItem(q, true));
    allQs.forEach(q => {
      if (!q.answer_unknown && Number.isInteger(Number(q.correct_index)) && Number(q.correct_index) >= 0) {
        registerItem(q, true);
      }
    });

    window.NATIVE_POLICE_QUESTION_BANK = unified;
    if (options.saveToStorage) {
      try {
        const userAdded = unified.filter(q => q.promoted_to_native);
        localStorage.setItem('jc_promoted_native_bank_v1', JSON.stringify(userAdded.slice(0, 600)));
      } catch (_e) {}
      try {
        const stObj = getAppState();
        if (typeof window.persistToLocalDatabase === 'function' && stObj?.activeCampaignId) {
          window.persistToLocalDatabase(stObj.activeCampaignId);
        }
      } catch (_e) {}
    }

    if (options.showToast && typeof window.toast === 'function') {
      const subjCount = Object.keys(bySubjectAndTopic).length;
      window.toast(`🏛️ Banco Nativo Consolidado: ${unified.length} questões organizadas em ${subjCount} disciplinas com IDs estáveis!`);
    }

    return {
      total: unified.length,
      subjectsCount: Object.keys(bySubjectAndTopic).length,
      hierarchy: bySubjectAndTopic,
      questions: unified
    };
  }

  function exportConsolidatedNativeBankJson() {
    const res = consolidateUserQuestionsIntoNativeBank({ saveToStorage: true, showToast: false });
    const payload = {
      schema_version: 'r177-stable-taxonomy',
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
  }

  JC_MODULES.nativeBankPromoter = {
    consolidate: consolidateUserQuestionsIntoNativeBank,
    exportJson: exportConsolidatedNativeBankJson
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

  function getHunterInitials(name) {
    const clean = String(name || 'Caçador').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase() || 'JC';
  }

  function getHunterAvatarDataUrl() {
    const st = getAppState();
    return st.profileAvatarDataUrl || st.publicProfile?.avatar || localStorage.getItem('jc_profile_avatar_v1') || '';
  }

  function setHunterAvatarDataUrl(dataUrl) {
    const st = getAppState();
    st.profileAvatarDataUrl = dataUrl;
    st.publicProfile = st.publicProfile || {};
    st.publicProfile.avatar = dataUrl;
    try {
      if (dataUrl) localStorage.setItem('jc_profile_avatar_v1', dataUrl);
      else localStorage.removeItem('jc_profile_avatar_v1');
      if (typeof save === 'function') save();
      if (typeof cloudSession === 'object' && cloudSession && navigator.onLine && typeof pushCloudState === 'function') {
        pushCloudState();
      }
    } catch (_e) {}
    decorateTopHeaderAvatarPill();
  }

  function getHunterDisplayName() {
    const st = getAppState();
    const sess = typeof cloudSession !== 'undefined' ? cloudSession : window.cloudSession;
    const user = sess?.user;
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
    const customName = st.profileDisplayName || st.publicProfile?.name || localStorage.getItem('jc_profile_display_name_v1') || '';
    return customName || metaName || (user?.email ? user.email.split('@')[0] : 'Caçador');
  }

  function getPrivacyConfig() {
    const st = getAppState();
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
    const name = typeof itemOrName === 'object' ? (itemOrName?.name || itemOrName?.author_name || 'Caçador') : String(itemOrName || 'Caçador');
    const initials = getHunterInitials(name);
    const priv = getPrivacyConfig();
    const myAvatar = isMe && priv.showAvatar ? getHunterAvatarDataUrl() : '';
    const theirAvatar = typeof itemOrName === 'object' ? (itemOrName?.avatar || itemOrName?.avatar_url || extraAvatarUrl || '') : extraAvatarUrl;
    const finalAvatar = myAvatar || theirAvatar;
    if (finalAvatar) {
      return `<img src="${finalAvatar}" alt="Foto de ${name.replace(/"/g, '')}">`;
    }
    return `<span>${initials}</span>`;
  }
  window.renderHunterAvatarHtml = renderHunterAvatarHtml;

  function decorateTopHeaderAvatarPill() {
    injectSocialProfileStyles();
    const btn = document.getElementById('accountBtn');
    if (!btn) return;
    const avatarUrl = getHunterAvatarDataUrl();
    const name = getHunterDisplayName();
    const initials = getHunterInitials(name);
    btn.classList.add('jcTopProfilePill');
    btn.title = `Meu Perfil de Caçador (${name})`;
    const avatarInner = avatarUrl
      ? `<img src="${avatarUrl}" alt="Foto de perfil de ${name.replace(/"/g, '')}">`
      : `<span>${initials}</span>`;
    btn.innerHTML = `<span class="jcHeaderAvatarCircle" id="topHeaderAvatarCircle">${avatarInner}</span><span class="jcHeaderProfileName">${name}</span>`;
    btn.onclick = (e) => {
      e?.preventDefault?.();
      if (typeof openView === 'function') {
        openView('profile');
      }
    };
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

    const hName = String(hunterData.name || hunterData.author_name || 'Caçador da Guilda').trim();
    const hRole = String(hunterData.role || hunterData.author_role || 'Carreiras Policiais').trim();
    const hSecRole = String(hunterData.secondary_role || '').trim();
    const hXp = Number(hunterData.xp ?? hunterData._displayXp ?? hunterData.author_xp ?? 0);
    const hStreak = Number(hunterData.streak ?? hunterData._displayStreak ?? 0);
    const hBestStreak = Math.max(hStreak, Number(hunterData.best_streak || 0));
    const hAcc = Number(hunterData.accuracy || 0);
    const hMissions = Number(hunterData.missions_done ?? hunterData._displayMissions ?? 0);
    const hHours = Number(hunterData._displayHours || Math.round(((hMissions * 50) + (hStreak * 30)) / 60 * 10) / 10 || 0);
    const hRankLabel = typeof level === 'function' ? (level(hXp, false)?.label || 'Caçador') : 'Caçador Ativo';
    const hBio = hunterData.bio || '“Membro ativo da Guilda na Jornada do Caçador.”';
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
            <b style="color:#fbbf24">${hPriv.showStreak !== false ? `🔥 ${hStreak} dias (Rec: ${hBestStreak}d)` : '🔒 Privado'}</b>
            <span>Ofensiva de Estudos</span>
          </div>
          <div class="jcProfileStatItem">
            <b style="color:#34d399">${hPriv.showAccuracy !== false ? `🎯 ${hAcc}% (${hMissions} missões)` : '🔒 Privado'}</b>
            <span>Precisão &amp; Missões</span>
          </div>
          <div class="jcProfileStatItem">
            <b>${hPriv.showHours !== false ? `⏱️ ${hHours}h` : '🔒 Privado'}</b>
            <span>Ritmo Estimado</span>
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
            <button type="button" class="action" id="jcVisitorChallengeDuelBtn" style="flex:1">⚔️ Desafiar ${hName.split(' ')[0]} para Duelo X1</button>
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
          const challBtn = document.querySelector(`[data-challenge-from-rank^="${hunterData.user_id}|"]`);
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
    const st = getAppState();
    const fpMap = st.answeredQuestionFingerprints || {};
    const boards = {};
    for (const q of allQs) {
      const bName = String(q.board || (q.origin === 'oficial' ? 'Instituto AOCP' : 'Simulado / Autoral')).trim();
      const normBoard = /cebraspe|cespe/i.test(bName) ? 'Cebraspe'
        : /fgv/i.test(bName) ? 'FGV Conhecimento'
        : /upenet|iaupe/i.test(bName) ? 'UPENET / IAUPE'
        : /ibfc/i.test(bName) ? 'IBFC'
        : /idecan/i.test(bName) ? 'IDECAN'
        : /aocp/i.test(bName) ? 'Instituto AOCP'
        : 'Simulados & Outras Bancas';
      if (!boards[normBoard]) boards[normBoard] = { totalAvailable: 0, answered: 0, correct: 0 };
      boards[normBoard].totalAvailable++;
      if (typeof questionFingerprint === 'function') {
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
    try { if (typeof refreshStreak === 'function') refreshStreak(); } catch (_e) {}
    try { if (typeof syncHunterStatsSnapshot === 'function') syncHunterStatsSnapshot(); } catch (_e) {}

    const st = getAppState();
    const allQs = getAllQuestions();
    const allSums = getAllSummaries();
    const allCards = getAllFlashcards();
    const priv = getPrivacyConfig();

    const name = getHunterDisplayName();
    const avatarUrl = getHunterAvatarDataUrl();
    const initials = getHunterInitials(name);
    const camp = typeof activeCampaign === 'function' ? activeCampaign() : { name: 'PMPE — Soldado' };
    const targetRole = st.profileTargetRole || st.publicProfile?.role || camp?.name || 'PMPE — Soldado';
    const secRole = st.publicProfile?.secondaryRole || '';
    const bioMotto = st.profileBioMotto || st.publicProfile?.bio || '“Disciplina diária, constância no ciclo e foco cirúrgico até a posse.”';
    const cityState = st.profileCity || 'Pernambuco, Brasil';

    const totalXp = typeof xp === 'function' ? xp() : Number(st.hunterStats?.xp || 0);
    const pool = typeof missionPool === 'function' ? missionPool() : [];
    const doneMissions = pool.filter(m => st.done?.[m.id]).length;
    const editalPct = pool.length ? Math.round((doneMissions / pool.length) * 100) : 0;
    const rankObj = typeof level === 'function' ? level(totalXp, pool.length > 0 && doneMissions === pool.length) : { label: 'C II - Caçador Experiente' };

    const scores = (st.scores || []).filter(s => !s.campaignId || s.campaignId === st.activeCampaignId);
    const scoreTotal = scores.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const scoreCorr = scores.reduce((acc, s) => acc + (Number(s.correct) || 0), 0);
    const tracked = st.questionStatsByCampaign?.[st.activeCampaignId] || {};
    const qTotal = Math.max(scoreTotal, Number(tracked.total || 0));
    const qCorr = Number(tracked.total || 0) > scoreTotal ? Number(tracked.correct || 0) : scoreCorr;
    const accuracy = qTotal > 0 ? Math.round((qCorr / qTotal) * 100) : (Number(st.hunterStats?.accuracy) || 0);

    const totalFocusSeconds = Object.values(st.studyByDay || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);
    const streak = Math.max(Number(st.streak || 0), Number(st.hunterStats?.streak || 0));
    const bestStreak = Math.max(streak, Number(st.bestStreak || 0), Number(st.hunterStats?.bestStreak || 0));
    const bossesWon = Object.keys(st.bosses || {}).length;

    const boardStats = computeBoardAccuracyStats();
    const telemetry = JC_MODULES.telemetry ? JC_MODULES.telemetry.getStats() : { p50Ms: 12, bankSize: allQs.length };

    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" alt="Foto de ${name.replace(/"/g, '')}">`
      : `<span>${initials}</span>`;

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
                  <input type="file" id="jcProfileAvatarInput" accept="image/*" hidden>
                </label>
              </div>
              <div class="jcProfileTitleBlock">
                <div class="eyebrow" style="color:#59e6ff;font-weight:900">PERFIL OFICIAL DO CAÇADOR</div>
                <h2>
                  <span>${name}</span>
                  <span class="jcProfileRoleBadge">🛡️ ${rankObj.label}</span>
                </h2>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;font-size:.82rem;color:#94a3b8">
                  <span>🎯 <b>Cargo Pretendido:</b> <strong style="color:#f8fafc">${targetRole}</strong>${secRole ? ` · 🛡️ <b>2º Alvo:</b> <strong style="color:#cbd5e1">${secRole}</strong>` : ''}</span>
                  <span>·</span>
                  <span>📍 ${cityState}</span>
                </div>
                <p class="jcProfileBioMotto">${bioMotto}</p>
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
              <label class="field" style="margin:0">Seu Nome de Exibição (Perfil &amp; Ranking)<input type="text" id="jcEditNameInput" value="${name}" maxlength="50"></label>
              <label class="field" style="margin:0">1º Concurso / Cargo Pretendido<input type="text" id="jcEditRoleInput" value="${targetRole}" maxlength="80" placeholder="Ex.: PMPE — Soldado"></label>
              <label class="field" style="margin:0">2º Concurso (Opcional)<input type="text" id="jcEditSecRoleInput" value="${secRole}" maxlength="80" placeholder="Ex.: CBMPE / PPPE"></label>
              <label class="field" style="margin:0">Cidade / Estado<input type="text" id="jcEditCityInput" value="${cityState}" maxlength="50"></label>
            </div>
            <label class="field" style="margin:0">Lema de Estudos / Bio do Perfil<input type="text" id="jcEditBioInput" value="${bioMotto.replace(/^“|”$/g, '')}" maxlength="140"></label>

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
            <div class="jcProfileStatItem"><b style="color:#34d399">${accuracy}%</b><span>Precisão (${qCorr}/${qTotal})</span></div>
            <div class="jcProfileStatItem"><b>${totalFocusHours}h</b><span>Horas Líquidas</span></div>
            <div class="jcProfileStatItem"><b>${editalPct}%</b><span>Cobertura (${doneMissions}/${pool.length})</span></div>
            <div class="jcProfileStatItem"><b style="color:#f43f5e">🏆 ${bossesWon}</b><span>Chefes Derrotados</span></div>
          </div>
        </div>
      </div>

      <div class="jcProfileTwoCols">
        <div style="display:grid;gap:14px">
          <div class="card" style="margin:0">
            <div class="sectionHead"><h2>📋 Apresentação &amp; Sincronia Real</h2><span class="tag">Sincronizado</span></div>
            <div class="list" style="gap:8px;font-size:.84rem">
              <div class="topic"><span>🎯 <b>Portal Ativo:</b> ${camp?.name || 'PMPE — Soldado'} (${doneMissions} missões cumpridas)</span></div>
              <div class="topic"><span>📚 <b>Acervo no Aparelho:</b> <b>${allQs.length} questões</b> · <b>${allSums.length} resumos</b> · <b>${allCards.length} flashcards</b></span></div>
              <div class="topic"><span>🔒 <b>Privacidade no Ranking:</b> ${priv.hiddenFromRanking ? 'Oculto (Modo Invisível)' : 'Visível para a Guilda (com filtros personalizados)'}</span></div>
              <div class="topic"><span>⚡ <b>Velocidade da Aba Questões:</b> abertura instantânea (p50 ${telemetry.p50Ms || 8}ms)</span></div>
            </div>
            <div style="display:grid;gap:8px;margin-top:12px">
              <button type="button" class="action small" id="jcProfileConsolidateNativeBtn" style="width:100%">🏛️ Consolidar Minhas ${allQs.length} Questões no Banco Nativo</button>
              <button type="button" class="ghost small" id="jcProfileExportNativeJsonBtn" style="width:100%">📥 Baixar Meu Banco Nativo Consolidado (.json)</button>
            </div>
          </div>

          <div class="card" style="margin:0">
            <div class="sectionHead"><h2>🏅 Insígnias Desbloqueadas</h2><span class="tag">Carreira</span></div>
            <div class="achievementGrid">
              <div class="achievement ${doneMissions >= 1 ? 'unlocked' : ''}"><b>${doneMissions >= 1 ? '✓' : '◈'} Recruta Ativo</b><span class="small muted">1ª missão cumprida (${doneMissions} feitas)</span></div>
              <div class="achievement ${streak >= 3 ? 'unlocked' : ''}"><b>${streak >= 3 ? '✓' : '◈'} Fogo Constante</b><span class="small muted">3+ dias seguidos (atual: ${streak}d)</span></div>
              <div class="achievement ${qTotal >= 30 ? 'unlocked' : ''}"><b>${qTotal >= 30 ? '✓' : '◈'} Atirador de Questões</b><span class="small muted">30+ resolvidas (atual: ${qTotal})</span></div>
              <div class="achievement ${accuracy >= 60 && qTotal >= 10 ? 'unlocked' : ''}"><b>${accuracy >= 60 && qTotal >= 10 ? '✓' : '◈'} Mira Calibrada</b><span class="small muted">60%+ precisão (atual: ${accuracy}%)</span></div>
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
                      <b>🏛️ ${b.board}</b>
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
                        <b>${subj}</b>
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
    if (avatarIn) {
      avatarIn.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const cnv = document.createElement('canvas');
            const size = 200;
            cnv.width = size;
            cnv.height = size;
            const ctx = cnv.getContext('2d');
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            const dataUrl = cnv.toDataURL('image/webp', 0.82);
            setHunterAvatarDataUrl(dataUrl);
            renderHunterProfileHub();
            if (typeof toast === 'function') toast('📸 Foto aplicada no Perfil, Topo, Ranking e Chat da Guilda!');
          };
          img.src = String(reader.result || '');
        };
        reader.readAsDataURL(file);
      };
    }

    const remBtn = document.getElementById('jcRemoveAvatarBtn');
    if (remBtn) {
      remBtn.onclick = () => {
        setHunterAvatarDataUrl('');
        renderHunterProfileHub();
        if (typeof toast === 'function') toast('Foto de perfil removida.');
      };
    }

    const editBtn = document.getElementById('jcEditSocialProfileBtn');
    const drawer = document.getElementById('jcEditProfileDrawer');
    if (editBtn && drawer) {
      editBtn.onclick = () => { drawer.hidden = !drawer.hidden; };
    }
    const cancelBtn = document.getElementById('jcCancelEditProfileBtn');
    if (cancelBtn && drawer) {
      cancelBtn.onclick = () => { drawer.hidden = true; };
    }
    const saveProfBtn = document.getElementById('jcSaveEditProfileBtn');
    if (saveProfBtn) {
      saveProfBtn.onclick = async () => {
        const newName = document.getElementById('jcEditNameInput')?.value.trim() || name;
        const newRole = document.getElementById('jcEditRoleInput')?.value.trim() || targetRole;
        const newSecRole = document.getElementById('jcEditSecRoleInput')?.value.trim() || '';
        const newCity = document.getElementById('jcEditCityInput')?.value.trim() || cityState;
        const newBio = document.getElementById('jcEditBioInput')?.value.trim() || '';

        const stObj = getAppState();
        stObj.profileDisplayName = newName;
        stObj.profileTargetRole = newRole;
        stObj.profileCity = newCity;
        stObj.profileBioMotto = newBio ? `“${newBio}”` : bioMotto;
        stObj.publicProfile = stObj.publicProfile || {};
        stObj.publicProfile.name = newName;
        stObj.publicProfile.role = newRole;
        stObj.publicProfile.secondaryRole = newSecRole;
        stObj.publicProfile.bio = stObj.profileBioMotto;
        stObj.publicProfile.avatar = getHunterAvatarDataUrl();
        stObj.publicProfile.hidden = Boolean(document.getElementById('jcPrivHiddenAll')?.checked);
        stObj.publicProfile.privacy = {
          showAvatar: Boolean(document.getElementById('jcPrivAvatar')?.checked),
          showStreak: Boolean(document.getElementById('jcPrivStreak')?.checked),
          showAccuracy: Boolean(document.getElementById('jcPrivAccuracy')?.checked),
          showHours: Boolean(document.getElementById('jcPrivHours')?.checked),
          showTargetRole: Boolean(document.getElementById('jcPrivRole')?.checked),
          showBadges: Boolean(document.getElementById('jcPrivBadges')?.checked),
          showBio: Boolean(document.getElementById('jcPrivBadges')?.checked)
        };

        try { localStorage.setItem('jc_profile_display_name_v1', newName); } catch (_e) {}
        if (typeof save === 'function') save();
        if (typeof cloudSession === 'object' && cloudSession && navigator.onLine && typeof pushCloudState === 'function') {
          try { await pushCloudState(); } catch (_e) {}
        }
        decorateTopHeaderAvatarPill();
        renderHunterProfileHub();
        if (typeof toast === 'function') toast('✅ Perfil, Ranking e Privacidade sincronizados com sucesso!');
      };
    }

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
    openVisitorModal: openPublicHunterProfileVisitorModal
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

/* ============================================================================
 * Módulo 7 (r178): Redesign Clean UI (Inspirado em Caveira / Linear / Shadcn),
 * Sidebar Lateral Retrátil (Expandida / Somente Ícones), Topbar Focus Timer Pill
 * (00:00:00) e Modo Foco Tela Cheia Imersivo Responsivo (Desktop & Mobile)
 * ============================================================================ */
(function () {
  'use strict';

  const JC_MODULES = (window.JC_MODULES = window.JC_MODULES || {});
  let wakeLockSentinel = null;

  function formatHHMMSS(totalSeconds) {
    const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  async function requestScreenWakeLock(enable) {
    try {
      if (enable && 'wakeLock' in navigator && !wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
      } else if (!enable && wakeLockSentinel) {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      }
    } catch (_e) {}
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
      @media (max-width: 719px) {
        .jcTopXpPill {
          display: none !important;
        }
        .jcTopTimerPill {
          height: 36px;
          padding: 2px 5px;
          gap: 2px;
        }
        .jcTopTimerBtn.stopBtn,
        .jcTopTimerBtn.resetBtn,
        .jcTopTimerDivider {
          display: none !important;
        }
        .jcTopTimerDigits {
          font-size: 0.78rem;
          padding: 0 3px;
        }
        .jcTopTimerExpandBtn {
          width: 26px;
          height: 26px;
          font-size: 0.78rem;
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

      /* ── 4. DESPOLUIÇÃO VISUAL PROFUNDA ("CLEAN DASHBOARD MODE" PADRÃO) ── */
      body.jcCleanDashboard .sectionHead p.small.muted,
      body.jcCleanDashboard .questionTrust,
      body.jcCleanDashboard #streakRequirement,
      body.jcCleanDashboard .localDbBar {
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
  let focusDisplayMode = localStorage.getItem('jc_focus_display_mode_v1') || 'countdown';

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

  function openFullscreenFocusTimer() {
    ensureFullscreenFocusModalExists();
    const modal = document.getElementById('jcFullscreenFocusOverlay');
    if (!modal) return;
    // Atualiza nome da missão atual no topo do modal
    const missionEl = document.getElementById('jcFocusMissionLabel');
    if (missionEl) {
      try {
        const st = typeof state === 'object' && state ? state : (window.state || {});
        const pool = typeof missionPool === 'function' ? missionPool() : [];
        const curM = pool.find(m => m.id === st.daily);
        missionEl.textContent = curM ? `🎯 ${curM.subject} — ${curM.name}` : '⚔️ Modo Foco Imersivo · Jornada do Caçador';
      } catch (_e) {}
    }
    modal.hidden = false; if (modal.classList) modal.classList.add('open');
    updateAllFocusTimerDisplays();
    requestScreenWakeLock(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_e) {}
  }

  function closeFullscreenFocusTimer() {
    const modal = document.getElementById('jcFullscreenFocusOverlay');
    if (modal) { modal.hidden = true; if (modal.classList) modal.classList.remove('open'); }
    requestScreenWakeLock(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (_e) {}
  }

  window.openFullscreenFocusTimer = openFullscreenFocusTimer;
  window.closeFullscreenFocusTimer = closeFullscreenFocusTimer;

  function ensureFullscreenFocusModalExists() {
    if (document.getElementById('jcFullscreenFocusOverlay')) return;
    const modal = document.createElement('div');
    modal.id = 'jcFullscreenFocusOverlay';
    modal.className = 'jcFullscreenFocusModal';
    modal.hidden = true;
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

    document.getElementById('jcFsPlayPauseBtn').onclick = () => {
      if (typeof toggleTimer === 'function') toggleTimer().then(updateAllFocusTimerDisplays);
      else document.getElementById('timerToggle')?.click();
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
    document.getElementById('jcFsStopBtn').onclick = () => {
      if (typeof timerRun !== 'undefined' && timerRun && typeof toggleTimer === 'function') {
        toggleTimer().then(updateAllFocusTimerDisplays);
      }
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
    document.getElementById('jcFsResetBtn').onclick = () => {
      document.getElementById('timerReset')?.click();
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
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
      if (modal.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullscreenFocusTimer();
      } else if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
        e.preventDefault();
        document.getElementById('jcFsPlayPauseBtn')?.click();
      }
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
        <span class="jcTopTimerDigits" id="jcTopTimerDigits">00:50:00</span>
        <button type="button" class="jcTopTimerExpandBtn" id="jcTopTimerExpandBtn" aria-label="Expandir cronômetro em tela cheia" title="Modo Foco em Tela Cheia (Estilo Caveira)">⛶</button>
      </div>
      <div class="jcTopXpPill" id="jcTopXpPill" title="Sua Experiência Acumulada">
        <i>⚡</i><span id="jcTopXpValue">0 XP</span>
      </div>
    `;
    accountArea.insertAdjacentHTML('afterbegin', timerPillHtml);

    document.getElementById('jcTopTimerPlayBtn').onclick = () => {
      if (typeof toggleTimer === 'function') toggleTimer().then(updateAllFocusTimerDisplays);
      else document.getElementById('timerToggle')?.click();
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
    document.getElementById('jcTopTimerStopBtn').onclick = () => {
      if (typeof timerRun !== 'undefined' && timerRun && typeof toggleTimer === 'function') {
        toggleTimer().then(updateAllFocusTimerDisplays);
      }
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
    document.getElementById('jcTopTimerResetBtn').onclick = () => {
      document.getElementById('timerReset')?.click();
      setTimeout(updateAllFocusTimerDisplays, 50);
    };
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
    const isCollapsed = localStorage.getItem('jc_sidebar_collapsed_v1') === '1';
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
    try { localStorage.setItem('jc_caveira_clean_mode_v1', isClean ? '1' : '0'); } catch (_e) {}
    const lbl = document.querySelector('#jcSideCleanModeToggleBtn .jcSideNavLabel');
    if (lbl) lbl.textContent = isClean ? 'Visual Limpo: ON' : 'Visual Limpo: OFF';
    const todayAcc = document.getElementById('jcTodaySecondaryAccordion');
    const repAcc = document.getElementById('jcReportSecondaryAccordion');
    if (isClean) {
      organizeTodaySecondaryCardsIntoDrawer();
      if (todayAcc) todayAcc.open = false;
      if (repAcc) repAcc.open = false;
    } else {
      if (todayAcc) todayAcc.open = true;
      if (repAcc) repAcc.open = true;
    }
    if (showNotice && typeof window.toast === 'function') {
      window.toast(
        isClean
          ? '✨ Visual Limpo ON: Banners decorativos, textos longos e blocos secundários recolhidos para foco máximo!'
          : '📖 Visual Limpo OFF (Modo Detalhado): Todos os banners ilustrativos, dicas e cartões foram expandidos!'
      );
    }
  }
  window.applyCaveiraCleanDashboardMode = applyCaveiraCleanDashboardMode;

  function bootCaveiraUiAndFullscreenTimer() {
    injectCaveiraCleanUiStyles();
    ensureFullscreenFocusModalExists();
    ensureTopHeaderFocusTimerBar();
    ensureCollapsibleDesktopSidebar();

    const preferClean = localStorage.getItem('jc_caveira_clean_mode_v1') !== '0';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCaveiraUiAndFullscreenTimer);
  } else {
    setTimeout(bootCaveiraUiAndFullscreenTimer, 0);
  }
})();



// ============================================================================
// MÓDULO 8 (r179): SUITE COMPLETA CAVEIRA & FRAMEWORKS MODERNOS
// - Renovação Automática de Vidas da Trilha a cada 20 min com Cronômetro ao Vivo
// - Novo Hub de Redação Policial (#jcEssayDashboardHub)
// - Painel Tático Interativo no Perfil Social (#jcTacticalPanelSection)
// - Novo Hub de Flashcards com Funil de 3 Chevrons (#jcFlashcardsDashboardHub)
// - Aba "⚖️ Leis & Textos (Lei Seca)" com Vade Mecum Policial, Favoritos e Grifo
// - Pílulas de Status no Banco de Questões + Breadcrumb e Barra Inferior com Invocador
// ============================================================================
(function initCaveiraFullSuiteR179() {
  const LAWS_FAV_KEY = 'jc_laws_favorites_v179';
  const LAWS_HIGHLIGHT_KEY = 'jc_laws_highlights_v179';

  const NATIVE_SMART_LAWS = [
    {
      id: 'law-cf88-art5',
      discipline: 'Direito Constitucional',
      title: 'Lei Seca - Constituição Federal: Art. 1º ao 5º (Fundamentos, Objetivos e Direitos e Deveres Individuais)',
      badge: 'Essencial PMPE/PPPE',
      articles: [
        'Art. 1º A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I - a soberania; II - a cidadania; III - a dignidade da pessoa humana; IV - os valores sociais do trabalho e da livre iniciativa; V - o pluralismo político. (Bizu: SO-CI-DI-VA-PLU).',
        'Art. 3º Constituem objetivos fundamentais da República Federativa do Brasil: I - construir uma sociedade livre, justa e solidária; II - garantir o desenvolvimento nacional; III - erradicar a pobreza e a marginalização e reduzir as desigualdades sociais e regionais; IV - promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação. (Bizu: CON-GA-ERRA-PRO).',
        'Art. 5º, III - ninguém será submetido a tortura nem a tratamento desumano ou degradante.',
        'Art. 5º, XI - a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, salvo em caso de flagrante delito ou desastre, ou para prestar socorro, ou, durante o dia, por determinação judicial.',
        'Art. 5º, XII - é inviolável o sigilo da correspondência e das comunicações telegráficas, de dados e das comunicações telefônicas, salvo, no último caso, por ordem judicial, nas hipóteses e na forma que a lei estabelecer para fins de investigação criminal ou instrução processual penal.',
        'Art. 5º, XVI - todos podem reunir-se pacificamente, sem armas, em locais abertos ao público, independentemente de autorização, desde que não frustrem outra reunião anteriormente convocada para o mesmo local, sendo apenas exigido prévio aviso à autoridade competente.',
        'Art. 5º, XLII - a prática do racismo constitui crime inafiançável e imprescritível, sujeito à pena de reclusão, nos termos da lei.',
        'Art. 5º, XLIII - a lei considerará crimes inafiançáveis e insuscetíveis de graça ou anistia a prática da tortura, o tráfico ilícito de entorpecentes e drogas afins, o terrorismo e os definidos como crimes hediondos (3TH).',
        'Art. 5º, XLIV - constitui crime inafiançável e imprescritível a ação de grupos armados, civis ou militares, contra a ordem constitucional e o Estado Democrático (RAÇÃO = Racismo e Ação de Grupos Armados são Imprescritíveis).'
      ]
    },
    {
      id: 'law-cf88-art144',
      discipline: 'Direito Constitucional',
      title: 'Lei Seca - Constituição Federal: Art. 144 (Segurança Pública e Órgãos Policiais)',
      badge: 'Top 1 Carreiras Policiais',
      articles: [
        'Art. 144. A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio, através dos seguintes órgãos (Rol Taxativo): I - polícia federal; II - polícia rodoviária federal; III - polícia ferroviária federal; IV - polícias civis; V - polícias militares e corpos de bombeiros militares; VI - polícias penais federal, estaduais e distrital (EC nº 104/2019).',
        'Art. 144, § 4º Às polícias civis, dirigidas por delegados de polícia de carreira, incumbem, ressalvada a competência da União, as funções de polícia judiciária e a apuração de infrações penais, exceto as militares.',
        'Art. 144, § 5º Às polícias militares cabem a polícia ostensiva e a preservação da ordem pública; aos corpos de bombeiros militares, além das atribuições definidas em lei, incumbe a execução de atividades de defesa civil.',
        'Art. 144, § 5º-A. Às polícias penais, vinculadas ao órgão administrador do sistema penal da unidade federativa a que pertencem, cabe a segurança dos estabelecimentos penais.',
        'Art. 144, § 6º As polícias militares e os corpos de bombeiros militares, forças auxiliares e reserva do Exército subordinam-se, juntamente com as polícias civis e as polícias penais estaduais e distrital, aos Governadores dos Estados, do Distrito Federal e dos Territórios.',
        'Art. 144, § 8º Os Municípios poderão constituir guardas municipais destinadas à proteção de seus bens, serviços e instalações, conforme dispuser a lei.'
      ]
    },
    {
      id: 'law-adm-improbidade-8429',
      discipline: 'Direito Administrativo',
      title: 'Lei Seca - Lei de Improbidade Administrativa: Lei nº 8.429/92 (Atualizada pela Lei nº 14.230/21)',
      badge: 'Alta Incidência',
      articles: [
        'Art. 1º, § 1º Consideram-se atos de improbidade administrativa as condutas dolosas tipificadas nos arts. 9º, 10 e 11 desta Lei, ressalvados tipos previstos em leis especiais. (Atenção: Não existe mais improbidade culposa!).',
        'Art. 1º, § 2º Considera-se dolo a vontade livre e consciente de alcançar o resultado ilícito tipificado nos arts. 9º, 10 e 11 desta Lei, não bastando a voluntariedade do agente (exige-se dolo específico).',
        'Art. 9º (Enriquecimento Ilícito - Rol Exemplificativo): Suspensão dos direitos políticos até 14 anos, perda da função, multa equivalente ao valor do acréscimo patrimonial e proibição de contratar até 14 anos.',
        'Art. 10 (Lesão ao Erário - Rol Exemplificativo): Suspensão dos direitos políticos até 12 anos, perda da função, multa equivalente ao valor do dano e proibição de contratar até 12 anos.',
        'Art. 11 (Atentado contra os Princípios - Rol TAXATIVO!): Multa até 24 vezes a remuneração e proibição de contratar até 4 anos (Não há perda da função nem suspensão de direitos políticos no Art. 11!).',
        'Art. 23. A ação para a aplicação das sanções previstas nesta Lei prescreve em 8 (oito) anos, contados a partir da ocorrência do fato ou, no caso de infrações permanentes, do dia em que cessou a permanência.'
      ]
    },
    {
      id: 'law-adm-licitacoes-14133',
      discipline: 'Direito Administrativo',
      title: 'Lei Seca - Nova Lei de Licitações e Contratos Administrativos: Lei nº 14.133/21',
      badge: 'Bancas AOCP/FGV',
      articles: [
        'Art. 28. São modalidades de licitação: I - pregão; II - concorrência; III - concurso; IV - leilão; V - diálogo competitivo. (Atenção: Tomada de preços, convite e RDC foram extintos!).',
        'Art. 6º, XLI - pregão: modalidade de licitação obrigatória para aquisição de bens e serviços comuns, cujo critério de julgamento poderá ser o de menor preço ou o de maior desconto.',
        'Art. 6º, XLII - diálogo competitivo: modalidade de licitação para contratação de obras, serviços e compras em que a Administração Pública realiza diálogos com licitantes previamente selecionados mediante critérios objetivos, com o intuito de desenvolver uma ou mais alternativas capazes de atender às suas necessidades.'
      ]
    },
    {
      id: 'law-penal-adm-publica',
      discipline: 'Direito Penal',
      title: 'Lei Seca - Código Penal: Crimes Praticados por Funcionário Público Contra a Administração (Arts. 312 a 327)',
      badge: 'Cai em toda prova',
      articles: [
        'Art. 312 (Peculato): Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio. § 2º Peculato culposo: se o funcionário concorre culposamente para o crime de outrem. § 3º No peculato culposo, a reparação do dano, se precede à sentença irrecorrível, extingue a punibilidade; se lhe é posterior, reduz de metade a pena imposta.',
        'Art. 316 (Concussão): Exigir, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida. Pena: reclusão, de 2 a 12 anos, e multa (Verbo nuclear: EXIGIR).',
        'Art. 317 (Corrupção Passiva): Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem (Verbos: SOLICITAR, RECEBER, ACEITAR PROMESSA).',
        'Art. 319 (Prevaricação): Retardar ou deixar de praticar, indevidamente, ato de ofício, ou praticá-lo contra disposição expressa de lei, para satisfazer interesse ou sentimento pessoal.',
        'Art. 320 (Condescendência Criminosa): Deixar o funcionário, por indulgência, de responsabilizar subordinado que cometeu infração no exercício do cargo ou, quando lhe falte competência, não levar o fato ao conhecimento da autoridade competente.'
      ]
    },
    {
      id: 'law-penal-militar-cpm',
      discipline: 'Direito Penal Militar',
      title: 'Lei Seca - Código Penal Militar (Decreto-Lei nº 1.001/69): Crimes Militares em Tempo de Paz (Art. 9º), Motim, Insubordinação e Deserção',
      badge: 'PMPE / CBMPE',
      articles: [
        'Art. 9º Consideram-se crimes militares, em tempo de paz: II - os crimes previstos neste Código e os previstos na legislação penal, quando praticados: a) por militar em situação de atividade ou assemelhado, contra militar na mesma situação ou assemelhado; b) por militar em situação de atividade, em lugar sujeito à administração militar, contra militar da reserva/reformado ou civil; c) por militar em serviço ou atuando em razão da função.',
        'Art. 149 (Motim): Reunirem-se militares ou assemelhados: I - agindo contra a ordem recebida de superior, ou negando-se a cumpri-la; II - recusando obediência a superior, quando estejam agindo sem ordem ou praticando violência; IV - ocupando quartel, fortaleza, aeródromo ou navio militar.',
        'Art. 163 (Recusa de Obediência): Recusar obedecer a ordem do superior sobre assunto ou matéria de serviço, ou relativamente a dever imposto em lei, regulamento ou instrução: Pena - detenção, de um a dois anos, se o fato não constitui crime mais grave.',
        'Art. 187 (Deserção): Ausentar-se o militar, sem licença, da unidade em que serve, ou do lugar em que deve permanecer, por mais de oito dias: Pena - detenção, de seis meses a dois anos; se oficial, a pena é agravada. (Bizu: Mais de 8 dias = consuma no 9º dia!).'
      ]
    },
    {
      id: 'law-extrav-abuso-tortura',
      discipline: 'Legislação Extravagante',
      title: 'Lei Seca - Abuso de Autoridade (Lei nº 13.869/19) e Lei de Tortura (Lei nº 9.455/97)',
      badge: 'Foco Policial',
      articles: [
        'Lei 13.869/19, Art. 1º, § 1º As condutas descritas nesta Lei constituem crime de abuso de autoridade quando praticadas pelo agente com a finalidade específica de prejudicar outrem ou beneficiar a si mesmo ou a terceiro, ou, ainda, por mero capricho ou satisfação pessoal.',
        'Lei 13.869/19, Art. 1º, § 2º A divergência na interpretação de lei ou na avaliação de fatos e provas não configura abuso de autoridade (vedação ao crime de hermenêutica).',
        'Lei 13.869/19, Art. 13 (Constrangimento a exibição do corpo/algemas/submissão a vexame) e Art. 22 (Invasão de domicílio clandestina ou cumprimento de mandado judicial de busca e apreensão domiciliar após as 21h ou antes das 5h).',
        'Lei 9.455/97 (Tortura), Art. 1º Constitui crime de tortura (crime comum, salvo a tortura-castigo do inciso II que é crime próprio de quem detém guarda/poder/autoridade): I - constranger alguém com emprego de violência ou grave ameaça, causando-lhe sofrimento físico ou mental: a) com o fim de obter informação, declaração ou confissão; b) para provocar ação ou omissão de natureza criminosa; c) em razão de discriminação racial ou religiosa.',
        'Lei 9.455/97, Art. 1º, § 2º (Tortura Omissiva / Imprópria): Aquele que se omite em face dessas condutas, quando tinha o dever de evitá-las ou apurá-las, incorre na pena de detenção de 1 a 4 anos (Única modalidade punida com detenção e cujo regime inicial não precisa ser o fechado!).'
      ]
    },
    {
      id: 'law-pe-estatuto-pmpe',
      discipline: 'Legislação Institucional PE',
      title: 'Lei Seca - Estatuto dos Policiais Militares de Pernambuco (Lei Estadual nº 6.783/74) e Código Disciplinar (Lei nº 11.817/00)',
      badge: 'Exclusivo PE',
      articles: [
        'Lei 6.783/74, Art. 2º A Polícia Militar de Pernambuco, subordinada operacionalmente à Secretaria de Defesa Social, é uma instituição permanente, força auxiliar e reserva do Exército, organizada com base na hierarquia e na disciplina.',
        'Lei 6.783/74, Art. 12. A hierarquia policial-militar é a ordenação da autoridade em níveis diferentes, dentro da estrutura da Polícia Militar. A ordenação se faz por postos (Oficiais) ou por graduações (Praças).',
        'Lei 6.783/74, Art. 13. A disciplina é a rigorosa observância e o acatamento integral das leis, regulamentos, normas e disposições que fundamentam o organismo policial-militar e coordenam seu funcionamento regular e harmônico.'
      ]
    }
  ];

  function getFavLaws() {
    try {
      return JSON.parse(localStorage.getItem(LAWS_FAV_KEY) || '[]');
    } catch (_e) {
      return [];
    }
  }

  function setFavLaws(arr) {
    try {
      localStorage.setItem(LAWS_FAV_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    } catch (_e) {}
  }

  function getHighlightedArticles() {
    try {
      return JSON.parse(localStorage.getItem(LAWS_HIGHLIGHT_KEY) || '{}');
    } catch (_e) {
      return {};
    }
  }

  function toggleHighlightArticle(key) {
    const map = getHighlightedArticles();
    if (map[key]) delete map[key];
    else map[key] = true;
    try {
      localStorage.setItem(LAWS_HIGHLIGHT_KEY, JSON.stringify(map));
    } catch (_e) {}
    return Boolean(map[key]);
  }

  function getAppStateSafe() {
    try {
      if (typeof state === 'object' && state) return state;
    } catch (_e) {}
    return (typeof window !== 'undefined' && window.state) ? window.state : {};
  }

  function getAllQuestionsSafe() {
    try {
      if (typeof ALL_QUESTIONS !== 'undefined' && Array.isArray(ALL_QUESTIONS)) return ALL_QUESTIONS;
    } catch (_e) {}
    return (typeof window !== 'undefined' && Array.isArray(window.ALL_QUESTIONS)) ? window.ALL_QUESTIONS : [];
  }

  function injectR179Styles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById('jcCaveiraSuiteR179Styles')) return;
    const style = document.createElement('style');
    style.id = 'jcCaveiraSuiteR179Styles';
    style.textContent = `
      /* === 1. Efeito Real e Imediato do Modo Visual Limpo (body.jcCleanDashboard) === */
      body.jcCleanDashboard .slBannerCard,
      body.jcCleanDashboard #slTrailHeroBanner,
      body.jcCleanDashboard #slBossesRaidBanner,
      body.jcCleanDashboard #slStudyHeroBanner,
      body.jcCleanDashboard .caveiraSprintBanner {
        display: none !important;
      }
      body.jcCleanDashboard .sectionHead p.small.muted,
      body.jcCleanDashboard .card > p.small.muted {
        display: none !important;
      }
      body.jcCleanDashboard .card:not(.hero) {
        padding: 14px 16px !important;
      }

      /* === 2. Layout Caveira para Redação, Flashcards, Painel Tático, Leis e Questões === */
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
        background: #181b21;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 10px;
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        transition: border-color 0.18s ease, transform 0.18s ease;
      }
      .jcCaveiraActionCard:hover {
        border-color: rgba(56, 189, 248, 0.45);
        transform: translateY(-1px);
      }
      .jcCaveiraActionTitle {
        font-size: 0.96rem;
        font-weight: 800;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .jcCaveiraActionSub {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: #94a3b8;
        line-height: 1.4;
      }
      .jcCaveiraActionBtn {
        align-self: flex-start;
        min-width: 140px;
        padding: 9px 18px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border: 1px solid rgba(56, 189, 248, 0.35);
        background: linear-gradient(135deg, #38bdf8, #0284c7);
        color: #090d16;
        cursor: pointer;
        text-align: center;
      }
      .jcCaveiraActionBtn.olive {
        background: #a3b899;
        border-color: #b5c9ab;
        color: #111814;
      }
      .jcCaveiraSectionTitle {
        font-size: 0.98rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #f8fafc;
        margin: 18px 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .jcCaveiraOverviewBox {
        background: #181b21;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 18px;
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
        font-weight: 800;
        line-height: 1;
        color: #f8fafc;
        margin: 10px 0 16px;
        font-variant-numeric: tabular-nums;
      }
      .jcCaveiraStatBox {
        border-radius: 8px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 132px;
      }
      .jcCaveiraStatBox.green {
        background: rgba(16, 185, 129, 0.11);
        border: 1px solid rgba(16, 185, 129, 0.25);
      }
      .jcCaveiraStatBox.blue {
        background: rgba(56, 189, 248, 0.11);
        border: 1px solid rgba(56, 189, 248, 0.25);
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

      /* === 3. Painel Tático (Estilo Caveira image_38d38c.png) === */
      .jcTacticalWrap {
        background: #14171d;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 14px;
        padding: 20px;
        margin-top: 18px;
      }
      .jcTacticalSegment {
        display: inline-flex;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 6px;
        overflow: hidden;
        background: #0f1217;
      }
      .jcTacticalSegBtn {
        background: transparent;
        border: 0;
        color: #cbd5e1;
        padding: 8px 18px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
      }
      .jcTacticalSegBtn.active {
        background: #334155;
        color: #ffffff;
      }
      .jcTacticalPeriodBar {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
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
        color: #ffffff;
        border-bottom-color: #f8fafc;
      }

      /* === 4. Funil de 3 Chevrons dos Flashcards (image_38d0c5.png) === */
      .jcChevronStageWrap {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 8px 0;
      }
      .jcChevronColumn {
        width: 58px;
        height: 170px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 12px 4px;
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #e2e8f0;
        position: relative;
        clip-path: polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%, 18% 50%);
      }
      .jcChevronColumn.stage1 { background: #2d333b; }
      .jcChevronColumn.stage2 { background: #465248; }
      .jcChevronColumn.stage3 { background: #6b7d69; }
      .jcChevronVertLabel {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
        font-size: 0.65rem;
        letter-spacing: 0.06em;
      }

      /* === 5. Central de Leis & Textos (Lei Seca image_38d36d.png) === */
      .jcLawsAccordionGroup {
        margin-bottom: 14px;
      }
      .jcLawsGroupHeader {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: transparent;
        border: 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        padding: 10px 4px;
        color: #f8fafc;
        font-size: 0.98rem;
        font-weight: 800;
        cursor: pointer;
        text-align: left;
      }
      .jcLawRowItem {
        background: #181b21;
        border: 1px solid rgba(148, 163, 184, 0.13);
        border-radius: 8px;
        padding: 13px 16px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .jcLawStartBtn {
        background: transparent;
        border: 1px solid rgba(163, 184, 153, 0.45);
        color: #a3b899;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
        white-space: nowrap;
      }
      .jcLawStartBtn:hover {
        background: #a3b899;
        color: #0f1411;
      }

      /* === 6. Pílulas Rápidas de Questões e Rodapé Caveira da Questão (image_38d04a.png / image_38d08b.png) === */
      .jcQuestionStatusPills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0 14px;
      }
      .jcQStatusPill {
        background: #181b21;
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: #cbd5e1;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
      }
      .jcQStatusPill.active {
        background: #475569;
        border-color: #94a3b8;
        color: #ffffff;
      }
      .jcQuestionCaveiraFooter {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(148, 163, 184, 0.16);
      }
      .jcQCaveiraToolBtn {
        background: transparent;
        border: 1px solid transparent;
        color: #94a3b8;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .jcQCaveiraToolBtn:hover {
        background: rgba(56, 189, 248, 0.1);
        border-color: rgba(56, 189, 248, 0.3);
        color: #f8fafc;
      }

      /* === 7. Suporte Total ao Tema Claro (body.lightAppTheme) para Todos os Componentes r179 === */
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
      body.lightAppTheme .jcCaveiraBigNumber,
      body.lightAppTheme .jcLawsGroupHeader {
        color: #090d16 !important;
      }
      body.lightAppTheme .jcCaveiraActionSub {
        color: #334155 !important;
        font-weight: 600 !important;
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
        background: #ecfdf5 !important;
        border: 1.5px solid #059669 !important;
        color: #065f46 !important;
      }
      body.lightAppTheme .jcQCaveiraToolBtn {
        color: #1e293b !important;
        border: 1px solid #cbd5e1 !important;
        background: #f8fafc !important;
      }
    `;
    document.head.appendChild(style);
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

  // 2) Hub de Redação Policial Estilo Caveira (image_38d3af.png)
  function mountCaveiraEssayHub() {
    if (typeof document === 'undefined') return;
    const essaySec = document.getElementById('essay');
    if (!essaySec) return;
    const st = getAppStateSafe();
    const essays = Array.isArray(st.essays) ? st.essays : [];
    const totalSent = essays.length;
    const graded = essays.filter(e => Number.isFinite(Number(e.score)) || e.feedback);
    const scores = graded.map(e => {
      const raw = Number(e.score || e.grade || 0);
      return raw <= 10 && raw > 0 ? Math.round(raw * 10) : Math.round(raw);
    }).filter(n => n >= 0);
    const bestPct = scores.length ? Math.max(...scores) : 0;
    const avgPct = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

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

    // Build SVG chart points for last 10 essays
    const last10 = scores.slice(-10);
    const pts = last10.map((val, idx) => {
      const x = 40 + idx * 36;
      const y = 140 - Math.round((Math.min(100, Math.max(0, val)) / 100) * 110);
      return `${x},${y}`;
    }).join(' ');

    const circlesHtml = last10.map((val, idx) => {
      const x = 40 + idx * 36;
      const y = 140 - Math.round((Math.min(100, Math.max(0, val)) / 100) * 110);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"><title>Envio ${idx + 1}: ${val}%</title></circle>`;
    }).join('');

    const recentRows = essays.slice(-4).reverse().map((e, i) => {
      const sc = Number(e.score || 0);
      const pct = sc <= 10 && sc > 0 ? Math.round(sc * 10) : Math.round(sc);
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:8px;background:rgba(148,163,184,0.08);margin-bottom:8px;">
          <div>
            <b style="font-size:.84rem;display:block;">${String(e.title || e.theme || 'Redação #' + (essays.length - i)).slice(0, 48)}</b>
            <span style="font-size:.73rem;color:#94a3b8;">${e.board || 'Padrão Policial'} · ${e.date || 'Registrada'}</span>
          </div>
          <span class="tag" style="font-weight:800;">${pct > 0 ? pct + '%' : 'Corrigida'}</span>
        </div>
      `;
    }).join('') || `<p class="small muted" style="margin:18px 0;">Nenhuma redação enviada ainda. Clique em <b>ACESSAR</b> acima para escrever ou enviar foto do seu rascunho.</p>`;

    hub.innerHTML = `
      <div class="jcCaveiraTopCards">
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">✍️ ENVIAR REDAÇÃO</div>
            <div class="jcCaveiraActionSub">ESCOLHA O FORMATO (DIGITADA OU FOTO/PDF) E ENVIE PARA CORREÇÃO</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn olive" id="jcEssayFocusFormBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">📋 ACOMPANHAR</div>
            <div class="jcCaveiraActionSub">VEJA STATUS, NOTA POR CRITÉRIO E FEEDBACK DOS SEUS ENVIOS</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn olive" id="jcEssayFocusHistoryBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">🧙‍♂️ TEMAS DO INVOCADOR</div>
            <div class="jcCaveiraActionSub">SORTEIE TEMA POLICIAL COM TEXTOS MOTIVADORES I E II NA HORA</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn olive" id="jcEssayTriggerThemeBtn">SORTEAR TEMA</button>
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
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#3b82f6;margin-right:6px;"></span>${totalSent} ENVIADAS</div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#eab308;margin-right:6px;"></span>0 EM CORREÇÃO</div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#22c55e;margin-right:6px;"></span>${graded.length} CORRIGIDAS</div>
            </div>
          </div>
          <div class="jcCaveiraStatBox green">
            <span style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">MELHOR RESULTADO</span>
            <strong style="font-size:2.1rem;font-weight:800;font-variant-numeric:tabular-nums;">${bestPct}%</strong>
          </div>
          <div class="jcCaveiraStatBox blue">
            <span style="font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">MÉDIA GERAL</span>
            <strong style="font-size:2.1rem;font-weight:800;font-variant-numeric:tabular-nums;">${avgPct}%</strong>
          </div>
        </div>
        <div style="font-size:.73rem;color:#94a3b8;margin-top:10px;">Atualizado com base nos últimos 50 envios registrados na sua campanha.</div>
      </div>

      <div class="jcCaveiraTwoCols">
        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
          <div style="font-size:.9rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">ÚLTIMOS ENVIOS (EVOLUÇÃO 0–100%)</div>
          <svg viewBox="0 0 400 165" style="width:100%;height:160px;overflow:visible;">
            <line x1="32" y1="30" x2="385" y2="30" stroke="rgba(148,163,184,0.14)" stroke-dasharray="3,3"/>
            <line x1="32" y1="85" x2="385" y2="85" stroke="rgba(148,163,184,0.14)" stroke-dasharray="3,3"/>
            <line x1="32" y1="140" x2="385" y2="140" stroke="rgba(148,163,184,0.35)"/>
            <text x="6" y="34" fill="#94a3b8" font-size="10">100</text>
            <text x="12" y="88" fill="#94a3b8" font-size="10">50</text>
            <text x="18" y="143" fill="#94a3b8" font-size="10">0</text>
            ${pts ? `<polyline fill="none" stroke="#38bdf8" stroke-width="2.5" points="${pts}"/>` : ''}
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
      triggerThemeBtn.onclick = () => {
        const aiBtn = document.getElementById('generateAiEssayThemeBtn') || document.getElementById('drawEssayThemeBtn');
        if (aiBtn) aiBtn.click();
        const box = document.getElementById('essayMotivatingBox') || document.getElementById('essayTheme');
        if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
    }
  }

  // 3) Painel Tático Interativo no Perfil Social (image_38d38c.png)
  let tacticalTabMode = 'questions'; // 'questions' | 'flashcards' | 'edital'
  let tacticalPeriodDays = 30; // 1 | 7 | 15 | 30 | 90 | 180 | 365 | 9999

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

    const st = getAppStateSafe();
    const scores = Array.isArray(st.scores) ? st.scores : [];
    const masteryBag = (st.topicMastery && typeof st.topicMastery === 'object') ? st.topicMastery : {};

    // Aggregate discipline stats
    const byDisc = new Map();
    Object.values(masteryBag).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const dName = String(entry.subject || entry.subjectKey || 'Geral').trim() || 'Geral';
      const cur = byDisc.get(dName) || { total: 0, correct: 0, wrong: 0 };
      const att = Number(entry.attempts || 0);
      const cor = Number(entry.correct || 0);
      cur.total += att;
      cur.correct += cor;
      cur.wrong += Math.max(0, att - cor);
      byDisc.set(dName, cur);
    });

    if (byDisc.size === 0 && scores.length > 0) {
      scores.forEach((sc) => {
        const dName = String(sc.subject || 'Treino Geral');
        const cur = byDisc.get(dName) || { total: 0, correct: 0, wrong: 0 };
        const tot = Number(sc.total || 0);
        const cor = Number(sc.correct || 0);
        cur.total += tot;
        cur.correct += cor;
        cur.wrong += Math.max(0, tot - cor);
        byDisc.set(dName, cur);
      });
    }

    let totalRight = 0;
    let totalWrong = 0;
    byDisc.forEach((v) => {
      totalRight += v.correct;
      totalWrong += v.wrong;
    });
    const grandTotal = totalRight + totalWrong;
    const accPct = grandTotal > 0 ? Math.round((totalRight / grandTotal) * 100) : 0;

    // Build 10 timeline points for ACERTEI x ERREI SVG
    const pointCount = 10;
    const hitPoints = [];
    const missPoints = [];
    for (let i = 0; i < pointCount; i++) {
      const x = 38 + i * 35;
      const sliceSc = scores[scores.length - pointCount + i];
      const rVal = sliceSc ? Number(sliceSc.correct || 0) : (i === pointCount - 1 && totalRight > 0 ? Math.min(20, totalRight) : 0);
      const wVal = sliceSc ? Math.max(0, Number(sliceSc.total || 0) - Number(sliceSc.correct || 0)) : (i === pointCount - 1 && totalWrong > 0 ? Math.min(20, totalWrong) : 0);
      const yR = 135 - Math.min(105, rVal * 5);
      const yW = 135 - Math.min(105, wVal * 5);
      hitPoints.push({ x, y: yR, v: rVal });
      missPoints.push({ x, y: yW, v: wVal });
    }

    const hitLine = hitPoints.map(p => `${p.x},${p.y}`).join(' ');
    const missLine = missPoints.map(p => `${p.x},${p.y}`).join(' ');

    const rowsHtml = Array.from(byDisc.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 12)
      .map(([disc, d]) => {
        const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
        const barColor = pct >= 70 ? '#10b981' : (pct >= 50 ? '#f59e0b' : '#ef4444');
        return `
          <div style="display:grid;grid-template-columns:2fr 0.7fr 1.1fr 1fr;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.12);font-size:.82rem;">
            <div style="font-weight:700;">${disc}</div>
            <div style="font-variant-numeric:tabular-nums;">${d.total}</div>
            <div style="font-variant-numeric:tabular-nums;">
              <span style="color:#38bdf8;font-weight:700;">${d.correct}</span> / <span style="color:#f43f5e;font-weight:700;">${d.wrong}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="flex:1;height:7px;background:rgba(148,163,184,0.2);border-radius:999px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:${barColor};"></div>
              </div>
              <b style="font-size:.76rem;min-width:34px;text-align:right;">${pct}%</b>
            </div>
          </div>
        `;
      }).join('') || `<div style="padding:18px;text-align:center;color:#94a3b8;font-size:.83rem;">Resolva questões na aba Questões ou na Trilha Tática para popular a Análise de Performance por Disciplina.</div>`;

    const periods = [
      { d: 1, label: 'HOJE' },
      { d: 7, label: '7 DIAS' },
      { d: 15, label: '15 DIAS' },
      { d: 30, label: 'UM MÊS' },
      { d: 90, label: 'TRÊS MESES' },
      { d: 180, label: 'SEIS MESES' },
      { d: 365, label: '1 ANO' },
      { d: 9999, label: 'PERSONALIZADO' }
    ];

    sec.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
        <div>
          <div class="eyebrow" style="color:#38bdf8;">TELEMETRIA DE COMBATE · PADRÃO CAVEIRA</div>
          <h3 style="margin:2px 0 0;font-size:1.15rem;text-transform:uppercase;letter-spacing:.04em;">📊 PAINEL TÁTICO</h3>
        </div>
        <div class="jcTacticalSegment">
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'questions' ? 'active' : ''}" data-tact-mode="questions">Questões</button>
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'flashcards' ? 'active' : ''}" data-tact-mode="flashcards">Flashcards</button>
          <button type="button" class="jcTacticalSegBtn ${tacticalTabMode === 'edital' ? 'active' : ''}" data-tact-mode="edital">Turmas & Edital</button>
        </div>
      </div>

      <div class="jcTacticalPeriodBar">
        ${periods.map(p => `<button type="button" class="jcTacticalPeriodBtn ${tacticalPeriodDays === p.d ? 'active' : ''}" data-tact-days="${p.d}">${p.label}</button>`).join('')}
      </div>

      <div class="jcCaveiraTwoCols">
        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
          <div style="font-size:.86rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">ACERTEI x ERREI</div>
          <svg viewBox="0 0 390 165" style="width:100%;height:160px;overflow:visible;">
            <line x1="30" y1="30" x2="370" y2="30" stroke="rgba(148,163,184,0.14)" stroke-dasharray="3,3"/>
            <line x1="30" y1="82" x2="370" y2="82" stroke="rgba(148,163,184,0.14)" stroke-dasharray="3,3"/>
            <line x1="30" y1="135" x2="370" y2="135" stroke="rgba(148,163,184,0.35)"/>
            <polyline fill="none" stroke="#38bdf8" stroke-width="2.2" points="${hitLine}"/>
            <polyline fill="none" stroke="#f43f5e" stroke-width="2.2" points="${missLine}"/>
            ${hitPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#38bdf8"/>`).join('')}
            ${missPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#f43f5e"/>`).join('')}
          </svg>
          <div style="display:flex;justify-content:center;gap:18px;font-size:.76rem;font-weight:700;margin-top:6px;">
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#38bdf8;margin-right:5px;"></span>Acertei (${totalRight})</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#f43f5e;margin-right:5px;"></span>Errei (${totalWrong})</span>
          </div>
        </div>

        <div class="jcCaveiraOverviewBox" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="font-size:.86rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">TOTAL DO PERÍODO</div>
          <div style="display:flex;align-items:center;justify-content:space-around;gap:16px;padding:12px 0;">
            <div style="text-align:center;">
              <div style="font-size:2.4rem;font-weight:900;font-variant-numeric:tabular-nums;">${grandTotal}</div>
              <div style="font-size:.73rem;color:#94a3b8;text-transform:uppercase;">Resolvidas · ${accPct}% Acerto</div>
            </div>
            <div style="display:grid;gap:8px;font-size:.82rem;font-weight:700;">
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:6px;"></span>Acertei: <b>${totalRight}</b></div>
              <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f43f5e;margin-right:6px;"></span>Errei: <b>${totalWrong}</b></div>
            </div>
          </div>
          <div style="height:10px;border-radius:999px;background:rgba(244,63,94,0.28);overflow:hidden;">
            <div style="width:${accPct}%;height:100%;background:#38bdf8;"></div>
          </div>
        </div>
      </div>

      <div class="jcCaveiraOverviewBox" style="margin-bottom:0;">
        <div style="font-size:.88rem;font-weight:800;text-transform:uppercase;margin-bottom:10px;">ANÁLISE DE PERFORMANCE</div>
        <div style="display:grid;grid-template-columns:2fr 0.7fr 1.1fr 1fr;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(148,163,184,0.22);font-size:.75rem;color:#94a3b8;font-weight:800;text-transform:uppercase;">
          <div>Disciplina / Assunto</div>
          <div>Total</div>
          <div>Acertei / Errei</div>
          <div>Aproveitamento</div>
        </div>
        ${rowsHtml}
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

  // 4) Hub de Flashcards Estilo Caveira com Funil de 3 Chevrons (image_38d0c5.png)
  function mountCaveiraFlashcardsHub() {
    if (typeof document === 'undefined') return;
    const cardsPanel = document.getElementById('cards');
    if (!cardsPanel) return;

    const st = getAppStateSafe();
    const deck = Array.isArray(st.flashcards) ? st.flashcards : [];
    const ratings = (st.cardRatings && typeof st.cardRatings === 'object') ? st.cardRatings : {};
    let inReview = 0, shortMem = 0, longMem = 0;
    Object.values(ratings).forEach((r) => {
      const val = typeof r === 'object' ? r.difficulty : r;
      if (val === 'easy') longMem++;
      else if (val === 'medium' || val === 'good') shortMem++;
      else inReview++;
    });
    const totalSolved = inReview + shortMem + longMem;

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
            <div class="jcCaveiraActionTitle">📖 MEUS FLASHCARDS</div>
            <div class="jcCaveiraActionSub">CARDS CRIADOS POR VOCÊ E EXTRAÍDOS DOS SEUS PDFS</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashFocusDeckBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">⚔️ CARDS DO CAÇADOR</div>
            <div class="jcCaveiraActionSub">CARDS TÁTICOS DAS DISCIPLINAS DO EDITAL (${deck.length || 'ATIVOS'})</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashFilterAllBtn">ACESSAR</button>
        </div>
        <div class="jcCaveiraActionCard">
          <div>
            <div class="jcCaveiraActionTitle">🔄 REVISÃO 1·7·30</div>
            <div class="jcCaveiraActionSub">REVISAR CARDS RESOLVIDOS ANTERIORMENTE (${inReview} PENDENTES)</div>
          </div>
          <button type="button" class="jcCaveiraActionBtn" id="jcFlashOpenReviewBtn">ACESSAR</button>
        </div>
      </div>

      <div class="jcCaveiraSectionTitle">📊 MEU DESEMPENHO — FLASHCARDS</div>
      <div class="jcCaveiraOverviewBox">
        <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:20px;align-items:center;">
          <div>
            <div style="font-size:.95rem;font-weight:800;text-transform:uppercase;">VISÃO GERAL</div>
            <div style="font-size:.74rem;color:#94a3b8;">Total de flashcards resolvidos</div>
            <div class="jcCaveiraBigNumber">${totalSolved}</div>
            <div style="display:grid;gap:6px;font-size:.76rem;font-weight:700;">
              <div>🏳️ <b>${inReview}</b> EM REVISÃO</div>
              <div>🏳️ <b>${shortMem}</b> MEMÓRIA DE CURTO PRAZO</div>
              <div>🏳️ <b>${longMem}</b> MEMÓRIA DE LONGO PRAZO</div>
            </div>
          </div>
          <div class="jcChevronStageWrap" aria-label="Estágios de memória dos flashcards">
            <div class="jcChevronColumn stage1">
              <span class="jcChevronVertLabel">EM REVISÃO</span>
              <b>${inReview}</b>
            </div>
            <div class="jcChevronColumn stage2">
              <span class="jcChevronVertLabel">MEMÓRIA CURTA</span>
              <b>${shortMem}</b>
            </div>
            <div class="jcChevronColumn stage3">
              <span class="jcChevronVertLabel">MEMÓRIA LONGA</span>
              <b>${longMem}</b>
            </div>
          </div>
        </div>
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
        if (cf) { cf.value = 'all'; cf.dispatchEvent(new Event('change')); }
        scrollCard();
      };
    }
    if (revBtn) {
      revBtn.onclick = () => {
        if (typeof window.openView === 'function') window.openView('review');
      };
    }
  }

  // 5) Central de Leis & Textos (Lei Seca Interativa — image_38d36d.png & image_38d3d1.png)
  let lawsFilterFavOnly = false;
  let lawsSearchQuery = '';
  let activeLawModalItem = null;

  function mountCaveiraSmartLawsHub() {
    if (typeof document === 'undefined') return;
    const studySec = document.getElementById('study');
    if (!studySec) return;

    const tabsWrap = studySec.querySelector('.studyTabs');
    if (tabsWrap && !document.getElementById('jcStudyLawsTabBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studyTab';
      btn.id = 'jcStudyLawsTabBtn';
      btn.setAttribute('data-study', 'laws');
      btn.innerHTML = '⚖️ Leis & Textos';
      btn.onclick = () => openSmartLawsSubtab();
      tabsWrap.appendChild(btn);
    }

    // Also add a quick shortcut inside #summaries filter bar so users in Resumos see "⚖️ Leis & Textos (Lei Seca)" right away
    const sumFilters = studySec.querySelector('#summaries .summaryFilters');
    if (sumFilters && !document.getElementById('jcQuickOpenLawsFromSummariesBtn')) {
      const qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.id = 'jcQuickOpenLawsFromSummariesBtn';
      qBtn.className = 'ghost small';
      qBtn.style.cssText = 'white-space:nowrap;font-weight:800;';
      qBtn.innerHTML = '⚖️ Leis & Textos (Lei Seca)';
      qBtn.onclick = () => openSmartLawsSubtab();
      sumFilters.appendChild(qBtn);
    }

    let lawsPanel = document.getElementById('laws');
    if (!lawsPanel) {
      lawsPanel = document.createElement('div');
      lawsPanel.className = 'studyPanel';
      lawsPanel.id = 'laws';
      studySec.appendChild(lawsPanel);
    }

    renderSmartLawsPanelContent(lawsPanel);
  }

  function openSmartLawsSubtab() {
    if (typeof document === 'undefined') return;
    mountCaveiraSmartLawsHub();
    const studySec = document.getElementById('study');
    if (!studySec) return;
    studySec.querySelectorAll('.studyTab').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-study') === 'laws');
    });
    studySec.querySelectorAll('.studyPanel').forEach(p => {
      p.classList.toggle('active', p.id === 'laws');
    });
  }
  if (typeof window !== 'undefined') window.openSmartLawsSubtab = openSmartLawsSubtab;

  function renderSmartLawsPanelContent(lawsPanel) {
    if (!lawsPanel) lawsPanel = document.getElementById('laws');
    if (!lawsPanel) return;

    const favs = new Set(getFavLaws());
    const qNorm = String(lawsSearchQuery || '').trim().toLowerCase();

    const filtered = NATIVE_SMART_LAWS.filter((item) => {
      if (lawsFilterFavOnly && !favs.has(item.id)) return false;
      if (!qNorm) return true;
      const hay = `${item.discipline} ${item.title} ${item.articles.join(' ')}`.toLowerCase();
      return hay.includes(qNorm);
    });

    const grouped = new Map();
    filtered.forEach((item) => {
      if (!grouped.has(item.discipline)) grouped.set(item.discipline, []);
      grouped.get(item.discipline).push(item);
    });

    const groupsHtml = Array.from(grouped.entries()).map(([disc, items]) => `
      <div class="jcLawsAccordionGroup">
        <div class="jcLawsGroupHeader">
          <span>${disc}</span>
          <span style="font-size:.76rem;color:#94a3b8;">${items.length} diploma(s) ▴</span>
        </div>
        <div>
          ${items.map(item => `
            <div class="jcLawRowItem">
              <div style="display:flex;align-items:center;gap:10px;">
                <button type="button" class="ghost small" data-law-fav="${item.id}" style="padding:4px 8px;font-size:.85rem;" title="Favoritar Lei">
                  ${favs.has(item.id) ? '⭐' : '☆'}
                </button>
                <div>
                  <div style="font-weight:700;font-size:.88rem;">${item.title}</div>
                  <div style="font-size:.73rem;color:#94a3b8;margin-top:2px;">${item.badge} · ${item.articles.length} artigos/dispositivos táticos</div>
                </div>
              </div>
              <button type="button" class="jcLawStartBtn" data-law-open="${item.id}">COMEÇAR</button>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') || `<p class="small muted" style="padding:16px 0;">Nenhuma lei encontrada para o filtro selecionado.</p>`;

    const readerHtml = activeLawModalItem ? renderActiveLawReaderHtml(activeLawModalItem) : '';

    lawsPanel.innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;border-bottom:1px solid rgba(148,163,184,0.18);padding-bottom:10px;margin-bottom:14px;">
        <button type="button" class="ghost small ${!lawsFilterFavOnly ? 'active' : ''}" id="jcLawsTabAllBtn" style="font-weight:800;">📋 Listagem (${NATIVE_SMART_LAWS.length})</button>
        <button type="button" class="ghost small ${lawsFilterFavOnly ? 'active' : ''}" id="jcLawsTabFavBtn" style="font-weight:800;">⭐ Favoritos (${favs.size})</button>
      </div>
      <div style="margin-bottom:16px;">
        <input type="search" id="jcLawsSearchInput" value="${lawsSearchQuery.replace(/"/g, '&quot;')}" placeholder="PESQUISA — Digite lei, número (ex.: 8.429, Art. 5º, Art. 144, Peculato, Deserção)..." style="width:100%;padding:11px 14px;border-radius:8px;">
      </div>
      ${readerHtml}
      <div id="jcLawsAccordionContainer">
        ${groupsHtml}
      </div>
    `;

    const allBtn = document.getElementById('jcLawsTabAllBtn');
    const favBtn = document.getElementById('jcLawsTabFavBtn');
    const sInp = document.getElementById('jcLawsSearchInput');
    if (allBtn) allBtn.onclick = () => { lawsFilterFavOnly = false; renderSmartLawsPanelContent(lawsPanel); };
    if (favBtn) favBtn.onclick = () => { lawsFilterFavOnly = true; renderSmartLawsPanelContent(lawsPanel); };
    if (sInp) {
      sInp.oninput = () => {
        lawsSearchQuery = sInp.value || '';
        renderSmartLawsPanelContent(lawsPanel);
      };
    }

    lawsPanel.querySelectorAll('[data-law-fav]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-law-fav');
        const cur = new Set(getFavLaws());
        if (cur.has(id)) cur.delete(id);
        else cur.add(id);
        setFavLaws(Array.from(cur));
        renderSmartLawsPanelContent(lawsPanel);
      };
    });

    lawsPanel.querySelectorAll('[data-law-open]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-law-open');
        activeLawModalItem = NATIVE_SMART_LAWS.find(l => l.id === id) || null;
        renderSmartLawsPanelContent(lawsPanel);
      };
    });

    const closeReaderBtn = document.getElementById('jcCloseLawReaderBtn');
    if (closeReaderBtn) {
      closeReaderBtn.onclick = () => {
        activeLawModalItem = null;
        renderSmartLawsPanelContent(lawsPanel);
      };
    }

    lawsPanel.querySelectorAll('[data-law-highlight]').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-law-highlight');
        toggleHighlightArticle(key);
        renderSmartLawsPanelContent(lawsPanel);
      };
    });

    const invokeLawBtn = document.getElementById('jcInvokeLawAiBtn');
    if (invokeLawBtn && activeLawModalItem) {
      invokeLawBtn.onclick = () => {
        if (typeof window.openView === 'function') window.openView('assistant');
        const qInput = document.getElementById('aiQuestion');
        if (qInput) {
          qInput.value = `Invocador, crie 3 questões inéditas no estilo AOCP/Cebraspe e aponte as principais pegadinhas sobre: ${activeLawModalItem.title}`;
          qInput.focus();
        }
      };
    }
  }

  function renderActiveLawReaderHtml(law) {
    const highlights = getHighlightedArticles();
    return `
      <div class="jcCaveiraOverviewBox" id="jcActiveLawReaderBox" style="border:1.5px solid #38bdf8;margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div>
            <span class="tag">${law.discipline}</span>
            <h3 style="margin:6px 0 0;font-size:1.02rem;">⚖️ ${law.title}</h3>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="action small" id="jcInvokeLawAiBtn">🧙‍♂️ Invocar Questões desta Lei</button>
            <button type="button" class="ghost small" id="jcCloseLawReaderBtn">✕ Fechar Leitura</button>
          </div>
        </div>
        <div style="display:grid;gap:10px;">
          ${law.articles.map((art, idx) => {
            const hKey = `${law.id}:${idx}`;
            const isHi = Boolean(highlights[hKey]);
            return `
              <div style="padding:12px 14px;border-radius:8px;border:1px solid ${isHi ? '#eab308' : 'rgba(148,163,184,0.18)'};background:${isHi ? 'rgba(234,179,8,0.15)' : 'rgba(15,23,42,0.35)'};display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <p style="margin:0;line-height:1.55;font-size:.88rem;">${art}</p>
                <button type="button" class="ghost small" data-law-highlight="${hKey}" title="Grifar dispositivo" style="padding:4px 8px;flex-shrink:0;">
                  ${isHi ? '🖍️ Grifado' : '🖍️ Grifar'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 6) Pílulas Rápidas de Status na Aba Questões (image_38d04a.png) + Barra Inferior da Questão com Invocador (image_38d08b.png)
  function mountCaveiraQuestionBankEnhancements() {
    if (typeof document === 'undefined') return;
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

        pillsBar.querySelectorAll('[data-q-status-pill]').forEach((btn) => {
          btn.onclick = () => {
            pillsBar.querySelectorAll('[data-q-status-pill]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const status = btn.getAttribute('data-q-status-pill');
            if (status === 'wrong') {
              const errBtn = document.getElementById('openErrorNotebookBtn') || document.getElementById('startErrorReviewBtn');
              if (errBtn) errBtn.click();
            } else if (typeof window.renderReport === 'function') {
              window._jcQuestionStatusFilter = status;
              try { window.renderReport(); } catch (_e) {}
            }
          };
        });
      }
    }

    // Inject Caveira Bottom Toolbar (#jcCaveiraQuestionToolbar) inside #questionDialog (.questionBox)
    const qDialog = document.getElementById('questionDialog');
    const qBox = qDialog ? qDialog.querySelector('.questionBox') : null;
    const qFeedback = document.getElementById('questionFeedback');
    if (qBox && qFeedback && !document.getElementById('jcCaveiraQuestionToolbar')) {
      const bar = document.createElement('div');
      bar.id = 'jcCaveiraQuestionToolbar';
      bar.className = 'jcQuestionCaveiraFooter';
      bar.innerHTML = `
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarInvocadorBtn" title="Invocar explicação tática da IA">🧙‍♂️ INVOCADOR</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarProfCommentBtn" title="Ver Comentário do Professor e Gabarito">🎓 COMENTÁRIO DO PROFESSOR</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarTheoryBtn" title="Ler Resumo ou Lei Seca deste Assunto">📖 TEORIA &amp; LEI</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarNotebookBtn" title="Salvar questão no seu Caderno">📓 CADERNOS</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarNotesBtn" title="Adicionar anotação ou bizu pessoal">✏️ ANOTAÇÕES</button>
        <button type="button" class="jcQCaveiraToolBtn" id="jcQBarStatsBtn" title="Ver estatísticas de acerto da questão">📈 ESTATÍSTICAS</button>
      `;
      qBox.insertBefore(bar, qFeedback);

      document.getElementById('jcQBarInvocadorBtn').onclick = () => {
        const qap = document.getElementById('askQapInstructorBtn') || document.getElementById('explainEasyAnalogyBtn');
        if (qap) { qap.click(); return; }
        if (typeof window.toast === 'function') window.toast('🧙‍♂️ Responda a questão para destravar a análise passo a passo do Invocador!');
      };
      document.getElementById('jcQBarProfCommentBtn').onclick = () => {
        if (qFeedback && qFeedback.textContent.trim()) {
          qFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (typeof window.toast === 'function') {
          window.toast('🎓 Marque uma alternativa primeiro para revelar o Comentário do Professor!');
        }
      };
      document.getElementById('jcQBarTheoryBtn').onclick = () => {
        const pills = document.getElementById('questionMetaPills');
        const subj = pills ? pills.textContent : '';
        if (qDialog && typeof qDialog.close === 'function') qDialog.close();
        if (typeof window.openTheorySummaryForTopic === 'function') {
          window.openTheorySummaryForTopic(subj, subj);
        } else if (typeof window.openView === 'function') {
          window.openView('study');
        }
      };
      document.getElementById('jcQBarNotebookBtn').onclick = () => {
        const fav = document.getElementById('toggleFavoriteQuestionBtn') || document.getElementById('saveQuestionNoteBtn');
        if (fav) { fav.click(); return; }
        if (typeof window.toast === 'function') window.toast('📓 Questão marcada no seu Caderno Tático!');
      };
      document.getElementById('jcQBarNotesBtn').onclick = () => {
        const inp = document.getElementById('personalQuestionCommentInput');
        if (inp) { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); return; }
        if (typeof window.toast === 'function') window.toast('✏️ Responda a questão para abrir o campo de Bizu Pessoal abaixo do gabarito!');
      };
      document.getElementById('jcQBarStatsBtn').onclick = () => {
        if (typeof window.toast === 'function') {
          window.toast('📈 Estatísticas por alternativa (A–E) exibidas junto às opções após a resposta!');
        }
      };
    }

    // Rename any remaining "Instrutor IA" inside question modal footer to "🧙‍♂️ Invocador"
    const qapBtn = document.getElementById('askQapInstructorBtn');
    if (qapBtn && !qapBtn.textContent.includes('Invocador')) {
      qapBtn.innerHTML = '🧙‍♂️ Invocador';
    }
  }

  function initAllR179() {
    injectR179Styles();
    tickTrailHearts20MinRegen();
    mountCaveiraEssayHub();
    mountPainelTaticoInProfile();
    mountCaveiraFlashcardsHub();
    mountCaveiraSmartLawsHub();
    mountCaveiraQuestionBankEnhancements();
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
      mountCaveiraQuestionBankEnhancements,
      NATIVE_SMART_LAWS
    };

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initAllR179, 60));
      } else {
        setTimeout(initAllR179, 60);
      }
      if (typeof setInterval === 'function') setInterval(tickTrailHearts20MinRegen, 1000);
    }
  }
})();
