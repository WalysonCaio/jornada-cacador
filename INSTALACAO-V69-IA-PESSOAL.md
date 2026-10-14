# Jornada do Caçador v69 — IA pessoal (BYOK)

## Ordem obrigatória

1. Faça uma cópia de segurança da pasta local do projeto.
2. Copie os arquivos deste pacote sobre `C:\Users\Walyson Caio\Documents\jornada-cacador`.
3. No Supabase, abra **SQL Editor**, cole todo o arquivo `supabase/migrations/20261014_v69_user_ai_keys.sql` e clique em **Run**.
4. O resultado correto é `Success. No rows returned`.
5. Abra o Prompt de Comando dentro da pasta do projeto.
6. Publique as funções, uma por vez:

```cmd
npx supabase functions deploy ai-key-manager --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy edital-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy redacao-gemini --project-ref jybislbbblyjsrcdegjt
```

7. Envie o site e o código ao GitHub:

```cmd
git add -f dist/sw.js dist/v59-enhancements.js
git add supabase/migrations/20261014_v69_user_ai_keys.sql
git add supabase/functions/ai-key-manager/index.ts
git add supabase/functions/material-gemini/index.ts
git add supabase/functions/edital-gemini/index.ts
git add supabase/functions/redacao-gemini/index.ts
git commit -m "Adiciona chaves pessoais Gemini protegidas pelo Vault"
git push origin main
```

8. Aguarde o Cloudflare concluir a publicação e pressione `Ctrl + F5` no site.

## Teste

1. Entre na conta.
2. Abra **Perfil**.
3. Clique em **Configurar minha IA**.
4. Crie uma chave em `https://aistudio.google.com/apikey`.
5. Cole a chave e clique em **Testar e salvar**.
6. Confirme a senha atual.
7. O aplicativo deve mostrar `Chave pessoal ativa` e somente os quatro últimos caracteres.
8. Analise um PDF com texto e confira nos logs/resposta `key_source: personal`.

## Segurança

- A chave completa não é gravada no navegador.
- O banco público guarda apenas os quatro últimos caracteres e o ID do segredo.
- A chave completa fica no Supabase Vault com criptografia autenticada.
- Somente Edge Functions com credencial administrativa podem recuperá-la.
- Salvar, substituir e remover exigem a senha atual.
- A exclusão da conta remove também o segredo do Vault.
