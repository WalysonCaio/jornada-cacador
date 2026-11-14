# Revisão r178 — arquivos corrigidos e aplicação

Base: `main` no commit `da6df61304f85d8067008f11f716bb79d8c1a46f` (r177), em 14/11/2026. Código de entrega na branch `entrega/revisao-r178`. A branch principal não foi atualizada por esta revisão.

- [Avaliação completa e notas](AVALIACAO.md)
- [Comparação com plataformas do segmento](COMPARACAO.md)
- [Resultado das verificações](VALIDACAO.txt)
- [ZIP somente com alterações](../../entregas/r178/jornada-cacador-r178-alteracoes.zip)

O ZIP é **atualização do código**, não backup de progresso. Extraia-o na pasta do projeto, mantendo os caminhos; não use o importador de backup dentro do aplicativo. Não contém `.git`, dependências, segredos nem novos APK/EXE. Arquivos originais já presentes no repositório não foram recompilados.

## O que você recebe

Disciplina/assunto/banca consistentes, gabaritos sem assumir A, sugestão IA pendente, feedback e desempenho por banca preservados, retomada de treino e simulado, painéis secundários adiados, teoria da matéria correta, telemetria sem números inventados, perfil mais seguro, privacidade do ranking e transação do edital restaurada. A biblioteca mantém seu compartilhamento. Os Manuais do Caçador ficam na ajuda, sem virar conteúdo de estudo.

## 1. Escolha uma forma de aplicar

**Mais simples para conferir a entrega completa:** faça uma cópia separada da branch. Abra um terminal numa pasta onde queira guardar essa cópia e execute, um comando por vez:

```bash
git clone --branch entrega/revisao-r178 https://github.com/WalysonCaio/jornada-cacador.git jornada-cacador-r178
cd jornada-cacador-r178
```

**Se quiser atualizar sua pasta existente:** salve uma cópia do código e exporte seu progresso pelo aplicativo. Confira `git status` e preserve modificações locais. Extraia o ZIP de alterações sobre a raiz do projeto, incluindo `.gitignore`, sem substituir sua pasta `.git`. O pacote foi feito para a base indicada acima; compare antes se sua cópia já tiver outras alterações posteriores.

## 2. Teste localmente

Com Node.js 24 ou superior, na pasta que contém `package.json`:

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

Os testes SQL usam PostgreSQL/PGlite local: não alteram o Supabase remoto. Os testes de IA usam serviços simulados: não consomem sua chave nem demonstram acurácia factual do provedor.

Para homologar a interface no seu computador, ou pelo workflow manual do GitHub:

```bash
npx playwright install chromium
npm run test:browser
```

No GitHub: **Actions → Homologar navegador (manual) → Run workflow**, selecione `entrega/revisao-r178`. A execução visual ficou pendente nesta revisão; a suíte está preparada para desktop e celular. O workflow **Validar projeto** executa Node e as duas integrações SQL.

## Publicação pelo editor do painel Supabase

Se usa o editor e recebeu `Module not found .../_shared/question-integrity.mjs`, use [os arquivos autocontidos do painel](../../supabase/dashboard/README.md). Copie o `index.ts` correspondente inteiro; ele já inclui os validadores. O roteiro CLI abaixo utiliza a árvore modular completa em `supabase/functions`.

## 3. Atualize banco e funções antes do frontend

Use primeiro um ambiente de homologação e backup do banco. Este pacote não executa migrações automaticamente.

1. Confira o histórico de migrações aplicado. A **v107** (`supabase/migrations/20261113120000_v107_atomic_edital_topics.sql`) continua necessária à RPC de gravação atômica do edital. Não repita migrações antigas indiscriminadamente.
2. Aplique a **nova v108** (`supabase/migrations/20261114120000_v108_leaderboard_profile_privacy.sql`) após o esquema existente, incluindo o ranking v97. Ela oculta campos privados no servidor; apenas subir o frontend não resolve a exposição na API. O teste SQL cobre reexecução e revogação da função bruta.
3. As migrações anteriores v74 e v72 continuam necessárias a exclusões e redefinição seguras. Se a RPC exigida estiver ausente, o código preserva os dados e informa a pendência.
4. Publique as seis funções abaixo, com seus imports `_shared`, pelo fluxo Supabase existente.

Se usa a CLI, já autenticado, substitua `SEU_PROJECT_REF` pelo identificador correto:

```bash
supabase functions deploy account-security --project-ref SEU_PROJECT_REF
supabase functions deploy assistente-pmpe --project-ref SEU_PROJECT_REF
supabase functions deploy edital-gemini --project-ref SEU_PROJECT_REF
supabase functions deploy material-gemini --project-ref SEU_PROJECT_REF
supabase functions deploy redacao-gemini --project-ref SEU_PROJECT_REF
supabase functions deploy system-diagnostics --project-ref SEU_PROJECT_REF
```

Não envie chaves de provedor/service role ao frontend. Esta revisão não mudou seus secrets. Subir SQL ao GitHub não o aplica ao Supabase.

## 4. Envie suas alterações ao GitHub

Se copiou o ZIP sobre sua pasta local e quer publicar a revisão no `main`, estes comandos são adequados **após conferir que não há conflito ou operação Git pendente**:

```bash
git status
git diff --stat
git add .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase android desktop windows-desktop package.json package-lock.json docs
git diff --cached --stat
git commit -m "fix(r178): corrige disciplinas, gabaritos, retomada e privacidade"
git push origin main
```

A lista explícita evita incluir o arquivo acidental da raiz com parte da mensagem de commit. No CMD do Windows, copie somente os comandos, sem linhas explicativas começando com `#`. `git add .` também adicionaria arquivos indesejados presentes na pasta; por isso a lista é preferível aqui.

Se estiver avaliando a branch de entrega, pode abrir **Compare & pull request** de `entrega/revisao-r178` para `main`, revisar **Files changed** e aguardar os checks antes de integrar. Evite forçar o push para resolver divergências; confira o histórico e preserve suas alterações.

## 5. Publique e confira

Depois do banco/funções, publique a pasta `dist` completa pelo seu fluxo Cloudflare existente. O cache r178 inclui `hunter-manuals.js/css`, `question-session-store.js` e `jc-architecture-modules.js`. Feche/reabra clientes antigos para receber a atualização. Não é necessário trocar o domínio.

Confira em homologação:

- Português/Crase, CPP e Penal: seleção sem mistura; disciplina/tópico sem itens mostra ausência.
- Gabarito ausente, anulado ou sugerido pela IA: sem pontuação confirmada; revisão pessoal continua identificada.
- Treino e simulado: responder, eliminar alternativa, continuar depois, fechar/reabrir e retomar; tempo do simulado não reinicia.
- Teoria: mesma disciplina; sem resumo, informa a lacuna. Manuais abrem na ajuda sem contar estudo/XP.
- Troca de conta/portal com rede lenta: dados antigos não aparecem na nova conta; sincronização e perfil exibem situação real.
- Ranking: ocultar campos numa conta e consultar de outra; sem horas/questões/semana inventadas.
- Edital: testar reanálise e falha de gravação sem perder o mapa anterior.
- Biblioteca compartilhada: documentos e controles continuam conforme sua configuração.

A entrega é código para aplicar e homologar. Nenhum deploy Cloudflare/Supabase, SQL remoto ou build de instalador foi executado.
