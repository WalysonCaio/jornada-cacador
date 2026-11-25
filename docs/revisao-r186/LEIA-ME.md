# r186 — Questões mais leves e progresso entre aparelhos

23/11/2026. Base r185 `6491f31ba85947574a250d3ac44be075d7fabfcd`. O ZIP reúne as alterações desde o main r181 `52b236036f5207117918aeb84ddd1df89eacdd1d`, incluindo r182–r185. Não é necessário aplicar ZIPs históricos em sequência.

[Conferência e limites](CONFERENCIA.md) · [Validação](VALIDACAO.txt) · [Manifesto](MANIFESTO.json).

## Alterações

- Questões dividida em Resolver, Simulados, Central de Provas e Desempenho & Gargalos. Navegação e estado de preparação aparecem antes dos cálculos; cada painel monta seu conteúdo quando aberto. Filtros usam cache por contexto e revisão.
- Comando, alternativas e tópicos exclusivos passam a ter prioridade sobre o tema do texto de apoio. Conflitos entre Português e Direito ficam identificados, sem levar uma questão contraditória para uma disciplina escolhida.
- Questões sem texto necessário ou sem as assertivas romanas citadas nas opções ficam disponíveis para revisão, mas bloqueadas nos treinos. Correções de espaços de extração são conservadoras; não se inventa texto ausente.
- Treinar/Simulado de um PDF usa vínculos de proveniência e o mesmo conjunto elegível contado no cartão. Quantidade antiga do catálogo é identificada separadamente. Título parecido não autoriza juntar arquivos, contas ou cadernos.
- Alternativas têm seleção visível e confirmação Responder/Ver explicação abaixo delas. Gabarito pendente e enunciado incompleto são avisados antes da interação; não concedem pontuação de acerto.
- XP de novas atividades possui recibos de evento: sincronizar duas vezes não repete o crédito. A junção preserva resultados de sessões distintas, fases concluídas, maestria e os recibos de XP. Saldo legado sobreposto usa uma base conservadora, sem somar totais possivelmente repetidos.
- Teto de XP usa evidência histórica; deixar de manter a ofensiva não apaga créditos anteriores. Contagens inválidas, aliases duplicados de chefes e domínio emprestado de outro tópico/portal são rejeitados.
- Ofensiva, calendário e semana usam o fuso da conta (`settings.studyTimeZone`, padrão America/Sao_Paulo), preservando os dias históricos. Reparos no histórico ficam pendentes até confirmação do servidor.
- Sincronização volta a agendar envios após login com alterações pendentes; não indica sucesso quando há reparos ainda não enviados. Erros HTTP e falhas de armazenamento não viram sucesso de sincronização. Respostas tardias de outra conta/portal/reset não concedem bônus na tela atual.

A biblioteca mantém a política de compartilhamento existente. Manuais do Caçador continuam como ajuda, sem virar disciplina, fonte de treino ou recompensa.

## Aplicar pelo GitHub

O PR existente é https://github.com/WalysonCaio/jornada-cacador/pull/4 . Sua branch de origem conserva o nome `entrega/revisao-r184`, mas a proposta foi atualizada para r186. Há também a referência `entrega/revisao-r186`. A branch pessoal `melhorias-r184` é independente.

1. Abra o PR, confira Files changed, este relatório e as verificações.
2. Homologue os fluxos no navegador/celular. O PR permanece em rascunho para revisão; ele não atualiza o site enquanto não for integrado e publicado.
3. Depois da conferência, use Ready for review e Merge pull request.
4. Publique `dist` inteira no fluxo Cloudflare do projeto. Publicar código no GitHub e publicar o site são etapas distintas.

## Aplicar pelo ZIP no Windows

Baixe `entregas/r186/jornada-cacador-r186-alteracoes.zip`. Exporte um backup no app em cada aparelho antes da atualização. Extraia o ZIP **na raiz do código**, preservando `.git` e conferindo suas modificações locais. O ZIP é atualização do projeto; não deve ser importado como backup JSON no app.

Use Node.js 24 ou superior. Execute **um comando por vez**, pressionando Enter antes do seguinte. Não cole comandos em uma única linha.

```cmd
findstr /C:"r186" dist\sw.js
```

```cmd
git status
```

Para publicar pela sua própria branch, crie uma nova branch (se já a criou, mantenha a existente):

```cmd
git switch -c melhorias-r186
```

```cmd
npm ci --ignore-scripts
```

```cmd
npm test
```

```cmd
npm run test:sql
```

Se alguma verificação falhar, confira o erro antes de publicar. O pacote não apaga automaticamente os três arquivos acidentais antigos; o helper abaixo reconhece somente as três saídas rastreadas por conteúdo e seleciona suas exclusões. Ele preserva arquivos diferentes, links, `.swp` pessoais e `-r182`.

```cmd
node scripts\cleanup-repository-artifacts.mjs --stage
```

Selecione o código revisado, sem incluir automaticamente alterações pessoais de Android/desktop ou arquivos temporários:

```cmd
git add .github .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase package.json package-lock.json docs
```

```cmd
git diff --cached --stat
```

```cmd
git commit -m "fix(r186): questoes sob demanda e sincronizacao de progresso"
```

```cmd
git push -u origin melhorias-r186
```

Se a seleção estiver vazia e aparecer “no changes added”, não há alteração nesses caminhos para criar um novo commit. Confira `git log -1 --oneline` e a branch; isso não significa que o deploy foi feito. Não substitua por `git add .` para contornar a mensagem, pois isso incluiria arquivos alheios à atualização.

O PR #4 já reúne a entrega; não é necessário abrir outro PR com as mesmas alterações. Uma branch pessoal enviada não integra `main` automaticamente.

## Supabase, publicação e aparelhos

A r186 não acrescenta migração ou Edge Function. Se a r184/r185 já estava aplicada completamente, basta esta atualização do cliente. Saindo da r181, aplique os pré-requisitos de [r184](../revisao-r184/LEIA-ME.md), incluindo v110 e a função `material-gemini` atualizada. Leis oficiais dependem de v109 e `leis-oficiais`. O RPC `sync_user_state` depende da migração v47 já existente. Não reaplique migrações às cegas.

Com a CLI Cloudflare do seu projeto autenticada, na raiz:

```cmd
npx wrangler deploy
```

Depois feche e reabra as abas e o app instalado **nos dois aparelhos**. Uma aba antiga continua executando seu JavaScript antigo mesmo depois da atualização do service worker. Em Menu → Diagnóstico e backup → Verificar agora, a linha Aplicativo deve mostrar **r186**. Isso confere o código que aquela aba está executando; ver r186 somente no GitHub não confirma o deploy.

Na mesma conta e portal, toque em Minha conta → Sincronizar agora em cada aparelho, aguarde a confirmação e repita no primeiro aparelho para receber as atividades do segundo. Compare a revisão do servidor, o dia/fuso de estudo, o XP e os recibos no diagnóstico. Não apague o armazenamento para tentar resolver uma divergência: isso pode eliminar progresso ainda não enviado.

Se a revisão não avança, confira o texto de sincronização, sessão, rede e existência do RPC. O diagnóstico diferencia conteúdo carregado neste aparelho de quantidade definitiva no servidor. A r186 não promete reconstruir atividades antigas já perdidas por sobreposição e sem recibos.

## Questões antigas e reanálise dos PDFs

Não é necessário apagar ou regenerar tudo. As novas regras já protegem a seleção local das questões existentes. Na Central de Provas, abra Revisar PDF/reanálise em lote para preparar propostas, confira cobertura, disciplina, tópico, texto e gabarito e aplique as revisões autorizadas do documento. As regras de segurança da r184 preservam a base existente enquanto a análise não for aprovada/aplicada; documentos compartilhados de terceiros exigem o fluxo permitido de cópia/revisão.

A classificação é uma heurística e o gabarito de IA continua sugestão. Questões órfãs precisam de nova extração do PDF ou transcrição conferida do trecho ausente. Sem gabarito oficial acessível, mantenha a pendência e use explicações como apoio; não transforme concordância entre modelos em gabarito oficial.

Esta sessão não teve acesso à sua base privada nem executou reanálise dos seus 182 PDFs. As ferramentas para revisão foram corrigidas; a revisão factual de todos esses documentos depende dos arquivos e da execução autenticada no seu ambiente.

## Conferência no celular

Abra Resolver pela primeira vez após atualizar; confira se a tela de preparação aparece antes do catálogo e dos gráficos. Meça o tempo real até os filtros ficarem utilizáveis e registre aparelho, versão e tamanho da base. Teste Português com texto jurídico, revisão de questão sem itens I–IV, PDFs com quantidade antiga, chave pendente, confirmação de resposta, sair/retomar e troca de portal.

A suíte `npm run test:browser` foi atualizada para desktop e larguras 360/390/412 px e pode ser executada no seu ambiente ou pelo workflow manual Homologar navegador. Ela não mede sua base privada nem substitui o aparelho real. Leia os limites de execução no relatório de validação.
