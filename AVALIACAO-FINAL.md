# Avaliação final — Jornada do Caçador (v103/r104)

Base: revisão estática do código (front, 8 Edge Functions, 15+ migrações), 6 baterias de teste e simulações com
Supabase/Gemini falsos. Não foi testado em navegador real, com o Gemini real, nem em um Postgres real.

## Nota geral: 7,5 / 10
(Com os pontos pendentes abaixo resolvidos: 8,5 a 9.)

| Área | Nota | Resumo |
|---|---|---|
| Escopo e ideia do produto | 9,0 | Portais por concurso, edital vira missões, repetição espaçada, bancas, duelos, TAF, redação. Muito acima de um app comum de estudo. |
| Pedagogia / estudo | 8,5 | Missões em rotação, revisão 1·7·30, caderno de erros, flashcards com fila por vencimento, chefes aos 50%. |
| Análise de edital | 8,0 | Agora lê todas as páginas em trechos, preserva progresso, avisa cobertura. Depende da qualidade do Gemini (não testado com edital real). |
| Segurança | 7,0 | Era ~3 antes da v96. Falta: placar de duelo e ranking confiam no navegador; `check_email_registered` público; CSP só em modo relatório. |
| Arquitetura / manutenção | 5,5 | `index.html` 367 KB e `v77-experience.js` 308 KB sobrescrevendo funções; tabela `user_state` fora das migrações; prefixos de migração repetidos. |
| Testes / qualidade | 7,5 | 6 baterias passam (contratos, estudo, edital, segurança, validador). Faltam testes em navegador e de RLS em Postgres real. |
| Desempenho / PWA | 7,0 | Service worker, offline básico. Script inline gigante atrasa a primeira pintura em celulares fracos. |
| UX / acessibilidade | 7,5 | pt-BR, aria-live, atalhos de teclado. Tela de duelo/ranking densa no celular. |
| Documentação (manual) | 7,5 | Clara e bonita; 4 trechos divergem da interface (ver CORRECOES-DO-MANUAL.md). |

## Pontos positivos
- Chave de IA pessoal guardada no Supabase Vault, acessível só pelo service_role (o manual está correto).
- Todas as 17 tabelas têm RLS; sincronização por revisão evita sobrescrever progresso.
- HTML dinâmico passa por escape; nenhum segredo no front.
- Todas as RPCs, tabelas e Edge Functions que o front chama existem no backend.
- Edital: cobertura total em trechos, backup do mapa, bloqueio de resultado parcial, aviso na tela.
- XP, 25 s por pergunta, duelo sem XP, chefe aos 50% e ciclo 1·7·30 conferem com o manual.

## Pontos negativos / riscos restantes
1. Duelo: o servidor recalcula o placar, mas as respostas certas vão junto das perguntas aos dois jogadores. Um jogador técnico ainda pode trapacear.
2. Ranking/XP vêm do estado salvo pelo próprio navegador (editável pelo usuário).
3. `check_email_registered` permite descobrir se um e-mail tem conta.
4. Biblioteca comunitária compartilha material de todos por padrão (direitos autorais de apostilas; sem consentimento por documento).
5. `user_state` (e possivelmente outras bases) não está em nenhuma migração: não dá para recriar o banco só com o repositório.
6. Migrações v89–v95 têm o mesmo prefixo `20261030`, o que impede `supabase db push`.
7. `hyper-endpoint` não é usada pelo app e continua no repositório (e possivelmente publicada).
8. Camadas v59/v77/v78 sobrescrevem funções do app (risco de bugs como o dos flashcards).

## Aplicado nesta rodada final
- Duelo: mensagens amigáveis para os erros do servidor (já enviado, duelo encerrado, limite diário...) e placar exibido vem do servidor.
- `.gitignore`: regras do `android/` atual (build, .gradle, keystore), remoção da linha acidental `$null`.
- Teste de regressão cobrindo isso; `sw.js` r104 para forçar atualização.
- Confirmado: edital 476/476 tópicos na sua versão final (simulação), progresso preservado, v96 presente.

## Ordem sugerida para o que falta (do mais valioso ao menos)
1. `supabase db dump --schema public` e guardar como migração base (resolve o item 5).
2. Opção por documento "Compartilhar com a comunidade" (item 4).
3. Trocar `check_email_registered` por limite de tentativas ou removê-la (item 3).
4. Ativar a CSP de verdade depois de alguns dias sem avisos no console (F12).
5. Dividir o `v77-experience.js` em módulos (item 8).
6. Servidor corrigir cada pergunta do duelo (item 1).

## Roteiro de teste em produção (15 minutos)
1. Criar conta → entrar pelo celular e pelo computador e ver o progresso igual.
2. Criar portal → enviar um edital grande → conferir se todas as disciplinas aparecem e se há aviso de cobertura.
3. Flashcards: marcar um como "difícil" e ver se volta em ~10 min; ligar "apenas pendentes".
4. Duelo X1 com um colega; tentar reenviar → deve recusar; ver ranking e missões.
5. SQL Editor: `select grantee from information_schema.routine_privileges where routine_name='cleanup_duplicate_hunter_profiles';` (vazio)
   e `select policyname from pg_policies where tablename='hunter_duels';` (só "Participantes visualizam seus duelos").
