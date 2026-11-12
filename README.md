# Jornada do Caçador

## Revisão r172 — 12/11/2026

- [Avaliação técnica e pedagógica](docs/revisao-r172/AVALIACAO-COMPLETA.md)
- [Como aplicar e publicar no GitHub](docs/revisao-r172/GITHUB-E-APLICACAO.md)
- [Arquivos alterados](docs/revisao-r172/ARQUIVOS-ALTERADOS.md)
- Validação local: Node.js 24+, `npm test` (sem instalar dependências na raiz).
- Relatórios anteriores descrevem revisões históricas; para esta entrega, consulte os documentos acima.
- Migração v106 e builds nativos ainda precisam de homologação.

Plataforma pessoal de preparação para concursos públicos, com foco especial nas carreiras de segurança pública.

O projeto transforma o edital enviado pelo usuário em um plano de aprendizagem: disciplinas, sequência pedagógica, missões diárias, trilha de questões, revisões programadas, caderno de erros, cronômetro de foco e acompanhamento de progresso.

## Principais recursos

- edital convertido em mapa de disciplinas e tópicos;
- currículo progressivo, com fundamentos antes de conteúdos avançados;
- missões diárias alternadas entre disciplinas;
- biblioteca de editais, materiais, leis, provas e simulados, com compartilhamento comunitário preservado;
- PDFs analisados em duas etapas (inventário e geração), com plano reaproveitável, referências de página e controle visível de cobertura;
- resumos, flashcards e questões com apoio de IA e opção de conferência humana;
- caderno de erros com prioridade de revisão;
- cronômetro com continuidade entre celular, computador e aplicativo Android;
- progresso sincronizado pelo Supabase;
- PWA responsiva e aplicativo Android baseado na versão web.

## Tecnologias

- HTML, CSS e JavaScript;
- Supabase Auth, PostgreSQL, Storage e Edge Functions em TypeScript/Deno;
- Gemini como provedor principal de IA e Groq como reserva quando aplicável;
- Cloudflare Workers para hospedagem dos arquivos estáticos.

## Estrutura

- `dist/`: aplicação web publicada;
- `supabase/functions/`: funções de servidor;
- `supabase/migrations/`: estrutura e evoluções do banco;
- `scripts/`: validações locais da versão;
- `GUIA-UNIFICADO.md`: instalação, publicação, manutenção, backup e diagnóstico.
- `LICENSE`: condições de visualização e uso do código-fonte.

## Aviso

Este é um projeto independente de apoio aos estudos. Não possui vínculo oficial com órgãos públicos, bancas organizadoras ou cursos preparatórios. Leis, editais, gabaritos e datas devem ser conferidos nas fontes oficiais.

## Autoria

Idealizado e desenvolvido por **Walyson Caio**.

O código não é distribuído sob uma licença de código aberto. Consulte `LICENSE` antes de copiar, modificar ou distribuir.
