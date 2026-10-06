# Hotfix material-gemini v65.1

Este hotfix restaura o fluxo direto que funcionava nas primeiras versões.

## O que mudou

- O PDF é enviado uma vez ao Gemini e segue diretamente para a geração do pacote de estudo.
- O inventário por IA deixou de ser uma etapa obrigatória.
- A auditoria de cobertura só pode bloquear o salvamento quando o próprio modelo declarar uma cobertura real.
- O esquema foi reduzido para no máximo 12 assuntos, preservando resumo detalhado, pontos essenciais, exemplo, bizu, mnemônico, pegadinha, flashcards e questões.
- São testados até quatro modelos compatíveis, primeiro com JSON estruturado e depois com JSON flexível.
- Falhas não consomem o limite diário e o PDF permanece salvo.

## Publicação obrigatória

Na pasta correta do projeto:

```bat
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
```

Não é necessário publicar as outras funções nem executar SQL.

Depois envie o código ao GitHub:

```bat
git add supabase/functions/material-gemini/index.ts scripts/validate-project.mjs HOTFIX-MATERIAL-GEMINI-V65-1.md
git commit -m "Restaura geracao estavel de materiais"
git push origin main
```

O teste deve ser feito no mesmo PDF que ficou pendente, usando **Gerar conteúdo**. Não é necessário reenviar o arquivo.
