# Auditoria técnica — Jornada do Caçador v46

Data: 01/10/2026

## Resultado executivo

A versão 46 reforça os pontos que apresentavam maior risco operacional: consumo não controlado das IAs, processamento duplicado, falta de diagnóstico, cronômetros simultâneos e ausência de backup do progresso. A sintaxe do cliente e das Edge Functions foi validada localmente. A validação autenticada final deve ser feita depois da migração SQL e da publicação das funções no projeto Supabase de produção.

## Alterações implementadas

### Segurança e isolamento

- RLS habilitada nas novas tabelas.
- Leitura limitada ao próprio `user_id`.
- Filas, auditoria, fingerprints e consumo gravados apenas pelas Edge Functions com `service_role`.
- Trigger impede relacionar dados a um portal pertencente a outro usuário.
- Verificação de usuário, portal, documento e caminho antes da leitura de PDF.
- Nenhuma chave secreta foi adicionada aos arquivos públicos de `dist`.

### Controle das IAs

- 5 análises de PDF por usuário/dia.
- 40 perguntas ao assistente por usuário/dia.
- Reserva atômica no banco contra cliques concorrentes.
- Somente uma análise de documento por vez para cada usuário.
- Gemini é o provedor principal do assistente; Groq é a reserva.
- Erro 429 possui mensagem própria e mantém o PDF pendente.
- Painel mostra uso diário, falhas e disponibilidade dos provedores.

### PDFs e fila

- Limite máximo de 50 MB no navegador, Storage e Edge Function.
- SHA-256 identifica PDF repetido.
- Conteúdo anterior é reutilizado sem nova chamada de IA.
- Estado da fila: `queued`, `processing`, `retry`, `completed`, `failed` ou `cancelled`.
- O aplicativo tenta o próximo item automaticamente enquanto estiver aberto e online.
- Documentos continuam salvos quando o provedor está sem cota.

### Qualidade pedagógica

- Questões distribuídas em 1 fácil, 2 médias e 2 difíceis por tópico.
- Distratores devem pertencer ao mesmo assunto e possuir extensão semelhante.
- A explicação comenta a alternativa correta e as incorretas.
- Questões passam por uma segunda chamada de revisão com baixa temperatura.
- Uma validação estrutural local elimina alternativas duplicadas, gabarito inválido, enunciado curto e duplicatas.
- Questão autoral nunca é identificada como oficial.
- Provas e simulados possuem categorias específicas na Biblioteca.
- Prova presente no PDF pode ser marcada somente como `adaptada_do_pdf`.

### Sincronização e foco

- Cronômetro sobrevive a F5 no mesmo aparelho.
- Sessão em execução é registrada no Supabase.
- Índice único impede dois cronômetros ativos para o mesmo usuário.
- Pausa e conclusão registram duração confirmada.
- O progresso normal continua sincronizado em `user_state`.

### Diagnóstico, backup e acessibilidade

- Novo menu **Diagnóstico e backup**.
- Verifica banco, Gemini, Groq, fila, falhas, foco e consumo.
- Exporta o estado local em JSON versionado.
- Restaura somente backups reconhecidos e exige confirmação.
- Foco visível para teclado, botões com altura mínima, campos sem zoom involuntário no iOS e respeito a `prefers-reduced-motion`.
- Toast anunciado por leitor de tela.

## Testes automáticos executados

- Sintaxe do JavaScript incorporado em `dist/index.html`.
- IDs HTML duplicados.
- Referências JavaScript a elementos ausentes.
- Detecção de chaves secretas em arquivos públicos.
- Identificação da versão do Service Worker.
- Compilação sintática de todas as Edge Functions TypeScript com esbuild.
- `git diff --check` para espaços e conflitos de patch.
- Integridade do pacote ZIP.

## Testes obrigatórios após a publicação

1. Criar uma conta de teste A e outra B.
2. Confirmar que A não consulta portais, PDFs ou progresso de B.
3. Enviar um material pequeno e acompanhar `pending → processing → ready`.
4. Reenviar o mesmo PDF e confirmar a mensagem de cache.
5. Enviar dois PDFs seguidos e confirmar que apenas um processa por vez.
6. Abrir o diagnóstico e conferir Gemini, Groq e consumo.
7. Iniciar foco no computador e tentar iniciar no celular com a mesma conta.
8. Pressionar F5 durante o foco e confirmar a continuidade.
9. Exportar backup, alterar uma configuração e restaurar o backup.
10. Enviar uma prova oficial e conferir origem, dificuldade, disciplina e explicações.
11. Forçar ou aguardar um 429 e confirmar que o documento permanece pendente.
12. Excluir um PDF após confirmar a senha e verificar Storage, banco e conteúdo derivado.

## Limites conhecidos

- A fila automática avança enquanto o aplicativo está aberto e conectado. Processamento totalmente autônomo com o aplicativo fechado requer configurar uma rotina agendada no Supabase e uma função trabalhadora dedicada.
- O teste local não acessa a conta de produção nem consegue provar a configuração remota de RLS/secrets. O painel de diagnóstico e os testes com duas contas completam essa validação.
- Uma IA pode cometer erro factual mesmo após revisão. Textos legais e gabaritos importantes devem continuar sendo conferidos em fonte oficial.
- Backup JSON não contém PDFs, senha ou secrets. O bucket e o banco precisam de backup separado no Supabase.
