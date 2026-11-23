# Conferência r187 — evidências, alterações e limites

23/11/2026. Base da revisão: r186 `7519ac5970b7accc7364cd685018f50d2d605fff`. Foram lidos os prints e o texto anexado com a análise do Gemini como evidências do problema. As propostas técnicas anexadas foram verificadas contra o código antes de adotadas.

## Painéis e sincronização

O controlador r186 apagava a validade dos painéis e o CSS escondia seus filhos durante qualquer atualização marcada como ocupada. Comparar arrays por identidade também tratava cópias iguais como mudanças. Isso reproduzia o estado “Preparando este painel…” em um painel já montado. A r187 mantém a montagem, agrupa notificações, compara conteúdo significativo e restaura filtros, foco, detalhes e rolagem após atualização real. Troca de conta/portal/reset limpa o contexto anterior; preservar uma tela não pode expor o conteúdo de outra conta.

A sidebar tinha Home como destaque inicial e dependia de um hook específico de openView. A r187 deriva o destaque da `.view.active` real, sincroniza na inicialização e acompanha mudanças pertinentes de classes/views por observer único. A navegação deixou de disparar o init global que remontava módulos/auditava questões mesmo em telas não relacionadas.

A hipótese do Gemini de que `realignStudyDisciplinesWithLibrary` chamava save a cada execução não correspondia ao código de partida: ela não fazia isso. Existiam, porém, substituições de arrays e atualizações visuais desnecessárias, além de carregadores e caminhos comunitários sem comparação semântica suficiente. Também havia problemas concretos de cache global e respostas assíncronas em contexto antigo. Foram corrigidos os caminhos reais, mantendo salvamento quando existe alteração legítima do progresso.

Uma bolinha amarela sozinha não comprova loop no servidor. Os testes verificam o comportamento do cliente: fontes iguais não repetem persistência/montagem/dirty; mudanças de conteúdo reais continuam aplicando; alterações pessoais e respostas antigas ficam isoladas. Não foram consultados os logs ou o `user_state` real da conta do usuário.

## Contagens

Os valores 2.435/2.365 no banco e 934 disponíveis foram relatados no texto enviado. A revisão não acessou esse banco para reconstruir cada exclusão. O resumo novo calcula os motivos com o conjunto efetivamente carregado e o pool efetivamente usado pelo botão. Revisa conteúdo/classificação/banca, chave pendente, anulação e filtros/modo, sem contar um registro em dois motivos.

O cenário automatizado 2.365 = 934 prontas + 600 revisão + 300 sem chave + 31 anuladas + 500 fora dos filtros é uma coleção de teste para conferir a partição. Esses subtotais não são diagnóstico factual da conta do usuário. Bases complementares são indicadas separadamente quando não fazem parte do array do banco local.

## Extração, texto e alternativas

O extrator de PDF descartava dados de avanço/posição e usava junção com espaços entre fragmentos. A r187 reconstrói as linhas usando os dados geométricos, preserva espaços explícitos e usa fallback conservador quando faltam metadados. O limiar não foi fixado cegamente em 0,18 da fonte: fontes estreitas, orientação, espaços reais, colunas e símbolos foram testados.

Na apresentação/importação, as correções tipográficas conhecidas preservam artigos/preposições reais A/O/E, palavras desconhecidas, código e matemática. Exemplos enviados — “S empre”, “responsáve l”, “ilegal idade”, “fazê - lo”, “aplica - se”, “habeas - corpus” e “licença - maternidade” — têm testes próprios. Isso não representa um corretor ortográfico universal de OCR.

As alternativas “Propaganda comercial. Assinale ... a) ... b) ... c)” e “Mulheres ... GABARITO COMENTADO - BLOCO 11 401.” foram reproduzidas. Um corte de apresentação só ocorre com limite confiável. O original completo, a cauda, os dados de fonte e as revisões/gabaritos anteriores ficam guardados em `text_integrity_review`; a questão fica bloqueada. Caudas ambíguas são preservadas inteiras para revisão. Listas legais, citações, títulos e exemplos de código têm casos negativos para evitar cortes indevidos.

Uma sequência interna de opções não é promovida automaticamente a questão nova. O parser também foi corrigido para não transformar um `e)` engolido por D em alternativa E legítima. A parte perdida precisa ser recuperada do PDF, não inventada. A reanálise gera proposta separada; não altera o banco ativo enquanto não houver aplicação autorizada.

## Assunto e banca

Questões de competência dos arts. 21–24 da CF são separadas de Art. 5º; Art. 22 e 24, remédios específicos e direitos sociais também têm testes de não equivalência. Um termo solto no enunciado não basta para encaixar uma questão em um assunto específico. Recortes estritos podem, portanto, ter menos questões prontas, com o motivo indicado.

Batalha/progressivo, reforço, fallback de erros, sprint e simulado filtrado respeitam os seletores. Simulado do portal inteiro continua com abrangência do portal. Retomadas usam o recorte salvo original quando existe; versões antigas sem esse contexto não permitem reconstruir filtros históricos ausentes, mas seguem as verificações de elegibilidade disponíveis.

A banca explícita reconhecida no começo do enunciado, como `(FUNCAB)`, prevalece sobre padrão herdado; menções em citações/corpo ou nome do arquivo não bastam. Decisões humanas e referências são preservadas, e divergências aguardam revisão. Métricas novas usam a banca correta; dados históricos não são reatribuídos por suposição.

## Escopo e limites

A biblioteca compartilhada foi preservada. Manuais do Caçador permanecem como ajuda. Os dois arquivos principais ainda são grandes: foram corrigidos os caminhos em cascata e extraídas regras para módulos específicos; não se trata de reescrita integral da arquitetura.

Não houve acesso aos PDFs/banco privados, alteração de gabaritos em produção, migração remota, deploy de Edge Function, merge em main ou publicação do site. A r187 não acrescenta SQL/Edge Function, mas o pacote completo desde r181 exige conferir os pré-requisitos anteriores descritos no guia.

Não houve homologação visual ou medição de tempo no celular. A ferramenta autorizada de navegador estava indisponível. A regra lida em [sites/SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) determina: “If cua_repl.js is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” A suíte preparada de navegador permanece disponível para execução no ambiente do usuário/workflow manual. Os testes Node/VM e SQL local não substituem essa homologação nem certificam a correção factual do acervo.
