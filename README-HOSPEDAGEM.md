# Jornada do Caçador — publicação e manutenção

## Estrutura

- `dist/`: aplicação web estática publicada no Cloudflare Pages.
- `supabase/functions/`: funções de backend.
- `supabase/migrations/`: alterações do banco de dados.

## Cloudflare Pages

Configuração recomendada:

- Branch de produção: `main`
- Comando de build: vazio
- Diretório de saída: `dist`

Cada `git push` para `main` publica automaticamente uma nova versão.

## Desenvolvimento local

Na raiz do projeto:

```bash
npx serve dist
```

Abra o endereço informado no terminal. Para testar recuperação de senha localmente,
adicione o endereço local permitido no Supabase apenas durante o desenvolvimento.

## Publicar funções do Supabase

```bash
npx supabase login
npx supabase functions deploy --project-ref jybislbbblyjsrcdegjt
```

## Domínios permitidos nas funções

Configure no Supabase, separando os endereços por vírgula:

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://seu-projeto.pages.dev,https://seu-dominio.com" PRIMARY_SITE_URL="https://seu-dominio.com" --project-ref jybislbbblyjsrcdegjt
```

Depois republique as funções.

## Fluxo de manutenção

1. Crie uma branch: `git switch -c ajuste/nome-da-alteracao`.
2. Edite os arquivos no VS Code.
3. Teste localmente.
4. Salve: `git add .` e `git commit -m "Descrição da alteração"`.
5. Envie: `git push -u origin ajuste/nome-da-alteracao`.
6. Confira a URL de prévia do Cloudflare.
7. Una a branch à `main` quando estiver correta.

Nunca coloque chaves do Gemini, Groq ou `service_role` no GitHub. Elas devem ficar
somente em Supabase > Edge Functions > Secrets.
