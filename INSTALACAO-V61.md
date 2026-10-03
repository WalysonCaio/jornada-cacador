# Jornada do Caçador — versão 61

## Correção do cronômetro

A sincronização automática executada a cada 30 segundos redefinia o tempo restante para um bloco completo. Por isso o relógio descia até aproximadamente 49:30 e voltava para 50:00.

Nesta versão, uma sincronização de progresso não modifica um cronômetro em execução. Quando o cronômetro estiver pausado, o aplicativo restaura o tempo salvo no aparelho e pode retomá-lo em outro dispositivo por meio da sessão de foco do Supabase.

## 1. Faça um backup

Copie a pasta:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para uma pasta como:

`C:\Users\Walyson Caio\Documents\jornada-cacador-backup-v60`

## 2. Substitua os arquivos

1. Extraia o ZIP da versão 61.
2. Abra a pasta extraída.
3. Selecione todos os arquivos e pastas de dentro dela.
4. Copie para `C:\Users\Walyson Caio\Documents\jornada-cacador`.
5. Confirme **Substituir os arquivos no destino**.

## 3. Abra o Prompt na pasta

No Explorador de Arquivos, abra a pasta do projeto, clique na barra de endereço, digite `cmd` e pressione Enter.

Ou abra o Prompt e execute:

```bat
cd /d "C:\Users\Walyson Caio\Documents\jornada-cacador"
```

## 4. Valide os arquivos

```bat
node --check dist\v59-enhancements.js
node scripts\validate-project.mjs
git diff --check
```

O segundo comando deve mostrar uma mensagem iniciada por `OK:`. O terceiro não deve mostrar nenhum erro.

## 5. Supabase CLI usando npx

Se você não instalou o Supabase CLI globalmente, use `npx supabase`. Não precisa instalar globalmente.

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
```

Para instalar a correção de banco da versão anterior, abra o **SQL Editor do Supabase** e execute todo o arquivo:

`supabase\migrations\20261003_v60_fair_ai_quota.sql`

A versão 61 não acrescenta outra migração SQL. A correção do cronômetro está no site.

Caso ainda não tenha executado a correção de `remaining_seconds`, execute também no SQL Editor:

`supabase\migrations\20261002_fix_focus_remaining_seconds.sql`

## 6. Publicação das Edge Functions

O cronômetro não exige Edge Function. Entretanto, para publicar as correções completas de leitura de arquivos da versão 60, use:

```bat
npx supabase functions deploy material-gemini
npx supabase functions deploy edital-gemini
npx supabase functions deploy redacao-gemini
npx supabase functions deploy system-diagnostics
```

## 7. Envie para o GitHub

```bat
git add .
git status
git commit -m "Versao 61 corrige cronometro de foco"
git push origin main
```

O `git add .` normalmente não mostra mensagem. Isso é normal. Confira os arquivos verdes com `git status`.

## 8. Aguarde o Cloudflare

1. Abra o painel do Cloudflare.
2. Aguarde o novo deploy terminar com **Success**.
3. Abra `https://jornada.wcaio.workers.dev`.
4. Pressione `Ctrl + F5` duas vezes.
5. Em **Menu → Sobre o projeto**, confirme **Versão 61**.

## 9. Teste obrigatório do cronômetro

1. Clique em **Iniciar foco**.
2. Aguarde pelo menos 90 segundos.
3. Confirme que ele passa por 49:30 e continua para 49:29, 49:28 etc.
4. Pause em um tempo qualquer, por exemplo 48:20.
5. Atualize a página e confirme que continua perto de 48:20, sem voltar para 50:00.
6. Pause no celular, abra no computador e clique em **Continuar foco**.
7. Confirme que o tempo restante foi retomado.

Não teste dois cronômetros rodando simultaneamente; a aplicação permite apenas uma sessão ativa por conta.
