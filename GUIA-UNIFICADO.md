> Versão atual r184: [aplicação, reanálise dos PDFs e GitHub](docs/revisao-r184/LEIA-ME.md). O conteúdo abaixo registra os recursos anteriores preservados.
# Jornada do Caçador — Guia Unificado (r184)

Revisão de 20/11/2026. [Aplicação da versão, GitHub e Supabase](docs/revisao-r183/LEIA-ME.md) · [Conferência do texto do Gemini](docs/revisao-r183/CONFERENCIA-GEMINI.md) · [Validação](docs/revisao-r183/VALIDACAO.txt).

Este guia substitui as instruções históricas que citavam cache r148, contagens fixas de questões e garantias sem evidência. Publicar código no GitHub e atualizar Supabase/Cloudflare são etapas distintas.

## Rotina de estudo

1. Escolha o portal do concurso e o edital correspondente. Um portal que já possui edital é preservado: para outro edital, crie outro portal ou use a exclusão explícita existente.
2. Em Hoje, escolha a missão, a modalidade e o bloco de foco. O cronômetro no topo abre o modo de tela cheia; regressivo e tempo acumulado de hoje são modos diferentes. Wake Lock e fullscreen dependem do navegador.
3. Em Questões, filtre disciplina e assunto antes de iniciar. A seleção é mantida nos modos de treino. Sem questões compatíveis, o aplicativo informa a ausência.
4. Confira origem, fonte e situação do gabarito. Sem chave válida, anulação ou sugestão de IA não se tornam acerto/erro confirmado. Comentário gerado não equivale a revisão factual.
5. Use Continuar depois para preservar a sessão. O salvamento é conferido antes de atalhos que saem do treino.
6. Em Estudar, alterne Resumos, Flashcards, Anotações, Caderno IA e Leis & Textos. Os Manuais do Caçador ficam em Menu → ajuda e não são material de disciplina, revisão ou fonte de XP.

## Biblioteca e IA

A política existente de compartilhamento da biblioteca foi preservada. Confira os controles de visibilidade disponíveis no projeto. Enviar um PDF não garante que todo o conteúdo foi extraído; acompanhe os avisos de cobertura e processamento.

O Invocador exige conta e conexão. Contexto e respostas permanecem vinculados ao portal e à conta. Seu histórico distingue apoio no material de conhecimento geral; essa indicação não certifica a resposta. Revise referências e gabaritos sugeridos antes de adotá-los.

Para provas sem gabarito, é possível estudar o enunciado e guardar pendências. Adicione a chave posteriormente quando houver fonte conferível; a IA permanece uma sugestão, com a origem identificada.

## Leis & Textos

A base nativa contém 12 seleções curtas identificadas como seleções. A r183 acrescenta uma importação de documentos oficiais por catálogo fixo, sem usar geração por IA para preencher leis.

Ao importar, o serviço consulta a fonte oficial, extrai o documento recebido e registra fonte, horário e hash. O leitor pagina a apresentação para manter a tela leve, preservando o texto salvo. Bloqueio, truncamento detectado, erro de rede ou falha de persistência devem aparecer como falha ou pendência, sem sucesso fabricado. A extração não certifica vigência, consolidação jurídica ou aplicabilidade ao edital; consulte a referência oficial. Cada conta mantém sua cópia pessoal de leis.

## Indicadores

Taxas e médias usam os registros válidos disponíveis da conta, do portal e do período. Ausência de dados permanece explícita. Avaliar um flashcard como fácil não comprova memória de longo prazo; completar uma missão não demonstra domínio de todo o edital. O histórico de alternativas da questão representa as respostas registradas do próprio usuário.

## Manutenção e publicação

Requer Node.js 24 ou superior:

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

Os testes SQL são locais. Não executam migrações no seu Supabase. O resultado estrutural do banco nativo não representa aprovação pedagógica de todas as respostas.

A r183 inclui as correções r182. Confira o histórico do banco antes de aplicar v109, que exige a v106 de `internal_laws_bank`; v107 e v108 seguem os pré-requisitos existentes. Há mais de uma migração histórica com o número v106: use os nomes completos informados no passo a passo.

Para o editor Supabase, use os arquivos autocontidos de `supabase/dashboard/`. Não remova imports isoladamente para esconder erros de publicação. Fontes e cópias são conferidas por teste; regenere com `node scripts/build-supabase-dashboard.mjs` após alterar o servidor. A função nova desta revisão é `leis-oficiais`; confira as instruções de publicação antes de disponibilizar o frontend.

Publique `dist` completa pelo fluxo Cloudflare existente (`wrangler.jsonc` aponta para essa pasta). Não é necessário migrar para Hostinger. O cache da aplicação é r183; fechar e reabrir os clientes permite receber a nova versão. Alterações de fonte preservam as chaves de dados pessoais de r182.

A integração contínua executa testes Node e SQL e condiciona os builds Android/Windows a eles. Para impedir integração sem aprovação, configure a regra de proteção do branch no GitHub. Testes de navegador e homologação no dispositivo real continuam separados da verificação de código; detalhes e limites estão no relatório da versão.
