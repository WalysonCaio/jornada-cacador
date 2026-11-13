# Avaliação técnica e pedagógica — r174

**Nota geral do código entregue: 7/10.** É uma avaliação qualitativa do repositório e das verificações locais, não uma certificação de produção. A base r173 recebeu 6,5/10 na auditoria independente: havia recursos úteis e testes, mas também caminhos que misturavam disciplinas, apresentavam confiança indevida no gabarito e podiam perder mapas de edital.

Foram examinados frontend, banco nativo, extração de PDFs, funções de IA, persistência, migrações, autenticação, diagnósticos, testes, distribuição web e projetos nativos. A revisão partiu do commit `3d1e6ed2bac05a2d3ea3f560928247eadc3abcaa` de `WalysonCaio/jornada-cacador`. Não houve acesso à conta do usuário nem ao banco de produção.

## Avaliação por área

| Área | Nota | Fundamentação |
|---|---:|---|
| Proposta pedagógica | 8 | Edital, prática, revisão e caderno de erros formam uma rotina coerente. Domínio ainda precisa ser calibrado com questões variadas e retenção posterior. |
| Separação de disciplinas | 8 | Removidos preenchimentos silenciosos e reforçados filtros e conflitos. A classificação continua heurística e exige revisão de casos ambíguos. |
| Confiança em questões e IA | 7 | Origem e pendência explícitas, correções rastreáveis e melhor preservação de alternativas. Falta revisão editorial ampla e calibração por banca. |
| Recuperação e persistência | 7 | Retomada local e transação do edital reduzem perda. Sincronização entre dispositivos e tentativas remotas ainda exigem mais integração. |
| Manutenção | 5 | O arquivo de experiência continua próximo de 1 MB e acumula sobrescritas de funções. A persistência de treino foi extraída, mas a modularização ainda é parcial. |
| Testes | 7 | Há regressões comportamentais e agora execução SQL isolada. Navegação visual, RLS real e builds nativos continuam sem homologação nesta entrega. |
| Experiência de estudo | 7 | Filtros, feedback e recuperação ficaram mais claros. O fluxo ainda oferece muitos recursos simultâneos e precisa de teste com estudantes em celular. |
| Distribuição nativa | 6 | Existem wrappers e CI, mas duas árvores Android e dois caminhos Windows aumentam risco de divergência. Nenhum instalador novo foi compilado. |

Não descontei pontos pela sua decisão de manter a biblioteca compartilhada. Os controles e o modelo de compartilhamento foram preservados. Manuais do Caçador continuam guias da plataforma e de método; não são conteúdo de disciplina nem base para gerar questões de concurso.

## Problemas concretos e correções

| Problema observado | Mudança na r174 | Consequência para o estudante |
|---|---|---|
| Ausência de questões de uma disciplina podia trazer seis itens de outras | Removido fallback no banco nativo e revisados caminhos de missão, duelo e boss | Filtro vazio permanece vazio |
| Filtro de banca aceitava referências a outras bancas na explicação | Usa metadados de banca e correspondência explícita | Comentário comparativo não muda a banca do item |
| Classificação recebia confiança máxima só por ter disciplina preenchida | Conflito entre disciplina declarada e conteúdo detectado exige revisão | Reduz mistura silenciosa entre matérias |
| Palavras de lógica em comando gramatical desviavam Português | Prioridade para comandos de concordância, regência, crase e outros | O tema de um texto citado não substitui o conhecimento cobrado |
| Cache de classificação ignorava edição de enunciado/opções com tamanho semelhante | Chave acompanha conteúdo e alternativas | Edição invalida classificação anterior |
| Correspondência parcial confundia artigos e tópicos genéricos | Limites de palavras, aliases e recusa de correspondências genéricas | Art. 1 não corresponde automaticamente a art. 144 |
| Busca de teoria podia encontrar o mesmo título em outra disciplina | Disciplina integra a seleção da teoria | Atalho do erro leva ao conteúdo pertinente |
| Explicação podia apresentar questão autoral como gabarito oficial | Rótulos dependem da origem e situação da chave | Estudante sabe o grau de conferência disponível |
| Datas de conferência eram atribuídas automaticamente | Removidas datas e rótulos sem evidência | Data de execução não se apresenta como revisão humana |
| Permutação remapeava apenas parte de letras agrupadas | Remapeamento e guardas reforçados; JSON nativo regenerado | Comentário não chama alternativa correta de errada por troca de letra |
| Resolver gabarito com IA podia anunciar sucesso com zero respostas | Contagem real, manutenção de pendências e tratamento de resposta parcial | Ausência de resposta não vira gabarito válido |
| Correção pessoal podia aceitar índice inválido ou perder o vínculo com a alternativa | Validação de opções, assinatura e histórico da revisão | Correção não vira outra letra depois de recarregar |
| Erro legado sem alternativas originava opções artificiais com resposta A | Treino exige questão original completa; revisão teórica permanece acessível | Não se estuda uma reconstrução apresentada como prova original |
| Filtros e catálogo eram calculados repetidamente na abertura | Uma passagem principal; gráficos e catálogo adiados com cancelamento de tarefas antigas | Menos trabalho bloqueando o início do treino |
| Treino dependia do armazenamento da aba | Módulo de recuperação local, expiração e aviso de falha de armazenamento | Possibilidade de continuar após fechar/reabrir |
| Simulado cronometrado perdia seu estado | Preserva respostas, posição, alternativas eliminadas e prazo absoluto | Retomada mantém o tempo efetivamente restante |
| Banco nativo carregado impedia hidratar questões importadas | União com deduplicação e proteção contra troca de conta/portal | Conteúdo local volta após recarregar |
| Falha de transação local podia produzir indicador de banco salvo | Confirmação real de commit antes do indicador | Cache com falha não aparece como atualizado |
| Reanálise apagava tópicos antes de confirmar novos | RPC v107 substitui mapa e atualiza documento atomicamente | Erro durante a gravação preserva o estado anterior |
| Tópicos antigos faziam edital novo parecer pronto | Removidas promoções automáticas para ready | Estado pronto corresponde à análise confirmada |
| Diagnóstico dizia banco e Storage saudáveis com retornos fixos | Consultas e contagens reais; estados desconhecidos explícitos | Falha de serviço fica visível |
| Exclusão sem RPC de segurança podia remover tópicos primeiro | Sem v74, operação informa migração ausente sem remover dados | Falta de atualização não causa exclusão parcial do edital |
| Privacidade confundia redefinir perfil com excluir conta | Texto ajustado ao comportamento real | Preservação da conta/chave na redefinição fica clara |

## Questões, disciplinas e conteúdos

A separação precisa ser uma regra do conjunto de questões, aplicada em todos os pontos de entrada. Não basta o seletor dizer Português se o botão de missão ou o boss usar um banco mais amplo. A revisão retirou esses preenchimentos silenciosos. Faltar questão é uma informação útil: permite identificar a lacuna e importar ou produzir material pertinente.

As classificações automáticas têm confiança operacional, não probabilidade estatística calibrada. Um item em conflito deve ser revisado; ele não se torna confiável só porque uma IA ou um campo antigo lhe deu uma disciplina. A fila de revisão mostra a divergência e aceita confirmação humana explícita.

Próxima evolução recomendada: catálogo versionado com IDs estáveis de disciplina, assunto e subassunto, aliases editáveis e conjunto de exemplos rotulados por professor. Medir precisão por disciplina e matriz de confusão antes de ajustar limiares. Essa migração não deve reclassificar em massa a biblioteca sem revisão.

O banco nativo tem **117 questões autorais em 15 disciplinas**. A distribuição é pequena e desigual: Ética tem uma questão e Geografia de Pernambuco, duas. Isso não sustenta diagnóstico amplo de domínio ou previsão de aprovação. A validação estrutural encontrou uma quase duplicata; cabe revisão editorial, não exclusão automática por similaridade.

## Gabaritos e simulados sem resposta oficial

O fluxo recomendado, refletido nos rótulos e validações, é:

1. Guardar a origem da questão e a situação da chave separadamente.
2. Importar gabarito por número da questão e versão do caderno; associação ambígua deve ser recusada.
3. Se o gabarito não existir, conservar a questão como pendente. Nunca assumir A, Certo ou a resposta mais frequente.
4. Uma solução da IA é uma sugestão identificada, não documento oficial. Falha de rede ou saída parcial mantém os itens não resolvidos pendentes.
5. Revisão pessoal registra alternativa, referência, data e histórico. Ela é apresentada como revisão pessoal, sem promovê-la a oficial.
6. Questão anulada ou sem chave válida não comprova acerto nas métricas. Questão autoral mantém indicação de revisão recomendada.

Para maior rigor editorial, acrescente número do caderno, URL oficial, data da versão, tipo preliminar/definitivo e revisor. Uma mudança de chave deve indicar que tentativas antigas foram corrigidas sob uma versão anterior. A r174 mantém histórico local de revisão; não implementa um sistema editorial completo multiusuário.

## Feedback e respostas de IA

O feedback deve separar conceito, análise da alternativa correta, análise individual das demais opções e próximo conteúdo a revisar. As alternativas aparecem em blocos e o texto informa quando a justificativa não existe. Uma heurística de palavras como “sempre” é uma pista para leitura, nunca prova automática de erro.

Há dois problemas diferentes: validade estrutural e verdade pedagógica. Índice dentro do intervalo, JSON correto e soma consistente da nota não provam que uma interpretação jurídica ou correção de redação esteja certa. É necessária amostragem humana, especialmente em legislação, jurisprudência e critérios particulares da banca.

Para IA, recomendo manter versão da fonte, páginas/trechos, modelo e prompt; exigir referências verificáveis e permitir abstenção. Medir respostas sem fonte, citações que não sustentam a conclusão, concordância com revisão humana, taxa de correção após reporte e custo por análise. Não foram inventadas taxas de acurácia da IA nesta revisão.

Na redação, conservar a nota como estimativa pedagógica, com critérios e trechos do aluno. Erro de OCR não deve ser punido como erro de escrita. Calibrar por banca e comparar uma amostra com notas humanas antes de prometer equivalência ao corretor oficial.

## Desempenho e métricas

Foram removidos trabalhos repetidos na entrada de Questões e separado o carregamento secundário. Isso reduz causas identificadas de bloqueio, mas **não é uma medição do tempo real no celular**. Não há resultado p95, FPS ou ganho percentual de navegação comprovado nesta entrega.

O teste sintético herdado da r173 continua verificando que cem leituras de mil itens não recalculam fingerprints já inseridos. Os novos testes verificam ordem de agendamento, cancelamento de tarefas de outro portal e ausência de montagem duplicada do catálogo. São testes de comportamento, não benchmarks de experiência completa.

Métricas para homologação:

| Métrica | Como usar |
|---|---|
| Clique até filtros utilizáveis, p50/p95 | Medir em celular com cache frio/quente e bancos de 1 mil, 10 mil e 50 mil itens |
| Long tasks e duração da renderização | Distinguir custo de classificação, DOM, rede e IndexedDB |
| Bytes e quantidade de consultas | Identificar oportunidade de paginação na origem e carregamento sob demanda |
| Sucesso da retomada | Testar fechamento, atualização, offline, expiração, quota e troca de conta |
| Desempenho por banca | Mostrar n, primeira tentativa, repetição e origem; não tratar estilo autoral como prova oficial |
| Erros e latência da IA | Separar 401, 429, timeout, saída inválida, falha de persistência e análise parcial |

O painel por banca usa respostas registradas após a atualização; não inventa a banca de resultados antigos. Tempo médio usa apenas marcações reais disponíveis. Amostra pequena aparece sinalizada. O prazo de retenção local do treino é de sete dias; a retomada não é sincronização entre aparelhos.

## Comparação com plataformas do segmento

Comparação documental, sem auditoria prática das plataformas concorrentes:

| Referência | Recurso documentado | Aplicação ao Jornada |
|---|---|---|
| [Qconcursos — filtros](https://suporte.qconcursos.com/pt-BR/articles/12118570-como-usar-os-filtros-de-questoes) | Combinação de filtros e cadernos | Recortes consistentes e conjuntos vazios explícitos |
| [TEC Concursos — ferramentas](https://tecconcursos.zendesk.com/hc/pt-br/articles/48231250314523-Principais-ferramentas-do-Tec-Concursos) | Filtros, comentários, cadernos e acompanhamento | Estudar erro com explicação e acompanhar evolução |
| [Gran Questões — funcionalidades](https://grancursosonline.zendesk.com/hc/pt-br/articles/21167529168795-Conhe%C3%A7a-as-funcionalidades-do-menu-principal-da-plataforma-do-Gran-Quest%C3%B5es) | Disciplinas/assuntos, simulados e desempenho | Taxonomia coerente nos pontos de entrada |
| [Gran — reporte de erros](https://grancursosonline.zendesk.com/hc/pt-br/articles/39646652508443-Como-reportar-um-erro-em-uma-quest%C3%A3o-ou-coment%C3%A1rio-no-Gran-Quest%C3%B5es) | Tipos distintos de problema e análise pedagógica | Separar erro de chave, classificação, formatação e conteúdo |

O diferencial útil do Jornada é juntar edital, missão diária, revisão e prática numa rotina. A recomendação é fortalecer esses caminhos antes de adicionar novas áreas. A tela Hoje deve deixar evidentes próxima ação, duração e revisão vencida. Guilda, rankings e configuração avançada podem permanecer como recursos secundários; nesta revisão não houve um redesenho visual completo sem homologação.

## Testes e limites da avaliação

A base passou nos 17 scripts existentes. A entrega acrescenta regressões executando funções reais em Node/VM, mocks de falhas e uma integração SQL em PostgreSQL/PGlite. O resultado final está em `VALIDACAO.txt` no pacote de entrega. Os testes SQL verificam rollback após falha no documento, propriedade, ausência de sessão, service_role, deduplicação, preservação de IDs/progresso/conteúdo e retorno de mais de mil tópicos.

Foi criada suíte Playwright para desktop e viewport de celular, com dados fictícios e bloqueio de rede externa. Ela cobre filtros, vazio, resposta, confirmação de saída, retomada, simulado, manuais e largura. A execução fica pendente no workflow manual: no ambiente gerenciado, a ferramenta `cua_repl.js` não estava disponível e a orientação Sites exige pular browser QA nessa condição.

Mensagens históricas dos testes sobre 60 FPS, acessibilidade ou conformidade legal não equivalem a medições ou certificações. Nenhum teste aqui demonstra, sozinho, política RLS correta em produção, ausência de toda vulnerabilidade ou verdade de todo comentário do banco.

## Pendências priorizadas

**Antes de produção:** aplicar a migração em homologação, publicar as funções, executar o workflow visual e testar uma conta de homologação com PDFs representativos. Validar isolamento entre duas contas, rede lenta, reenvio e dois aparelhos.

**Integridade de métricas:** partes do progresso e das tentativas ainda vêm do cliente. Ranking e domínio não devem ser apresentados como totalmente antifraude. Evoluir para tentativa com ID único, questão/versionamento e resposta escolhida; o servidor deve carregar a chave e corrigir. A proteção local contra repetição de uma finalização não substitui idempotência no servidor.

**Manutenção:** separar classificação, questões, avaliação, PDFs e interface em módulos; reduzir as camadas de sobrescrita. A extração da persistência é uma primeira etapa. Paginação, índices de consulta e virtualização devem ser decididos com medição real, evitando caches que escondam dados editados.

**Conteúdo:** revisão editorial do banco e dos manuais. Percentuais, afirmações sobre memória/bancas e referências legais exigem fonte e atualização. O conteúdo dos manuais foi preservado; esta entrega não os certifica pedagogicamente nem juridicamente.

**Aplicativos nativos:** definir qual árvore Android e qual wrapper Windows são as distribuições oficiais. O workflow Android atual compila `app/` na raiz. Não alterar applicationId ou IDs de instalação sem plano de migração. Compilar e testar os instaladores em etapa própria.

**Operação:** revisar timeouts e cancelamento de todas as chamadas de IA; implementar telemetria sem documentos pessoais, tokens ou redações nos logs. A exclusão de conta envolve Storage e Auth e pode ser parcial; agora o erro é explícito, mas continua exigindo procedimento de recuperação operacional. A [documentação Supabase](https://supabase.com/docs/guides/auth/managing-user-data) explica que um usuário proprietário de objetos não pode ser excluído antes de tratar esses objetos.

O código e o pacote foram disponibilizados na branch `entrega/revisao-r174` para revisão. Nenhuma implantação do aplicativo, migração remota ou alteração dos dados da conta foi realizada. O pacote é uma versão candidata para aplicar e homologar.
