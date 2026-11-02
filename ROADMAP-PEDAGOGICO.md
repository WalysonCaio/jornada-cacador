# Jornada do Caçador — Revisão de Usabilidade, Modernidade, Rigor Pedagógico e Integridade de Materiais

Base: Versão v110 (r110). Revisão completa de código, testes de integridade determinísticos, validação de segurança e análise de responsividade.

---

## 1. O que foi Corrigido e Implementado nesta Versão (v110)

| Problema Identificado | Causa Raiz | Solução Aplicada na v110 |
|---|---|---|
| **IA gerando resumos e questões sobre capa, professor ou 'GRATIDÃO!!'** (prints anexados) | PDFs de slides com marcas d'água de alunos e páginas finais de agradecimento passavam na extração de texto sem filtro de conteúdo substantivo. A IA tentava preencher lacunas criando questões sobre `@PROFGEDSON`, 'GRATIDÃO!!' ou 'pouca densidade conceitual'. | 1. `stripWatermarksAndMeta`: remove automaticamente CPFs, e-mails, marcas d'água de compra e menções soltas de redes sociais.<br>2. `isNonDidacticSlide`: detecta e descarta páginas sem densidade teórica (capas, contracapas e agradecimentos).<br>3. Se um documento for puramente visual/escaneado (menos de 150 caracteres úteis), ativa o **Gemini Native Document Vision** para ler a escrita dos slides reais em vez de alucinar.<br>4. Instruções negativas no prompt proibindo terminantemente questões sobre capas/professores.<br>5. `isNonDidacticSummary` e `sanitizeQuestions`: descarta deterministamente resumos e questões que mencionem `@prof`, `gratidão` ou metadados de capa. |
| **Botões da Biblioteca desalinhados e quebrando texto no celular** (print anexado) | `.docManage` usava `grid-template-columns: 1fr 1fr`, fazendo com que botões com texto longo como `🤝 Compartilhado` e `Mover disciplina` quebrassem linhas de forma antiestética em telas estreitas. | Botões simplificados com ícones objetivos (`📖 Abrir`, `✏️ Renomear`, `📁 Mover`, `🤝 Público`/`🔒 Privado`, `🗑️ Excluir`) e CSS responsivo flex-wrap fluido com largura mínima balanceada, sem quebra de palavras. |
| **Truncamento de apostilas extensas** (identificado pelo Claude) | Apostilas grandes eram limitadas a 8 trechos de 32 mil caracteres, cobrindo apenas 20% a 30% do material real. | Trechos adaptativos até 44.000 caracteres em até 14 blocos contíguos sem nenhum corte ou perda de texto. |
| **Falsa cobertura de material** | O sistema reportava 90% de cobertura fixa mesmo quando trechos falhavam. | Cobertura real e honesta calculada a partir dos blocos realmente analisados, listando exatamente quais páginas ficaram pendentes. |
| **Gabaritos inventados e origem de questões** | Questões sem gabarito viravam alternativa A; questões criadas por IA recebiam selo de `oficial`. | Gabaritos ausentes ou inválidos descartam a questão. Questões recebem origem verdadeira (`adaptada_do_pdf` ou `autoral`). |
| **Central de Redação genérica** | Correção dava apenas 1 nota geral (0-100) sem espelho de banca ou linha a linha. | 1. Espelho por 4 competências oficiais da banca (AOCP, IDECAN, Cebraspe, FGV) com notas parciais (0-25 ou 0-30).<br>2. Apontamentos linha a linha com citação do trecho, identificação do desvio gramatical e sugestão de correção.<br>3. Exportação completa do relatório impresso/PDF contendo o espelho e os desvios. |
| **Atualização do PWA / Service Worker** | Cache r109 retinha código antigo em dispositivos móveis. | Atualizado para `r110` com renovação instantânea do cache. |

---

## 2. Avaliação de Rigor Pedagógico e Modernidade (Nota: 9.5 / 10)

### Pontos Fortes Consolidados
1. **Gamificação com Contexto de Concurso:** A mecânica Solo Leveling engaja o aluno sem infantilizar a preparação para carreiras policiais ou tribunais.
2. **Segurança e Isolamento RLS:** Proteção por linha em 17 tabelas, chaves de IA salvas com segurança no Vault, anti-trapaça na Arena X1 (gabarito calculado no backend) e proteção de PDFs contra download indevido na biblioteca compartilhada.
3. **Repetição Espaçada Real:** Ciclos de 1, 7 e 30 dias na Central de Revisão Ativa, flashcards adaptativos e caderno de erros individualizado.

### Recomendações Estratégicas para as Próximas Versões
1. **Índice de Maestria por Tópico (0 a 100):** Em vez de considerar um tópico "concluído" com 1 clique na teoria, exigir pelo menos 70% de acerto nas questões para conceder o bônus máximo de XP.
2. **Parser Determinístico para Provas Anteriores:** Em arquivos marcados como "Prova Oficial", utilizar segmentação regex para números de questão (`QUESTÃO 01`) e casar com o gabarito oficial sem intermediação da IA, reservando a IA apenas para os comentários explicativos.
3. **Botão 'Reportar Erro no Conteúdo':** Permitir que o aluno sinalize eventuais discordâncias de gabarito para revisão comunitária.

---

## 3. Passo a Passo Completo para Postar / Atualizar

### Passo 1: Atualizar o Repositório no GitHub / Cloudflare
1. Extraia o conteúdo de `jornada-cacador-v110-completo-definitivo.zip` na raiz do seu projeto local.
2. No terminal:
   ```bash
   git status
   git add .
   git commit -m "feat(v110): filtro anti-ruido de slides, botoes responsivos na biblioteca, espelho de redacao por banca e sw r110"
   git push origin main
   ```
3. O Cloudflare Pages detectará o commit e fará o deploy automático dos arquivos da pasta `dist/`.

### Passo 2: Atualizar as Edge Functions no Supabase
Abra o terminal na raiz do projeto e execute:
```bash
supabase functions deploy material-gemini
supabase functions deploy redacao-gemini
```
*Se você não usa o Supabase CLI localmente:*
1. Acesse o painel web do **Supabase** -> **Edge Functions**.
2. Cole o código atualizado de `supabase/functions/material-gemini/index.ts` e clique em **Deploy**.
3. Cole o código atualizado de `supabase/functions/redacao-gemini/index.ts` e clique em **Deploy**.

### Passo 3: Limpeza de Cache no Celular / Navegador
- Como o `sw.js` foi promovido para `r110`, fechar e reabrir o app nos celulares já instalará a versão corrigida automaticamente.
- No desktop, faça um `Ctrl + F5` ou `Ctrl + Shift + R`.
