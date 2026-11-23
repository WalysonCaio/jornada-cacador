# Entrega r185 — 21/11/2026

Baixe `jornada-cacador-r185-alteracoes.zip` e extraia na raiz do projeto, preservando `.git` e conferindo alterações locais. É atualização de código, não backup para importar no app. Inclui r182/r183/r184 desde main r181 (52b236036f5207117918aeb84ddd1df89eacdd1d).

[Aplicação e GitHub](../../docs/revisao-r185/LEIA-ME.md) · [Validação e limites](../../docs/revisao-r185/VALIDACAO.txt).

65/65 scripts e quatro integrações SQL locais aprovados. O PR #4 incorpora esta versão. Não houve merge no main, deploy ou acesso às contas reais. A execução no navegador/celular continua pendente de homologação fora deste ambiente.

O ZIP não aplica exclusões sozinho: `scripts/cleanup-repository-artifacts.mjs` remove somente as três saídas conhecidas com hash conferido; `--stage` seleciona apenas essas exclusões no Git. O guia explica o uso. O manifesto registra arquivos e remoções; SHA256SUMS confere o ZIP.

Após publicar, feche/reabra os clientes. O leitor PDF precisa de um primeiro uso online após atualizar para cachear seu motor; depois suporta offline. Biblioteca compartilhada e Manuais como ajuda preservados.
