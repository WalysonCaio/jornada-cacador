# Versão 74 — auditoria e CRUD seguro

Esta versão mantém todas as funções da versão 73 e corrige operações de exclusão e validação de propriedade.

## O que foi corrigido

- excluir edital remove o PDF, o arquivo auxiliar de texto, o registro, o conteúdo gerado e o mapa do edital;
- excluir material também remove o arquivo auxiliar `.text.json`, evitando consumo oculto de Storage;
- excluir portal remove os PDFs e redações armazenados antes de excluir os registros vinculados;
- excluir redação remove arquivo, correção e registro;
- todas essas operações exigem senha atual e são executadas pela função segura do servidor;
- o servidor confirma que o ID pertence ao usuário antes de alterar qualquer dado;
- a remoção do edital e do mapa acontece numa única transação no PostgreSQL;
- a rota antiga de leitura de edital no assistente não aceita mais IDs de outro usuário;
- a redefinição do perfil só remove arquivos depois de o banco confirmar a transação;
- edital antigo salvo como `edital_concurso` é reconhecido como edital normal;
- CORS da função de materiais também aceita o ambiente local de manutenção.

## Passo 1 — fazer backup

Na pasta do projeto, execute:

```bat
git status
git add -A
git commit -m "Backup antes da versao 74"
git push origin main
```

Se aparecer `nothing to commit`, o backup atual já está no GitHub.

## Passo 2 — instalar o SQL obrigatório

No painel do Supabase correto (`jybislbbblyjsrcdegjt`), abra **SQL Editor → New query**.

Copie todo o conteúdo de:

`supabase/migrations/20261017_v74_secure_document_delete.sql`

Cole no editor e clique em **Run**. O resultado esperado é:

`Success. No rows returned`

## Passo 3 — publicar as Edge Functions alteradas

Abra o Prompt de Comando na pasta do projeto e execute uma linha por vez:

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security
npx supabase functions deploy assistente-pmpe
npx supabase functions deploy material-gemini
```

Não cole chaves no código nem no GitHub.

## Passo 4 — validar localmente

```bat
node scripts/validate-project.mjs
node scripts/test-crud-contracts.mjs
```

As duas linhas devem terminar com `OK`.

## Passo 5 — publicar GitHub/Cloudflare

```bat
git add -A
git status
git commit -m "Versao 74 auditoria e CRUD seguro"
git push origin main
```

Aguarde o deploy do Cloudflare. Abra `https://jornada.wcaio.workers.dev` e use `Ctrl + F5`.

## Passo 6 — teste funcional obrigatório

Use arquivos pequenos e descartáveis:

1. crie um portal de teste;
2. envie um edital e conclua a análise;
3. confirme que o mapa e as missões aparecem;
4. exclua o edital e confirme a senha;
5. confirme que o edital, o mapa e as missões desapareceram;
6. recarregue a página e confirme que não voltaram;
7. envie e exclua um material comum;
8. envie e exclua uma redação;
9. exclua o portal de teste e recarregue a página;
10. abra outro aparelho e confirme que os itens excluídos não reaparecem.

Se a exclusão informar que a versão 74 não está instalada, repita o Passo 2 no mesmo projeto Supabase usado pelo site.
