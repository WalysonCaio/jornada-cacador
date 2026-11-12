# Jornada do Caçador — revisão técnica e pedagógica r172

**Data:** 12/11/2026. **Entrada:** `jornada-cacador.rar`. **Resultado:** correções no código, testes locais, migração incremental, recomendações e roteiro de publicação.

## Parecer executivo

O diferencial mais promissor é integrar edital, material do próprio estudante, preparação para carreiras de segurança, rotina, revisão e gamificação. O projeto tem amplitude de funcionalidades e várias proteções já implementadas. Seu principal problema não é falta de funcionalidades: é a confiança no conteúdo, nas métricas e na integração de muitas alterações acumuladas.

**Nota da versão recebida: 5,8/10. Nota técnica provisória do pacote revisado: 6,7/10.** São médias simples dos oito critérios abaixo, arredondadas. Não representam satisfação de usuários, auditoria de produção nem precisão medida dos modelos. A revisão melhora problemas demonstráveis, mas não autoriza chamar o produto de “100% validado”.

| Critério | Recebido | Revisado | Fundamentação |
|---|---:|---:|---|
| Proposta de produto | 8,5 | 8,5 | Integração relevante; originalidade comercial absoluta não foi demonstrada |
| Organização pedagógica | 7,0 | 7,5 | Missões, revisões e erros são úteis; filtros passam a respeitar melhor a escolha |
| Integridade da IA e das questões | 5,5 | 7,0 | Removidos gabarito A por padrão, heurística rotulada como IA e alteração automática de conteúdo |
| Métricas de aprendizagem | 5,0 | 6,0 | Correção proposta para coluna SQL, histórico pessoal melhor identificado; faltam eventos confiáveis e deduplicação |
| Confiabilidade e publicação | 5,0 | 6,5 | Cache corrigido, endereços alinhados e execução de testes padronizada |
| Segurança dos fluxos revisados | 5,5 | 6,5 | Protocolos externos restringidos e PATCH de redação limitado ao proprietário; RLS real ainda precisa ser exercitada |
| Arquitetura e manutenção | 4,0 | 4,5 | Persistem arquivos enormes, variáveis globais e sobrescritas de funções |
| Testes e reprodutibilidade | 5,5 | 7,0 | 16 scripts aprovados e CI novo; faltam integração de banco, E2E e builds nativos |

**Recomendação:** homologar esta revisão antes de atualizar usuários reais. Priorizar confiabilidade e curadoria antes de acrescentar novas telas. A biblioteca e seu modelo de compartilhamento foram preservados: nenhuma política de biblioteca foi alterada.

## O que foi realmente examinado

- Inventário de 2.095 arquivos extraídos, incluindo histórico Git e artefatos de compilação. Inventário não significa revisão humana linha a linha de todos esses arquivos.
- Aplicação em `dist`, caminhos de questões, filtros, revisão, notas, histórico e organização de estudo; principais funções de IA; migrações e métricas; wrappers Android/Windows; service worker, cabeçalhos e workflows.
- 13 scripts de teste/validação existentes: **12 passaram na versão recebida e 1 falhou**. O teste r171 esperava proteções Android que não existiam no código.
- Após as alterações: **16/16 scripts passaram**. São scripts com múltiplas verificações; não são 16 testes de ponta a ponta nem uma medida de cobertura de código.
- Validação estrutural do banco nativo: **117 questões**, 15 disciplinas, sem duplicação exata detectada, um par próximo indicado pelo validador (#35 e #49, semelhança aproximada de 0,799). Isso não certifica correção conceitual ou atualização jurídica das 117 questões.
- Revisão amostral de questões quantitativas: combinação de 6 em 3 = 20; comissão de 3 entre 6 e 2 entre 4 = 120; inclusão/exclusão = 25; aumentos de 20% e 10% = 32%; 72 km/h para parada em 40 m = 5 m/s². Essas verificações não substituem curadoria integral.
- Varredura por quatro famílias de padrões de segredos em 146 arquivos textuais elegíveis: nenhum achado. Não houve auditoria de todos os commits do histórico nem detecção universal de credenciais.
- Pesquisa documental em páginas oficiais de Qconcursos, TEC, Estratégia, GitHub, Supabase, Electron e MDN.

**Não executado:** login real, consumo de IA, alteração de contas, publicação, migrações em PostgreSQL, testes de carga, instalação Android/Windows e auditoria visual autenticada. O Chromium local não iniciou por restrição de criação de socket do ambiente. Portanto não há nota visual medida, Lighthouse, tempo de carregamento real ou verificação manual de responsividade nesta entrega. Funções TypeScript tiveram sintaxe analisada após remoção de tipos; isso não equivale a `deno check` nem a deploy validado.

## Correções implementadas e por que importam

| ID | Problema demonstrado | Correção no pacote | Validação / limite |
|---|---|---|---|
| R01 | v103 cria `topic_mastery.mastery`, v104 usa `mastery_score` em duas RPCs | Nova migração v106 redefine as funções usando `mastery` | Inspeção e teste estático; executar em homologação |
| R02 | Bônus de domínio lê estado antes da atualização; concorrência pode repetir bônus; primeira linha ausente deixa booleanos nulos | Lock transacional por usuário/campanha/tópico e normalização dos booleanos | Código SQL revisado; falta teste PostgreSQL concorrente |
| R03 | `prepareQuestionConsistent` convertia índice ausente/inválido em zero | Preserva `-1`, não pontua chave ausente, distingue autoria de gabarito oficial | Regressões executadas em VM |
| R04 | Explicação gerada podia substituir o gabarito; heurísticas fabricavam alternativas de questões | Removida alteração automática de conteúdo e de gabarito por prosa | Testes de contradição, alternativa vazia e preservação |
| R05 | Permutação ignorava alternativas dependentes de ordem | Mantém ordem em “todas as anteriores”, referências e conjuntos de numerais | Regressão determinística |
| R06 | Sem resposta do provedor, regras locais inventavam resposta chamada de IA | Mantém `answer_unknown` e índice `-1`; não reprocessa gabaritos já conhecidos | Cenário offline executado |
| R07 | Servidor também usava A quando resposta de IA faltava; associação por posição podia trocar questões | Novo `validatedSuggestedKeys`: exige correspondência de enunciado, opções e índice válido; nenhuma resposta válida gera 422 | Casos de ausência, ordem alterada e enunciado divergente |
| R08 | Remover alternativas vazias deslocava índices no material e no assistente | Rejeita questão incompleta/duplicada em vez de deslocar gabarito; não corta questão com mais de 5 opções | Testes de sanitização e regressões anteriores |
| R09 | Tópico vazio trazia questões da disciplina inteira; “não respondidas” podia trazer respondidas; AOCP aceitava banca desconhecida | Filtros estritos; faltas de gabarito e anuladas excluídas dos caminhos normais de treino | Código revisado e suíte geral; falta interação E2E |
| R10 | Histórico de uma pessoa tinha aparência de estatística coletiva; zero respostas virava uma amostra | Rótulo “Seu histórico”, “Seu erro mais frequente” e amostra zero real | Inspeção e suíte geral |
| R11 | Redação aceitava objeto sem espelho consistente; escalas podiam ser normalizadas silenciosamente | Novo validador exige leitura, 4 critérios, máximo total 100, notas finitas e soma coerente, além de campos de devolutiva | Casos válidos, ilegíveis, vazios e inconsistentes |
| R12 | PATCH de redação com chave de serviço não tinha filtro de proprietário; sucesso podia ser informado sem confirmar gravação | Filtro `user_id`, UUID de entrada e confirmação do PATCH final | Verificação estática de escopo; falha real de banco ainda precisa ser simulada |
| R13 | Cache apagava caches de outras aplicações, iniciava rede mesmo com mídia em cache e devolvia HTML para arquivo ausente | Limpeza por prefixo, mídia cache-first, HTML de fallback só para navegação e resposta 503 para recurso ausente | Teste de comportamento com Cache API simulada |
| R14 | Instalador antigo apontava para domínio antigo; abertura de protocolo externo era irrestrita | Mesmo domínio nos dois wrappers; protocolos restritos; navegação externa sai da janela | Testes com Electron simulado nos dois caminhos |
| R15 | WebViews permitiam acesso a arquivo local e navegação genérica; um deles não tinha tratamento de URL | Desativa `file://`, bloqueia conteúdo misto, limita navegação e adiciona tela de erro com nova tentativa | Teste estático passou; compilação e aparelho pendentes |
| R16 | CORS compartilhado omitia domínio atual; não havia comando único de testes web | Domínio atual incluído; `npm test`, workflow de validação e exclusões de arquivos locais | 16 scripts aprovados; Actions ainda não executado no GitHub |

Arquivos principais: `dist/index.html`, `dist/v77-experience.js`, `dist/sw.js`, três funções de IA, dois novos módulos de validação em `_shared`, nova migração SQL, ambos os `MainActivity.java`, ambos os `main.js`, testes e workflow. O arquivo `ALTERACOES.patch` permite inspecionar exatamente a diferença em relação ao material recebido, sem confundir diferenças preexistentes no histórico Git.

## Pendências importantes que continuam abertas

### P0 — antes de apresentar métricas como prova de domínio ou ranking antifraude

1. **Acerto ainda pode ser declarado pelo cliente.** `record_question_attempt` recebe `p_is_correct`, e a política de `topic_mastery` permite operações do próprio usuário. A autenticação identifica a conta; não prova que a resposta estava certa. Projetar tentativa com ID, ID/versionamento da questão e resposta escolhida; servidor carrega gabarito e calcula o resultado. Não foi feito um redesenho parcial que quebrasse questões locais e offline.
2. **Idempotência incompleta.** A nova trava evita disputa pelo bônus de um tópico, mas não deduplica uma tentativa reenviada. Incluir `attempt_id` único com restrição no banco. Para missão, registrar conclusão única por campanha/missão/versão. `complete_mission_honest` calcula e retorna valores, mas não comprova sozinho que a recompensa foi persistida uma única vez.
3. **Duas regras de XP coexistem.** O front ainda atribui 25 por acerto em um fluxo; a RPC retorna 10/2 mais bônus. Definir regra única e aplicar recibo do servidor, com indicação de resultado offline pendente. Esta revisão não altera o balanço de jogo global sem validar todos os fluxos.
4. **Homologar as migrações reais.** A nova migração não reescreve v104 já aplicada. Conferir existência da v103, backups e histórico remoto. A avaliação do arquivo não prova o estado do banco em produção.

### P1 — confiabilidade de IA e manutenção

- Redação e descoberta de modelos ainda precisam de prazo total por requisição, cancelamento e limite global de tentativas. Algumas chamadas têm timeout e outras não; padronizar um cliente de provedores.
- O assistente marca a resposta como apoiada no material quando há contexto. Isso não prova que cada afirmação foi sustentada. Adotar referências por trecho/página, validação de citações e abstenção quando a fonte não responde.
- Uma IA revisar a outra reduz certos erros, mas não equivale a validação independente por especialista. Guardar a versão do material, modelo, prompt, resposta e motivo da revisão.
- A correspondência estrita dos novos gabaritos pode rejeitar respostas em que o modelo reescreveu o enunciado. Essa rejeição é intencional. Evolução: contrato estruturado com IDs imutáveis em vez de aceitar similaridade frouxa.
- Erro de rede antes do bloco principal de algumas Edge Functions pode produzir resposta genérica sem tratamento uniforme. Padronizar envelopes de erro e códigos legíveis.
- Algumas RPCs/funções engolem falhas; substituir silêncio por evento técnico sem tokens, texto de redação ou documentos pessoais.
- `v77-experience.js` permanece com aproximadamente 1 MB e mais de 15 mil linhas; `index.html`, aproximadamente 584 KB. Há muitas camadas de sobrescrita de funções. Extrair módulos por domínio, começando por questões/avaliação e persistência. Não recomendo trocar tudo de framework de uma vez.
- Há dois projetos Android e dois caminhos Windows. O workflow Android usa `app/` da raiz, não necessariamente o que o desenvolvedor abre em `android/`. Consolidar após verificar qual applicationId está instalado/publicado; não mudar IDs agora.
- Dependências Electron têm faixas sem lockfile; atualização controlada, lockfile e `npm ci` continuam necessários. A versão não foi atualizada às cegas sem compilar instalador.
- Publicação de `dist` e aplicação de SQL/Edge Functions são etapas distintas. Subir código no GitHub não atualiza automaticamente o Supabase.

### P2 — acessibilidade, observabilidade e experiência

- Auditar teclado, leitor de tela, foco nos diálogos, contraste, zoom 200% e toque em telas pequenas. Há CSS de responsividade/reduced-motion, mas isso não comprova acessibilidade.
- Mostrar na primeira tela uma próxima ação clara: edital → diagnóstico → primeira sessão. Deixar guilda, rankings e configuração avançada em segundo plano durante o início.
- Quando um filtro ficar vazio, explicar “Ainda não há questões para este recorte” e oferecer gerar/importar questões ou limpar o filtro. Nunca relaxá-lo sem informar.
- Mostrar que perda de rede pode deixar progresso pendente; reenvio deve ser idempotente e testado com duas abas e dois aparelhos.
- Implantar painel operacional de erros, duração e consumo da IA. Não foram inventados números de p95, custo ou disponibilidade nesta análise.

## Avaliação pedagógica

### O que conservar

A preparação orientada pelo edital, distribuição de disciplinas, revisões, caderno de erros e distinção entre estudar e demonstrar domínio são boas bases. Conservar a identidade visual/temática de caçador como motivação opcional e manter o compartilhamento da biblioteca como solicitado. A decisão de arquitetura da biblioteca não foi usada como motivo para removê-la ou descontar pontos nesta revisão.

### O que mudar na lógica de aprendizagem

**Domínio não é apenas percentual.** Acertar várias vezes a mesma pergunta pode indicar memorização do item. Exibir acertos e total, número de questões distintas, número de sessões e origem. Exemplo: “8/10 acertos em 6 questões distintas, em 2 dias”; evitar “dominado” com uma única exposição.

**Estudado, praticado e retido devem ser separados.** Cronômetro e leitura demonstram atividade, não retenção. Sugestão de estados: não iniciado; estudado; praticado; revisão necessária; evidência de domínio. O último requer questões variadas e uma revisão posterior, sem consulta. Limiares precisam ser tratados como regra interna e calibrados com dados.

**Revisão deve medir recuperação.** Priorizar o erro recente, a importância do tópico no edital e o tempo desde a última recuperação correta. Oferecer “não sei” e confiança percebida, mas não transformar autoconfiança em nota. Reapresentar conteúdo conceitual antes de repetir o mesmo distrator.

**Questões precisam de qualidade editorial.** Rubrica sugerida por item: alinhamento ao tópico, comando claro, uma resposta defensável, distratores plausíveis, justificativa de cada alternativa, fonte quando aplicável, data e revisor. Se algum requisito crítico falhar, marcar revisão pendente e retirar do treino pontuado até a decisão editorial.

**Banco nativo é inicial.** São 117 itens para 15 disciplinas: distribuição varia de 1 a 16. Ética tem 1; Geografia de Pernambuco, 2. Não sustenta diagnóstico amplo de um concurso inteiro. Não basta gerar milhares de perguntas: começar pelos tópicos descobertos, obter variedade e revisar amostras sistematicamente.

**Proveniência precisa ser comprovável.** `verified_at` preenchido por padrão com mês não comprova conferência. Separar data de geração, data da fonte, revisão humana e revisão automatizada. Questão autoral inspirada na banca deve continuar marcada como autoral, sem aparência de transcrição oficial.

**Redação é estimativa.** O novo validador verifica estrutura e coerência matemática, não mérito da correção. Calibrar por banca e edital com redações avaliadas por humanos. Rastrear cada crítica a um trecho; não punir aluno por falha de OCR. Não tratar texto-modelo como promessa de nota 100.

## Comparação com o mesmo segmento

Comparação de recursos documentados, sem contratação/teste de contas pagas e sem ranking absoluto de qualidade. Recursos e planos podem variar.

| Referência | Evidência pública consultada | Aplicação útil à Jornada |
|---|---|---|
| Qconcursos | Filtros por assunto/banca/ano e estado de resolução; exclusões de anuladas/desatualizadas; cadernos e simulados | Tornar recortes previsíveis, identificar versão/estado da questão e facilitar revisão do erro |
| TEC Concursos | Cadernos de erros a partir do histórico; filtros combinados e organização de assuntos | Dar mais destaque à recuperação dos erros e à progressão curricular |
| Estratégia Concursos | Sistema de questões com comentários docentes, cadernos/simulados e uso web/app; trilhas orientadas por professores | Explicar o objetivo de cada tarefa e investir em curadoria, além da geração automática |
| Jornada do Caçador | Edital/material do aluno, IA, rotina e gamificação integrados no código enviado | Concentrar diferenciação no plano de estudo contextualizado, com rastreabilidade e dados honestos |

A prioridade competitiva recomendada é **confiança + próximo passo claro + revisão útil**. Novas animações, rankings ou mais quantidade de IA têm menos valor se o estudante não consegue saber de onde veio uma resposta.

## Métricas propostas — metas, não resultados medidos

| Dimensão | Métrica e definição | Critério inicial proposto |
|---|---|---|
| Ativação | Usuários que concluem primeiro edital e primeira sessão / cadastros elegíveis | Medir baseline por 2 semanas antes de estabelecer meta |
| Cobertura do edital | Tópicos com material aprovado e questões revisadas / tópicos do edital | Mostrar numerador/denominador, não só uma porcentagem |
| Qualidade de IA | Itens aprovados por revisão humana / itens amostrados, separados por tipo | Amostra inicial de 100 questões e 20 redações; nenhum erro crítico aceito |
| Gabarito | Concordância com referência oficial quando disponível | Registrar divergências; não contar hipótese de IA como referência |
| Retenção | Acerto em itens distintos após 7 e 30 dias, sem consulta | Comparar com diagnóstico individual e indicar tamanho da amostra |
| Redação | Erro absoluto entre avaliação IA e referência humana, por critério | Definir tolerância com corretores antes de aprovar uso |
| Tempo | p50 e p95 por etapa: extração, geração, validação e gravação | Medir por documento e faixa de páginas, com timeout explícito |
| Confiabilidade | Falhas por operação / operações iniciadas; sucesso de gravação | Alertar aumento em relação ao baseline, não mascarar erro como sucesso |
| Custo | Tokens e custo por documento/questão/redação aprovada | Comparar qualidade aprovada por custo; incluir retries |
| Sincronização | Eventos duplicados/perdidos e atraso de sincronização | Zero duplicação de recompensas nos testes de reconexão |
| Experiência | Abandono por etapa e conclusão de sessão | Separar desistência, erro técnico e falta de conteúdo |

Eventos sugeridos: `analysis_started`, `analysis_finished`, `analysis_failed`, `question_attempted`, `review_completed`, `essay_review_saved`, `sync_failed`. Campos: ID de evento, ID pseudônimo, versão do app, campanha, tipo de origem, resultado e duração. Não registrar chave, token, PDF ou redação integral em telemetria.

## Matriz de cenários

| Cenário | Resultado esperado | Evidência nesta revisão |
|---|---|---|
| Gabarito null/vazio/negativo/fora do limite | Sem gabarito; não assumir A | Executado em VM |
| Questão anulada | Não pontuar | Validador executado; fluxo completo pendente |
| Alternativa vazia/duplicada | Rejeitar item gerado, sem deslocar índice | Regressão local + inspeção |
| IA devolve questão em outra ordem | Associar conteúdo corretamente ou rejeitar | Executado no validador compartilhado |
| IA indisponível/offline | Manter pendência, sem “resolver” por regra local | Executado em VM |
| Redação ilegível/nota incoerente/critério ausente | Não aceitar nota | Executado no validador |
| Banco recusa gravação da correção | Não informar sucesso | Guarda implementada; integração pendente |
| Dois pedidos simultâneos de bônus | Um bônus por limiar | Lock proposto; PostgreSQL concorrente pendente |
| Reenvio da mesma tentativa | Não incrementar duas vezes | Ainda pendente: implementar idempotência |
| Cache offline sem JS | 503; nunca HTML no lugar do script | Executado com Cache API simulada |
| Cache de outra aplicação | Não apagar | Executado |
| Link com protocolo arbitrário no Windows | Bloquear | Executado com Electron simulado |
| Upload Android via seletor | Continuar aceitando arquivo escolhido | Código preservado; aparelho pendente |
| Usuário A acessa/exclui dados privados de B | Negar; acesso comunitário continua conforme regra existente | Não executado em banco real |
| PDF digital/scaneado/protegido/corrompido/grande | Mensagem clara, cobertura correta, sem perder arquivo | Testes sintéticos existentes; lote real ainda necessário |
| Token expirado durante análise | Reautenticar sem duplicar consumo/tarefa | Pendente em homologação |
| Filtro de tópico sem correspondência | Lista vazia explicada; não trocar tópico | Implementado; E2E pendente |
| Ranking e duelo com duas contas | Sem acesso indevido ou aceitação de placar fabricado | Contratos estáticos existentes; teste real pendente |
| Leitor de tela/teclado/mobile | Navegação e foco consistentes | Pendente |

## Plano de execução sugerido

**Etapa 1 — aplicar esta revisão em homologação:** rodar `npm test`, comparar migrações, publicar funções revisadas, testar 2 contas e 2 dispositivos, reconexão, PDFs e redações reais de teste. Responsável: engenharia. Saída: evidência registrada de cada cenário crítico.

**Etapa 2 — tornar métricas confiáveis:** tentativa com UUID idempotente, correção no servidor quando houver gabarito versionado, eventos separados de XP e domínio, reconciliação offline. Responsáveis: engenharia + coordenação pedagógica. Saída: reenvio/concor­rência sem prêmio duplicado.

**Etapa 3 — calibrar conteúdo:** conjunto de referência, revisão humana amostral, fila editorial, relatórios por disciplina e origem, critérios de abstenção. Responsável: coordenação pedagógica com especialistas. Saída: relatório de precisão real, não inferida pela existência de testes.

**Etapa 4 — reduzir manutenção e atrito:** extrair domínio de questões e persistência, consolidar wrappers após verificar IDs, lockfiles, E2E dos principais fluxos, acessibilidade e observabilidade. Responsável: engenharia/produto. Saída: versão testável e mais simples de manter.

Chegar a 8/10 ou mais exige evidências dessas etapas; adicionar recursos sozinho não resolve os déficits atuais.

## Fontes consultadas

Consultadas em 12/11/2026. Os achados sobre a Jornada provêm do código enviado; as fontes abaixo sustentam comparação e orientações técnicas.

- Qconcursos, filtros: https://suporte.qconcursos.com/pt-BR/articles/12118570-como-usar-os-filtros-de-questoes
- TEC, caderno de erros: https://tecconcursos.zendesk.com/hc/pt-br/articles/48591881334939--Tutorial-Como-fazer-um-caderno-de-erros-no-Tec-Concursos
- TEC, filtros: https://tecconcursos.zendesk.com/hc/pt-br/articles/48593690506267--Tutorial-Como-utilizar-os-filtros-do-Tec-Concursos
- Estratégia, sistema de questões: https://atendimentoconcursos.estrategia.com/hc/pt-br/articles/13433212079255-O-que-%C3%A9-e-como-usar-o-Sistema-de-Quest%C3%B5es-do-Estrat%C3%A9gia-Concursos
- Estratégia, trilha: https://atendimentoconcursos.estrategia.com/hc/pt-br/articles/43501769319703-Trilha-Estrat%C3%A9gica
- Electron, segurança: https://github.com/electron/electron/blob/main/docs/tutorial/security.md
- MDN, service workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- Supabase, chaves: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase, migrações: https://supabase.com/docs/guides/deployment/database-migrations
- GitHub, publicação: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
