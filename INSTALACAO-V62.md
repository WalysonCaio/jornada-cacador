# Instalação e publicação — versão 62

Esta versão não cria uma migração SQL nova. Se as migrações das versões 56 a 60 já foram executadas com sucesso, não repita o SQL.

## 1. Faça o backup

Feche o editor e copie a pasta atual `jornada-cacador` para uma pasta de backup.

## 2. Substitua os arquivos

Extraia o ZIP da versão 62. Copie o conteúdo extraído para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Quando o Windows perguntar, escolha substituir os arquivos existentes. Não apague a pasta `.git` da sua cópia local.

## 3. Abra o Prompt na pasta correta

No Explorador de Arquivos, abra a pasta do projeto, clique na barra de endereço, digite `cmd` e pressione Enter.

Confirme:

```bat
cd
git status
```

O caminho deve terminar em `Documents\jornada-cacador`.

## 4. Valide antes de publicar

```bat
node --check dist\v59-enhancements.js
node --check dist\sw.js
node --check desktop\main.js
node scripts\validate-project.mjs
```

O último comando deve começar com `OK:`.

## 5. Conecte o Supabase

Se já estiver conectado, apenas confirme o projeto:

```bat
npx supabase projects list
```

Se necessário:

```bat
npx supabase login
npx supabase link --project-ref jybislbbblyjsrcdegjt
```

## 6. Publique as funções alteradas

Execute uma linha por vez:

```bat
npx supabase functions deploy account-security
npx supabase functions deploy assistente-pmpe
npx supabase functions deploy edital-gemini
npx supabase functions deploy material-gemini
npx supabase functions deploy redacao-gemini
npx supabase functions deploy system-diagnostics
```

Todas devem terminar com uma mensagem de publicação concluída.

## 7. Envie ao GitHub

```bat
git add README-MANUTENCAO.md README.md AUDITORIA-V62.md INSTALACAO-V62.md desktop dist scripts supabase
git status
git commit -m "Revisao final v62 e correcao do cronometro"
git push origin main
```

No `git status`, os arquivos que serão enviados aparecem em verde antes do commit. Depois do `git push`, execute:

```bat
git status
```

O resultado esperado é `working tree clean`.

## 8. Aguarde a Cloudflare

Abra o painel da Cloudflare e confirme que o último deploy do GitHub terminou com sucesso. Depois abra:

`https://jornada.wcaio.workers.dev`

No computador, pressione `Ctrl + F5`. No celular/PWA, feche completamente e abra novamente. Em **Menu > Diagnóstico**, confirme a versão 62.

## 9. Teste o cronômetro

1. Inicie um bloco de 50 minutos.
2. Espere chegar a `49:20`.
3. Confirme que ele continua diminuindo.
4. Atualize a página e confirme que o tempo é retomado, não reiniciado.
5. Pause em um aparelho e retome em outro.

## 10. Se uma função falhar

Veja os logs com, por exemplo:

```bat
npx supabase functions logs material-gemini
```

Para conferir as funções publicadas:

```bat
npx supabase functions list
```

Não cole chaves secretas, senha ou `service_role` no GitHub ou em capturas de tela.
