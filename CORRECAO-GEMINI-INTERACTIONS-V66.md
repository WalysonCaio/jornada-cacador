# Correção Gemini Interactions — v66

Esta versão corrige a falha de análise de materiais causada por modelos antigos, excesso de tentativas e timeout de 150 segundos.

Hotfix v66.2: os blocos de PDF e texto agora são enviados dentro de um passo
`user_input`, conforme o formato obrigatório da Interactions API.

Hotfix v66.3: em caso de sobrecarga 503, tenta automaticamente os modelos
3.7 Flash e 3.1 Flash Lite. Erro de cota 429 não gera tentativas repetidas.

Hotfix v66.4: remove o esquema profundo incompatível do `response_format`.
O retorno continua em JSON e é validado pela função antes de qualquer gravação.

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

   Antes do teste, abra o **SQL Editor** do mesmo projeto Supabase, copie todo
   o arquivo `supabase/migrations/20261006_v66_release_stale_ai_lock.sql` e
   pressione **Run**. Isso libera o registro antigo que mostra, incorretamente,
   “Já existe uma análise em andamento”.

7. Envie a alteração ao GitHub:

   ```bat
   git add supabase/functions/material-gemini/index.ts supabase/migrations/20261006_v66_release_stale_ai_lock.sql CORRECAO-GEMINI-INTERACTIONS-V66.md
   git status
   git commit -m "Corrige analise de PDFs com Gemini Interactions"
   git push origin main
   ```

8. Aguarde o Cloudflare concluir o novo deploy. Não é necessário gerar nova APK: ela abre o site publicado.

## Teste

No aplicativo, use o PDF já salvo e pressione **Gerar resumos, flashcards e trilha**. Depois abra `Edge Functions > material-gemini > Logs` no Supabase.

O log correto deve mostrar `Gemini interaction`. Ele não deve mais mostrar `Stable Gemini generation gemini-2.5-flash` nem `Gemini model candidates` durante essa geração.

Se aparecer erro 429, a função está publicada e funcionando, mas a cota da chave Google acabou. Se aparecer 503, o serviço está temporariamente sobrecarregado. Nenhum dos dois deve descontar uma análise concluída do limite interno.
