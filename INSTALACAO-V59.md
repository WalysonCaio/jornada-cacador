# Jornada do Caçador — instalação da versão 59

## O que mudou

- limite diário aumentado de 5 para 10 análises por categoria e usuário;
- análise de material em duas etapas: inventário integral e geração didática;
- inventário salvo no documento e reutilizado em uma nova tentativa;
- indicador de estágio e percentual de processamento;
- relatório completo de cobertura exportável em JSON;
- páginas de origem nos resumos e atalho para abrir o PDF na página indicada;
- identificação “Gerado por IA” ou “Conferido pelo usuário”;
- backup ampliado com progresso, metadados dos documentos e conteúdo de estudo;
- diagnóstico de cobertura e conferência humana;
- cache atualizado para a versão 59.

## 1. Backup da versão atual

Copie:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

para:

`C:\Users\Walyson Caio\Documents\jornada-cacador-backup-v58`

## 2. Substituir os arquivos

Extraia o ZIP da versão 59 e copie todo o conteúdo de dentro dele para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Confirme **Substituir os arquivos no destino**.

Esta versão não exige uma migração SQL nova. Se a migração da versão 57 ainda não foi executada, rode antes:

`supabase\migrations\20261002_v57_subject_consistency.sql`

## 3. Validar no computador

Abra o Prompt na pasta do projeto:

```bat
cd /d "C:\Users\Walyson Caio\Documents\jornada-cacador"
node --check dist\v59-enhancements.js
node scripts\validate-project.mjs
git diff --check
```

Os dois primeiros comandos devem terminar sem erro. O terceiro não deve imprimir erro.

## 4. Publicar as funções

```bat
supabase login
supabase link --project-ref jybislbbblyjsrcdegjt
supabase functions deploy material-gemini
supabase functions deploy edital-gemini
supabase functions deploy redacao-gemini
supabase functions deploy system-diagnostics
```

Não é necessário republicar as outras funções se a versão 58 já estava funcionando.

## 5. Enviar ao GitHub

```bat
git add .
git status
git commit -m "Versao 59 processamento em etapas e validacao humana"
git push origin main
```

Aguarde o Cloudflare mostrar **Success**.

## 6. Atualizar o site instalado

1. Feche o site, PWA, aplicativo Android e versão Windows.
2. Abra `https://jornada.wcaio.workers.dev`.
3. Atualize a página duas vezes.
4. Entre na conta e clique em **Sincronizar agora**.
5. Abra **Menu → Sobre o projeto** e confirme **Versão 59**.

## 7. Teste obrigatório

1. Envie um material PDF grande, mas menor que 50 MB.
2. Confirme que o processamento passa por inventário, geração e revisão.
3. Abra **Ver relatório completo da análise** no cartão do arquivo.
4. Confira se aparecem seções detectadas, cobertas, páginas, confiança e avisos.
5. Abra um resumo e use **Abrir PDF na página**.
6. Confira o trecho no arquivo original e clique em **Marcar como conferido**.
7. Abra **Menu → Diagnóstico e backup** e confirme o limite de 10 análises.
8. Exporte o backup e confirme que o nome contém `v59`.

## Limites e segurança pedagógica

O inventário e as referências de página melhoram a rastreabilidade, mas continuam sendo estimativas da IA. Antes de memorizar leis, prazos, exceções, gabaritos e regras decisivas, confira o PDF original e a fonte oficial atualizada.
