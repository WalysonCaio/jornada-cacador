# Jornada do Caçador — correção da versão 60

## Correções desta versão

- o limite de 10 considera somente análises de PDF concluídas com sucesso;
- falhas, respostas 429, interrupções e conteúdo reaproveitado do cache não gastam a cota;
- as 10 análises são contabilizadas no total diário de PDFs, sem multiplicar o limite por categoria;
- trabalhos interrompidos há mais de 20 minutos são liberados automaticamente;
- falhas temporárias do upload e do inventário do Gemini mantêm o PDF salvo para nova tentativa;
- a barra agora mostra quatro etapas reais, e não um percentual contínuo estimado;
- mensagem específica informa quando a cota ou a capacidade do Gemini causa erro 429.

## 1. Faça backup

Copie a pasta atual:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para uma pasta de backup antes de substituir arquivos.

## 2. Substitua os arquivos

Extraia o ZIP da versão 60, copie todo o conteúdo para a pasta do repositório e confirme **Substituir os arquivos no destino**.

## 3. Execute a migração SQL obrigatória

No Supabase, abra **SQL Editor → New query**. Copie todo o conteúdo de:

`supabase\migrations\20261003_v60_fair_ai_quota.sql`

Cole no editor e clique em **Run**. O resultado esperado é `Success. No rows returned`.

Sem esta etapa, o banco continuará usando a regra antiga de consumo.

## 4. Valide no Prompt de Comando

```bat
cd /d "C:\Users\Walyson Caio\Documents\jornada-cacador"
node --check dist\v59-enhancements.js
node scripts\validate-project.mjs
git diff --check
```

Os dois primeiros comandos devem terminar sem erro. O terceiro não deve mostrar erro.

## 5. Publique as funções atualizadas

```bat
supabase login
supabase link --project-ref jybislbbblyjsrcdegjt
supabase functions deploy material-gemini
supabase functions deploy edital-gemini
supabase functions deploy redacao-gemini
supabase functions deploy system-diagnostics
```

## 6. Envie ao GitHub

```bat
git add .
git status
git commit -m "Versao 60 cota justa e leitura de PDF corrigida"
git push origin main
```

Aguarde o Cloudflare concluir a nova publicação.

## 7. Atualize o aplicativo instalado

1. Feche o site, PWA, aplicativo Android e versão Windows.
2. Abra `https://jornada.wcaio.workers.dev`.
3. Atualize a página duas vezes para trocar o cache.
4. Entre na conta e use **Sincronizar agora**.
5. Em **Menu → Sobre o projeto**, confirme **Versão 60**.

## 8. Teste da correção

1. Envie um PDF de teste menor que 50 MB.
2. Inicie a análise e observe: **Etapa 1 de 4**, **2 de 4**, **3 de 4** e conclusão.
3. Se houver erro, confirme que o cartão continua salvo e permite tentar novamente.
4. Abra **Menu → Diagnóstico e backup** e confira o consumo.
5. Uma análise com falha não deve aumentar o total de operações concluídas.
6. Uma análise concluída deve aumentar o total em uma unidade.

## Como interpretar a barra

A barra funciona, mas não mede tokens nem páginas em tempo real porque o Gemini não fornece esse avanço. Ela mostra eventos confirmados pelo servidor:

1. mapeamento do PDF;
2. geração do conteúdo;
3. revisão de qualidade;
4. conteúdo salvo e concluído.

Assim, ela pode permanecer algum tempo na mesma etapa. Isso significa que o servidor ainda aguarda aquela operação; não é uma animação decorativa.
