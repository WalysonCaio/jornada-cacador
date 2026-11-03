# Jornada do Caçador — análise completa (versão r114 → r115)

Método: leitura do código (front, 8 Edge Functions, 18 migrações), análise estática (variáveis não declaradas, funções duplicadas, HTML sem escape, RLS e permissões), 9 baterias de teste, simulações com Supabase e Gemini falsos e testes de mutação (quebrar o código de propósito para ver se o teste percebe).
Limites: não testei em celular real, com o Gemini real, nem num Postgres real. As migrações SQL novas foram validadas só estruturalmente.

## 1. Nota geral: 7,8 / 10

| Área | Nota | Observação |
|---|---|---|
| Ideia e escopo do produto | 9,0 | Portais por concurso, edital → missões, repetição espaçada, bancas, duelos, TAF, redação, ranking. |
| Pedagogia / rigor do estudo | 7,5 | Boa base (revisão 1·7·30, caderno de erros, flashcards por vencimento). Falta premiar domínio, não só atividade. |
| Análise de edital | 8,0 | Todas as páginas em trechos, backup do mapa, aviso de cobertura. Não testada com edital real. |
| Análise de material (apostila) | 7,5 | Sem truncar, cobertura real, origem verdadeira das questões, anti-ruído corrigido. Falta processamento retomável. |
| Prova oficial / simulado em PDF | 5,5 | Maior lacuna: a prova é tratada como apostila; não extrai questões originais nem o gabarito oficial. |
| Segurança | 8,0 | Era ~3. RLS em 19 tabelas, funções privilegiadas fechadas, chat endurecido (v98). Resta confiança no cliente (ranking/XP) e `unsafe-inline` na CSP. |
| Banco / backend | 7,5 | Base do `user_state` agora em migração. Prefixos de migração repetidos. |
| Arquitetura do front | 5,5 | `index.html` 407 KB + `v77-experience.js` 368 KB (≈ 775 KB de JS na abertura). |
| UX / responsivo / acessibilidade | 8,0 | 69 media queries, safe-area, dvh, foco visível, link de pular. Só tema escuro, sem onboarding. |
| Testes | 8,0 | 9 baterias passam; faltam testes em navegador e de RLS em Postgres real. |
| Repositório / operação | 7,0 | `.gitignore` melhorado; `CLAUDE.md` com caminho local e nome do usuário versionado. |
| Documentação (manual) | 7,5 | Bom; 5 divergências com a interface (ver CORRECOES-DO-MANUAL.md). |

## 2. O que está muito bom
- Integração íntegra: toda RPC, tabela e Edge Function que o front chama existe no backend (verificado por script).
- Nenhuma variável usada sem declarar (analisador próprio validado com erro plantado) e nenhuma função duplicada no `index.html`.
- Todas as 19 tabelas têm RLS; no estado final não restou política aberta além do banco de questões compartilhado e do chat (por desenho).
- HTML dinâmico escapado, inclusive nas mensagens do chat vindas de outros usuários.
- Chave de IA pessoal no Supabase Vault; duelo sem gabarito no cliente; comunidade opt-in; CSP ativa.
- Testes que de fato pegam regressão (mutação).

## 3. Problemas encontrados e corrigidos nesta rodada
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | Alta | **Anti-ruído do material apagava títulos legítimos**: 13 de 15 títulos em "Title Case" ("Lei Maria Da Penha", "Mandado De Segurança"...) sumiam antes de chegar à IA. | Regra trocada por detecção de repetição no documento (≥ 40% das páginas); títulos preservados; instruções de prova preservadas. |
| 2 | Alta | **Termômetro de aprovação enganoso**: com 1 questão certa mostrava "Faixa Elite — Primeiros Colocados"; cortes 60/72/80% fixos chamados de "média histórica PMPE" (sem fonte); disciplina sem amostra recebia **35% inventado**. | Amostra mínima de 30 questões com intervalo de confiança (Wilson 95%), meta configurável por portal, texto "mede seu desempenho no app, não a nota de corte real", "sem amostra" no lugar do 35%. |
| 3 | Média | "Pontos Fortes" bastava 3 questões; segundo 35% inventado no diagnóstico. | Mínimo de 10 questões; sem número inventado. |
| 4 | Alta | **Chat da guilda**: INSERT direto na tabela permitia personificar outro caçador (`author_name`), forjar XP e fazer flood, contornando a função segura. | Migração v98: remove o INSERT/UPDATE direto; a função passa a limitar 12 msgs/min e bloquear repetição em 30 s. Front traduz os erros. |
| 5 | Média | Redação: critérios por banca (pesos 20/20/30/30 etc.) apresentados como "espelho oficial". | Rotulado como "referência geral" e "espelho estimado"; a IA informa que a nota é estimativa pedagógica. |
| 6 | Baixa | WebSocket do chat sem heartbeat (cai em ~1 min; só voltava via polling). | Heartbeat de 25 s e limpeza ao fechar. |
| 7 | Baixa | `onclick=importCampaign`: função inexistente; só não quebrava porque o `id` do botão vira variável global. | Linha morta removida. |
| 8 | Baixa | Splash sem respeitar "reduzir movimento"; `CLAUDE.md` com caminho do seu computador e nome. | CSS de movimento reduzido; `CLAUDE.md` no `.gitignore` (rode `git rm --cached CLAUDE.md`). |

## 4. Pontos que ainda precisam de decisão ou trabalho
Prioridade alta
1. **Prova e simulado em PDF (nota 5,5).** No caminho normal a IA resume e **cria questões novas**; as originais e o gabarito oficial não são extraídos, e o formato é forçado a 4 alternativas (A–E de 5 alternativas e Certo/Errado do Cebraspe ficam de fora). Pipeline sugerido: segmentar questões por padrão (`QUESTÃO 12`), ler o gabarito por parser determinístico (preliminar × definitivo, anuladas), casar por número e marcar `oficial` só com gabarito do documento; a IA só comenta a resolução.
2. **Gamificação que premia atividade.** Teoria = 1 clique; "corrigir erros" = 1 clique; missão dá +100 XP mesmo com 0% de acerto; chefe liberado por contagem de missões. Proposta: maestria por tópico (0–100), XP = 40 + até 60 por acerto, reforço obrigatório abaixo de 70%, teoria com 2 perguntas de recuperação, chefe por domínio.
3. **Processamento retomável de apostilas grandes**: uma execução (~105 s) não cobre 500 páginas; a tabela de jobs já existe para continuar em lotes.

Prioridade média
4. Dividir o código (carregar por aba): hoje ~775 KB de JS na primeira tela.
5. Tema claro/automático, onboarding de 3 passos, rodapé de privacidade/LGPD, semântica de abas (`role="tablist"`).
6. Botão "Reportar erro" em questão, resumo e gabarito (não existe) + selos de origem.
7. Ranking e XP dependem do navegador: para competição séria, calcular no servidor.
8. CSP sem `unsafe-inline` exige mover o script inline para arquivo (junto com o item 4).

Prioridade baixa
9. Manifest: separar ícones `any` e `maskable`.
10. Migrações v89–v95 com o mesmo prefixo `20261030` (só funcionam rodadas à mão). Apagar a função `hyper-endpoint` (não usada).
11. Duelo: servidor corrigir pergunta a pergunta (hoje um jogador técnico ainda pode ler as respostas durante a rodada).

## 5. Como publicar
1. Extraia o zip por cima do projeto.
2. `node scripts/test-security-contracts.mjs`, `test-material-noise.mjs`, `test-cutoff-honesty.mjs` (os de material exigem Node 22.13+).
3. Supabase → SQL Editor: rode `20261102120000_v98_guild_chat_hardening.sql` e as 2 consultas de conferência no final do arquivo.
4. `npx supabase functions deploy material-gemini` e `npx supabase functions deploy redacao-gemini`.
5. `git rm --cached CLAUDE.md`, `git add .`, `git commit`, `git push origin main`; aguarde o deploy, abra o site e use `Ctrl+Shift+R` (o `sw.js` foi para r115).

## 6. Roteiro de verificação (15 min)
- Resultados > Termômetro: com 5 questões deve aparecer "Amostra pequena"; altere a "Minha meta (%)" e veja os marcadores moverem.
- Biblioteca: reprocesse uma apostila com títulos como "Lei Maria da Penha" e confira se aparecem nos resumos.
- Chat: envie a mesma mensagem duas vezes seguidas (deve recusar) e 13 mensagens em 1 minuto.
- SQL: `select has_table_privilege('authenticated','public.hunter_guild_messages','INSERT');` → `false`.
