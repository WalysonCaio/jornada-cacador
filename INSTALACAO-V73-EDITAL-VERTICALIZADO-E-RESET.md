# Versão 73 — edital verticalizado e redefinição definitiva

## Correções

- Edital oficial e edital verticalizado são aceitos como fontes válidas para mapa, disciplinas e missões.
- O tipo identificado é preservado no resultado da análise.
- Um edital verticalizado gera apenas um aviso para conferência com a fonte oficial; não é rejeitado.
- A redefinição apaga PDFs, editais, portais, conteúdo gerado, redações, anotações, progresso, histórico e cronômetro.
- A chave Gemini pessoal e a conta são mantidas.
- O estado sincronizado não é simplesmente excluído: ele é substituído por um marco vazio com `reset_epoch` superior. Isso impede que outro celular, computador ou APK restaure dados antigos.
- O aplicativo só informa sucesso depois de verificar zero conteúdo restante e confirmar o marco de redefinição.

## Passo 1 — SQL obrigatório

No Supabase, acesse **SQL Editor → New query**. Copie todo o conteúdo do arquivo:

`supabase/migrations/20261017_v72_reset_profile_complete.sql`

Cole, clique em **Run** e confirme `Success. No rows returned`.

Mesmo que você tenha executado uma versão anterior desse SQL, execute novamente: ele usa `create or replace` e instalará a correção contra restauração por outro aparelho.

## Passo 2 — Edge Functions

No Prompt aberto em `C:\Users\Walyson Caio\Documents\jornada-cacador`:

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security
npx supabase functions deploy edital-gemini
```

## Passo 3 — GitHub e Cloudflare

```bat
git add -A
git status
git commit -m "Versao 73 aceita edital verticalizado e corrige redefinicao"
git push origin main
```

Aguarde o deploy do Cloudflare. Depois abra `https://jornada.wcaio.workers.dev` e pressione `Ctrl + F5`.

## Passo 4 — Teste

1. Feche o aplicativo nos outros aparelhos durante o primeiro teste.
2. Em Perfil, use **Redefinir perfil e apagar conteúdos**.
3. Confirme a senha e aguarde a recarga.
4. Verifique se Biblioteca, Portais, Estudar, Redações e histórico estão vazios.
5. Envie `EDITAL VERTICALIZADO PMPE` como **Edital do concurso**.
6. Ele deve ser classificado como `edital_verticalizado`, gerar o mapa e exibir somente um aviso de conferência com o edital oficial.

