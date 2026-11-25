# Revisão r182 — aplicação e envio ao GitHub

Entrega concluída em 19/11/2026, sobre a r181 (`52b236036f5207117918aeb84ddd1df89eacdd1d`). A revisão preserva a biblioteca compartilhada, o tema, a sidebar, o cronômetro e os painéis recentes. Os Manuais do Caçador continuam como ajuda da plataforma, fora do material de disciplina.

[Correções realizadas](ALTERACOES.md) · [Verificações](VALIDACAO.txt)

## 1. Baixe a entrega correta

A branch de entrega é `entrega/revisao-r182`. O ZIP `jornada-cacador-r182-alteracoes.zip` contém arquivos de código novos/alterados, com os caminhos do projeto. **Extraia na pasta do projeto; não envie ao importador de backup do aplicativo.** Preserve sua pasta `.git`.

Se preferir conferir uma cópia separada, abra um terminal numa pasta onde queira guardar o projeto:

```bash
git clone --branch entrega/revisao-r182 https://github.com/WalysonCaio/jornada-cacador.git jornada-cacador-r182
cd jornada-cacador-r182
```

Se usar sua cópia existente, confira `git status`, guarde alterações locais e faça uma cópia antes de extrair o ZIP sobre a raiz. A base desta entrega está indicada acima; compare antes de sobrescrever se sua pasta já tiver modificações posteriores.

## 2. Execute os testes

Instale Node.js 24 ou superior. Na raiz do projeto:

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

Os testes SQL usam PostgreSQL/PGlite local e não alteram seu Supabase. Os testes das funções de IA simulam os serviços e não consomem sua chave. Resultados e limites estão em `VALIDACAO.txt`.

## 3. Publique as alterações no GitHub

Se aplicou o ZIP na sua cópia local, execute um comando por vez. A branch abaixo separa a revisão para conferir antes de integrar ao `main`:

```bash
git status
git switch -c melhorias-r182
git diff --stat
git add .github .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase package.json package-lock.json docs
git diff --cached --stat
git commit -m "fix(r182): corrige gabaritos, disciplinas, sincronizacao e leis"
git push -u origin melhorias-r182
```

No CMD do Windows, copie somente os comandos, sem comentários começando com `#`. A lista explícita evita adicionar o arquivo acidental da raiz com parte de uma mensagem antiga de commit. Confira o que foi selecionado antes do commit; não inclua dependências, arquivos de ambiente ou chaves.

No GitHub, abra **Compare & pull request** de `melhorias-r182` para `main`, confira **Files changed** e aguarde **Validar projeto**. Depois integre a revisão. Se preferir a branch já entregue, compare `entrega/revisao-r182` diretamente com `main`.

Se a branch `melhorias-r182` já existir, use `git switch melhorias-r182`. Se o push apontar divergência, confira o histórico antes de integrar; não use `--force` como solução automática. Não é necessário executar `git init` novamente.

Para proteção contínua, nas regras do repositório exija a verificação de qualidade antes de integrar alterações no `main`. Nesta entrega, os workflows Android e Windows também passaram a depender dos mesmos testes Node e SQL antes de compilar e disponibilizar seus artefatos.

## 4. Aplique a migração das leis

Faça backup e use um ambiente de homologação antes de atualizar o ambiente de produção. A presença de um SQL no GitHub não o executa no Supabase.

A nova migração é:

```text
supabase/migrations/20261118010000_v109_owned_laws_library.sql
```

Ela exige a tabela criada pela migração já existente:

```text
supabase/migrations/20261117130000_v106_internal_laws_bank.sql
```

Essa v106 é a que contém `internal_laws_bank` no nome; existe outra migração histórica com o mesmo número e outra finalidade. Confira o nome completo e o histórico aplicado.

A v109 remove a unicidade global do ID de lei e permite cópias por `(user_id,id)`, preservando registros e políticas existentes. Ela também registra fonte, versão e natureza do conteúdo. **Aplique-a antes do frontend r182**, que usa `on_conflict=user_id,id` e as novas colunas.

Continuam necessários os pré-requisitos já presentes no projeto: v107 para gravação atômica do edital e v108 para privacidade do ranking. Não execute todas as migrações antigas indiscriminadamente. Se essas versões já estão aplicadas, esta revisão acrescenta somente a v109.

## 5. Funções Supabase: painel ou CLI

As funções atuais permanecem autocontidas, com validadores incorporados. Há cópias em `supabase/dashboard/`, testadas para colar no editor sem depender da pasta `_shared`. A lógica de servidor não foi substituída por validação permissiva.

Para publicar pelo painel, abra **Edge Functions → nome da função → Code → index.ts**, substitua o conteúdo inteiro pelo `supabase/dashboard/nome-da-funcao/index.ts` correspondente e clique **Deploy updates**. Não apague apenas imports nem cole código de uma função em outra. Mantenha suas configurações de autenticação e Secrets.

As seis cópias disponíveis são:

```text
assistente-pmpe
redacao-gemini
material-gemini
edital-gemini
account-security
system-diagnostics
```

Se as seis funções autocontidas da r181 já foram publicadas corretamente, esta revisão não exige republicá-las por mudança de lógica: os ajustes nelas são de documentação do código. Use as cópias caso precise atualizar ou recuperar uma publicação incompleta.

Alternativa pela CLI, a partir da raiz do projeto e já autenticado:

```bash
npx supabase functions deploy assistente-pmpe --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy redacao-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy edital-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy system-diagnostics --project-ref jybislbbblyjsrcdegjt
```

Confira que esse identificador é o seu ambiente de destino. Os comandos não precisam de `--no-verify-jwt` para aplicar esta revisão. Nunca copie service role ou chave de IA para o frontend.

## 6. Publique o frontend e confira os fluxos

Depois da migração, publique `dist` completa pelo seu fluxo Cloudflare existente. O service worker usa cache r182. Inclua os módulos, os arquivos de ajuda e `native-laws-database.json`; não publique apenas o `index.html`. Feche e reabra clientes antigos para receber a atualização.

Cenários de conferência no seu ambiente:

1. Português/Crase e CPP/Penal: filtros, sprints e teoria mantêm a matéria e o conteúdo selecionados; ausência de questões permanece explícita.
2. Gabarito ausente, anulado ou sugerido pela IA: não vira A nem acerto confirmado. Revisão pessoal permanece identificada.
3. Treino e simulado: continuar depois, fechar/reabrir e retomar; relógio do simulado não reinicia.
4. Troca de conta/portal com rede lenta: respostas antigas não alteram o contexto novo.
5. Leis: duas contas salvam o mesmo ID, recebem seu conteúdo e recuperam as cópias ao carregar; falha de rede distingue salvamento local de nuvem.
6. Painel: Hoje e outros períodos mudam os indicadores; redações/flashcards usam registros reais e notas zero continuam visíveis.
7. Menu → Manuais do Caçador: ajuda abre sem gerar material, estudo ou XP. A biblioteca continua conforme o compartilhamento existente.
8. Upload de edital: um portal que já tem edital é preservado; use outro portal para outro edital ou faça a exclusão explícita pelo fluxo protegido. O upload não apaga automaticamente edital, arquivo ou mapa anterior.

A suíte de navegador pode ser executada no seu computador:

```bash
npx playwright install chromium
npm run test:browser
```

Também está disponível em **Actions → Homologar navegador (manual) → Run workflow**. O código foi verificado por Node/VM e SQL isolado; as condições de verificação visual deste ambiente estão documentadas em `VALIDACAO.txt`.

Esta entrega fornece código e procedimentos. Não foram executados SQL remoto, deploy Cloudflare/Supabase ou novos builds APK/EXE durante a revisão.
