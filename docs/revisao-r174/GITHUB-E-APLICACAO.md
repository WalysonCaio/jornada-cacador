# Aplicar a revisão r174 e atualizar o GitHub

Seu repositório já existe: https://github.com/WalysonCaio/jornada-cacador. Não é necessário criar outro repositório nem usar `git init` novamente numa cópia já clonada.

## 1. Entenda os arquivos da entrega

- Projeto completo: baixe o ZIP da branch `entrega/revisao-r174` no GitHub. Ele contém os arquivos versionados do repositório; o APK histórico não foi recompilado nem homologado nesta revisão.
- `jornada-cacador-r174-alteracoes.zip`: somente arquivos novos/modificados desta revisão, com os mesmos caminhos do projeto. É a opção mais simples para aplicar sobre a base r173.
- `ALTERACOES-r174.patch`: diferença em relação ao commit de origem, para revisão técnica ou aplicação com Git.
- `AVALIACAO-r174.md`: análise detalhada, nota, correções, comparação e pendências.
- `VALIDACAO.txt`: comandos e resultados das verificações executadas.

**Esses ZIPs não são backups de progresso.** Não os envie ao botão “Importar backup” dentro do aplicativo. Extraia-os no computador e abra a pasta do projeto no seu editor.

## 2. Faça backup e prepare uma branch

Exporte o progresso pelo aplicativo, guarde uma cópia do projeto atual e faça backup do banco Supabase antes de alterar o ambiente remoto.

Se ainda não clonou o repositório, no terminal:

```bash
git clone https://github.com/WalysonCaio/jornada-cacador.git
cd jornada-cacador
git switch -c melhorias-r174
```

Se já tem a cópia local, abra o terminal nela, verifique `git status` e guarde alterações locais antes de atualizar. Crie a branch de revisão a partir da versão que deseja modificar. Não sobrescreva trabalho local sem comparar.

## 3. Aplique os arquivos

Extraia o ZIP de alterações e copie seu conteúdo para a raiz da cópia local, mantendo os caminhos `dist/`, `scripts/`, `supabase/`, `docs/` e `.github/`. Ative a visualização de arquivos ocultos se necessário. Preserve a pasta `.git` da sua cópia: ela contém o histórico.

Alternativa para quem usa patch, partindo do commit de origem limpo:

```bash
git apply --check CAMINHO/ALTERACOES-r174.patch
git apply CAMINHO/ALTERACOES-r174.patch
```

Se a conferência acusar conflito, compare os arquivos antes de aplicar. O patch foi feito para a base indicada no LEIA-ME; um repositório que mudou depois pode exigir resolução manual.

## 4. Execute as verificações locais

Instale Node.js 24 ou superior. Na raiz do projeto:

```bash
npm ci --ignore-scripts
npm test
npm run test:sql
```

Não é preciso instalar dependências de produção para servir o frontend estático. As dependências de desenvolvimento são usadas para SQL isolado e testes de navegador. O arquivo `package-lock.json` fixa suas versões.

Para homologar o navegador no seu computador:

```bash
npx playwright install chromium
npm run test:browser
```

O script cria seu próprio servidor local e bloqueia serviços externos. Não usa sua conta nem banco remoto. A execução dessa suíte ficou pendente no ambiente de revisão.

## 5. Envie a branch ao GitHub

```bash
git status
git diff --stat
git add .
git diff --cached --stat
git commit -m "Corrige filtros, gabaritos e recuperação de estudos na r174"
git push -u origin melhorias-r174
```

Confira os arquivos selecionados antes do commit. Não envie `.env`, senhas, tokens, chaves privadas, `node_modules` ou configurações locais de máquina. Preserve os arquivos de código e o lockfile.

No GitHub, abra **Compare & pull request** da branch para `main`. Confira a aba **Files changed** e os resultados de **Actions**. O workflow principal executa testes Node e SQL.

Para o navegador: **Actions → Homologar navegador (manual) → Run workflow**, selecione a branch `melhorias-r174` e execute. Se houver falha, consulte o log e o artefato `browser-failures`. Esse workflow é manual porque a suíte visual ainda precisa da primeira homologação real.

O procedimento de envio segue a [documentação oficial do GitHub](https://docs.github.com/pt/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github). Usar GitHub Desktop em vez do terminal é uma alternativa: adicione o repositório local, confira o diff, faça commit e use **Publish branch**.

## 6. Atualize o Supabase antes do frontend

**Ordem necessária:** backup → migração v107 → funções → frontend. Teste primeiro em homologação.

No SQL Editor do projeto Supabase correto, revise e execute o arquivo:

```text
supabase/migrations/20261113120000_v107_atomic_edital_topics.sql
```

Ele cria `replace_campaign_topics_atomic`, usada pela reanálise e recuperação do edital. Depende do esquema anterior com campanhas, documentos e tópicos atualizado. Se existirem migrações anteriores pendentes, confira o histórico e a ordem; não execute todos os SQL antigos sem revisão.

A exclusão segura de documentos também exige a migração v74, já existente no repositório. Se ela estiver ausente, a nova função informa o bloqueio e preserva o documento e os tópicos.

Publique estas quatro Edge Functions pelo fluxo Supabase que você utiliza:

```text
account-security
assistente-pmpe
edital-gemini
system-diagnostics
```

Se usa a CLI e já está autenticado, substitua `SEU_PROJECT_REF` pelo identificador do ambiente de destino:

```bash
supabase functions deploy account-security --project-ref SEU_PROJECT_REF
supabase functions deploy assistente-pmpe --project-ref SEU_PROJECT_REF
supabase functions deploy edital-gemini --project-ref SEU_PROJECT_REF
supabase functions deploy system-diagnostics --project-ref SEU_PROJECT_REF
```

Esta entrega não altera seus secrets. Não coloque a service role ou as chaves dos provedores no frontend. A presença do SQL no GitHub não significa que ele foi aplicado no banco.

## 7. Publique a aplicação web e homologue

O `wrangler.jsonc` já aponta para `dist/`. Publique essa pasta pelo seu fluxo Cloudflare existente. Se usa Wrangler, confira a conta e o nome do Worker antes do comando de implantação. Não é necessário criar outro Site nem trocar o domínio para aplicar este pacote.

O service worker usa cache r174 e inclui o módulo `question-session-store.js`. Abra a aplicação atualizada e confirme o novo comportamento; fechar e reabrir pode ser necessário para substituir um cliente antigo já aberto.

Faça uma sessão de homologação com dados de teste:

1. Português com tópico específico: nenhuma questão de outra disciplina; filtro sem correspondência deve mostrar zero.
2. Troca de banca e portal: lista, contagem e teoria consistentes.
3. Questão sem gabarito: pendência visível; sugestão IA não pontua como gabarito confirmado.
4. Correção pessoal de chave: referência, histórico e preservação após recarregar.
5. Treino: responder, continuar depois, fechar/reabrir e retomar com a mesma alternativa marcada.
6. Simulado: marcar resposta, eliminar alternativa, continuar depois e retomar com menos tempo restante.
7. Edital: reanálise válida e falha de gravação em homologação, sem apagar o mapa anterior.
8. Manuais: quatro guias acessíveis, sem disciplina ou flashcards de concurso gerados a partir deles.
9. Biblioteca: controles e compartilhamento preservados.
10. Duas contas: conteúdo e retomadas isolados; logout/reset encerra a sessão local.

Somente depois de revisar o PR, os testes e a homologação, faça o merge conforme seu processo. Os aplicativos Android/Windows carregam a aplicação hospedada, mas seus projetos e builds também precisam de verificação própria antes de distribuir novos instaladores.

## Recuperação

Se o frontend apresentar regressão, use a versão anterior do seu fluxo Cloudflare e mantenha o backup. A migração v107 é aditiva; não remova funções SQL ou reverta tabelas para tentar recuperar um problema visual. Não use redefinição de perfil como procedimento de atualização.

A entrega está na branch `entrega/revisao-r174`, com código revisável e ZIP de alterações em `entregas/r174/`. A branch principal não foi atualizada. Nenhuma implantação do aplicativo ou migração remota foi realizada. A aplicação no seu ambiente e o merge seguem o seu processo.
