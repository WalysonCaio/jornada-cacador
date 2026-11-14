# Jornada do Caçador — Guia Unificado e Manual Passo a Passo (r176 — v105)

Última atualização documental: 06 de novembro de 2026  
Versão da aplicação: **r176** (Banco até a migração v105, Chefe com Maestria e Amostra Mínima ≥70%, Selo de Origem em Toda Questão, Recibo Honesto da Missão, Extrator Contínuo em Lote e WebView Seguro) (Ciclo Tático Sincronizado, Lei Seca Cronológica, Provas com Raio-X, Banco de Questões sem Viés, Duelo X1 60s e Conformidade LGPD/DPO)

Este documento reúne o **Manual Passo a Passo de Uso Pedagógico** (seções 1 a 6) e o **Guia Técnico de Manutenção, Banco de Dados e Publicação** (seções 7 a 21).

## 1. Primeiros Passos: Conta, Tema Claro/Escuro, Chave IA e Portais

1. **Crie sua conta e sincronize entre dispositivos:** na tela de abertura, clique em **Criar conta** e informe seu nome, e-mail e senha. Ao usar a mesma conta no computador e no celular, todo o seu progresso é sincronizado automaticamente ao abrir/retornar ao aplicativo e a cada alteração salva.
2. **Alternância entre Tema Claro e Tema Escuro:** no topo da tela, clique em **☀️ Claro / 🌙 Escuro** para alternar entre o visual escuro (Solo Leveling) e o Modo Papel de alto contraste para leitura prolongada de leis e PDFs.
3. **Chave Gemini Pessoal (BYOK — Recomendado):** em **Minha Conta → Configurar minha IA**, cole sua chave gratuita do Google AI Studio. Ela fica criptografada no cofre do servidor (Supabase Vault) e libera cota ampliada para analisar editais extensos, apostilas e redações.
4. **Portais Individuais e Conciliação de 2 Concursos (`🔗 Unificar editais`):** use o seletor de portal no topo da tela (ex.: `PMPE — Soldado ▾`) para criar portais por concurso (`PMPE`, `CBMPE`, `PPPE`, `PCPE`, `PRF`). Para estudar para até 2 provas ao mesmo tempo, clique em **🔗 Unificar editais** na aba **Portais** — os tópicos comuns avançam simultaneamente nos dois editais.

## 2. Como Enviar o Edital (Verticalizado ou Oficial) e Usar o Mapa

1. Abra **Menu → Biblioteca**, escolha o arquivo PDF, selecione a categoria **Edital do concurso** e clique no botão **Enviar para esta campanha** (o edital é 100% individual e privado do seu perfil).
2. O extrator processa tanto **Editais Verticalizados** (em tabela, com checkboxes ou numeração contínua) quanto **Editais Oficiais completos** (até 600 páginas em trechos), separando todas as disciplinas reais em ordem pedagógica (`1 → 2 → 3`).
3. Na aba **Portais**, acompanhe o **Termômetro Duplo do Edital** (**Cobertura Teórica %** vs. **Cobertura Prática em Questões %**), o **Cronograma Reverso** até a data da prova e o **Chefe da Disciplina**.

## 3. Rotina Diária Sincronizada na Aba "Hoje": Missão, Ciclo Tático e Planejamento

A aba **Hoje** mantém em sincronia total a **Missão Atual**, o **Ciclo Tático do seu Edital**, o **Cronômetro de Foco por Modalidade**, o **Plano Diário** e a **Missão Semanal**:

| Etapa da Missão Diária | O que fazer no passo a passo | Como o sistema marca e sincroniza |
|---|---|---|
| **1. Estudar a teoria do tópico** | Selecione **📖 Teoria** no Cronômetro de Foco, dê o play e leia o resumo do tópico na Central de Estudo (ou clique em *1. Abrir Resumo* no Ciclo Tático). | Marca automaticamente ao estudar o resumo da disciplina ou concluir um bloco de foco. |
| **2. Criar resumo ou revisar Flashcards** | Selecione **📜 Lei** no Cronômetro, leia os artigos vinculados e salve sua nota ou revise os cartões em *Estudar → Flashcards*. | Marca ao criar um resumo/nota ou revisar os flashcards. Ao completar **2 etapas (50%)**, sua **Ofensiva Diária** já é confirmada automaticamente! |
| **3. Resolver questões da disciplina** | Clique no botão fixo **◎ Questões de [Disciplina da Missão]** ou em **⚡ Sprint Rápido (5 min)** abaixo da Missão Atual (ou em *Iniciar batalha de 5 questões* na aba Questões). | Acompanha a meta configurada no seu Planejamento (5, 10, 15 ou 20 questões/dia) e marca ao atingir o volume do dia. |
| **4. Corrigir erros e revisão final** | Confira o diagnóstico passo a passo das questões erradas e revise as pendências de 24h, 7d e 30d na Central de Revisão. | Marca ao concluir a bateria comentada ou revisar erros. Clique em **Concluir missão e receber XP**. |

- **Bônus de Maestria Pedagógica no XP:** cada missão concluída concede **+100 XP base** mais um **Bônus de Maestria (+15 XP para acerto $\ge$ 50%, +30 XP para $\ge$ 70% e +50 XP para $\ge$ 85%)** calculado sobre o seu desempenho real nas questões daquela matéria.
- **Ciclo Tático do Edital e Planejamento:** ao clicar em **⏭️ Girar para Próxima Matéria** ou em qualquer disciplina numerada do Ciclo Tático, a Missão Atual, o Cronômetro e o Histórico Diário giram juntos (sem repetir missões concluídas em dias anteriores). No botão **Planejamento**, o resumo ao vivo mostra a soma exata do Plano Diário (ex.: `77m + 58m + 65m + 40m = 240m`) e da Meta Semanal (`20 questões/dia × 6 dias = 120 questões/semana`).

## 4. Biblioteca Inteligente: Raio-X, Caderno de Prova, Gabarito Tardio e Estudo sem PDF

1. **Raio-X Pré-Análise Instantâneo:** ao escolher qualquer PDF na Biblioteca, o sistema mostra na hora o número de páginas, se há texto digital (ou se precisa de OCR) e quantas questões foram detectadas antes do envio.
2. **Provas com Escolha de Caderno e Gabarito Separado:** ao enviar uma *Prova anterior* ou *Simulado*, você pode anexar o **PDF do Gabarito Separado**, colar o gabarito em texto e indicar o **Caderno** (*Tipo 1, Tipo 2, Azul, Amarelo, Branco*).
3. **Botão "🔑 Adicionar gabarito depois" (Blindado):** para provas importadas sem gabarito, clique em **🔑 Adicionar gabarito** quando tiver o gabarito em mãos. O sistema aplica estritamente pelo número da questão, recusa gabaritos ambíguos (dois cadernos colados juntos), nunca sobrescreve respostas já válidas e marca como `ANULADA` as questões anuladas pela banca.
4. **Botão "📝 Criar Estudo por Texto ou Assunto" (Sem PDF):** cole artigos de Lei Seca ou anotações diretamente em texto para gerar resumos, flashcards e questões sem precisar de PDF.
5. **Compartilhamento Comunitário Opt-In (LGPD):** a caixa de compartilhamento comunitário inicia **desmarcada por padrão**; ao marcá-la, apenas resumos e questões higienizados (sem CPF, e-mail ou nome real) são compartilhados, podendo alternar entre **🤝 Público** e **🔒 Privado** a qualquer momento.

## 5. Central de Estudo em Ordem Cronológica, Banco de Questões e Bancas

- **Ordem Didática e Cronológica Estrita (`Art. 1º → Art. 2º → Art. 5º`):** na aba **Estudar**, todos os resumos e artigos seguem ordem numérica e pedagógica, trazendo Explicação, Lei Seca em Destaque, Bizu de Prova, Mnemônico, Pegadinha da Banca e **Mapa Mental Tático**.
- **Banco de Questões Balanceado e Bases Gratuitas:** na aba **Questões**, as 117 questões nativas são marcadas com honestidade como `autoral` (mantendo o filtro por estilo da banca: *Instituto AOCP, Cebraspe, FGV Conhecimento, UPENET/IAUPE, IBFC, IDECAN*), com alternativas embaralhadas de forma determinística (distribuição equilibrada A/B/C/D = 21%/32%/26%/20%), indicação de **Norma-Base e Data de Conferência (11/2026)** e botão **⚠️ Reportar erro ou lei atualizada**.
- **Importação de Bases Gratuitas e Remoção de Duplicatas:** use o botão **📦 Importar JSON** para carregar `banco-questoes/lote-bases-gratuitas.json` (com deduplicação automática por *fingerprint*) ou execute `banco-questoes/limpar-questoes-repetidas-supabase.sql` no SQL Editor do Supabase.
- **Simulador de Aprovação (Meta de Corte & Correção de Gargalos):** compara sua nota líquida com a meta de corte do concurso e aponta as disciplinas prioritárias para correção.

## 6. Arena Duelo X1 (60s), Redação IA, TAF, Story 9:16 e Privacidade LGPD

- **Arena Duelo X1 (60s por questão + Bots Examinadores):** desafie colegas online ou treine contra os Bots das Bancas (AOCP, Cebraspe, FGV, UPENET e Sombra Rank S) com 60 segundos por questão, suporte a 2–5 alternativas e placar validado no servidor.
- **Card Story 9:16:** baixe ou compartilhe seu card vertical (1080×1920) ao final de cada bateria de questões.
- **Redação IA, TAF e Ranking:** pratique redações com Textos Motivadores I e II, registre seus treinos no Painel TAF Policial e acompanhe o Ranking Geral (com opção de ocultar seu perfil).
- **Canal Público do Encarregado (DPO — Art. 41, § 1º da LGPD):** `privacidade@jornadadocacador.com.br` (além de exportação JSON e exclusão definitiva de conta em *Minha Conta*).

## 7. Estrutura Técnica de Pastas do Projeto

```text
dist/                  site e PWA publicados (inclui native-question-bank.json)
supabase/functions/    7 Edge Functions executadas no servidor
supabase/migrations/   31 migrações SQL do banco de dados (até v102)
scripts/               11 suítes de validação e testes automatizados
banco-questoes/        lotes JSON de questões abertas e scripts SQL de limpeza/seed
desktop/               instalador Windows (Electron)
android/               projeto Android (WebView)
```

## 8. Validação Obrigatória Antes de Publicar

Na raiz do projeto (`C:\Users\Walyson Caio\Documents\jornada-cacador`), execute:

```cmd
node scripts\validate-project.mjs
node scripts\test-question-bank.mjs
node scripts\test-attach-answer-key.mjs
node scripts\test-crud-contracts.mjs
node scripts\test-security-contracts.mjs
node scripts\test-front-study.mjs
```

Todos os scripts devem exibir `OK:`.

## 9. Publicação no GitHub e Cloudflare Pages

```cmd
cd "C:\Users\Walyson Caio\Documents\jornada-cacador"
git add .
git commit -m "feat(r148): manual oficial e video tutorial atualizados + sincronia completa"
git push origin main
npx wrangler pages deploy dist --project-name jornada-cacador --commit-dirty=true
```

Após o deploy concluir, abra o site e pressione `Ctrl + Shift + R` para ativar o Service Worker `r148`.

## 10. Migração SQL v102 no Supabase (5 Alternativas no Banco Compartilhado)

Caso ainda não tenha executado a migração `v102`, abra o **SQL Editor** no Supabase e execute `supabase/migrations/20261106120000_v102_shared_bank_five_options.sql`:

```sql
do $$
begin
  if to_regclass('public.shared_question_bank') is not null then
    alter table public.shared_question_bank drop constraint if exists shared_question_bank_correct_index_check;
    alter table public.shared_question_bank
      add constraint shared_question_bank_correct_index_check
      check (correct_index >= 0 and correct_index <= 4);
  end if;
end
$$;
```

## 11. Autoria e Aviso Legal

Projeto idealizado por **Walyson Caio**. Plataforma independente, sem vínculo oficial com órgãos públicos, bancas examinadoras ou cursos preparatórios. Leis, editais e gabaritos devem ser conferidos nas publicações oficiais.
