# Revisão r175 — Manuais do Caçador como ajuda da plataforma

Base: `main` no commit `abf74e218e9c16716f1f11b5d200bee8e5ddcfcc`, versão r174. Revisão de 13/11/2026.

## Correção da imagem enviada

Na r174, os manuais ainda eram inseridos em `BASIC_SUMMARIES` e `ALL_SUMMARIES`. Por isso apareciam dentro de Estudar, recebiam a contagem de resumos e o selo “GERADO POR IA”. Apenas excluí-los das questões não atendia ao requisito de mantê-los fora do material de estudos.

A r175 separa os quatro guias em um catálogo próprio. Acesse **Menu → Manuais do Caçador**. A janela tem navegação entre os guias, leitura e fechamento, com retorno de foco ao Menu.

## O que mudou

- Os guias deixam de ser resumos e não possuem disciplina, tópico do edital ou ações de geração de conteúdo.
- O atalho antigo e a categoria dos manuais saem de Estudar. Os quatro textos permanecem disponíveis como ajuda.
- Guias identificados como legados são retirados das listas de resumos, flashcards, questões e disciplinas em memória. O cache também é filtrado ao ler e salvar, para que uma recarga não os reinsira.
- O Instrutor IA e o Caderno IA deixam de utilizar os guias como material de referência para o estudo de disciplinas.
- A leitura de ajuda não chama IA, não concede XP, não cria missões e não marca conteúdo como estudado. Revisões e retomadas antigas identificadas como ajuda também ficam fora das sessões de estudo, preservando o histórico salvo.
- O detector reconhece a identidade dos guias da plataforma. Materiais legítimos como “Manual de Redação Oficial” e “Manual de Direito Penal” continuam sendo materiais de estudo.
- O texto dos guias foi revisto: retirados percentuais sem fonte, receitas rígidas de distribuição de tempo, promessas de XP e generalizações apresentadas como regra de banca ou memória.
- A navegação principal recebeu fundo opaco para impedir que textos de abas rolando por baixo apareçam através dela. A conferência visual desse ajuste continua pendente.
- Na revisão ativa, removido outro preenchimento silencioso com questões de outras disciplinas quando havia menos de três itens para a disciplina escolhida.

O compartilhamento e os controles da biblioteca foram preservados. Não foram excluídos documentos do usuário nem redefinido o progresso. A filtragem atua nos artefatos reconhecidos como guias da plataforma, sem fazer limpeza remota de dados.

## Como aplicar

1. Guarde uma cópia do seu código atual. Extraia `jornada-cacador-r175-alteracoes.zip` sobre a pasta do projeto, preservando os caminhos dos arquivos e sua pasta `.git`.
2. Com Node.js 24+, execute `npm test`. Se precisar preparar as dependências de desenvolvimento da r174, use `npm ci --ignore-scripts`.
3. Publique a pasta `dist` completa pelo seu fluxo Cloudflare. Inclua os novos arquivos `hunter-manuals.js` e `hunter-manuals.css`, além dos arquivos alterados.
4. O service worker usa cache r175. Atualize a página; se um cliente antigo continuar aberto, feche e reabra a PWA após a atualização.
5. Confira: Estudar sem categoria/atalho dos manuais; Menu com os quatro guias; filtros por disciplina; retomada de treino e biblioteca preservados.

**Não há nova migração SQL ou função Supabase nesta r175.** Se ainda não aplicou a parte de banco/funções da r174, siga o guia daquela revisão. Subir estes arquivos no GitHub não executa migrações nem publica o aplicativo por si só.

Para enviar suas alterações locais ao `main`, confira os arquivos antes do commit e execute um comando por vez:

```bash
git status
git add dist scripts docs README.md package.json package-lock.json
git diff --cached --stat
git commit -m "fix(r175): separa manuais da plataforma do material de estudos"
git push origin main
```

Esse comando de adição não inclui arquivos acidentais na raiz com nomes estranhos. O ZIP é atualização de código; extraia-o na pasta do projeto. O importador de backup dentro do aplicativo é destinado ao progresso do usuário.

## Verificação e limites

Os testes executam funções reais em Node/VM, além de uma simulação de DOM para o menu, diálogo, seleção e retorno de foco. Há regressões de cache legado, reinicialização, contextos de IA, materiais legítimos chamados Manual e revisão com poucas questões.

A suíte Playwright foi atualizada para abrir os guias pelo Menu e verificar que não aparecem em Resumos nem filtros. Sua execução visual permanece pendente no workflow manual **Homologar navegador (manual)**. A ferramenta `cua_repl.js` não está disponível neste ambiente e a orientação Sites para este ambiente gerenciado exige pular browser QA nessa condição.

Não foram executadas chamadas autenticadas na conta, alterações no banco, implantação Cloudflare ou compilação de aplicativos nativos. A entrega é código para aplicar e homologar, com resultado dos testes em `VALIDACAO.txt`.
