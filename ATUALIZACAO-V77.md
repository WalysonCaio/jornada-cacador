# Jornada do Caçador — Atualização 77

## O que mudou

- A barra principal agora prioriza Hoje, Portais, Questões, Estudar e Menu.
- O Instrutor IA continua disponível na Central do Caçador.
- A tela Hoje ganhou uma área de próxima ação, revisão urgente e acesso rápido às questões.
- A Central de Questões agora permite filtrar disciplina, dificuldade e origem.
- Questões oficiais/importadas e autorais por IA são identificadas separadamente.
- As alternativas continuam sendo embaralhadas antes de cada tentativa.
- O desempenho por disciplina passou a ser exibido em barras de precisão.
- A última tela aberta é preservada durante a sessão.
- Foram adicionados ajustes responsivos específicos para celular, tablet e desktop.
- O cache offline foi atualizado para `jornada-cacador-v77-study-experience`.

## Instalação resumida

1. Faça backup da pasta atual do projeto.
2. Copie os arquivos desta atualização sobre o repositório local.
3. Abra o Prompt de Comando na pasta do projeto.
4. Execute `node scripts/validate-project.mjs`.
5. Execute `node scripts/test-crud-contracts.mjs`.
6. Confira as alterações com `git status`.
7. Adicione, confirme e envie ao GitHub somente depois de revisar o resultado.

Esta atualização não exige nova migração SQL nem nova publicação das Edge Functions. Ela altera somente a experiência web/PWA e os arquivos de validação.
