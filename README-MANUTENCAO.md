# Jornada do Caçador — backup e manutenção

## Visão geral

A Jornada do Caçador é uma aplicação web progressiva (PWA). A interface foi escrita em HTML, CSS e JavaScript puro. Não utiliza React, Vue, Angular ou outro framework de interface nesta versão.

O sistema usa:

- HTML5 para a estrutura das telas;
- CSS3 para aparência e responsividade;
- JavaScript moderno para missões, progresso, trilha, cronômetro e interface;
- Supabase para login, banco PostgreSQL, armazenamento de PDFs e sincronização;
- Supabase Edge Functions em TypeScript/Deno para operações seguras e integração com IA;
- Gemini para análise dos PDFs e Groq como assistente/provedor adicional;
- Service Worker e manifesto PWA para instalação pelo navegador e funcionamento parcial offline;
- Electron apenas para empacotar a versão Windows.

## Estrutura do projeto

```text
dist/                       versão web publicada
  index.html                interface e lógica principal
  content-summaries.js      conteúdos incorporados
  material-deep-dives.js    conteúdos detalhados
  manifest.webmanifest      configuração da PWA
  sw.js                     cache e funcionamento offline
  icon-*.png / icon.svg     ícones
desktop/                    projeto do instalador Windows
supabase/functions/         funções seguras executadas no servidor
supabase/migrations/        estrutura e atualizações do banco de dados
.github/workflows/          automação para gerar o instalador .exe
```

## Programas recomendados no Windows 10

1. Google Chrome ou Microsoft Edge, para testar a versão web.
2. Visual Studio Code, para editar o código com destaque de erros e extensões.
3. Git for Windows, para versionamento e uso do GitHub.
4. Node.js LTS, para testar e gerar o aplicativo desktop.
5. GitHub Desktop, opcional, para usar GitHub sem depender tanto de comandos.
6. Supabase CLI, opcional e recomendado somente quando for manter funções e banco localmente.

O Bloco de Notas funciona para alterações pequenas, mas não é recomendado. Ele não verifica JavaScript, não organiza o projeto e aumenta o risco de apagar aspas ou chaves. Use o Visual Studio Code.

## Instalação das ferramentas

### Visual Studio Code

1. Acesse `https://code.visualstudio.com/`.
2. Baixe a versão para Windows.
3. Execute o instalador e marque “Add to PATH” e “Open with Code”.

### Git e GitHub

1. Crie uma conta em `https://github.com/`.
2. Instale o Git em `https://git-scm.com/download/win`.
3. Durante a instalação, mantenha as opções recomendadas.
4. Instale o GitHub Desktop em `https://desktop.github.com/`.
5. Entre com sua conta do GitHub Desktop.
6. Escolha **File > Clone repository** para baixar o repositório ou **Add local repository** para adicionar esta pasta.
7. Use **Commit to main** para registrar alterações e **Push origin** para enviar ao GitHub.

### Node.js

1. Acesse `https://nodejs.org/`.
2. Baixe a versão LTS.
3. Instale com as opções padrão.
4. Abra o PowerShell e verifique: `node --version` e `npm --version`.

## Testar o site no computador

No terminal do Visual Studio Code, dentro do projeto, execute:

```powershell
npx serve dist
```

Abra o endereço exibido no terminal. Algumas funções de autenticação dependem dos endereços autorizados no Supabase; para testes completos, use o domínio publicado ou adicione o endereço de teste às URLs permitidas.

## Gerar o instalador Windows manualmente

No PowerShell:

```powershell
cd desktop
npm install
npm run build:windows
```

O instalador será criado em `desktop\release`. O Windows poderá mostrar um aviso de “editor desconhecido” porque o instalador não possui certificado pago de assinatura de código. Isso não significa que o arquivo esteja infectado; para distribuição pública, adquira um certificado de assinatura.

## Gerar o instalador pelo GitHub

1. Envie todos os arquivos ao repositório.
2. Abra o repositório no GitHub.
3. Entre em **Actions**.
4. Abra **Gerar instalador do Windows**.
5. Clique em **Run workflow**.
6. Ao terminar, baixe o arquivo na seção **Artifacts**.

## Usar no iPad

Abra `https://jornada-cacador.j32341472.chatgpt.site` no Safari. O layout é responsivo e se adapta ao iPad. Para instalar como aplicativo, toque em **Compartilhar > Adicionar à Tela de Início**. Entre com a mesma conta usada no computador para carregar o mesmo progresso.

## Publicar em outro domínio

É possível publicar o conteúdo da pasta `dist` em Cloudflare Pages, Netlify, Vercel ou GitHub Pages e apontar um domínio próprio. Para login e redefinição de senha funcionarem, atualize no Supabase:

- Authentication > URL Configuration > Site URL;
- Redirect URLs;
- origens CORS das Edge Functions;
- a constante `APP_URL` em `dist/index.html`;
- a constante `SITE` das funções que restringem a origem.

Após alterar o domínio, gere e publique uma nova versão. Não mantenha `localhost` como endereço de recuperação em produção.

## O que este backup contém

- código da interface;
- ícones e configuração PWA;
- funções do Supabase;
- migrações SQL disponíveis;
- projeto e automação do instalador Windows;
- documentação de manutenção.

## O que precisa de backup separado

Este pacote não contém senhas, chaves secretas, registros atuais do banco nem PDFs privados dos usuários. No Supabase, faça separadamente:

1. exportação/backup do banco PostgreSQL;
2. cópia do bucket `study-documents`;
3. registro seguro dos nomes dos Secrets das Edge Functions;
4. cópia das configurações de autenticação e URLs permitidas.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` ou `GROQ_API_KEY` no GitHub ou dentro da pasta `dist`.

## Fluxo seguro de manutenção

1. Crie uma branch no GitHub.
2. Faça a alteração no Visual Studio Code.
3. Teste em navegador.
4. Confirme que nenhuma chave secreta foi adicionada.
5. Faça commit e push.
6. Publique primeiro uma versão de teste.
7. Depois publique em produção.

## Versão 46 — confiabilidade e segurança

Esta versão adiciona:

- painel **Menu > Diagnóstico e backup**;
- exportação e restauração do progresso em JSON;
- limite diário de 5 análises de PDF e 40 perguntas ao assistente por usuário;
- proteção contra duas análises simultâneas;
- cache SHA-256 para PDFs repetidos;
- fila de reprocessamento enquanto o aplicativo estiver aberto;
- consumo diário das IAs no painel;
- Gemini como principal e Groq como reserva no assistente;
- mensagem específica para cota do provedor esgotada (erro 429);
- sessão de foco única por usuário, impedindo cronômetros simultâneos em aparelhos diferentes;
- categoria Prova oficial e Simulado em PDF;
- segunda etapa de revisão por IA para questões geradas;
- validação automática de JavaScript, IDs HTML e exposição acidental de secrets.

### Publicação obrigatória da versão 46

1. No Supabase, abra **SQL Editor > New query**.
2. Cole e execute `supabase/migrations/20261001_reliability_security.sql`.
3. No terminal aberto na raiz do projeto, publique as funções:

```powershell
supabase functions deploy material-gemini
supabase functions deploy edital-gemini
supabase functions deploy assistente-pmpe
supabase functions deploy account-security
supabase functions deploy system-diagnostics
```

4. Envie `dist/index.html` e `dist/sw.js` ao GitHub para o Cloudflare publicar.
5. Abra o site e pressione `Ctrl + F5`.
6. Entre em **Menu > Diagnóstico e backup > Verificar agora**.

### Validação local

Execute na raiz do projeto:

```powershell
node scripts/validate-project.mjs
```

O resultado esperado começa com `OK:`. Esse teste não substitui o teste autenticado no ambiente de produção, mas detecta erros de sintaxe, IDs duplicados, referências ausentes, versão incorreta do cache e secrets colocados por engano nos arquivos públicos.

## Versão 48 — currículo e foco multiaparelho

Esta versão acrescenta:

- retomada do cronômetro pausado em outro aparelho;
- recuperação automática de sessão de foco abandonada após 90 segundos sem heartbeat;
- confirmação para transferir uma sessão realmente ativa;
- ordem pedagógica gerada a partir do edital, com fundamentos, pré-requisitos e dificuldade;
- desbloqueio sequencial dos tópicos dentro de cada disciplina;
- rotação diária determinística entre disciplinas, sem escolha aleatória;
- caderno de erros conectado às revisões e classificado por urgência;
- página **Sobre o projeto**, com propósito e autoria.

### Publicação obrigatória da versão 48

1. No Supabase, abra **SQL Editor > New query**.
2. Cole todo o conteúdo de `supabase/migrations/20261002_pedagogical_focus_sync.sql` e clique em **Run**.
3. No terminal aberto na raiz do projeto, publique a função que analisa o edital:

```powershell
supabase functions deploy edital-gemini
```

4. Envie ao GitHub pelo menos `dist/index.html`, `dist/sw.js`, `README.md`, a função e a nova migração.
5. Aguarde o Cloudflare concluir a publicação e abra o site com `Ctrl + F5`.
6. Reanalise o edital uma vez para que os tópicos antigos recebam a nova ordem pedagógica.

O progresso é reconciliado pelo nome da disciplina e do tópico. Assim, a reanálise preserva as conclusões correspondentes, mas tópicos renomeados ou removidos pelo novo edital não são considerados equivalentes automaticamente.

## Versão 49 — ofensiva qualificada e estudo externo

- Um dia só entra na ofensiva quando possui **50 minutos estudados e pelo menos uma missão concluída**.
- O tempo pode vir do cronômetro, de registros externos ou da soma dos dois.
- O botão **Registrar estudo fora do aplicativo**, abaixo do cronômetro, aceita data, minutos e descrição opcional.
- Registros externos entram automaticamente nas metas diária e semanal.
- Cada registro pode ser excluído; ao excluir, o tempo é descontado e a ofensiva é recalculada.
- Os registros fazem parte do estado sincronizado da conta e aparecem nos demais aparelhos.
- Redefinir o portal ou apagar todo o progresso também remove os registros externos e recalcula a ofensiva.

Esta versão altera somente os arquivos públicos. Depois de enviar `dist/index.html` e `dist/sw.js` ao GitHub, aguarde o Cloudflare e use `Ctrl + F5`. Não há uma nova migração SQL nem Edge Function específica para a versão 49.

## Versão 50 — correção da ofensiva sincronizada

- A conclusão marcada pelo **Histórico diário** agora vale para a data da missão, e não para o instante em que o usuário marcou a caixa.
- A validação considera tanto o progresso da missão quanto o registro do Histórico diário.
- Registrar ou excluir estudo externo recalcula a ofensiva antes de salvar.
- Conclusões e tempo externo solicitam sincronização imediata com o Supabase, mantendo a sincronização agendada como segurança.
- Dados já inseridos na versão 49 são reaproveitados; ao carregar a versão 50, os 90 minutos e a missão já registrados são recalculados automaticamente.

## Versão 51 — mesclagem de conflitos entre aparelhos

- Um conflito de revisão não substitui mais imediatamente os dados locais.
- Missões concluídas, Histórico diário, tempo estudado e registros externos são mesclados com o estado do servidor.
- Depois da mesclagem, o aplicativo tenta publicar novamente usando a revisão mais recente.
- Redefinições deliberadas continuam tendo prioridade e não são desfeitas por aparelhos antigos.
- O total diário é reparado a partir dos registros externos existentes antes do cálculo da ofensiva.

## Correção SQL v52 — cronômetro

Se o cronômetro mostrar `column reference "remaining_seconds" is ambiguous`, execute no **Supabase > SQL Editor** todo o arquivo:

`supabase/migrations/20261002_fix_focus_remaining_seconds.sql`

O erro ocorre porque `remaining_seconds` é simultaneamente o nome da coluna e do campo retornado pela função PostgreSQL. A correção usa o alias explícito `fs.remaining_seconds`. Não é necessário publicar Edge Function nem alterar Secrets.
