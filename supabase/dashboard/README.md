# Funções prontas para o editor do painel Supabase — complemento r178

Use estes arquivos somente para copiar o conteúdo completo no `index.ts` da função correspondente no painel. Eles incluem os validadores compartilhados e não dependem da pasta `_shared`.

## Corrigir assistente-pmpe

O erro `Module not found .../_shared/question-integrity.mjs` significa que o módulo importado não está entre os arquivos enviados ao Supabase. O `index.ts` modular da CLI não basta, isoladamente, nessa publicação pelo editor. Remover somente o import também removeria a definição de uma função necessária.

1. Abra `supabase/dashboard/assistente-pmpe/index.ts` desta entrega em um editor de texto ou em **Raw** no GitHub.
2. Copie todo o conteúdo do arquivo, incluindo os validadores incorporados no início. Não copie o HTML da página nem as marcações de um bloco de código.
3. No Supabase, abra **Edge Functions → assistente-pmpe → Code → index.ts**.
4. Selecione todo o conteúdo desse `index.ts` e substitua pelo arquivo desta pasta.
5. Clique **Deploy updates** e confirme a publicação.
6. Após a mensagem de sucesso, teste a função usando uma conta autenticada no aplicativo. Se houver erro de execução, consulte o log da função: isso é uma etapa diferente do erro de empacotamento mostrado na imagem.

Mantenha o nome `assistente-pmpe` e as configurações existentes de autenticação e Secrets. Este ajuste não exige migração SQL ou alteração no frontend.

## Outras funções

| Função no painel | Arquivo para copiar |
|---|---|
| assistente-pmpe | `assistente-pmpe/index.ts` |
| redacao-gemini | `redacao-gemini/index.ts` |
| material-gemini | `material-gemini/index.ts` |
| edital-gemini | `edital-gemini/index.ts` |
| account-security | `account-security/index.ts` |
| system-diagnostics | `system-diagnostics/index.ts` |

A redação também tinha import local: esta cópia incorpora `validateEssayResult`. As outras quatro já eram autocontidas e foram copiadas sem alterar sua lógica. Não cole o código de uma função em outra.

## Para quem publica pela CLI

As fontes de manutenção continuam em `supabase/functions/`, com `_shared` completo. Execute o deploy a partir da raiz do projeto, com todos esses arquivos presentes:

```bash
npx supabase login
npx supabase functions deploy assistente-pmpe --project-ref jybislbbblyjsrcdegjt
```

Não é preciso substituir a fonte modular pelo arquivo gerado do painel. A [documentação oficial](https://supabase.com/docs/guides/functions/deploy) descreve a publicação pela CLI; o [guia do editor](https://supabase.com/docs/guides/functions/quickstart-dashboard) descreve a edição e publicação no painel.

## Manutenção e testes

Para atualizar estas cópias depois de modificar as fontes:

```bash
node scripts/build-supabase-dashboard.mjs
node scripts/test-supabase-dashboard.mjs
```

O gerador rejeita imports não suportados e incorpora os módulos em escopos separados, preservando os validadores. O manifesto registra SHA-256 de cada cópia. Não edite só a cópia gerada: altere a fonte e regenere.

Verificados localmente: reprodução dos seis arquivos, ausência de imports pendentes, sintaxe TypeScript, inicialização isolada, CORS/métodos HTTP e cenários reais de handlers com serviços simulados. Não houve deploy no Supabase nem chamada de produção para confirmar execução real.
