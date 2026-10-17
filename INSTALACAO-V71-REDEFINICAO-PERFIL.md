# Jornada do Caçador — versão 71

Esta correção resolve o edital antigo que permanecia no banco após a redefinição do perfil e preserva a chave Gemini pessoal.

## O que foi corrigido

- **Redefinir perfil** agora exclui do Supabase todos os portais, editais, materiais, redações, mapas, resumos, flashcards, trilhas, missões, anotações e progresso.
- Os arquivos correspondentes também são excluídos do bucket privado `study-documents`.
- A conta, o nome, o e-mail e a chave Gemini pessoal permanecem.
- O caderno desenhado e os estados locais antigos também são removidos do aparelho.
- A análise de edital ignora um `GEMINI_MODEL` antigo quando ele não estiver disponível para a chave pessoal.
- Erros 429 e 5xx deixam o edital na fila e mostram uma explicação clara, sem apagar o PDF.

## Passo 1 — Faça um backup

Copie a pasta atual do projeto para uma pasta de backup antes de substituir arquivos.

## Passo 2 — Copie a versão 71

Extraia o ZIP e copie seu conteúdo para a pasta local do repositório `jornada-cacador`, confirmando a substituição dos arquivos.

## Passo 3 — Abra o Prompt na pasta correta

No Explorador de Arquivos, abra a pasta do repositório, clique na barra de endereço, digite `cmd` e pressione Enter.

Confirme a pasta:

```bat
cd
git status
```

## Passo 4 — Publique as duas Edge Functions corrigidas

Execute uma linha por vez:

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
npx supabase functions deploy account-security
npx supabase functions deploy edital-gemini
```

Não é necessário executar SQL novo nesta versão.

## Passo 5 — Envie a versão web ao GitHub

```bat
git add -A
git status
git commit -m "Corrige redefinicao completa do perfil e analise de edital"
git push origin main
```

O Cloudflare deve iniciar uma nova publicação automaticamente. Aguarde o deploy concluir com sucesso.

## Passo 6 — Atualize o aplicativo instalado

Abra `https://jornada.wcaio.workers.dev`, atualize a página e feche/abra novamente o aplicativo instalado. O Service Worker da versão 71 elimina o cache anterior.

## Passo 7 — Teste controlado

1. Entre em **Perfil → Configurações de IA**.
2. Confirme que aparece **Chave pessoal ativa**. Não é necessário digitá-la novamente após redefinir o perfil.
3. Use **Redefinir perfil e apagar conteúdos** e confirme sua senha.
4. Após a recarga, confira se a Biblioteca está vazia.
5. Crie ou abra um portal e envie um único PDF verdadeiro na categoria **Edital do concurso**.
6. Aguarde a análise e confira o mapa do edital.

Se a mensagem disser erro 429, a cota da chave Gemini terminou temporariamente. Se disser indisponibilidade 5xx, o Gemini está sobrecarregado. Em ambos os casos, o edital continuará salvo e poderá ser reanalisado.

