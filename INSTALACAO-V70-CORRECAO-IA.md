# Jornada do Caçador v70 — correção completa do pipeline de IA

Esta versão corrige a análise de materiais que encerrava com “Gemini, DeepSeek e Groq não concluíram este bloco”.

## O que mudou

- Gemini usa `generateContent` e descobre os modelos liberados para a chave pessoal.
- Groq usa `openai/gpt-oss-120b`, substituto do modelo Llama desativado para contas gratuitas.
- DeepSeek usa `deepseek-flash`, modelo atual da API.
- O frontend chama a função publicada `assistente-pmpe`, e não o endpoint antigo `hyper-endpoint`.
- O diagnóstico verifica a chave Gemini pessoal e mostra DeepSeek e Groq separadamente.
- Quando todos os provedores falham, a mensagem informa o status de cada tentativa sem expor chaves.

## Instalação

1. Faça uma cópia da pasta `C:\Users\Walyson Caio\Documents\jornada-cacador`.
2. Copie o conteúdo deste pacote para essa pasta e confirme a substituição.
3. Abra o Prompt de Comando na pasta do projeto.
4. Se a migração v69 ainda não foi executada, rode `supabase/migrations/20261014_v69_user_ai_keys.sql` no SQL Editor do projeto `jybislbbblyjsrcdegjt`.
5. Atualize os nomes dos modelos de reserva:

```cmd
npx supabase secrets set GEMINI_MODEL=gemini-3.8-flash --project-ref jybislbbblyjsrcdegjt
npx supabase secrets set DEEPSEEK_MODEL=deepseek-flash --project-ref jybislbbblyjsrcdegjt
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-120b --project-ref jybislbbblyjsrcdegjt
```

6. Publique as funções:

```cmd
npx supabase functions deploy ai-key-manager --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy edital-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy redacao-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy assistente-pmpe --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy system-diagnostics --project-ref jybislbbblyjsrcdegjt
```

7. Envie os arquivos ao GitHub:

```cmd
git add -f dist/index.html dist/sw.js dist/v59-enhancements.js
git add supabase/functions/ai-key-manager/index.ts
git add supabase/functions/material-gemini/index.ts
git add supabase/functions/edital-gemini/index.ts
git add supabase/functions/redacao-gemini/index.ts
git add supabase/functions/assistente-pmpe/index.ts
git add supabase/functions/system-diagnostics/index.ts
git add supabase/migrations/20261014_v69_user_ai_keys.sql
git add scripts/validate-project.mjs INSTALACAO-V70-CORRECAO-IA.md
git commit -m "Corrige pipeline de IA e modelos de reserva"
git push origin main
```

8. Aguarde o Cloudflare concluir e abra `https://jornada.wcaio.workers.dev` com `Ctrl + F5`.

## Teste obrigatório

1. Entre na conta e confirme em Perfil que a chave pessoal está ativa.
2. Em Menu → Diagnóstico, clique em “Verificar agora”.
3. Confirme Gemini pessoal, DeepSeek e Groq.
4. Envie um PDF com texto selecionável pequeno e processe-o.
5. Depois teste um PDF maior.
6. Se houver falha, copie a nova mensagem “Diagnóstico: ...”; ela identifica exatamente qual provedor recusou a chamada.
