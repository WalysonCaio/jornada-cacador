# Jornada do Caçador — versão 58 final

Esta versão inclui todas as correções anteriores e acrescenta verificação de cobertura para PDFs extensos.

## 1. Fazer backup

Copie a pasta atual:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para:

`C:\Users\Walyson Caio\Documents\jornada-cacador-backup-v57`

## 2. Atualizar os arquivos

Extraia o ZIP da versão 58. Copie todo o conteúdo de dentro da pasta extraída para a pasta do projeto e confirme **Substituir os arquivos no destino**.

## 3. Aplicar as migrações pendentes

Se a versão 57 ainda não foi instalada, abra **Supabase → SQL Editor → New query**, copie todo o arquivo abaixo e clique em **Run**:

`supabase\migrations\20261002_v57_subject_consistency.sql`

Resultado esperado: `Success. No rows returned`.

Não existe uma migração nova para a cobertura da versão 58; ela é guardada no campo `metadata` já existente.

## 4. Validar no computador

Abra o Prompt de Comando dentro da pasta do projeto e execute:

```bat
node scripts\validate-project.mjs
git diff --check
```

O primeiro comando deve começar com `OK:` e o segundo não deve mostrar erros.

## 5. Publicar as funções atualizadas

```bat
supabase login
supabase link --project-ref jybislbbblyjsrcdegjt
supabase functions deploy material-gemini
supabase functions deploy edital-gemini
supabase functions deploy assistente-pmpe
supabase functions deploy account-security
supabase functions deploy redacao-gemini
supabase functions deploy system-diagnostics
```

## 6. Enviar ao GitHub e Cloudflare

```bat
git add .
git status
git commit -m "Versao 58 revisao final e cobertura de PDFs extensos"
git push origin main
```

Aguarde o painel do Cloudflare mostrar **Success**.

## 7. Atualizar aparelhos

1. Feche o site e o aplicativo em todos os aparelhos.
2. Abra `https://jornada.wcaio.workers.dev`.
3. Se necessário, atualize a página duas vezes para o novo service worker assumir.
4. Entre na conta e use **Sincronizar agora**.
5. Abra **Menu → Sobre o projeto** e confirme **Versão 58**.

## 8. Teste obrigatório de um PDF extenso

1. Envie um PDF de estudo com mais de 50 páginas e menos de 50 MB.
2. Aguarde a análise sem fechar permanentemente o arquivo da Biblioteca.
3. Confirme que o cartão exibe percentual de seções cobertas e quantidade de resumos.
4. Abra Resumos e confira assuntos do início, do meio e do final do PDF.
5. Se aparecer aviso de baixa cobertura, não trate o resumo como substituto integral do PDF: confira a causa e use **Regenerar conteúdo e questões**.

## Observação pedagógica

A versão 58 impede que uma resposta truncada seja salva silenciosamente e registra omissões declaradas pela IA. Mesmo assim, conteúdo gerado por IA é material de apoio: leis, normas, gabaritos e informações decisivas devem ser conferidos no documento original e em fonte oficial atualizada.
