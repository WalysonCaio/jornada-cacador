# Jornada do Caçador — versão 65

Esta versão corrige três problemas observados no uso real.

## Correções

- Títulos legais são normalizados: `Art. 4o`, `Artigo 4º` e `Art 4` passam a aparecer como `Art. 4°`.
- A correção também é aplicada aos resumos antigos já salvos; não é necessário gerar tudo novamente.
- Um resumo aberto permanece aberto durante atualizações e sincronizações de fundo. Ele só fecha quando o usuário toca no botão `−`.
- A leitura de PDF tenta primeiro a resposta estruturada e, se o modelo não aceitar o esquema, repete com JSON flexível.
- Respostas cercadas por blocos Markdown também são interpretadas corretamente.
- Uma resposta vazia, truncada ou sem resumos faz a função tentar outra configuração/modelo.
- Foi removida a terceira chamada grande ao Gemini. A validação local das questões continua ativa, reduzindo timeout e consumo de cota.

## Publicação

No Prompt de Comando aberto na pasta do projeto:

```bat
node scripts\validate-project.mjs
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy system-diagnostics --project-ref jybislbbblyjsrcdegjt
git add dist supabase/functions/material-gemini supabase/functions/system-diagnostics scripts CORRECAO-PDF-RESUMOS-V65.md
git commit -m "Corrige leitura de PDFs e persistencia dos resumos"
git push origin main
```

Depois, aguarde a publicação do Cloudflare e abra:

`https://jornada.wcaio.workers.dev`

Faça uma atualização forçada com `Ctrl + F5`. Em aplicativo instalado, feche e abra novamente após a publicação.

## Teste recomendado

1. Abra um resumo e deixe-o expandido por mais de 30 segundos.
2. Confirme que continua aberto após a sincronização.
3. Confira um título que tinha `Art. 4o`; ele deve aparecer como `Art. 4°`.
4. Em um PDF com falha, toque em **Gerar conteúdo** novamente. Não é necessário reenviar o arquivo.
5. Aguarde o processamento sem fechar a conta. O arquivo deve passar por mapeamento e geração e terminar como pronto.

Não há migração SQL nova nesta versão.
