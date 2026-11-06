# Jornada do Caçador — avaliação completa (r139 → r140)

Método: leitura do código (front, 8 Edge Functions, 30 migrações), análise estática (variáveis não declaradas, código morto, RLS, integração front↔backend, referências do SQL), **auditoria mecânica do banco de questões estático** (gabarito, duplicatas, rótulo, viés de posição), 11 verificações automáticas, simulação com Supabase/Gemini falsos e teste de mutação.
Limites: sem celular real, sem Gemini real, sem Postgres real, sem PDFs de prova reais; o conteúdo jurídico das questões e da política de privacidade **não** foi revisado por advogado.

## Nota geral: 7,9 / 10

| Área | Nota | Em uma frase |
|---|---|---|
| Ideia e escopo | 9,0 | Edital → missões, bancas, duelos, TAF, redação, comunidade, diagnóstico de erro. |
| Pedagogia / rigor do estudo | 8,0 | Rótulos honestos, sem viés de posição, diagnóstico de erro; o XP ainda premia atividade. |
| Análise de edital | 8,0 | Todas as páginas em trechos, backup do mapa, cobertura real. |
| Análise de material (apostila) | 8,0 | Sem truncar, anti-ruído que preserva títulos. |
| Prova / simulado em PDF | 8,5 | Caderno, gabarito separado, "adicionar gabarito depois", Raio-X, sem gabarito inventado. |
| Segurança | 8,0 | RLS em 19 tabelas, conteúdo comunitário verificado pelo servidor. Resta ranking/XP no navegador. |
| Privacidade / LGPD | 8,0 | Política com controlador, bases legais, retenção, transferência internacional e menores, coerente com o código. |
| Banco / backend | 7,5 | Integração íntegra; migrações antigas com prefixo repetido. |
| Arquitetura do front | 4,5 | ≈ 1438423 bytes de JS próprio (+11% numa versão): 117 questões estão escritas dentro do código. |
| UX / responsivo / acessibilidade | 8,5 | Diálogos próprios, Raio-X, resumo pós-duelo; só tema escuro. |
| Testes | 9,0 | 11 verificações; as críticas validadas por mutação. |
| Repositório / operação | 7,5 | `hyper-endpoint` ainda sobrando. |
| Documentação (manual) | 7,5 | Precisa citar caderno, gabarito separado, Raio-X e "adicionar gabarito". |

## 1. O que está muito bom
- Quase nenhum código morto (1 função em ~515); nenhuma variável sem declarar; toda RPC, tabela e Edge Function chamada pelo front existe; 19 tabelas com RLS.
- **Política de privacidade completa e coerente com o sistema:** a caixa "Compartilhar com a comunidade" e o botão 🤝/🔒 por arquivo existem; a exclusão de conta apaga arquivos e o usuário.
- Você implementou minhas recomendações: diálogo de caderno, gabarito em PDF separado, "adicionar gabarito depois", comentário/diagnóstico de erro.
- O banco nativo está mecanicamente íntegro: 117 questões, gabaritos válidos, sem duplicatas, explicações completas.

## 2. Corrigido nesta rodada
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | **Alta** | As 117 questões do banco nativo são **autorais**, mas estavam com `origin: 'oficial'` e atribuídas a bancas reais (AOCP, Cebraspe, FGV…): o aluno via texto escrito por nós como se fosse prova da banca. | Marcadas como `autoral`; o campo `board` (estilo) continua alimentando os filtros por banca. |
| 2 | **Alta** | **Viés de posição:** a resposta certa era a alternativa **B em 61%** das questões (A 21%, C 12%, D 6%). Dá para acertar "chutando B". | Embaralhamento determinístico (mesma ordem em toda sessão), pulando as que dependem da ordem ("todas as anteriores", combinações de numerais); letras dos comentários reescritas. Agora A/B/C/D = 21/32/26/20%. |
| 3 | **Alta** | "Adicionar gabarito depois": (a) aplicava gabarito **ambíguo** (dois cadernos colados) em silêncio; (b) usava a **posição** na lista quando o número da questão não estava no gabarito; (c) **sobrescrevia** respostas que já eram corretas. | Recusa ambiguidade, procura só pelo número e só completa o que está sem gabarito. |
| 4 | Média | O filtro "AOCP" incluía **toda** questão oficial (Cebraspe e FGV apareciam como AOCP). | Corrigido. |
| 5 | Média | Bancos já existentes ainda rejeitam gabarito na 5ª alternativa (editar a v79 não altera um banco já criado). | Migração **v102** idempotente. |
| 6 | — | Testes | `test-question-bank` (6 mutantes pegos), `test-attach-answer-key` (3 mutantes pegos) e checagem da v102. |

## 3. O que ainda precisa mudar (por prioridade)
**Alta**
1. **Revisão do conteúdo jurídico das 117 questões por quem tem formação** (os comentários citam artigos, leis e emendas; a legislação muda). Marque a data de conferência e a norma-base em cada uma.
2. **Mova o banco de questões para fora do código** (JSON carregado sob demanda ou tabela no banco): hoje ele infla o JS e ainda o torna lento para quem nem usa. Isso também permite corrigir uma questão sem novo deploy.
3. **Canal público do encarregado com e-mail.** A política descreve um canal "no painel"; a LGPD pede contato do encarregado divulgado publicamente (um e-mail resolve).
4. **XP premia atividade:** teoria = 1 clique, missão +100 XP com 0% de acerto, chefe por contagem. Maestria por tópico e XP proporcional ao acerto.

**Média**
5. **Caixa de compartilhamento pré-marcada** (opt-out): está explicada na política, mas o consentimento é mais forte se o aluno marcar de propósito.
6. Front pesado: carregar por aba, tirar o script inline do HTML e remover `unsafe-inline` da CSP.
7. **Valide o extrator com 3 a 5 PDFs de prova reais** de bancas diferentes (PDFs reais podem intercalar colunas e ter figuras).
8. Questão anulada ao adicionar gabarito tardio hoje conta como "ainda sem gabarito": melhor marcá-la como anulada.
9. Ranking/XP dependem do navegador.

**Baixa**
10. `check_email_registered` permite descobrir se um e-mail tem conta; apagar `hyper-endpoint`; prefixos de migração repetidos (`20261030_*`).
11. Tema claro, onboarding de 3 passos, botão "Reportar erro".

## 4. Como publicar
1. Extraia o zip por cima do projeto.
2. Rode as verificações de `scripts/` (as novas: `test-question-bank.mjs` e `test-attach-answer-key.mjs`).
3. Supabase → SQL Editor: rode `20261106120000_v102_shared_bank_five_options.sql` e a consulta de conferência no fim do arquivo. Não há função nova para publicar.
4. `git add .`, `git commit`, `git push origin main`; depois do deploy, `Ctrl+Shift+R` (sw.js r140).

## 5. Roteiro de verificação (20 min)
- Abra um simulado do banco nativo e responda 10 questões: a resposta certa **não** deve ser quase sempre a B, e o comentário deve citar a mesma letra que você marcou como certa.
- No catálogo de provas, as questões nativas devem aparecer como **autorais** (não oficiais); filtre por "Cebraspe" e confirme que não aparecem questões da AOCP.
- Importe uma prova sem gabarito, depois use "Adicionar gabarito" colando "Tipo 1 … Tipo 2 …" no mesmo texto: deve recusar. Cole só o seu caderno: deve aplicar.
- SQL: confirme a restrição com a consulta do fim da v102.
