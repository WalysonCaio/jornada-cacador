# Jornada do Caçador v68 — correção de CPU na leitura de PDFs

## Problema corrigido

O Supabase encerrava `material-gemini` com `CPU Time exceeded` porque a biblioteca PDF.js estava extraindo dezenas ou centenas de páginas dentro da Edge Function do plano gratuito.

Na v68:

1. o navegador baixa o PDF privado usando a sessão do próprio usuário;
2. `pdf.js` extrai o texto página por página no aparelho;
3. o navegador envia um arquivo auxiliar privado terminado em `.text.json` para o mesmo bucket;
4. a Edge Function lê esse JSON, sem executar PDF.js;
5. o conteúdo é dividido em até 10 blocos;
6. os blocos usam Gemini, DeepSeek e Groq nessa ordem;
7. se não existir texto suficiente, o PDF segue para Gemini Vision/OCR.

O arquivo auxiliar é removido quando o PDF ou a conta é excluído.

## Arquivos desta atualização

```text
dist/index.html
dist/sw.js
dist/pdf-text-client.js
dist/pdf.mjs
dist/pdf.worker.mjs
supabase/functions/material-gemini/index.ts
supabase/functions/account-security/index.ts
```

## Publicação

Abra o Prompt na raiz do repositório:

```powershell
cd "C:\Users\Walyson Caio\Documents\jornada-cacador"
```

Publique as funções no projeto correto:

```powershell
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security --project-ref jybislbbblyjsrcdegjt
```

Adicione os arquivos ao Git:

```powershell
git add dist/index.html dist/sw.js dist/pdf-text-client.js dist/pdf.mjs dist/pdf.worker.mjs
git add supabase/functions/material-gemini/index.ts supabase/functions/account-security/index.ts
git add INSTALACAO-V68-CPU-PDF.md
git status
```

Faça o commit e envie:

```powershell
git commit -m "Move extracao de PDF para o navegador e corrige limite de CPU"
git push origin main
```

Espere o Cloudflare concluir a publicação. Depois abra o site, pressione `Ctrl + F5` e confirme que o Service Worker atualizou.

## Teste

1. Abra a Biblioteca.
2. Use o PDF que estava pendente; não é necessário reenviá-lo.
3. Clique em gerar conteúdo.
4. Aguarde a mensagem de preparação do texto no navegador.
5. Em PDFs grandes, permaneça com o aplicativo aberto durante essa primeira extração.
6. Depois do arquivo `.text.json` ser salvo, reanálises não precisam extrair novamente.
7. Confira os logs de `material-gemini`.

Para PDFs com texto, o log esperado contém:

```text
Using browser-extracted PDF text
```

Não deve mais aparecer:

```text
Warning: TT: undefined function
CPU Time exceeded
```

Para PDF escaneado, o fluxo continuará registrando:

```text
Browser PDF text unavailable; using Gemini native document vision
```

Esse segundo caso depende do Gemini Vision ou de OCR aplicado previamente ao documento.

