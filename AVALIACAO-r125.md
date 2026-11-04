# Jornada do Caçador — avaliação completa (r124 → r125)

Método: leitura do código (front, 8 Edge Functions, 19 migrações), análise estática (variáveis não declaradas, código morto, RLS, funções privilegiadas, integração front↔backend), 10 baterias de teste, simulações com Supabase/Gemini falsos e **teste de mutação** (quebrar o código de propósito para ver se o teste percebe).
Limites: sem celular real, sem Gemini real, sem Postgres real (SQL validado só estruturalmente), PDFs de prova reais não testados (usei provas sintéticas).

## Nota geral: 7,5 / 10

| Área | Nota | Em uma frase |
|---|---|---|
| Ideia e escopo | 9,0 | Portais por concurso, edital → missões, repetição espaçada, bancas, duelos, TAF, redação, ranking, comunidade. |
| Pedagogia / rigor do estudo | 7,5 | Mais honesto (termômetro, questões), mas o XP ainda premia atividade e não domínio. |
| Análise de edital | 8,0 | Todas as páginas em trechos, backup do mapa, cobertura real, perfil individual por usuário. |
| Análise de material (apostila) | 8,0 | Sem truncar, cobertura real, anti-ruído que preserva títulos. Falta processamento retomável. |
| Prova oficial / simulado em PDF | 7,0 | Era 5,5. Extrator agora nunca inventa gabarito; faltam questões com imagem, escolha de caderno e OCR. |
| Segurança | 7,5 | RLS em 19 tabelas, funções perigosas fechadas, chat endurecido. Risco: conteúdo compartilhado por padrão e passível de falsificação. |
| Privacidade / LGPD | 6,0 | Há páginas legais, mas faltam controlador, encarregado, retenção e transferência internacional. |
| Banco / backend | 7,5 | Integração íntegra; migrações com prefixos repetidos. |
| Arquitetura do front | 5,0 | ≈ 1,13 MB de JS próprio na abertura e 496 funções em camadas que se sobrescrevem. |
| UX / responsivo / acessibilidade | 8,0 | 86 media queries, safe-area, dvh, abas com `role=tab`, foco visível. Só tema escuro. |
| Testes | 8,5 | 10 baterias; as críticas validadas por mutação. Faltam testes em navegador e de RLS em Postgres real. |
| Repositório / operação | 7,0 | `.gitignore` bom; `hyper-endpoint` sobrando; versões de migração repetidas. |
| Documentação (manual) | 7,5 | Clara; precisa refletir o que mudou. |

## 1. Pontos muito positivos
- Quase nenhum código morto: 1 função não usada em 496; nenhuma variável não declarada; nenhuma função duplicada.
- Toda RPC, tabela e Edge Function chamada pelo front existe no backend (verificado por script).
- Todas as 19 tabelas têm RLS; HTML dinâmico é escapado; chave de IA pessoal no Vault; duelo sem gabarito no cliente.
- Sitemap, robots, 404, Open Graph e páginas legais presentes.
- Você já implementou a maior parte das sugestões anteriores (v97, v98, CSP, extrator de provas, páginas legais).

## 2. Corrigido nesta rodada
| # | Gravidade | Problema | Correção |
|---|---|---|---|
| 1 | **Alta** | Extrator de provas com **dois cadernos (Tipo 1/2)**: 6 de 6 gabaritos errados, rotulados "oficial". | Detecta conflito e **recusa** em vez de escolher um caderno. |
| 2 | **Alta** | Prova **sem gabarito**: números soltos na prosa ("questões 3 a 5", "ARTIGOS 2 E 4 DA LEI 8 A 9") viravam gabarito inventado "oficial". | Gabarito só vale como tabela de ≥ 4 pares separados só por espaço/`|`/`;`/`,`, em maiúsculas. Sem tabela, nada é importado. |
| 3 | **Alta** | Numeração que reinicia por disciplina (Português 1–4, Direito 1–4) sobrescrevia gabaritos. | Conflito detectado → recusa. |
| 4 | Alta | Questões de 5 alternativas perdiam uma; Certo/Errado ganhava 2 alternativas **inventadas**; JSON sem resposta virava "A". | Preserva 2–5 alternativas reais; descarta questão sem gabarito válido; app passou a aceitar 2–5 alternativas. |
| 5 | Média | Texto-base e rodapé ("Página 3 de 12") entravam nas alternativas; afirmativas "1. 2. 3." do enunciado abriam questões falsas; "preliminar × definitivo" descartava as duas. | Texto-base vai para as questões seguintes; rodapés/cabeçalhos repetidos saem; afirmativas continuam no enunciado; vale o definitivo. |
| 6 | Alta | Caminho rápido do PDF gravava **cobertura 100% fixa** e **apagava o conteúdo antigo antes de gravar**. | Cobertura real (questões sem gabarito/anuladas listadas), abaixo de 60% cai para a IA, grava primeiro e só então apaga. |
| 7 | Média | "Questão gêmea": resposta certa **sempre na alternativa A** e distratores genéricos repetidos. | Embaralha, preserva o nº de alternativas, distratores variados. |
| 8 | Média | Questões "adaptadas" pela IA eram tratadas como "oficiais"; texto colado sem gabarito virava "oficial estruturada". | Origem honesta (`adaptada_do_pdf`) e aviso para conferir o gabarito. |
| 9 | Média | Trecho sem conteúdo didático (capa) contava como "não analisado" e dava falso alerta de cobertura. | Conta como analisado. |
| 10 | **Alta** | v99 devolvia o **nome real do cadastro** de quem enviou material a todos os usuários. | Migração **v100**: só o nome público escolhido; "Ocultar meu perfil" respeitado. |

## 3. O que ainda precisa mudar (por prioridade)
**Alta**
1. **Conteúdo comunitário pode ser falsificado.** `study_documents` e `generated_study_content` aceitam INSERT/UPDATE direto do usuário (política `own_rows_all`) e a biblioteca comunitária mostra tudo que estiver `ready` e compartilhado (padrão ligado). Um usuário mal-intencionado cria material com gabarito errado e ele aparece para todos. Correção: coluna `server_verified` que só o service_role pode ligar (trigger) e a biblioteca exibir só conteúdo verificado.
2. **Compartilhamento ligado por padrão, inclusive material já enviado.** É decisão sua, mas envolve direitos autorais (apostilas de cursinho) e LGPD. No mínimo: aviso claro no envio, opção visível de desligar e texto na política de privacidade (ver PRIVACIDADE-LGPD-MODELO.md).
3. **Fallback para DeepSeek/Groq.** Se houver chave configurada, o texto dos materiais vai para provedores fora do Brasil (DeepSeek: China) e a política não os cita. Declare ou desative.
4. **Gamificação premia atividade, não domínio** (teoria = 1 clique; missão +100 XP com 0% de acerto; chefe por contagem de missões). Proposta: maestria por tópico, XP proporcional ao acerto, reforço obrigatório abaixo de 70%.

**Média**
5. **Front pesado:** ≈ 1,13 MB de JS próprio. Carregar por aba e mover o script inline para arquivo (permite remover `unsafe-inline` da CSP).
6. **Prova em PDF:** questões que dependem de imagem/figura, escolha do caderno quando houver Tipo 1/2 (hoje recusa), PDFs em duas colunas (a extração de texto do PDF pode intercalar colunas) e OCR para digitalizados.
7. **Apostilas grandes (~500 páginas):** processamento retomável em lotes (a tabela de jobs já existe).
8. **Ranking/XP dependem do navegador**; para competição séria, calcular no servidor.

**Baixa**
9. `check_email_registered` permite descobrir se um e-mail tem conta (limitar tentativas).
10. Prefixos de migração repetidos (`20261030_*`): só rodam à mão no SQL Editor; apagar a função `hyper-endpoint`.
11. Tema claro, onboarding de 3 passos, "Reportar erro" em questão/resumo.

## 4. Como publicar
1. Extraia o zip por cima do projeto.
2. Rode: `node scripts/test-exam-extractor.mjs`, `test-front-study.mjs`, `test-security-contracts.mjs`, `test-material-integrity.mjs` (e as demais).
3. Supabase → SQL Editor: rode `20261104120000_v100_community_author_privacy.sql`.
4. `npx supabase functions deploy material-gemini`.
5. `git add .`, `git commit`, `git push origin main`; depois do deploy use `Ctrl+Shift+R` (sw.js r125).

## 5. Roteiro de verificação (20 min)
- Cole o texto de uma prova com gabarito "Tipo 1 / Tipo 2": deve avisar que há mais de um gabarito e **não** importar.
- Envie uma prova real em PDF com gabarito no fim: confira se as questões têm 5 alternativas e o gabarito bate com o do PDF (confira 5 questões por amostragem).
- Envie uma prova **sem** gabarito: nada deve virar "oficial".
- Biblioteca comunitária: o autor deve aparecer como "Colega da Comunidade" ou o nome público do perfil, nunca o nome do cadastro.
- Rode no SQL: `select jsonb_path_query_array(public.get_community_exam_library('', ''), '$.documents[*].author_name');`
