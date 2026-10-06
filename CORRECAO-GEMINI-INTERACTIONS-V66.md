# Correção Gemini Interactions — v66

Esta versão corrige a falha de análise de materiais causada por modelos antigos, excesso de tentativas e timeout de 150 segundos.

## Publicação segura

1. Faça uma cópia da pasta atual `C:\Users\Walyson Caio\Documents\jornada-cacador`.
2. Copie o conteúdo desta versão para essa pasta, substituindo os arquivos quando o Windows perguntar.
3. Abra a pasta `C:\Users\Walyson Caio\Documents\jornada-cacador` no Explorador.
4. Clique na barra de endereço, digite `cmd` e pressione Enter.
5. Confirme o repositório correto:

   ```bat
   git remote -v
   git branch --show-current
   ```

   O ramo deve ser `main` e o endereço deve ser o repositório Jornada do Caçador.

6. Publique somente a função corrigida no Supabase:

   ```bat
   npx supabase login
   npx supabase link --project-ref jybislbbblyjsrcdegjt
   npx supabase functions deploy material-gemini
   ```

7. Envie a alteração ao GitHub:

   ```bat
   git add supabase/functions/material-gemini/index.ts CORRECAO-GEMINI-INTERACTIONS-V66.md
   git status
   git commit -m "Corrige analise de PDFs com Gemini Interactions"
   git push origin main
   ```

8. Aguarde o Cloudflare concluir o novo deploy. Não é necessário gerar nova APK: ela abre o site publicado.

## Teste

No aplicativo, use o PDF já salvo e pressione **Gerar resumos, flashcards e trilha**. Depois abra `Edge Functions > material-gemini > Logs` no Supabase.

O log correto deve mostrar `Gemini interaction`. Ele não deve mais mostrar `Stable Gemini generation gemini-2.5-flash` nem `Gemini model candidates` durante essa geração.

Se aparecer erro 429, a função está publicada e funcionando, mas a cota da chave Google acabou. Se aparecer 503, o serviço está temporariamente sobrecarregado. Nenhum dos dois deve descontar uma análise concluída do limite interno.
