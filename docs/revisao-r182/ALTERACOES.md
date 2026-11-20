# Correções realizadas na r182

Base examinada: r181, commit `52b236036f5207117918aeb84ddd1df89eacdd1d`. Conclusão: 19/11/2026. O objetivo foi corrigir as regressões identificadas, mantendo os recursos de interface recentes e a biblioteca compartilhada.

## Questões e aprendizagem

- A auditoria pedagógica passou a ser um relatório: não altera chave, disciplina ou conteúdo e não fabrica explicação oficial. Contagens e percentuais derivam dos itens, com pendências explícitas.
- Gabaritos nulos, booleanos, fora do intervalo, anulados ou sugeridos pela IA sem revisão não comprovam acerto. Alternativas ausentes não são compactadas para deslocar a chave.
- CPP não é Penal; disciplinas desconhecidas não viram Constitucional. Assuntos ambíguos permanecem para revisão.
- Sprints, filtros, missões, erros, banco por documento e simulados usam critérios de elegibilidade consistentes. Um conjunto pequeno não é completado com outra matéria ou outra prova.
- A teoria corresponde à disciplina e ao conteúdo. Ausência de material não gera uma aula genérica, e o registro de abertura depende de encontrar o resumo real.
- Questão gêmea offline não é inventada. Uma nova sugestão da IA fica identificada e pendente de revisão, fora da fila de treino pontuado. Analogia e criação de cartão verificam a chave e o contexto.
- As 125 questões autorais foram preservadas; o JSON e o JavaScript têm alternativas e comentários sincronizados. Validação estrutural não certifica a verdade de todos os comentários.

## Cache, recuperação e contas

- Cache de questões considera conta, portal, redefinição, identidade dos objetos e conteúdo editado. Mudar uma questão intermediária ou substituir o banco não mantém objetos de outra conta.
- Leituras estáveis reutilizam validação e índices; há uma varredura de alterações O(N). Não se promete abertura O(1) ou 60 FPS.
- Filtros principais não dependem da montagem imediata de gráficos e catálogo. Pastas fechadas evitam montar conteúdo até serem abertas.
- Treinos e simulados recuperam respostas e posição, com prazo contínuo e isolamento local. Isso não transforma a sessão local em retomada entre aparelhos.
- Sincronização, refresh e carregamentos descartam respostas antigas. Edições feitas durante upload não são substituídas pelo snapshot anterior.
- Flashcards registram conta, portal e data reais; callbacks de outra conta, portal ou redefinição são bloqueados.
- O upload de edital não remove documentos, Storage ou tópicos anteriores antes da confirmação. A restrição de um edital por portal permanece; outro edital requer outro portal ou exclusão explícita pelo fluxo seguro existente.

## Leis e textos

- As seleções locais são descritas como recortes/dispositivos e notas, sem garantia de texto integral ou vigência conferida automaticamente.
- Fontes externas são identificadas e têm limites e prazos de requisição. Texto, título e metadados não entram como HTML executável no leitor.
- Favoritos, grifos, importações e cópias locais são separados por conta/redefinição. Dados legados sem proprietário não são atribuídos silenciosamente a uma conta.
- A v109 permite que duas contas salvem o mesmo ID, preservando dados, políticas e compartilhamento existentes.
- O carregamento recupera as cópias do usuário. O botão de salvar inclui o complemento que está visível, e a interface distingue confirmação em nuvem, cópia local pendente e falha.
- Navegar entre abas não realiza gravações automáticas repetidas de todas as leis.

## Indicadores e interface

- Painel Tático usa registros datados e o período/modalidade selecionados, sem derivar uma série temporal de acumulados sem data.
- Redações usam `cloudEssays`; cartões usam o deck e `flashProgress`. Notas zero não são descartadas nem notas baixas multiplicadas por dez.
- Dados sem data/escopo adequado ficam sinalizados ou fora do recorte. Conclusão de missão e avaliação de cartão não são certificação de domínio ou retenção.
- Perfil e ranking recuperam escape de HTML, URLs restritas, escopo e feedback de sincronização verdadeiro. Não se inventam horas, questões ou XP semanal.
- Telemetria sem amostras informa ausência; uma medição local dos filtros não afirma FPS nem latência completa do celular.
- Manuais do Caçador ficam no catálogo de ajuda, fora de questões, flashcards, disciplinas e contextos de IA para conteúdo. Materiais legítimos chamados “Manual” continuam permitidos.

## Entrega e publicação

- Restaurados contratos de testes que haviam sido trocados por expectativas incompatíveis com as proteções seguras; adicionadas regressões com funções reais e falhas simuladas.
- Gerador e cópias autocontidas das seis funções Supabase disponíveis para o editor do painel, com verificação de reprodução e inicialização sem dependências injetadas pelo teste.
- Workflows Android e Windows dependem da verificação compartilhada Node/SQL antes de gerar artefatos.
- Cache r182 e versão 1.0.182. Guia com ordem de migração/publicação e comandos próprios para uma branch de revisão.

Consulte `VALIDACAO.txt` para os resultados finais, cenários verificados e os limites. Não houve alteração em produção ou limpeza remota dos dados existentes.
