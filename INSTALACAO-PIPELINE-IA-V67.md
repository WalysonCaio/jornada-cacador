# Jornada do Caçador v67 — PDFs com Gemini, DeepSeek e Groq

Esta versão substitui a análise monolítica do PDF por um fluxo em etapas:

1. extrai o texto localmente, página por página, dentro da Edge Function;
2. detecta títulos e intervalos de páginas;
3. divide o material em até 10 blocos, sem descartar silenciosamente o final;
4. gera resumos, flashcards e questões para cada bloco;
5. tenta Gemini primeiro, DeepSeek depois e Groq por último;
6. salva o conteúdo somente depois de validar toda a geração;
7. falhas não contam no limite diário;
8. PDFs repetidos continuam usando o cache SHA-256;
9. PDFs digitalizados usam a leitura visual do Gemini como rota de OCR.

## Antes de começar

Use somente o repositório que publica `https://jornada.wcaio.workers.dev` e o projeto Supabase cujo Project Ref é `jybislbbblyjsrcdegjt`.

No Windows, abra a pasta correta:

```powershell
cd "C:\Users\Walyson Caio\Documents\jornada-cacador"
git status
```

Confirme que o prompt termina em `jornada-cacador>` antes de executar qualquer comando.

## 1. Criar a chave do DeepSeek

1. Entre na plataforma oficial do DeepSeek.
2. Abra a área de API keys.
3. Crie uma chave nova.
4. Copie a chave e guarde-a fora do código.
5. Verifique se a conta possui saldo para uso da API. A assinatura do ChatGPT não fornece créditos ao DeepSeek.

## 2. Conferir as três chaves no Supabase

Na raiz do projeto, execute um comando por vez. Substitua somente o conteúdo depois do sinal `=`:

```powershell
npx supabase secrets set GEMINI_API_KEY=SUA_CHAVE_GEMINI --project-ref jybislbbblyjsrcdegjt
npx supabase secrets set DEEPSEEK_API_KEY=SUA_CHAVE_DEEPSEEK --project-ref jybislbbblyjsrcdegjt
npx supabase secrets set GROQ_API_KEY=SUA_CHAVE_GROQ --project-ref jybislbbblyjsrcdegjt
```

Não coloque aspas, `<`, `>` nem a chave dentro de arquivos enviados ao GitHub.

Confirme apenas os nomes dos secrets:

```powershell
npx supabase secrets list --project-ref jybislbbblyjsrcdegjt
```

Devem aparecer `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` e `GROQ_API_KEY`. O valor secreto não será exibido, o que é normal.

Modelos opcionais podem ser definidos por secrets:

```powershell
npx supabase secrets set DEEPSEEK_MODEL=deepseek-flash --project-ref jybislbbblyjsrcdegjt
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-120b --project-ref jybislbbblyjsrcdegjt
```

Se um desses nomes deixar de existir no provedor, altere somente o respectivo secret; não é necessário reescrever a função.

## 3. Publicar a Edge Function correta

Ainda na raiz do projeto:

```powershell
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
```

Esse comando envia também a dependência `unpdf`, usada para extrair texto do PDF. Aguarde a mensagem de implantação concluída.

Nesta atualização não é necessário republicar `edital-gemini`, `redacao-gemini`, `assistente-pmpe` ou `account-security`, pois o novo fluxo altera somente `material-gemini`.

## 4. Enviar as alterações ao GitHub

Confira os arquivos antes de adicionar:

```powershell
git status
git diff --check
```

Adicione a função e esta documentação:

```powershell
git add supabase/functions/material-gemini/index.ts INSTALACAO-PIPELINE-IA-V67.md
git status
```

Os dois arquivos devem aparecer em verde em **Changes to be committed**.

Depois:

```powershell
git commit -m "Adiciona pipeline de PDF com fallback Gemini DeepSeek Groq"
git push origin main
```

Como não houve mudança obrigatória na interface `dist`, o Cloudflare não precisa de uma nova versão para o processamento funcionar. O site continuará chamando a função atualizada no Supabase.

## 5. Fazer o primeiro teste

1. Abra `https://jornada.wcaio.workers.dev`.
2. Entre na sua conta.
3. Abra o portal correto e depois a Biblioteca.
4. Envie primeiro um PDF pequeno, com texto selecionável, na categoria **Material de estudo**.
5. Aguarde a análise sem apertar novamente o botão.
6. Confirme que o arquivo muda para **Conteúdo sincronizado**.
7. Abra **Estudar** e confira resumo, flashcards e trilha.
8. Teste depois um PDF maior.

No retorno da função, o campo `provider` permite conferir quem concluiu a geração:

- `gemini`: Gemini concluiu todos os blocos;
- `deepseek`: DeepSeek foi utilizado;
- `groq`: Groq foi utilizado;
- `gemini+deepseek` ou outra combinação: blocos diferentes usaram provedores diferentes;
- `gemini-vision`: o PDF precisou de leitura visual/OCR.

## 6. Conferir os logs

No Supabase:

1. abra **Edge Functions**;
2. escolha `material-gemini`;
3. abra **Logs**;
4. faça uma nova análise;
5. procure por `Gemini interaction`, `deepseek`, `groq` ou `ALL_AI_PROVIDERS_FAILED`.

Interpretação dos erros:

- `429`: cota ou concorrência do provedor atingida; o próximo provedor é tentado;
- `503`/`504`: sobrecarga ou timeout; o próximo provedor é tentado;
- `OCR_REQUIRED`: PDF sem texto selecionável; Gemini Vision é usado;
- `ALL_AI_PROVIDERS_FAILED`: nenhum dos três concluiu; o arquivo permanece salvo e a falha não conta na cota;
- `INVALID_PROVIDER_JSON`: a IA respondeu fora do formato; o próximo provedor é tentado;
- `LOW_COVERAGE`: a geração não atingiu a cobertura mínima e não substituiu conteúdo anterior.

## 7. Teste de segurança e consistência

Depois do primeiro sucesso, verifique:

1. o título jurídico usa `Art. 4°`, não `Art. 4o`;
2. os resumos incluem páginas do começo, meio e fim;
3. cada resumo tem pontos, exemplo, bizu, mnemônico e pegadinha;
4. cada resumo tem flashcards e cinco questões;
5. a disciplina foi reunida à trilha existente, sem duplicar nomes;
6. ao reenviar exatamente o mesmo PDF, o cache é utilizado;
7. uma falha de todos os provedores não aumenta o total de análises concluídas;
8. apenas uma análise por usuário ocorre por vez; as demais permanecem pendentes e são retomadas pela fila enquanto o aplicativo estiver aberto.

## Reversão segura

Se a nova função apresentar um erro inesperado, não apague banco nem PDFs. No GitHub, restaure apenas a versão anterior de:

```text
supabase/functions/material-gemini/index.ts
```

Depois publique novamente:

```powershell
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
```

