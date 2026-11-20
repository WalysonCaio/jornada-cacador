# Funções prontas para o painel Supabase — r182

Abra a pasta da função correspondente e copie todo o index.ts para o editor do painel.
As seis cópias incluem os validadores e não dependem de arquivos _shared no envio.
Não cole o código de uma função em outra e mantenha a autenticação e os Secrets existentes.

Para atualizar cópias depois de editar a fonte, execute:

```bash
node scripts/build-supabase-dashboard.mjs
node scripts/test-supabase-dashboard.mjs
```

As fontes atuais em supabase/functions também são autocontidas. O manifesto registra
os hashes das cópias. A verificação local não é um deploy no Supabase.

[Guia completo da revisão](../../docs/revisao-r182/LEIA-ME.md).
