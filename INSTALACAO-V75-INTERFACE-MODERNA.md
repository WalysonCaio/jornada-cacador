# Jornada do Caçador V75 — interface moderna e responsiva

## O que mudou

- visual unificado em todas as telas;
- largura otimizada para notebook e monitor;
- navegação inferior com cinco ações no celular;
- navegação centralizada e fixa no computador;
- cartões, formulários, botões, filtros e modais redesenhados;
- áreas de toque com no mínimo 44 px;
- melhor leitura de resumos, IA, trilha, biblioteca e relatórios;
- adaptação para celulares estreitos, tablets, iPad e desktop;
- suporte às áreas seguras do Android/iOS;
- foco visível para teclado e suporte a redução de movimentos;
- títulos da aba do navegador atualizados conforme a tela aberta;
- novo cache offline para impedir que o visual antigo permaneça instalado.

## Importante

Esta atualização é visual. Ela não altera tabelas, senhas, PDFs, progresso ou conteúdo do Supabase. Se a versão 74 já foi instalada, não é necessário executar SQL ou republicar Edge Functions.

## Passo 1 — copiar os arquivos

Copie o conteúdo do ZIP para:

`C:\Users\Walyson Caio\Documents\jornada-cacador`

Quando o Windows perguntar, escolha **Substituir os arquivos no destino**.

Confira principalmente estes arquivos:

- `dist\index.html`
- `dist\ui-v75.css`
- `dist\sw.js`
- `dist\v59-enhancements.js`
- `scripts\validate-project.mjs`

## Passo 2 — validar

Abra o Prompt de Comando na pasta do projeto e execute:

```bat
node scripts/validate-project.mjs
node scripts/test-crud-contracts.mjs
```

As duas verificações devem terminar com `OK`.

## Passo 3 — conferir o Git

```bat
git status
```

O arquivo novo `dist/ui-v75.css` deve aparecer como `untracked` ou ser listado entre as alterações.

## Passo 4 — enviar ao GitHub

```bat
git add -A
git status
git commit -m "Versao 75 interface moderna e responsiva"
git push origin main
```

## Passo 5 — aguardar o Cloudflare

Abra o painel do Cloudflare e espere o deploy aparecer como concluído. Depois abra:

`https://jornada.wcaio.workers.dev`

No computador, pressione `Ctrl + F5`.

No celular ou APK, feche completamente o aplicativo e abra novamente. O novo service worker trocará o cache antigo pelo cache V75.

## Checklist visual

1. tela de login sem rolagem lateral;
2. menu inferior com Hoje, Portais, IA, Estudar e Menu;
3. painel de patente em duas colunas no celular e quatro no computador;
4. botões com tamanho confortável para toque;
5. Biblioteca organizada sem cartões cortados;
6. resumos mantendo o conteúdo aberto durante a leitura;
7. questões com botão de continuar visível no celular;
8. modais cabendo na altura da tela;
9. teclado navegando com foco visível;
10. nenhuma tela ultrapassando horizontalmente a largura do aparelho.
