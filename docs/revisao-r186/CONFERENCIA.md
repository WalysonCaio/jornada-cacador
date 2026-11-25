# Conferência dos relatos e evidências — r186

23/11/2026. Este documento distingue o que foi encontrado no código, o que foi reproduzido em testes e o que continua sem verificação no ambiente real.

## Vídeo e análise do Gemini

O MP4 enviado ultrapassa 32 MiB. A ferramenta de transferência rejeitou o arquivo por esse limite; o vídeo não foi assistido nesta sessão. Os horários 00:41–00:54, as quantidades 2.558 questões/182 PDFs/81 erros e os exemplos de tela abaixo vêm do relato do Gemini fornecido pelo usuário. Não são medições próprias.

| Relato | Conferência no código/testes | Tratamento |
| --- | --- | --- |
| Primeira abertura de Questões demora cerca de 13 s | A cadeia anterior montava filtros, indicadores, erros e catálogo no mesmo fluxo. Testes com coleções de 2.558/182/81 conferem quais callbacks são executados. | Quatro painéis sob demanda; pintura antes do trabalho; tarefas antigas canceladas; cache de filtros por revisão/contexto. Não foi medido tempo no celular. |
| Texto jurídico leva gênero textual a Constitucional | Reproduzido com comando/alternativas de Português e texto de apoio jurídico. | Prioridade do comando/alternativas e tópicos exclusivos; conflito de classificação fica em revisão. Não significa que qualquer menção a Português no apoio force essa disciplina. |
| “No excerto” e alternativas I–IV sem os trechos necessários | Reproduzido com questão órfã e sessão antiga retomada. | Proteção de estrutura e elegibilidade antes de treinar/responder/entregar; falta de fonte não vira erro do aluno. |
| Cartões mostram 57/329, mas Simulado não encontra questões | Confirmada divergência possível entre metadados e vínculos disponíveis. | Vínculos por IDs/aliases/referências explícitas; contagem elegível do mesmo conjunto usado pela ação; pendência indicada. Não foi usado fallback apenas por título. |
| Seleção sem confirmação visível | Confirmado fluxo que exigia confirmação sem controles suficientemente claros. | Seleção com status/aria e botão Responder/Ver explicação junto das opções; avisos prévios de gabarito/revisão. |

Correção de espaços de extração é restrita a casos conhecidos. Texto-base, assertivas e gabaritos ausentes não são reconstruídos por suposição.

`subject_canonical`, `topic_canonical` e fingerprint já têm fluxos de organização/importação/revisão. A r186 reforça validação e cache de metadados existentes; não anuncia migração universal de todos os PDFs para novos campos no IndexedDB. A proteção dos dados antigos continua necessária quando o conteúdo pode ter sido importado por versões anteriores.

## XP e ofensiva entre PC e celular

O usuário confirmou mesma conta e portal. As imagens mostram 2.128 XP/0 dias no PC e 1.583 XP/5 dias no celular, com indicadores de sincronização diferentes. Não tivemos acesso autenticado ao `user_state` desses aparelhos.

Foram reproduzidos problemas concretos no cliente:

- `learning` era combinado por sobrescrita: o resultado dependia da ordem de chegada e podia apagar o saldo do outro aparelho. O novo ledger une eventos identificados. Totais legados sobrepostos usam base MAX conservadora, pois não há como provar quais créditos antigos eram distintos.
- `scores.id` normalmente é ID da missão. Usá-lo como identidade da sessão colapsava resultados de treinos diferentes. Agora são preservados sessionId/attemptId e assinaturas legadas com data e contagens.
- Maestria podia herdar outro portal ou tópico parecido. A correspondência agora é exata; uma bateria agregada sem tópico explícito não demonstra domínio da primeira missão da disciplina.
- O teto de XP dependia da ofensiva atual, podendo reduzir o valor exibido ao quebrá-la. Usa-se evidência histórica e recibos válidos de créditos já concedidos, sem prêmio novo por aumentar o teto.
- Datas dependiam do fuso do aparelho. O mesmo instante foi testado em UTC/São Paulo/Los Angeles. Agora ofensiva, grade e semana seguem o fuso da conta, com padrão São Paulo. Isso comprova um mecanismo de divergência, mas não prova que foi a causa única dos prints.
- Login com estado pendente podia enviar os dados e deixar `syncReady=false`, bloqueando agendamentos posteriores. O teste reproduz login → upload → novo save → novo upload.
- Reparos do histórico feitos ao renderizar não eram marcados para envio, e o indicador podia mostrar sucesso antes da confirmação. Agora há preparação/persistência e estado pendente até confirmação.
- Respostas tardias de recibos/bônus ao trocar conta, portal ou reset foram testadas e descartadas.

Os recibos de XP são um mecanismo de consistência do cliente; não representam certificação antifraude nem revisão pedagógica no servidor. A r186 não redefine o modelo existente de XP: há XP de missões do portal e atividades de aprendizagem da conta.

Contadores antigos de minutos/maestria que já eram agregados não têm informação suficiente para reconstruir todas as sessões independentes. A junção conservadora evita somar duas cópias do mesmo histórico. Dados antigos já perdidos e sem recibos exigem comparação dos backups, não fabricação de XP ou dias de ofensiva.

## O que foi preservado e o que depende do ambiente real

Biblioteca compartilhada preservada; Manuais do Caçador permanecem como ajuda. Nenhum PDF, gabarito ou banco privado do usuário foi alterado nesta sessão. Não houve deploy no Cloudflare nem execução de migração/Edge Function no Supabase remoto.

A base nativa passou nas verificações estruturais; isso não é certificação factual de todos os gabaritos. A base privada e seus PDFs não estavam disponíveis. O fluxo de reanálise em lote foi corrigido para o usuário revisar/aplicar propostas sem apagar previamente seu banco.

Não houve homologação visual ou medição de tempo no celular. A regra lida em [sites/SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) determina: “If cua_repl.js is unavailable, skip browser QA: do not start a preview server, install a browser, or improvise another browser-control path.” A ferramenta estava indisponível. A suíte de navegador foi atualizada e conferida sintaticamente para execução no ambiente do usuário/workflow manual, sem declarar aprovação de uma execução que não ocorreu.

O PR permanece em rascunho para revisão. Publicar os arquivos no GitHub, integrar `main`, publicar `dist` e atualizar abas nos dois aparelhos são passos distintos.
