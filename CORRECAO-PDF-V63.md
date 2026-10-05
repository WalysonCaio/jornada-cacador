# Jornada do Caçador v63 — correção da análise de PDFs

## Destinos corretos

Antes de publicar, confira esta tabela. Se qualquer dado estiver diferente, pare e não execute o próximo comando.

| Serviço | Destino correto da Jornada do Caçador |
| --- | --- |
| Pasta local | `C:\Users\Walyson Caio\Documents\jornada-cacador` |
| Repositório GitHub | repositório cujo nome termina em `jornada-cacador` |
| Branch | `main` |
| Supabase project-ref | `jybislbbblyjsrcdegjt` |
| Supabase URL | `https://jybislbbblyjsrcdegjt.supabase.co` |
| Cloudflare Worker | o que publica `https://jornada.wcaio.workers.dev` |
| Versão esperada | `63` |

## O erro corrigido

A função tentava primeiro modelos com identificadores incompatíveis. Um retorno 400/404 encerrava a geração principal e impedia a tentativa do modelo estável. Além disso, após o upload, o PDF podia ainda estar no estado `PROCESSING` do Gemini quando a análise era iniciada.

A versão 63:

- usa `gemini-2.5-flash` e `gemini-2.5-flash-lite`;
- tenta o modelo seguinte quando um modelo não está disponível;
- aguarda o PDF ficar `ACTIVE` antes de analisá-lo;
- não consome cota em falha;
- devolve trabalhos temporariamente bloqueados para `pending`;
- informa claramente secret, migração, Storage ou provedor ausente;
- mostra no diagnóstico o project-ref realmente conectado.

## Passo 1 — backup

Copie a pasta atual para, por exemplo:

`C:\Users\Walyson Caio\Documents\backup-jornada-antes-v63`

Não apague a pasta original nem a pasta oculta `.git`.

## Passo 2 — copiar a versão 63

Extraia o ZIP. Entre na pasta `sitework` extraída e copie todo o conteúdo para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Escolha **Substituir os arquivos no destino**. Não copie a pasta `sitework` inteira como uma subpasta e não apague `.git`.

## Passo 3 — abrir o Prompt no projeto correto

No Explorador, abra `C:\Users\Walyson Caio\Documents\jornada-cacador`, clique na barra de endereço, digite `cmd` e pressione Enter.

Execute:

```bat
cd
git rev-parse --show-toplevel
git branch --show-current
git remote get-url origin
```

Confira:

- os dois caminhos terminam em `\jornada-cacador`;
- a branch é `main`;
- a URL remota termina em `/jornada-cacador.git` ou contém claramente o repositório `jornada-cacador`.

Se aparecer outro aplicativo, feche o Prompt e volte ao passo 3 na pasta correta.

## Passo 4 — validar os arquivos

```bat
node --check dist\v59-enhancements.js
node --check dist\sw.js
node --check desktop\main.js
node scripts\validate-project.mjs
```

O último comando deve começar com `OK:`. Se der erro, não publique.

## Passo 5 — confirmar o Supabase correto

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
type supabase\.temp\project-ref
```

O último comando deve mostrar exatamente:

```text
jybislbbblyjsrcdegjt
```

Confira os secrets diretamente nesse projeto:

```bat
npx supabase secrets list --project-ref jybislbbblyjsrcdegjt
```

A lista precisa conter `GEMINI_API_KEY`. `GROQ_API_KEY` é recomendada como reserva do assistente.

## Passo 6 — conferir a migração da cota

No painel do Supabase, selecione o projeto cuja referência é `jybislbbblyjsrcdegjt`. Abra **SQL Editor**, cole e execute:

```sql
select
  to_regprocedure('public.reserve_ai_usage(uuid,uuid,text,integer)') as controle_de_ia,
  to_regclass('public.ai_usage_events') as eventos_de_ia,
  to_regclass('public.processing_jobs') as fila_de_processamento;
```

As três colunas devem retornar nomes, e não `null`.

Se `controle_de_ia` estiver `null`, execute nesse mesmo projeto o arquivo:

`supabase\migrations\20261003_v60_fair_ai_quota.sql`

Se alguma tabela estiver `null`, interrompa e confira se as migrações anteriores foram executadas nesse projeto antes de continuar.

## Passo 7 — publicar somente as quatro funções alteradas

O `--project-ref` explícito evita publicar no segundo aplicativo:

```bat
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy edital-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy assistente-pmpe --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy system-diagnostics --project-ref jybislbbblyjsrcdegjt
npx supabase functions list --project-ref jybislbbblyjsrcdegjt
```

Confira na lista se `material-gemini`, `edital-gemini`, `assistente-pmpe` e `system-diagnostics` aparecem atualizadas.

## Passo 8 — conferir novamente o GitHub antes do envio

```bat
git remote get-url origin
git branch --show-current
git status
```

Só prossiga se o remoto for `jornada-cacador` e a branch for `main`.

Depois:

```bat
git add -A
git status
git commit -m "Corrige analise de PDFs v63"
git push origin main
git rev-parse --short HEAD
```

Guarde o código curto mostrado pelo último comando.

## Passo 9 — confirmar a Cloudflare correta

1. Abra o painel da Cloudflare.
2. Entre em **Workers & Pages**.
3. Abra somente o aplicativo cuja URL de produção é `https://jornada.wcaio.workers.dev`.
4. Confira em **Settings > Builds** se o repositório conectado é `jornada-cacador` e a branch é `main`.
5. Em **Deployments**, aguarde a publicação do commit enviado no passo 8.
6. Compare o código do commit exibido na Cloudflare com `git rev-parse --short HEAD`.

Não publique manualmente no segundo aplicativo.

## Passo 10 — remover cache antigo e verificar

Abra `https://jornada.wcaio.workers.dev`.

No computador, pressione `Ctrl + F5`. Se ainda mostrar a versão antiga:

1. pressione `F12`;
2. abra **Application**;
3. entre em **Service Workers**;
4. clique em **Unregister**;
5. em **Storage**, clique em **Clear site data**;
6. feche e abra a página novamente.

No aplicativo, abra **Menu > Diagnóstico e backup > Verificar agora**. Confirme:

- versão 63;
- projeto Supabase `jybislbbblyjsrcdegjt`;
- Gemini configurado;
- banco conectado.

## Passo 11 — teste controlado

Primeiro envie um PDF digital pequeno, com texto selecionável, na categoria **Material de estudo**.

Resultado esperado:

1. `Aguardando análise`;
2. `Gemini analisando`;
3. `Conteúdo sincronizado`;
4. resumos, flashcards e trilha na mesma disciplina.

Depois teste um PDF maior. Uma falha não deve reduzir o número de análises concluídas no diagnóstico.

## Se ainda falhar

No painel do Supabase correto:

1. abra **Edge Functions**;
2. abra `material-gemini`;
3. abra **Logs**;
4. faça uma nova tentativa com o PDF pequeno;
5. copie o evento completo que aparecer no mesmo horário.

As mensagens da v63 distinguem: `MISSING_CONFIGURATION`, `USAGE_GUARD_MISSING`, `STORAGE_READ_FAILED`, `PROVIDER_RATE_LIMIT`, `PROVIDER_UNAVAILABLE`, `FILE_TOO_LARGE` e `PROCESSING_FAILED`.
