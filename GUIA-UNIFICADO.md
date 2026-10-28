# Jornada do Caçador — Guia unificado

Última atualização documental: 21 de outubro de 2026  
Versão da aplicação: 78 — Caderno Inteligente

Este arquivo substitui os antigos tutoriais separados de instalação, correção e atualização. Os documentos anteriores são apenas histórico e não são necessários para o funcionamento da aplicação.

## 1. Visão geral

O Jornada do Caçador é uma plataforma pessoal de preparação para concursos públicos, especialmente carreiras de segurança pública. Um edital enviado pelo usuário é transformado em disciplinas, tópicos, missões, trilhas, revisões e acompanhamento de progresso.

Tecnologias principais:

- HTML, CSS e JavaScript puro na interface;
- PWA e Service Worker para instalação e funcionamento parcial offline;
- Supabase Auth, PostgreSQL e Storage;
- Supabase Edge Functions em TypeScript/Deno;
- Gemini para leitura e geração a partir de documentos;
- DeepSeek e Groq no assistente, conforme configuração do servidor;
- Cloudflare Workers para publicação da versão web;
- Electron para o instalador Windows;
- Android WebView para o aplicativo Android.

## 2. Pastas importantes

```text
dist/                  site e PWA publicados
supabase/functions/    funções executadas no servidor
supabase/migrations/   alterações do banco de dados
scripts/               validações locais
desktop/               instalador Windows
android/               projeto Android
.openai/                configuração auxiliar de hospedagem
```

Não apague `dist`, `supabase`, `scripts`, `desktop`, `android`, `.git`, `.gitignore`, `build.gradle`, `gradle`, `gradlew` ou `gradlew.bat`.

## 3. Programas recomendados

No Windows 10/11, instale:

1. Visual Studio Code;
2. Git for Windows;
3. Node.js LTS;
4. GitHub Desktop, opcional;
5. Android Studio, somente para gerar o APK;
6. Supabase CLI, somente para publicar Edge Functions e trabalhar com o banco.

O Bloco de Notas não é recomendado para manutenção do projeto.

## 4. Abrir o projeto

Pasta normalmente utilizada:

```text
C:\Users\Walyson Caio\Documents\jornada-cacador
```

No Explorador de Arquivos, abra essa pasta, clique na barra de endereço, digite `cmd` e pressione Enter.

Confirme:

```cmd
git status
```

## 5. Backup antes de atualizar

Antes de copiar uma atualização:

1. feche o Visual Studio Code e terminais que usam o projeto;
2. copie a pasta `jornada-cacador`;
3. renomeie a cópia para incluir a versão e a data;
4. mantenha esse backup até concluir os testes em produção.

Os PDFs, usuários e dados atuais do banco não ficam dentro desse backup. Eles permanecem no Supabase.

## 6. Instalar uma atualização recebida em ZIP

1. Extraia o ZIP.
2. Abra a pasta extraída e confirme que contém `dist`, `scripts` e `supabase`.
3. Copie todo o conteúdo extraído.
4. Cole sobre `C:\Users\Walyson Caio\Documents\jornada-cacador`.
5. Escolha **Substituir os arquivos no destino**.
6. Não apague a pasta `.git` do repositório local.
7. Execute as validações abaixo.

## 7. Validação obrigatória

Na raiz do projeto:

```cmd
node scripts\validate-project.mjs
node scripts\test-crud-contracts.mjs
git diff --check
git status
```

Os dois primeiros comandos devem começar com `OK:`. Se houver erro, não publique.

## 8. Testar localmente

Execute:

```cmd
npx serve dist
```

Abra o endereço informado. Login, recuperação de senha e CORS podem exigir o domínio publicado ou a inclusão temporária do endereço local nas configurações autorizadas.

Encerre o servidor com `Ctrl + C`.

## 9. Enviar uma atualização ao GitHub

Confira o repositório:

```cmd
git remote -v
git branch --show-current
```

O branch esperado é `main`. Depois:

```cmd
git add .
git status
git commit -m "Descreva resumidamente a atualizacao"
git push origin main
```

Antes do `git commit`, confira a lista em verde. Nunca envie `.env`, chaves privadas, certificados, arquivos de assinatura ou PDFs dos usuários.

## 10. Publicação no Cloudflare

O projeto oficial publica:

```text
https://jornada.wcaio.workers.dev
```

Quando o Cloudflare está conectado ao GitHub, o `git push origin main` inicia a publicação. Em **Workers & Pages > jornada > Deployments**, aguarde `Success`.

Depois, abra o site e pressione `Ctrl + Shift + R`. Se o Service Worker mantiver uma versão antiga:

1. pressione `F12`;
2. abra **Application > Service Workers**;
3. clique em **Unregister**;
4. abra **Storage**;
5. use **Clear site data**;
6. recarregue o endereço.

## 11. Quando publicar funções do Supabase

Não publique funções em atualizações apenas visuais. Publique somente quando arquivos dentro de `supabase/functions` tiverem sido alterados.

Na raiz do projeto:

```cmd
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy material-gemini
npx supabase functions deploy edital-gemini
npx supabase functions deploy assistente-pmpe
npx supabase functions deploy redacao-gemini
npx supabase functions deploy account-security
npx supabase functions deploy ai-key-manager
npx supabase functions deploy system-diagnostics
```

Publique somente as funções realmente modificadas. Uma atualização de `dist` não exige esses comandos.

## 12. Quando executar SQL

Execute SQL somente quando a atualização indicar expressamente uma nova migração.

1. Abra o projeto correto no Supabase.
2. Entre em **SQL Editor > New query**.
3. Abra o arquivo novo dentro de `supabase/migrations`.
4. Cole o conteúdo completo.
5. Revise o projeto selecionado.
6. Clique em **Run** uma única vez.

Não execute novamente todas as migrações antigas sem necessidade.

## 13. Secrets do Supabase

As chaves secretas devem ficar em **Edge Functions > Secrets**, nunca no frontend ou GitHub. Entre elas podem existir:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GROQ_API_KEY
DEEPSEEK_API_KEY
```

A chave pública/publishable do Supabase pode aparecer no frontend; a `service_role` nunca pode.

## 14. Manutenção da interface

Arquivos principais:

```text
dist/index.html
dist/ui-v75.css
dist/ui-v77.css
dist/ui-v78.css
dist/v59-enhancements.js
dist/v77-experience.js
dist/v78-smart-notebook.js
dist/sw.js
```

Ao criar ou alterar um arquivo público:

1. inclua-o em `dist/index.html` quando aplicável;
2. adicione-o à lista `ASSETS` de `dist/sw.js`;
3. altere o nome da constante `CACHE` em `dist/sw.js`;
4. execute os validadores;
5. teste em computador e celular.

## 15. Instalar como PWA

### Computador

Abra o site no Chrome ou Edge e use **Instalar Jornada do Caçador** na barra de endereço ou no menu do navegador.

### iPad

Abra no Safari e selecione **Compartilhar > Adicionar à Tela de Início**.

### Android

Abra no Chrome e selecione **Adicionar à tela inicial**. A PWA normalmente recebe atualizações com mais facilidade do que um APK separado.

## 16. Gerar o instalador Windows

```cmd
cd desktop
npm install
npm run build:windows
```

O resultado fica em `desktop\release`. O instalador apenas abre o domínio oficial e utiliza os mesmos dados da versão web.

## 17. Gerar o APK Android

Abra a pasta Android no Android Studio e confirme que a URL aponta para:

```text
https://jornada.wcaio.workers.dev/
```

Use **Build > Generate Signed Bundle / APK > APK**. Guarde o arquivo `.jks`, o alias e as senhas em local privado. Para atualizar um APK instalado, use sempre a mesma assinatura e um `versionCode` maior.

## 18. Backup dos dados

O GitHub protege o código, mas não substitui o backup do Supabase. Faça cópias separadas de:

- banco PostgreSQL;
- bucket `study-documents`;
- configurações de autenticação;
- nomes dos Secrets;
- chave de assinatura Android;
- configurações do Cloudflare.

Dentro do aplicativo, use **Menu > Diagnóstico e backup** para exportar o estado permitido do usuário.

## 19. Diagnóstico rápido

### Site não atualiza

- confirme o último commit no GitHub;
- confirme `Success` no Cloudflare;
- limpe o Service Worker;
- teste em janela anônima.

### `Failed to fetch`

- confirme a internet;
- confira se a Edge Function está publicada;
- confira CORS e domínio autorizado;
- abra os logs da função no Supabase.

### Erro 429

A cota do provedor foi atingida. Aguarde a renovação ou utilize outra chave/provedor configurado. Tentativas que falham antes da conclusão não devem consumir a cota interna de análises concluídas.

### PDF não é analisado

- confirme se é PDF textual;
- PDFs escaneados dependem de OCR/visão e consomem mais recursos;
- confira tamanho, status e logs de `material-gemini`;
- não envie novamente o mesmo arquivo enquanto estiver `processing`.

### Dados diferentes entre aparelhos

- use a mesma conta;
- clique em sincronizar;
- confirme internet e sessão válida;
- evite manter uma versão antiga da PWA em cache.

## 20. Segurança

- nunca publique chaves secretas;
- mantenha exclusões protegidas por senha;
- não desative RLS do Supabase;
- não coloque `service_role` em `dist`;
- use dependências oficiais e atualizadas;
- faça backup antes de migrations;
- teste redefinição de perfil e exclusões em uma conta de teste;
- mantenha o repositório privado se não quiser expor o código-fonte.

## 21. Autoria e uso

Projeto idealizado por **Walyson Caio**. É independente e não possui vínculo oficial com órgãos públicos, bancas ou cursos preparatórios.

Leis, editais, respostas de IA, gabaritos e datas devem ser conferidos nas fontes oficiais. A IA é uma ferramenta de apoio e não substitui a validação humana.

