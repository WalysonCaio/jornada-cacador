# Como aplicar a revisão e publicar no GitHub

Este roteiro usa Windows e um repositório novo. O pacote r172 contém código-fonte; não é APK nem instalador Windows. O compartilhamento da biblioteca permanece como no projeto recebido.

## 1. Preparar a pasta

1. Baixe e extraia `Jornada-Cacador-Revisado-r172.zip`.
2. Abra a pasta `jornada-cacador`. Nela devem estar `README.md`, `package.json`, `dist`, `supabase`, `scripts` e `.github`.
3. Guarde sua pasta anterior separadamente. Para testar o pacote, prefira uma pasta nova; não copie a antiga pasta `.git`, `.env`, `build` ou caches.
4. Instale Git para Windows e Node.js 24 ou posterior pelas páginas oficiais. Abra novamente o PowerShell após instalar.
5. No Explorador de Arquivos, abra a pasta extraída, clique na barra de endereço, digite `powershell` e pressione Enter.

Confira:

```powershell
git --version
node --version
npm --version
npm test
```

O resultado esperado é **16/16 scripts passaram**. O teste da raiz não precisa de `npm install`: usa bibliotecas do próprio Node. Os instaladores Windows são projetos separados e precisam de dependências próprias. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd test`.

Não confunda uma advertência de API experimental do Node com uma falha. Leia o resumo e o código de saída. Se algum teste falhar, não publique essa alteração como validada.

## 2. Criar o repositório no GitHub

1. Entre em https://github.com e clique no **+ → New repository**.
2. Nome sugerido: `jornada-cacador`.
3. Escolha **Private** para revisar o código com acesso restrito ou **Public** para disponibilizar o código conforme a sua licença atual. A visibilidade do GitHub não muda a biblioteca dentro do aplicativo.
4. Como o pacote já tem README e licença, deixe desmarcadas as opções de criar README, `.gitignore` e licença no GitHub.
5. Clique em **Create repository**.
6. Copie o endereço HTTPS exibido. Ele se parece com `https://github.com/SEU-USUARIO/jornada-cacador.git`.

## 3. Enviar o código pelo PowerShell

Na pasta do projeto, configure sua identificação se ainda não estiver configurada. Use seus próprios dados; o e-mail pode ser o endereço `noreply` fornecido pelo GitHub em Settings → Emails.

```powershell
git init -b main
git config user.name "SEU NOME"
git config user.email "SEU EMAIL DO GITHUB"
git add .
git status
git diff --cached --stat
```

Confira a lista: não devem entrar `.env`, senhas, chaves privadas, keystore, `node_modules`, `build`, `.gradle`, `local.properties` ou caches. O `.gitignore` do pacote já cobre os principais caminhos, mas não remove arquivos que já estivessem rastreados em outro repositório. A chave pública/publishable do Supabase é diferente de uma chave secreta de serviço; não coloque `service_role` no front nem no Git.

Depois da conferência:

```powershell
git commit -m "Revisao r172: integridade pedagogica, IA, cache e testes"
git remote add origin https://github.com/SEU-USUARIO/jornada-cacador.git
git push -u origin main
```

Substitua `SEU-USUARIO` e o nome do repositório pelo endereço real. O Git pode abrir uma janela para autenticação. Conclua a autenticação da sua conta; não escreva token dentro do endereço do repositório ou dos arquivos.

Atualize a página do GitHub. Você deve ver as pastas e arquivos, não apenas um ZIP. A aba **Actions** executará o workflow **Validar projeto**. Os builds Android e Windows existentes podem executar conforme os gatilhos de cada workflow. Um build verde do Android não comprova que o aplicativo foi testado em aparelho.

## 4. Se já existe um repositório

Não rode `git init` nem substitua o `origin` sem verificar onde está trabalhando. Use uma cópia/clonagem do repositório existente e uma branch de revisão:

```powershell
git status
git remote -v
git switch -c revisao-r172
```

Copie os arquivos alterados do pacote para essa cópia, preservando sua `.git` e sua configuração local. O documento `ARQUIVOS-ALTERADOS.md` identifica as mudanças; `ALTERACOES.patch` contém a diferença em relação ao RAR recebido. O patch pode não aplicar em versões mais recentes: confira primeiro com `git apply --check CAMINHO-DO-PATCH`.

Rode `npm test`, confira `git diff` e então:

```powershell
git add .
git commit -m "Aplica revisao r172"
git push -u origin revisao-r172
```

Abra um Pull Request para revisar. Não use `git push --force` para resolver divergência. Se o push for rejeitado, confira a branch e as mudanças remotas antes de tentar novamente.

## 5. Como atualizar o site e o backend

**GitHub guarda o código. Não é a mesma coisa que atualizar seu aplicativo.** O projeto aponta para Cloudflare Workers e Supabase, com configurações de projeto específicas. A publicação dessas partes deve ocorrer somente no ambiente que você pretende atualizar.

### Primeiro: homologação

Use um projeto Supabase de teste e uma URL de teste da aplicação. Não aponte os testes de exclusão/reset para contas reais. Confira histórico de migrações e faça backup antes de qualquer mudança no banco existente.

A correção de banco é a nova migração:

`supabase/migrations/20261112160000_v106_mastery_column_and_bonus_lock.sql`

Ela substitui as duas funções que usavam a coluna errada e adiciona serialização do cálculo do bônus. Não altera a biblioteca. Não edite nem reaplique todas as migrações antigas manualmente sobre o banco existente.

Com o CLI Supabase instalado/configurado, na pasta do projeto:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJETO_DE_HOMOLOGACAO
npx supabase migration list --remote
npx supabase db push --dry-run --remote
```

Leia o plano. Se aparecerem migrações antigas que você acredita já aplicadas, pare e reconcilie o histórico; não prossiga assumindo que está correto. Este pacote não foi testado com um PostgreSQL remoto, e o arquivo enviado pode não refletir alterações feitas manualmente no Dashboard.

Após validar o histórico e a cópia de teste:

```powershell
npx supabase db push --remote
npx supabase functions deploy assistente-pmpe
npx supabase functions deploy material-gemini
npx supabase functions deploy redacao-gemini
```

Os módulos em `_shared` são dependências das funções. Mantenha-os junto do código. Confira as variáveis e secrets existentes no Supabase; não cole segredos no GitHub. Se usar URL de homologação, adicione-a explicitamente ao CORS nas funções utilizadas e às URLs autorizadas do Auth; parte do projeto ainda tem configuração duplicada por função. Não use `*` como substituto da configuração correta.

Teste os cenários da avaliação: gabarito ausente, IA indisponível, redação ilegível, gravação recusada, duas requisições de domínio simultâneas, login/logout, reconexão e biblioteca compartilhada com o comportamento anterior.

### Depois: front-end

O `wrangler.jsonc` publica a pasta `dist`. Confira a conta Cloudflare e o projeto antes de publicar:

```powershell
npx wrangler login
npx wrangler deploy
```

Esses comandos publicam no projeto configurado; não são apenas uma simulação. Só execute no ambiente desejado após os testes. A nova versão do cache é r172. Após publicar, feche/reabra o aplicativo e confirme o carregamento da atualização. Não há garantia de atualização simultânea de todas as abas já abertas.

### Aplicativos

- Android: o workflow da raiz compila `app/`, com applicationId `br.com.missaopmpe.app`. Há outro projeto em `android/`, com identificador diferente. Escolha conscientemente; não substitua o applicationId de um aplicativo já distribuído.
- Windows: os dois caminhos agora apontam para o domínio atual, mas ainda existem dois workflows. Use `desktop/` como referência para a consolidação futura e confira qual artefato você está distribuindo.
- O APK de debug e AAB sem assinatura gerados pelo workflow não equivalem a publicação pronta em loja. Build, assinatura e testes de instalação são etapas separadas.

## 6. Como voltar atrás

Guarde o release anterior e seu backup do banco. Se houver regressão no front, republique a versão anterior e use um novo identificador de cache para evitar clientes presos à revisão errada. Para banco, prepare migração corretiva revisada: reverter código não reverte SQL já aplicado. Nunca execute reset remoto como forma improvisada de rollback.

## 7. Atualizações futuras no GitHub

```powershell
npm test
git status
git add .
git commit -m "Descreva a alteracao realizada"
git push
```

Se trabalhar por branch, abra um Pull Request e confira os resultados da aba Actions antes de mesclar.

## Referências

- GitHub: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- Supabase: https://supabase.com/docs/guides/deployment/database-migrations
- CLI e alvos locais/remotos: https://supabase.com/docs/guides/local-development/cli-workflows
- Chaves públicas e secretas: https://supabase.com/docs/guides/getting-started/api-keys
