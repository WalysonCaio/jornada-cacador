# r183 — arquivo para aplicar e passo a passo do GitHub

Entrega de 20/11/2026. Base: `main` r181 (`52b236036f5207117918aeb84ddd1df89eacdd1d`). Inclui as correções r182 e a conferência das alterações relatadas pelo Gemini.

[O que foi verificado, corrigido e avaliação](CONFERENCIA-GEMINI.md) · [Validação e limites](VALIDACAO.txt) · [Arquivos e hashes](MANIFESTO.json).

**A biblioteca compartilhada permanece com a política existente. Os Manuais do Caçador permanecem na ajuda, fora de material de estudos e disciplinas.**

## 1. Escolha como aplicar

A branch pronta é `entrega/revisao-r183`. O arquivo `entregas/r183/jornada-cacador-r183-alteracoes.zip` contém todos os arquivos novos/alterados em relação à base acima, com os caminhos corretos.

**O ZIP é uma atualização do código. Extraia na raiz do projeto; não importe no backup do aplicativo.** Faça uma cópia da pasta atual e preserve `.git`. Se sua cópia já contém alterações posteriores, confira o diff antes de sobrescrever.

Uma opção que evita misturar alterações locais é clonar a entrega em outra pasta:

```bash
git clone --branch entrega/revisao-r183 https://github.com/WalysonCaio/jornada-cacador.git jornada-cacador-r183
cd jornada-cacador-r183
```

Se usar a branch pronta, o código já está no GitHub: não precisa reenviar os mesmos arquivos. No GitHub, compare `entrega/revisao-r183` com `main`, confira Files changed e os testes, e abra/integre o pull request quando concluir a conferência. Link de comparação:

https://github.com/WalysonCaio/jornada-cacador/compare/main...entrega/revisao-r183

## 2. Teste antes de integrar

Com Node.js 24 ou superior, na raiz:

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

A suíte SQL usa PostgreSQL/PGlite local, não o banco de produção. As simulações de IA não consomem sua chave. Os resultados estão no relatório da versão.

## 3. Se aplicou o ZIP na sua pasta local

No CMD do Windows, copie um comando por vez, sem linhas de comentário com `#`:

```cmd
cd "C:\Users\Walyson Caio\Documents\jornada-cacador"
git status
git switch -c melhorias-r183
git diff --stat
git add .github .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase package.json package-lock.json docs
git diff --cached --stat
git commit -m "fix(r183): conclui revisao de estudo, interface, sincronizacao e leis"
git push -u origin melhorias-r183
```

Se `melhorias-r183` já existe, use `git switch melhorias-r183`. Não execute `git init` de novo. Se aparecer `nothing to commit`, os arquivos não diferem da versão já salva ou a extração ocorreu em outra pasta; confira `git status` e o caminho. Se o push indicar divergência, confira o histórico e integre as alterações; não use `--force` como correção automática.

A lista explícita em `git add` evita selecionar arquivos acidentais da raiz. Sempre confira o conteúdo selecionado. Não envie `.env`, chaves, dependências ou backups pessoais. No GitHub, abra Compare & pull request de `melhorias-r183` para `main`, confira Files changed, aguarde Validar projeto e então integre.

`git add .`, commit e push funcionam quando a pasta está correta e o conjunto foi conferido. O ponto principal é aplicar os arquivos de verdade antes desses comandos; Git não cria as correções sozinho.

## 4. Atualize o banco se necessário

A r183 não acrescenta SQL além do incluído na r182. Confira o histórico aplicado, tenha backup e valide em homologação.

A tabela de leis requer a migração existente:

```text
supabase/migrations/20261117130000_v106_internal_laws_bank.sql
```

E a correção por usuário:

```text
supabase/migrations/20261118010000_v109_owned_laws_library.sql
```

A v109 permite o mesmo ID para duas contas, usa `(user_id,id)` e registra fonte/versão/natureza do conteúdo. **Aplique antes do frontend.** Se já foi aplicada na r182, não há uma migração r183 nova a executar. Existe outra v106 histórica para outra finalidade: confira o nome completo. V107 (edital atômico) e v108 (privacidade de ranking) seguem os pré-requisitos existentes. Não rode todas as migrações antigas indiscriminadamente.

## 5. Publique a nova função `leis-oficiais`

Para importar os documentos oficiais, esta função precisa existir no Supabase. Ela autentica a conta, aceita somente IDs de um catálogo fixo, busca texto oficial e devolve fonte/hash; não usa Gemini para inventar ou completar lei e não usa service role para gravar.

Pelo painel:

1. Abra Supabase → Edge Functions e crie/abra a função **leis-oficiais**.
2. Em Code → `index.ts`, cole o conteúdo inteiro de **`supabase/dashboard/leis-oficiais/index.ts`**.
3. Mantenha a autenticação e as variáveis padrão do Supabase; publique em Deploy updates.
4. Não acrescente chave secreta ao frontend. Confira que o projeto de destino é o seu.

Pela CLI já autenticada, alternativa ao painel:

```bash
npx supabase functions deploy leis-oficiais --project-ref jybislbbblyjsrcdegjt
```

As seis funções anteriores têm cópias autocontidas em `supabase/dashboard/` e continuam disponíveis para recuperação/publicação. `assistente-pmpe` deve receber o arquivo da própria função. O erro antigo `Module not found .../_shared/question-integrity.mjs` é resolvido usando a cópia autocontida inteira ou publicando a pasta completa pela CLI; não apague apenas o import.

Após alterar uma fonte do servidor, regenere e teste as cópias:

```bash
node scripts/build-supabase-dashboard.mjs
node scripts/test-supabase-dashboard.mjs
```

A nova função permite as origens atuais e localhost. Se hospedar em outro domínio, acrescente a origem real na lista explícita do servidor, regenere e publique. Não desative autenticação para contornar erro.

## 6. Publique `dist` completa

O projeto está configurado para Cloudflare Workers em `wrangler.jsonc`. Use seu fluxo de publicação existente; pela CLI autenticada, na raiz:

```bash
npx wrangler deploy
```

Inclua a pasta `dist` inteira: módulos, ajuda, JSON, CSS e service worker. O cache é r183. GitHub atualizado não executa SQL nem publica automaticamente uma função do Supabase. Se sua hospedagem está conectada ao GitHub, confira o deploy após integrar a branch.

## 7. Confira no seu ambiente

1. Alterne Visual Limpo: banners/gavetas mudam; origem e situação do gabarito continuam visíveis.
2. Cronômetro em tela cheia: computador/celular, claro/escuro, modo regressivo/acumulado, teclado e saída. Wake Lock depende do suporte do navegador.
3. Perca uma vida da trilha; aguarde a regeneração de uma por 20 minutos. O botão não concede três vidas grátis.
4. Em Questões, filtre Português/Crase e CPP/Inquérito, inclusive sprint e simulado. Sem itens compatíveis, não deve aparecer outra matéria como substituição.
5. Abra uma questão pendente de gabarito: não deve receber chave A automática, pontuação confirmada ou aprovação fabricada. Teste continuar depois e retomar.
6. Use Teoria & Lei, Cadernos, Anotações e Invocador; navegação deve preservar o treino. Troque conta/portal durante uma resposta lenta; a resposta antiga não deve aparecer no contexto novo.
7. Em Leis & Textos, importe um documento do catálogo. Confira fonte, data, hash, quantidade e última página do leitor; atualize e recupere a cópia. Faça o mesmo em outra conta. Falha de fonte/rede/espaço não pode produzir confirmação falsa.
8. Confira painéis por período e notas zero, Menu → Manuais na ajuda e política existente da biblioteca.

O importador preserva os parágrafos textuais do HTML recebido. Não transcreve automaticamente imagens, PDFs ou anexos externos e não certifica vigência. Quando uma fonte oficial bloqueia, a seleção anterior permanece disponível e a falha é informada. O catálogo não equivale a 13 importações já executadas na sua conta.

A homologação de navegador pode ser executada no seu computador ou no workflow manual existente:

```bash
npx playwright install chromium
npm run test:browser
```

Não foram executados nesta entrega: SQL remoto, deploy Cloudflare/Supabase, instalação no dispositivo, novo APK/EXE ou merge automático no `main`. São ações de aplicação da entrega, com instruções concretas acima; os limites dos testes estão documentados.
