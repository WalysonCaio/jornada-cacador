# r185 — Caderno IA isolado por conta e portal

21/11/2026. Desenvolvida sobre a r184 `0d32dea6af5612a3ffb4b524c710820a3d0e1193`. O pacote completo de alterações também incorpora r182/r183/r184 desde o main r181 examinado (`52b236036f5207117918aeb84ddd1df89eacdd1d`).

[Validação e limites](VALIDACAO.txt) · [Arquivos e remoções](MANIFESTO.json).

## O que mudou

- Cache do Caderno IA separado por conta, portal local, ID do portal no servidor e geração da redefinição. O armazenamento antigo, sem dono comprovável, não é migrado para nenhuma conta.
- Snapshot de conta, portal, fontes, conteúdo e requisição antes de consultar IA. Resposta de contexto antigo não grava dados, não muda rótulos e não desbloqueia uma operação nova.
- Troca de contexto cancela a operação local e libera os controles novos; a pergunta privada digitada é limpa ao trocar de conta/portal/reset.
- Fontes privadas de outra conta/portal são excluídas durante a hidratação. Fontes explicitamente compartilhadas continuam permitidas conforme a política existente.
- Resultado em cache precisa coincidir com o conteúdo atual das fontes, mesmo quando a data do PDF não mudou. Cobertura fica vazia durante troca de conta e o quiz usa somente questões das fontes marcadas.
- Falha/quota do armazenamento não vira confirmação falsa de salvamento. Cache corrompido ou excessivo é ignorado e o número/tamanho das entradas é limitado.
- PDF e worker saíram do precache e passam a ser cacheados no primeiro uso. JPGs ainda usados pelas telas foram mantidos. O cache do aplicativo é r185.
- Removidas três saídas acidentais rastreadas do Git; adicionados padrões de arquivos temporários ao `.gitignore`.

A biblioteca compartilhada e os Manuais como ajuda foram preservados. A r185 não altera gabaritos ou documentos existentes no Supabase.

## Caminho mais simples pelo GitHub

O **PR #4** foi atualizado para incluir a r185. Sua branch de origem continua chamada **`entrega/revisao-r184`** por ser a proposta já existente. Também existe a referência **`entrega/revisao-r185`** para baixar esta versão. A branch pessoal `melhorias-r184` é outra referência e não recebe alterações automaticamente.

1. Abra https://github.com/WalysonCaio/jornada-cacador/pull/4 .
2. Confira Files changed e as verificações. Faça a homologação no seu ambiente conforme o relatório.
3. Quando concluir, clique Ready for review e depois Merge pull request.
4. Publique `dist` completa pelo fluxo Cloudflare existente. O GitHub não executa migrações ou publica funções do Supabase automaticamente.

Se já aplicou os pré-requisitos da r184, a r185 não acrescenta migração nem alteração de Edge Function. Se está saindo da r181, siga primeiro [a aplicação da r184](../revisao-r184/LEIA-ME.md), incluindo v110 e `material-gemini` atualizada. As leis continuam dependendo de v109 e `leis-oficiais`, conforme os guias anteriores.

## Aplicação pelo ZIP

Baixe `entregas/r185/jornada-cacador-r185-alteracoes.zip`. Extraia na raiz do projeto, preservando `.git` e conferindo alterações locais. É uma atualização do código, não um backup para importar no aplicativo. O pacote inclui as revisões anteriores necessárias; não é preciso extrair todos os ZIPs históricos.

O ZIP substitui/adiciona arquivos, mas não apaga os três arquivos-lixo antigos. Para removê-los após extrair, execute este comando sozinho no CMD:

```cmd
node scripts\cleanup-repository-artifacts.mjs
```

O helper atua só nas três saídas identificadas e confere o conteúdo por SHA-256, tolerando apenas diferenças de fim de linha. Arquivo com conteúdo diferente e links são preservados. Ele não apaga `-r182`, arquivos `.swp` pessoais ou outros arquivos não rastreados. Se integrar o PR pelo Git, as exclusões rastreadas já fazem parte da alteração.

Antes de enviar sua cópia local, confira a versão:

```cmd
findstr /C:"r185" dist\sw.js
```

Confira a branch e as alterações:

```cmd
git status
```

Se usar sua branch `melhorias-r184`, selecione os arquivos revisados e as exclusões. Execute cada comando em seu próprio bloco, pressionando Enter antes do próximo. Evite `git add .` numa pasta com arquivos acidentais ou dados pessoais.

```cmd
git add .gitignore README.md GUIA-UNIFICADO.md dist scripts package.json package-lock.json docs
```

Se aplicou pelo ZIP, selecione somente as três exclusões conhecidas, sem incluir seus instaladores ou outras modificações locais:

```cmd
node scripts\cleanup-repository-artifacts.mjs --stage
```

Esse modo também confere a versão rastreada no índice do Git e seleciona somente as exclusões reconhecidas. Depois confira a seleção:

```cmd
git diff --cached --stat
```

```cmd
git commit -m "fix(r185): isola Caderno IA e protege cache e operacoes"
```

```cmd
git push -u origin melhorias-r184
```

Se não houver diferença para o último commit, não há novo commit a criar. Enviar essa branch não integra o main. O PR #4 pronto continua sendo o caminho de entrega; não precisa abrir uma proposta duplicada com os mesmos arquivos.

## Valide e publique

Requer Node.js 24 ou superior. Execute separadamente:

```bash
npm ci --ignore-scripts
```

```bash
npm test
```

```bash
npm run test:sql
```

A validação SQL é local. Pela CLI Cloudflare já autenticada, na raiz:

```bash
npx wrangler deploy
```

Publique `dist` inteira. Feche e reabra as abas e o aplicativo instalado: atualizar o service worker não reescreve o JavaScript de uma página que já estava aberta.

**PDF offline:** depois de atualizar para r185, faça o primeiro uso do leitor/reanálise com internet para baixar o motor e o worker desta versão. Depois, eles ficam disponíveis no cache. A primeira abertura offline, sem esse uso prévio, informa indisponibilidade; não retorna HTML no lugar de um módulo JS.

## Homologação no navegador e celular

A suíte de navegador foi preparada para desktop e 360/390/412 px. Ela não substitui a conferência de todas as telas nem usa contas reais. A execução não foi possível nesta sessão, conforme o relatório. No seu computador ou workflow manual existente, use:

```bash
npx playwright install chromium
```

```bash
npm run test:browser
```

No celular, confira claro/escuro, cabeçalho, leitor de leis e a revisão de PDFs. No Caderno IA, teste: gerar em A e trocar para B antes de concluir; logout/login com mesmo nome de portal; reset; mudar a fonte e o conteúdo; tentar uma consulta nova enquanto a anterior ainda responde. Nenhum resultado de A deve aparecer em B e os controles novos devem funcionar.

Não houve deploy ou SQL remoto durante esta entrega. A execução real nas suas contas e dispositivos permanece uma etapa de aplicação/homologação, sem promessa de validação factual de todas as questões.
