# Avaliação completa do projeto — r178

Revisão de 14/11/2026. Base examinada: `da6df61304f85d8067008f11f716bb79d8c1a46f` (main, r177). Foram examinados frontend, taxonomia, questões, gabaritos, extração de PDFs, IA, redação, sincronização, perfis, ranking, cache offline, migrações, testes e wrappers nativos. A revisão utilizou o código atual do GitHub; instruções e avaliações históricas presentes nos documentos são contexto, não autorização para publicar ou executar SQL em produção.

## Nota de zero a dez

**Minha avaliação: 6/10 para a base r177 e 7,5/10 para o código corrigido r178, como candidato a homologação.** A proposta pedagógica tem força; a implementação ainda precisa de simplificação e de validação real de navegação, conteúdo e sincronização entre aparelhos. A nota é julgamento técnico qualitativo, não resultado de um benchmark, certificação ou previsão de aprovação.

| Área | Base r177 | r178 | Fundamentação e limite |
|---|---:|---:|---|
| Proposta e percurso pedagógico | 8 | 8 | Edital, missão, prática e revisão formam uma rotina útil. Falta validar a experiência com estudantes. |
| Separação de disciplinas e conteúdos | 5 | 8 | Retirados preenchimentos com outras matérias; CPP separado de Penal; ambiguidades em revisão. Heurísticas ainda exigem exemplos humanos rotulados. |
| Confiança no conteúdo e gabaritos | 4 | 7 | Índices/opções preservados, IA pendente e revisão identificada. Não houve revisão factual de todos os comentários ou da legislação. |
| Persistência e recuperação | 4 | 8 | Treinos locais, prazo contínuo, escopo e respostas tardias protegidos; edital atômico. Homologação multiaparelho continua necessária. |
| Desempenho | 5 | 7 | Menos trabalho repetido na abertura, painéis adiados e medição honesta dos filtros. Sem medição real de clique até interação no celular. |
| Perfis, privacidade e segurança | 4 | 7 | Escape de HTML, URLs restritas, caches por conta e projeção privada no servidor. A migração precisa ser aplicada; ranking ainda não é integralmente antifraude. |
| Manutenção | 5 | 5 | Persistência e novas áreas têm módulos, mas o arquivo v77 continua grande e com sobrescritas. |
| Verificação | 5 | 8 | Novas regressões comportamentais, handlers reais com serviços simulados e duas integrações PostgreSQL isoladas. Navegador, RLS real e builds nativos não homologados aqui. |

Não descontei pontos pelo compartilhamento da biblioteca: sua escolha foi preservada. Os Manuais do Caçador ficam em **Menu → Manuais do Caçador**, como ajuda da plataforma, fora de resumos, flashcards, questões e indicadores de estudo.

## O que foi corrigido

A base atual passou em apenas **14 dos 30 scripts** existentes. Parte das proteções r174/r175 havia sido perdida nas alterações seguintes. A r178 recupera essas proteções e preserva recursos úteis posteriores, incluindo o perfil, a arquitetura de taxonomia, os atalhos de teoria e as oito novas questões autorais. O resultado final está em [VALIDACAO.txt](VALIDACAO.txt).

| Problema | Correção |
|---|---|
| Disciplina desconhecida podia virar Constitucional; nomes parciais confundiam CPP e Penal | Correspondência por aliases explícitos e IDs estáveis; desconhecidas não recebem uma matéria arbitrária. |
| Sprints e raids completavam seleções pequenas com outros assuntos/bancas | Interseção estrita; ausência de itens aparece como ausência, sem preencher silenciosamente. |
| Assunto não encontrado recebia o primeiro tópico da disciplina | Mantém identificação própria ou revisão, sem associação arbitrária. |
| Consolidação alterava a origem, as alternativas ou o banco nativo compartilhado em memória | Cópia organizada separada, metadados preservados e exportação no escopo da conta/portal. |
| Snapshot antigo ressuscitava pergunta excluída ou chave corrigida | Consolidação deriva do conteúdo atual; snapshot não é fonte para reinjetar itens. |
| Gabaritos inválidos, booleanos ou ausentes podiam virar A; opções vazias deslocavam a resposta | Valida tipos, limites e posições, preserva pendência e recusa estrutura defeituosa. Suporta C/E e A–E. |
| Extração IA podia chamar todas as questões de oficiais por encontrar “Gabarito” em algum trecho | Extração por IA tem origem identificada e sugestão pendente; não prova vínculo oficial por questão. |
| Comentários tinham data/selo de conferência sem responsável | Removidos selos artificiais; banco autoral mantém versão e referência sugerida. |
| Estatísticas e metas diárias aceitavam chave não validada | Barreira de correção antes de pontuar; desempenho por banca usa tentativas registradas. |
| Aba Questões montava gráficos/catálogo no caminho principal e repetia cálculos | Filtros primeiro; gráficos e catálogo depois da pintura, com cancelamento ao trocar de portal/aba. |
| Telemetria inventava duração mínima, resultado sem amostras e “60 FPS” | Relógio real, amostras válidas, p50/p95 locais e estado “sem amostras”. Não mede a navegação completa. |
| Fechar a aba perdia treino/simulado; retorno podia pontuar de novo | Retomada local por usuário/portal/reset, expiração, alternativas e prazo absoluto; guardas de repetição local. |
| “Ler teoria” criava texto genérico e marcava leitura sem material aberto | Seleciona resumo da mesma disciplina e tópico; sem resumo, informa a lacuna. Registra abertura apenas após encontrar o card real. |
| Wikipédia aparecia como síntese verificada | Fonte externa identificada, link HTTPS restrito, limite total de oito segundos e opção de tentar novamente. |
| Manuais voltavam a entrar nos materiais e contextos de IA | Catálogo independente e filtros nos carregamentos, cache, geração, revisão e sessões antigas. |
| Perfil permitia inserir HTML/URLs inseguros e reutilizava dados de outra conta | Escape de texto, validação de avatar e escopo por conta/reset, incluindo callbacks assíncronos. |
| Ranking fabricava horas, questões e XP semanal a partir de outras métricas | Mostra indisponível onde falta dado real; evita fundir homônimos e limita XP local ao teto auditável existente. |
| Preferências de privacidade eram só visuais | Migração v108 oculta os campos correspondentes e seus derivados para terceiros na resposta do servidor. |
| Respostas antigas de sincronização/carregamento podiam atingir conta ou portal novo | Revalidação de escopo após operações assíncronas, proteção do refresh e preservação de edições concorrentes locais. |
| Edital podia ser apagado parcialmente antes de confirmar novo mapa | Restaurada a RPC transacional v107 e o bloqueio de exclusão quando a migração de segurança está ausente. |
| Diagnóstico e salvamento anunciavam sucesso sem confirmação | Consultas, respostas e persistência verificadas; offline e falhas aparecem explicitamente. |
| Links externos arbitrários nos wrappers Desktop/Android | Restauradas restrições de protocolo e navegação. Instaladores não recompilados nesta entrega. |

## Questões, IA e gabaritos ausentes

A questão deve guardar separadamente **origem**, **disciplina/conteúdo** e **situação da resposta**. “Importada” não significa “oficial”; “oficial” não significa que a extração da chave esteja correta; “revisada por você” não equivale a documento da banca.

Sem gabarito, mantenha a questão pendente. É possível importar a chave depois, com número da questão e versão do caderno, ou solicitar uma sugestão da IA. A sugestão deve continuar identificada e fora do acerto confirmado até revisão. Não existe método que garanta a resposta correta somente porque a IA apresentou explicação confiante.

Para revisar uma chave, confira enunciado completo, alternativas, referência e versão do caderno. Registre responsável/data/fonte. A correção pessoal preserva vínculo com o texto da alternativa e histórico. Mudança de chave não recalcula retroativamente todas as estatísticas históricas nesta versão; um sistema editorial multiusuário e versionado continua recomendado.

Dados antigos já marcados como oficiais não foram alterados em massa sem evidência. Revise uma amostra das importações históricas e, sobretudo, materiais em que a chave foi produzida pela IA.

O feedback deve separar conceito, resposta correta, justificativa de cada alternativa e próxima revisão. Onde falta explicação, deve informar a ausência em vez de inventar uma justificativa. As explicações continuam apoio de estudo, com necessidade de conferência pedagógica e jurídica.

## Classificação e avaliação pedagógica

A melhoria mais importante é manter os filtros como regra para todos os caminhos: Questões, missão, sprint, erro, duelo e boss. Em caso de conflito entre o cadastro e o conhecimento cobrado, enviar para revisão, sem usar apenas palavras isoladas. Um texto sobre Constituição pode cobrar gramática; a matéria depende da tarefa solicitada.

O catálogo de IDs ajuda a organizar, mas não prova acurácia do classificador. Próximo passo: conjunto versionado de questões rotuladas por professor, com exemplos fáceis e ambíguos, medindo precisão por disciplina e matriz de confusão. Separar essa amostra dos exemplos utilizados para ajustar as regras.

O banco nativo contém **125 questões autorais em 15 disciplinas**. A validação estrutural encontrou zero erros e uma quase duplicata. Os oito itens acrescentados na r176/r177 foram preservados. O acervo ainda é pequeno e desigual; não sustenta, sozinho, uma inferência ampla de domínio ou aprovação.

Na redação, a nota permanece estimativa pedagógica. Foram reforçados propriedade, persistência e consistência da soma dos critérios. Isso não valida fidelidade à banca: é preciso comparar amostras com corretores humanos e distinguir erro de OCR de erro do aluno.

## Velocidade e métricas

As mudanças retiram trabalho desnecessário e preservam o índice por documento introduzido recentemente, sem cache de metadados baseado apenas na quantidade de questões. O ganho de tempo percebido ainda precisa ser medido.

A telemetria atual mede **execução síncrona dos filtros**, por conta/portal/reset. p50/p95 não representam tempo total de abertura, FPS, rede, hidratação completa ou desempenho comprovado em celular. Nenhum ganho percentual foi inventado.

Homologar com cache frio/quente e bancos de 1 mil, 10 mil e 50 mil itens. Medir clique até filtros utilizáveis, tarefas longas, rede/bytes, memória, IndexedDB e tempo até iniciar treino. Paginação na origem e virtualização só devem ser priorizadas após identificar o gargalo real.

Nas estatísticas por banca, mostrar quantidade, período e origem. Não comparar treino autoral no estilo AOCP com amostra oficial como se fossem o mesmo acervo. Resultados antigos sem banca ou duração não recebem dados inventados. Repetição de questões exige identificação para não superestimar domínio.

## Prioridades seguintes

1. **Homologação antes de publicar:** aplicar v108 e pré-requisitos num ambiente de teste; executar testes de navegador e cenários de duas contas/dois aparelhos, rede lenta e PDFs reais.
2. **Conteúdo:** revisão humana de amostra, referência oficial por questão, validade temporal da legislação e fila editorial de reportes. Aumentar diversidade do banco por disciplina/banca sem tratar volume como qualidade.
3. **Experiência:** Hoje com próxima ação, duração e revisão pendente; recursos secundários no Menu. O redesenho visual completo não foi homologado nesta revisão.
4. **Integridade:** tentativas com ID único e versão da questão, correção pelo servidor e idempotência remota. Guardas locais e teto de XP não tornam todo o ranking antifraude.
5. **Manutenção:** retirar sobrescritas e separar classificação, treino, métricas, PDFs e perfil em módulos com limites claros. Escolher as árvores nativas oficiais e consolidar a distribuição em etapa própria.

Veja também [comparação com outras plataformas](COMPARACAO.md) e [passo a passo para aplicar e enviar ao GitHub](LEIA-ME.md). Nenhuma conta, migração ou aplicativo de produção foi alterado nesta revisão.
