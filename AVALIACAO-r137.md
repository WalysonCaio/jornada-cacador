# Jornada do Caçador — avaliação completa (r136 → r137)

Método: leitura do código (front, 8 Edge Functions, 30 migrações), análise estática (variáveis não declaradas, código morto, RLS, integração front↔backend, referências do SQL), 10 verificações automáticas, simulação com Supabase/Gemini falsos e teste de mutação (quebrar o código de propósito para ver se o teste percebe).
Limites: sem celular real, sem Gemini real, sem Postgres real, e sem PDFs de prova reais (usei provas sintéticas).

## Nota geral: 7,7 / 10

| Área | Nota | Em uma frase |
|---|---|---|
| Ideia e escopo | 9,0 | Edital → missões, bancas, duelos, TAF, redação, comunidade: produto diferenciado. |
| Pedagogia / rigor do estudo | 7,5 | Termômetro e questões honestos; o XP ainda premia atividade, não domínio. |
| Análise de edital | 8,0 | Todas as páginas em trechos, backup do mapa, cobertura real. |
| Análise de material (apostila) | 8,0 | Sem truncar, anti-ruído que preserva títulos; falta processamento retomável. |
| Prova / simulado em PDF | 8,0 | Extrator seguro, diálogo de gabarito (PDF do gabarito, colar, caderno), Raio-X. Faltam figura, OCR e validação com PDFs reais. |
| Segurança | 8,0 | v101 adotada: só o servidor verifica conteúdo. Resta compartilhamento padrão e ranking confiando no navegador. |
| Privacidade / LGPD | 6,5 | A política já cita Gemini/DeepSeek/Groq; faltam controlador, encarregado, retenção, transferência internacional e menores. |
| Banco / backend | 7,5 | Integração íntegra; migrações com prefixo repetido. |
| Arquitetura do front | 5,0 | ≈ 1288911 bytes de JS próprio (cresce a cada versão) e 512+ funções em camadas. |
| UX / responsivo / acessibilidade | 8,5 | `prompt()` trocado por diálogo próprio, Raio-X ao escolher o arquivo; só tema escuro. |
| Testes | 8,5 | Críticas validadas por mutação; teste genérico de referências do SQL. |
| Repositório / operação | 7,5 | v101 aplicada; `hyper-endpoint` ainda sobrando. |
| Documentação (manual) | 7,5 | Clara; precisa citar Raio-X, caderno e gabarito separado. |

## 1. Pontos muito positivos
- Quase nenhum código morto (1 função em 512 e nenhuma variável sem declarar); toda RPC, tabela e Edge Function usada pelo front existe; 19 tabelas com RLS.
- Você adotou e ampliou as correções anteriores: v101, diálogo de caderno no lugar do `prompt()`, gabarito por PDF separado, Raio-X.
- O fluxo de gabarito ficou bom: quando não há gabarito confiável, o aluno escolhe entre cruzar com o PDF do gabarito, colar o gabarito ou importar só para estudo.

## 2. Corrigido nesta rodada
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | **Alta** | O modo novo "importar sem gabarito" definia a alternativa **A** (ou CERTO) como correta e gravava como **oficial**: o aluno seria corrigido contra uma resposta inventada. | Sem gabarito a questão fica `answer_unknown` com `correct_index = -1`, não é oficial, não entra em simulados nem no desempenho e a cobertura avisa quantas ficaram sem gabarito. |
| 2 | Média | O botão "Resolver com IA" não fazia nada diferente (a opção nunca era lida), mas prometia resolver. | Escondido até existir de verdade. |
| 3 | Média | A auto-recuperação ao abrir o app zerava **qualquer** documento em "processing", mesmo um que ainda estava sendo analisado. | Só zera quem está parado há mais de 150 s. |
| 4 | — | Testes | 3 cenários novos no extrator (sem gabarito, misto e Certo/Errado) com 3 mutantes pegos, mais verificações do cliente de PDF. |

## 3. O que ainda precisa mudar (por prioridade)
**Alta**
1. **Questões sem gabarito não têm onde aparecer ainda:** ficam fora de simulados e do desempenho, mas o aluno precisa de um caminho claro para "adicionar o gabarito depois" (hoje é reprocessar o documento). Vale um botão "Adicionar gabarito" no card do documento.
2. **Compartilhamento comunitário ligado por padrão**, inclusive material já enviado: aviso no envio, botão de desligar visível e texto na política (direitos autorais e LGPD).
3. **Política de privacidade incompleta** (use o PRIVACIDADE-LGPD-MODELO.md) e fallback DeepSeek/Groq enviando texto para fora do Brasil: declare como transferência internacional ou remova as chaves.
4. **XP premia atividade:** teoria = 1 clique, missão +100 XP com 0% de acerto, chefe por contagem. Maestria por tópico e XP proporcional ao acerto.

**Média**
5. Front pesado: carregar por aba, mover o script inline para arquivo e remover `unsafe-inline` da CSP.
6. Provas em PDF: questões com figura e OCR; **valide com 3 a 5 PDFs reais** de bancas diferentes antes de confiar no extrator (os testes usam provas sintéticas e PDFs reais podem intercalar colunas).
7. Apostilas de ~500 páginas: processamento retomável.
8. Ranking/XP dependem do navegador.

**Baixa**
9. `check_email_registered` permite descobrir se um e-mail tem conta.
10. Prefixos de migração repetidos (`20261030_*`); apagar `hyper-endpoint`.
11. Tema claro, onboarding de 3 passos, botão "Reportar erro".

## 4. Como publicar
1. Extraia o zip por cima do projeto.
2. Rode as verificações de `scripts/` (em especial `test-exam-extractor.mjs`).
3. `git add .`, `git commit`, `git push origin main`; depois do deploy, `Ctrl+Shift+R` (sw.js r137). Não há SQL nem função nova nesta rodada.

## 5. Roteiro de verificação (20 min)
- Envie uma prova **sem gabarito** e escolha "Importar para estudo": as questões **não** podem aparecer em batalhas/simulados e o card deve avisar "N questões SEM gabarito".
- Envie a mesma prova com o PDF do gabarito: as questões passam a ser corrigidas e oficiais.
- Escolha "Resolver com IA": o botão não deve existir.
- Faça upload, recarregue a página em menos de 2 minutos e confirme que o documento em análise não volta para "pendente".
- Teste com um PDF de prova real e confira 5 questões contra o gabarito do documento.
