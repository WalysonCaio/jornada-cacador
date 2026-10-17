# Versão 72 — redefinição completa e verificada

Esta versão corrige definitivamente o edital e os conteúdos que permaneciam após redefinir o perfil.

## Importante

São necessárias **três publicações**: SQL no Supabase, Edge Functions no Supabase e arquivos web no GitHub/Cloudflare. Se qualquer uma for ignorada, a correção não funcionará.

## 1. Execute o SQL

No Supabase, abra **SQL Editor → New query**. Abra o arquivo:

`supabase/migrations/20261017_v72_reset_profile_complete.sql`

Copie todo o conteúdo, cole no SQL Editor e clique em **Run**. O resultado correto é:

`Success. No rows returned`

## 2. Publique as funções

Abra o Prompt de Comando na pasta local `jornada-cacador` e execute uma linha por vez:

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security
npx supabase functions deploy edital-gemini
```

## 3. Publique a interface

```bat
git add -A
git status
git commit -m "Versao 72 redefine perfil e remove todo o conteudo"
git push origin main
```

Aguarde o Cloudflare terminar a nova implantação.

## 4. Atualize o cache

Abra `https://jornada.wcaio.workers.dev`, pressione `Ctrl + F5`, feche e abra novamente a versão instalada.

## 5. Faça o teste

1. Entre em **Perfil**.
2. Clique em **Redefinir perfil e apagar conteúdos**.
3. Digite a senha atual.
4. Aguarde a mensagem de confirmação e a recarga.
5. Confira Biblioteca, Portais, Estudar, Redações, histórico e cronômetro.

O servidor agora verifica se `study_campaigns`, `study_documents`, `essay_submissions`, `user_state` e `focus_sessions` ficaram vazios. Se ainda existir algum registro, a tela mostrará erro em vez de informar sucesso falso.

A chave Gemini pessoal e a conta são preservadas.

