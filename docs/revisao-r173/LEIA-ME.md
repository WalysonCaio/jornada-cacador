# Revisão r173 — manuais e desempenho de Questões

Revisão do arquivo jornada-cacador.rar recebido em 12/11/2026. Alterações locais prontas para revisão/publicação; não foi feita implantação no Cloudflare, GitHub ou Supabase.

## O que são os Manuais do Caçador?

São quatro guias do próprio projeto: ciclo de estudos, resolução de questões, revisão espaçada e uso da plataforma. Não são disciplinas do edital nem exigem geração por IA.

Havia dois defeitos: os objetos dos manuais estavam dentro de EXTRA_FLASHCARDS (que deve conter tuplas de pergunta/resposta); e a substituição posterior de BASIC_SUMMARIES pelo núcleo teórico não preservava os manuais. Ambos foram corrigidos. O atalho também limpa a busca, reabre as pastas e informa quantos guias foram encontrados, em vez de anunciar sucesso sem verificar os dados.

## Desempenho e outras correções

- O carregador nativo recalculava identificadores e normalizava todo o banco a cada chamada; ainda acionava acoplamento de resumos/flashcards ao consultar questões. Agora acompanha os itens já inseridos por lista de destino e processa somente novas entradas. Uma lista nova recebe o banco novamente; questões removidas pela sanitização não são reinseridas em cada consulta.
- O seletor de tópicos reutiliza o resultado enquanto portal, disciplina, banca, edital e metadados relevantes das questões não mudarem. A verificação ainda percorre os metadados: não é uma promessa de custo constante nem elimina todo processamento da tela.
- Sanitização reconhece uma lista substituída mesmo quando tamanho e primeiros/últimos textos coincidem.
- Contagens de tópicos com zero correspondências mostram 0q. Antes, um fallback apresentava a quantidade da disciplina inteira como se fosse daquele tópico.
- Removidas promessas de “abertura instantânea” do indicador de banco local.
- Cache offline passa a r173; versão do pacote passa a 1.0.173.

## Validação

`npm test`: 17/17 scripts aprovados com Node 24.22.1. Teste novo executa as funções reais em contexto isolado: formato dos flashcards, preservação dos quatro manuais após reinicialização e recarga, inserção incremental, troca do banco, cache dos tópicos, troca de portal/banca e contagem zero.

Em cenário sintético de 1.000 questões, 100 leituras após a carga inicial geram zero novos cálculos de fingerprint. Não é medição do tempo total de clique ou de rede. O Chromium local foi impedido de iniciar pelo ambiente; não foi possível validar visualmente ou medir a navegação completa. Não foram usados dados da conta, APIs autenticadas nem realizadas alterações no banco remoto. O link de conversa compartilhada não pôde ser lido.

## Arquivos alterados

- dist/content-summaries.js
- dist/v77-experience.js
- dist/sw.js
- package.json
- scripts/test-front-study.mjs (contrato adaptado à preservação dos manuais)
- scripts/test-r173-navigation.mjs (regressões novas)
- README.md e este diretório de documentação.

As pastas Android/app carregam a URL hospedada; não foram compilados APK, AAB ou instalador Windows. Os assets legados embarcados não foram atualizados nesta revisão.

## Como aplicar

1. Faça uma cópia do seu projeto atual.
2. Copie os arquivos acima para a mesma estrutura no seu projeto (ou use o pacote de fontes). O arquivo ALTERACOES.patch contém as alterações desta revisão, sem alterações locais anteriores do anexo.
3. Com Node 24+, execute `npm test` na raiz.
4. Publique a pasta `dist` pelo fluxo Cloudflare já usado no projeto. O wrangler.jsonc aponta para essa pasta. Nenhuma migração SQL é necessária para estas mudanças.
5. Abra/atualize a aplicação online para instalar o cache r173. Confira Estudar → Resumos → Manuais, teste busca anterior e pastas fechadas; abra Questões, mude disciplina/banca e confirme os contadores. Valide também importação de questões e troca de portal.

O ZIP exclui caches, histórico .git, configurações locais de máquina/IDE e produtos de compilação; mantém fontes e recursos do projeto. Use sua cópia atual do repositório para preservar seu histórico e sua configuração de publicação.

## Próximas melhorias recomendadas

1. Medir tempo entre clique e tela utilizável com um banco real grande e em celular; separar custo de renderização, classificação e download antes de ampliar o cache.
2. Dividir v77-experience.js em módulos de questões, estudo, duelo e interface, com carregamento sob demanda. É uma refatoração maior que precisa de testes de navegação completos.
3. Paginar documentos/questões na origem e renderizar listas em lotes quando o volume real justificar.
4. Revisar editorialmente os manuais: há percentuais e generalizações sobre bancas/memória sem fonte e instruções que podem envelhecer. Esta revisão corrigiu acesso/estrutura, não certificou conteúdo pedagógico ou jurídico.
5. Adicionar testes reais de navegador ao CI para os fluxos de manual, filtros, importação, troca de portal e uso offline.
