# Jornada do Caçador v64 — modelos Gemini automáticos

## Diagnóstico confirmado

O PDF foi enviado corretamente e chegou a 30%. O inventário entrou em fallback e a geração retornou 404 porque os modelos fixos não estavam liberados para a `GEMINI_API_KEY` deste projeto.

## Correção

- consulta `models.list` com a chave configurada no Supabase;
- mantém somente modelos que oferecem `generateContent`;
- prioriza modelos Flash disponíveis;
- exclui modelos de embedding, imagem, vídeo, áudio, TTS e live;
- tenta até oito candidatos em caso de incompatibilidade;
- usa a mesma descoberta no material, edital e assistente;
- o diagnóstico mostra quantos modelos estão disponíveis e os primeiros nomes;
- erros continuam sem consumir a cota de análises concluídas.

## Publicação depois da v63

Não existe SQL novo. Confirme primeiro:

```bat
cd C:\Users\Walyson Caio\Documents\jornada-cacador
git remote get-url origin
git branch --show-current
type supabase\.temp\project-ref
```

Os resultados precisam indicar `jornada-cacador`, `main` e `jybislbbblyjsrcdegjt`.

Valide:

```bat
node --check dist\v59-enhancements.js
node --check dist\sw.js
node scripts\validate-project.mjs
```

Publique no Supabase correto:

```bat
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy edital-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy assistente-pmpe --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy redacao-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy system-diagnostics --project-ref jybislbbblyjsrcdegjt
```

Envie ao GitHub:

```bat
git add -A
git status
git commit -m "Seleciona modelos Gemini automaticamente v64"
git push origin main
git rev-parse --short HEAD
```

Na Cloudflare, abra somente o Worker de `https://jornada.wcaio.workers.dev`, confirme repositório `jornada-cacador`, branch `main` e o mesmo commit.

No aplicativo, use **Menu > Diagnóstico e backup > Verificar agora**. O item Gemini deve mostrar pelo menos um modelo disponível. Depois tente novamente o mesmo PDF; não é necessário reenviá-lo.
