# Correção do erro ao publicar assistente-pmpe pelo painel

O erro apresentado foi `Module not found .../_shared/question-integrity.mjs`, em `index.ts:2:41`. O código modular usa também `solved-keys.mjs`. Esses dois arquivos estavam no pacote r178, mas precisam fazer parte do envio da função; colar somente o `index.ts` modular no editor não os incorpora.

Preparei arquivos autocontidos, gerados a partir da r178, para seu fluxo de publicação pelo painel. Os dois validadores foram incorporados no assistente. A redação recebeu sua dependência incorporada também. Não foi removida a validação de gabaritos ou autenticação. Não foram modificados os Secrets, o banco ou o frontend.

**Para resolver agora:** abra [o index.ts pronto do assistente](../../supabase/dashboard/assistente-pmpe/index.ts), use **Raw**, copie todo o texto e substitua integralmente o `index.ts` em **Supabase → Edge Functions → assistente-pmpe → Code**. Clique **Deploy updates**. Não basta excluir as linhas `import`.

[Instruções completas e arquivos das seis funções](../../supabase/dashboard/README.md).

As fontes modulares em `supabase/functions` continuam válidas para a CLI com a árvore completa. O complemento não exige repetir as migrações da r178; o roteiro de banco da revisão anterior continua independente.

O manifesto da entrega original r178 descreve aquele snapshot. Este complemento registra os novos arquivos separadamente em `supabase/dashboard/MANIFESTO.json` e no pacote de correção.

O teste novo executa os handlers das cópias autocontidas sem injetar os helpers pelo teste, além de verificar sintaxe, inicialização e reprodução das fontes. A publicação real e o teste com sua conta continuam a ser feitos no seu painel.
