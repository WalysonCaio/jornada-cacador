# Resultado da revisão r184

A revisão encontrou falhas adicionais nos caminhos de análise que os testes anteriores não exercitavam. O foco foi preservar o PDF como fonte, evitar contaminação entre disciplinas e impedir substituições silenciosas.

| Problema | Correção e comportamento |
|---|---|
| Prova reescrita pelo gerador de IA | `material-gemini` recusa provas/simulados e títulos identificados como cadernos de questões. O navegador encaminha esses arquivos para extração e comparação. |
| Índice gerado apresentado como resposta confiável | Material autoral gerado recebe sugestão separada, `correct_index=-1`, chave pendente e identificação de IA. Não pontua antes de revisão. |
| Questões descartadas a partir da sexta de um resumo | Removido o corte silencioso de cinco itens no sanitizador. |
| Cache de conteúdo entre documentos/contas | Removido o reaproveitamento desse cache do gerador; não copia conteúdo privado de outro documento. |
| Substituição por POST e DELETE separados | Propostas privadas e aplicação atômica com snapshot. Primeira análise de material usa RPC exclusivo do servidor e recusa sobrescrita. |
| Recuperação no navegador contornava a validação do servidor | Removido o fallback que gerava e gravava material/prova diretamente. Recuperação de edital continua pelo fluxo protegido existente. |
| “Reanalisar” reutilizava o texto antigo | `forceFresh` relê o original no Storage, com guardas de conta/portal/reset e extrações concorrentes. |
| Página falhava e desaparecia da contagem | Falhas, páginas vazias/omitidas, truncamento e OCR ficam explícitos; leitura incompleta não gera substituição. |
| Disciplina inferida sobrescrevia a declaração antes da conferência | Preservadas declaração e justificativa; conflito não desaparece durante a carga. |
| Assunto Constitucional atribuído pela posição da questão | Removido o tópico por número; disciplina é analisada antes do assunto. |
| Penal, CPP e áreas militares confundidos | Regras específicas, equivalência estrita e sinalização de empate; sem encaixe automático em uma matéria vizinha. |
| Múltipla escolha sem alternativas virava Certo/Errado | Exige evidência de formato C/E; estrutura incompleta é bloqueada. |
| Numeração/página/caderno perdidos | Preservados na extração e nos relatórios. Correspondência usa enunciado e alternativas, não só o número. |
| Gabarito acima da questão 250/trecho longo ignorado | Corrigidos limites silenciosos do leitor e testes para sequências maiores. |
| Tipo 1 confundido com Tipo 10/primeiro caderno escolhido | Correspondência exata e escolha explícita em caso de ambiguidade. |
| Revisão pessoal perdida numa nova proposta | Preservados gabarito e classificação confirmados, inclusive overrides da conta. Mudança posterior invalida a proposta. |
| Questão antiga ausente na nova extração | Guardada com status de não localizada e fora dos treinos, sem exclusão automática. |
| Botões grandes/empilhados no leitor de leis | Ações compactas no desktop e adaptadas ao celular; largura mínima/overflow ajustados. |
| Hash e avisos duplicados, metadados extensos | Hash único em detalhes; avisos de confiança permanecem visíveis. |
| Layout estreito de filtros, alternativas e navegação | Nova folha responsiva com quebra de texto, min-width:0, controles acessíveis e ajustes de grids/rolagem. |

## Confiança e limites

O lote valida correspondência com a fonte extraída, estrutura, classificação heurística e chaves disponíveis. **Não certifica a verdade factual de todas as respostas.** PDF escaneado, figura ausente, separação textual imperfeita, lei atualizada e gabarito errado na própria fonte ainda exigem conferência.

A análise estrutural do arquivo nativo encontrou 125 itens válidos. A heurística sinalizou 13 classificações para conferência; isso não demonstra 13 erros factuais. Três novos casos envolvem assuntos que cruzam áreas (atos administrativos/Súmula 473, responsabilidade civil do Estado e uso de algemas). Foram mantidos como casos de revisão, sem mudar automaticamente o conteúdo nativo para forçar um resultado.

Os documentos privados e as questões reais da conta não foram acessados nesta sessão. O lote deve rodar dentro da conta após aplicar a versão. As capturas de responsividade não foram refeitas em navegador; a correção usa a imagem enviada, inspeção de código e testes do controlador/CSS. Não foi anunciada conformidade WCAG ou cobertura visual universal.

A política de compartilhamento da biblioteca e a separação dos Manuais foram preservadas. `server_verified` continua representando proveniência técnica do servidor; não equivale a aprovação factual ou gabarito oficial.

## Evolução recomendada

Use os relatórios dos PDFs reais para priorizar as pendências; não apague todo o banco como etapa de manutenção. Depois de homologar o fluxo, acompanhe tempo de extração, falhas por página, proporção de classificações pendentes e divergências de gabarito por documento. Amplie as regressões com PDFs representativos, sem publicar arquivos privados ou assumir que testes simulados substituem a revisão editorial.
