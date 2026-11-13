# Jornada do Caçador — revisão r174

Entrega de fontes para aplicar ao projeto. Base: `WalysonCaio/jornada-cacador`, commit `3d1e6ed2bac05a2d3ea3f560928247eadc3abcaa`, revisão r173. Data da revisão: 13/11/2026.

## O que mudou

- Questões não são completadas com outra disciplina, assunto ou banca quando o filtro fica vazio. Conflitos de classificação são encaminhados à revisão.
- Comandos de gramática ganham prioridade sobre o tema de um texto citado; comparação de tópicos usa limites de palavras e aliases, evitando confundir, por exemplo, art. 1 com art. 144.
- Gabaritos do documento, autorais, sugestões da IA e correções pessoais têm situações diferentes. Sugestão da IA não revisada não comprova acerto.
- Comentários passam a indicar sua origem; removidas datas de conferência fabricadas e corrigido o remapeamento de letras em comentários agrupados do banco nativo.
- Desempenho por banca distingue autoria/documento, primeira tentativa e repetição; amostras pequenas ficam sinalizadas.
- A abertura de Questões deixa gráficos e catálogo para depois da primeira renderização e evita a construção duplicada dos filtros.
- Treinos e simulados podem ser retomados neste aparelho por até sete dias, com isolamento por usuário, portal e redefinição de perfil. O relógio do simulado continua enquanto ele estiver fechado.
- Conteúdo importado em cache é combinado com o banco nativo após recarregar; leituras atrasadas não contaminam outro portal ou conta.
- Reanálise de edital grava mapa e situação do documento numa transação, preservando identificadores e progresso de tópicos mantidos. Falhas não anunciam sucesso nem apagam o mapa anterior.
- Diagnóstico de serviços usa resultados reais e explicita o que não verificou. Exclusão de documento sem a migração de segurança preserva o conteúdo e informa o bloqueio.

O compartilhamento e os controles da biblioteca foram preservados. Os quatro Manuais do Caçador continuam guias de método e uso, sem se tornarem questões ou disciplinas do edital.

## Antes de aplicar

1. Exporte o progresso pelo aplicativo e mantenha uma cópia do projeto atual. Faça também backup do banco no Supabase.
2. Leia [GITHUB-E-APLICACAO.md](GITHUB-E-APLICACAO.md). O ZIP é código-fonte: não é o JSON de backup de progresso e não deve ser importado no botão de restaurar progresso do aplicativo.
3. Aplique `supabase/migrations/20261113120000_v107_atomic_edital_topics.sql` no ambiente de homologação, depois de conferir que o esquema anterior está atualizado. Não execute migrações históricas indiscriminadamente.
4. Atualize as quatro Edge Functions alteradas e publique a pasta `dist` pelo seu fluxo Cloudflare. Atualizar o GitHub sozinho não atualiza Supabase e hospedagem.

## Verificações

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

Node.js 24 ou superior. `npm test` continua independente de navegador; `test:sql` usa PostgreSQL/PGlite em memória e não acessa o Supabase remoto.

Homologação de navegador, no seu computador ou no workflow manual **Homologar navegador (manual)**:

```bash
npx playwright install chromium
npm run test:browser
```

Os fluxos desktop/mobile de filtros, resposta, saída, retomada, simulado e manuais foram preparados. A execução visual ficou pendente: a ferramenta de navegador autorizada não estava disponível no ambiente de revisão. Não foram acessados dados da sua conta, executadas migrações remotas ou compilados APK/AAB/instaladores.

Consulte a [avaliação completa](AVALIACAO-COMPLETA.md) para notas, riscos restantes, referências de outras plataformas e métricas recomendadas.
