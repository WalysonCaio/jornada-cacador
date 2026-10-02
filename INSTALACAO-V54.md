# Jornada do Caçador — instalação da versão 56 revisada

## 1. Fazer uma cópia de segurança

Antes de substituir arquivos, copie a pasta atual:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para:

`C:\Users\Walyson Caio\Documents\jornada-cacador-backup`

## 2. Copiar os arquivos da versão 56

Extraia este ZIP. Abra a pasta `Jornada-do-Cacador-v56` e copie todo o conteúdo dela para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Quando o Windows perguntar, escolha **Substituir os arquivos no destino**.

Não copie a pasta externa inteira para dentro do repositório. Copie o conteúdo que está dentro dela.

## 3. Executar a migração no Supabase

1. Entre no Supabase.
2. Abra o projeto Jornada do Caçador.
3. Entre em **SQL Editor**.
4. Clique em **New query**.
5. Abra localmente o arquivo:

`supabase\migrations\20261002_library_essay_exam.sql`

6. Copie todo o conteúdo para o SQL Editor.
7. Clique em **Run**.

8. Repita o processo com o arquivo:

`supabase\migrations\20261002_v56_guardrails.sql`

Resultado esperado:

`Success. No rows returned`

## 4. Abrir o Prompt na pasta correta

Abra a pasta:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Clique na barra de endereço do Explorador, digite `cmd` e pressione Enter.

Confirme que o Prompt mostra:

`C:\Users\Walyson Caio\Documents\jornada-cacador>`

## 5. Validar os arquivos

Execute:

```bat
node scripts\validate-project.mjs
```

O resultado deve começar com `OK:`.

## 6. Publicar as funções do Supabase

Execute uma linha por vez:

```bat
supabase functions deploy material-gemini
supabase functions deploy redacao-gemini
supabase functions deploy account-security
supabase functions deploy edital-gemini
supabase functions deploy assistente-pmpe
supabase functions deploy system-diagnostics
```

## 7. Conferir alterações no Git

Execute:

```bat
git status
```

Depois adicione os arquivos:

```bat
git add dist/index.html dist/sw.js scripts/validate-project.mjs
git add supabase/functions/material-gemini
git add supabase/functions/redacao-gemini
git add supabase/functions/account-security
git add supabase/functions/edital-gemini
git add supabase/functions/assistente-pmpe
git add supabase/functions/system-diagnostics
git add supabase/migrations/20261002_library_essay_exam.sql
git add supabase/migrations/20261002_v56_guardrails.sql
git add INSTALACAO-V54.md
```

Confira novamente:

```bat
git status
```

Os arquivos que serão enviados devem aparecer em verde em **Changes to be committed**.

## 8. Enviar para o GitHub

```bat
git commit -m "Versao 56 estabilidade biblioteca edital e redacao"
git push origin main
```

## 9. Aguardar o Cloudflare

O Cloudflare deve iniciar a publicação automaticamente após o `git push`.

Abra o painel do Cloudflare e confirme que o último deployment terminou com **Success**.

## 10. Atualizar no celular

1. Feche completamente o site ou aplicativo.
2. Abra novamente `https://jornada.wcaio.workers.dev`.
3. Se ainda aparecer a versão anterior, limpe somente os dados/cache desse site.
4. Entre novamente na conta.
5. Abra **Menu → Sobre o projeto** e confirme a indicação **Versão 56**.

## 11. Testes rápidos

- Biblioteca mostra pastas por categoria.
- Material processado aparece na subpasta da disciplina.
- Portal mostra “Sem edital publicado”, “Sem data prevista” ou a contagem regressiva.
- Menu possui a opção **Redação**.
- Uma redação em PDF, JPG ou PNG pode ser enviada, corrigida e exportada.
- A busca da Biblioteca encontra arquivos por nome e disciplina.
- As pastas permanecem abertas durante a sincronização.
- Um segundo edital é bloqueado enquanto o atual existir.
- As notificações mostram a contagem regressiva da prova.
- Trilha funciona no celular e permite avançar para a próxima questão.
- Acertos e erros da Trilha e Batalha aparecem nos relatórios.
