# Jornada do Caçador — atualização para a versão 57

## 1. Backup

Copie a pasta atual:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para:

`C:\Users\Walyson Caio\Documents\jornada-cacador-backup-v56`

## 2. Substituir os arquivos

Extraia o ZIP da versão 57. Copie **todo o conteúdo de dentro** da pasta extraída para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Escolha **Substituir os arquivos no destino**.

## 3. Corrigir disciplinas já existentes no Supabase

No Supabase, abra **SQL Editor → New query**, copie todo o conteúdo do arquivo abaixo e clique em **Run**:

`supabase\migrations\20261002_v57_subject_consistency.sql`

Resultado esperado: `Success. No rows returned`.

Essa migração não apaga PDFs, resumos, questões nem progresso. Ela apenas padroniza nomes equivalentes, como “Direito Constitucional I” e “direito constitucional”.

## 4. Validar localmente

Abra o Prompt na pasta do projeto e execute:

```bat
node scripts\validate-project.mjs
```

O resultado deve começar com `OK:`.

## 5. Publicar as funções alteradas

```bat
supabase functions deploy material-gemini
supabase functions deploy system-diagnostics
```

## 6. Enviar para o GitHub

```bat
git add .
git status
git commit -m "Versao 57 organiza estudo e remove duplicacoes"
git push origin main
```

## 7. Confirmar a publicação

1. Aguarde o Cloudflare indicar **Success**.
2. Feche o aplicativo/site em todos os aparelhos.
3. Abra novamente `https://jornada.wcaio.workers.dev`.
4. Entre na conta e use **Sincronizar agora** uma vez.
5. Em **Menu → Sobre o projeto**, confirme **Versão 57**.

## 8. Testes rápidos

- Selecione uma disciplina em Resumos, aguarde um minuto e confirme que o filtro não muda.
- Abra uma pasta de disciplina e confirme que ela não fecha durante a sincronização.
- Confirme que os dois materiais de Direito Constitucional aparecem na mesma pasta.
- Abra a Trilha e confirme que existe somente uma disciplina Direito Constitucional, com fases contínuas.
- Confira o Histórico diário e confirme que a missão repetida aparece apenas uma vez.
- Confirme que XP e moedas consideram somente missões atuais do edital.
