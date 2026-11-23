# r187 — Painéis estáveis e integridade das questões

23/11/2026. Desenvolvida sobre r186 `7519ac5970b7accc7364cd685018f50d2d605fff`. O ZIP completo reúne alterações desde main r181 `52b236036f5207117918aeb84ddd1df89eacdd1d`, incluindo r182–r186. Não aplique todos os ZIPs históricos em sequência.

[Conferência do relato e limites](CONFERENCIA.md) · [Validação](VALIDACAO.txt) · [Manifesto](MANIFESTO.json).

## O que mudou

- **Questões sem voltar ao carregamento a cada atualização:** “Preparando este painel…” fica reservado à primeira montagem ou troca de conta/portal/reset. Atualizações do mesmo contexto preservam painel, filtros, foco, detalhes abertos e rolagem. Chamadas repetidas são agrupadas; cópias iguais dos dados não provocam nova montagem.
- **Sidebar acompanha a tela real:** o destaque deriva de `.view.active`, incluindo restauração inicial, navegação interna e hooks substituídos. Navegar não reinicia todos os módulos nem executa a auditoria global de questões.
- **Atualizações de conteúdo sem sincronização desnecessária:** carregadores principal/efetivo, biblioteca comunitária e realinhamento distinguem fontes iguais de mudanças reais. Mantêm os objetos e a tela quando nada mudou; dados novos, revisões e progresso legítimos continuam atualizando. Respostas antigas não atravessam conta, portal ou redefinição.
- **Contagens explicadas:** Montar batalha mostra quantas questões estão no aparelho e quantas estão prontas no recorte, em revisão, sem gabarito validado, anuladas ou fora dos filtros/modo. Cada registro entra em um único motivo; o resumo não cria questões nem libera as bloqueadas.
- **Texto de PDF:** reconstrução usa posição, avanço e espaços dos fragmentos, em vez de colocar um espaço entre todos os itens. Correções tipográficas são conservadoras: exemplos conhecidos como “S empre”, “responsáve l”, “ilegal idade” e hífens de ênclises/compostos. Artigos A/O/E, palavras desconhecidas, matemática, código e espaços reais são preservados.
- **Alternativa com outra questão ou gabarito dentro:** corte de apresentação somente quando há limite confiável. O trecho cru, a cauda, a fonte, o gabarito anterior e a revisão pessoal ficam preservados. A questão fica bloqueada até conferir o PDF; caudas ambíguas não são cortadas por suposição. O parser não transforma um `e)` engolido em uma nova alternativa válida.
- **Assuntos mais rigorosos:** competências dos arts. 21–24 saem de Direitos Individuais/Art. 5º; Art. 22, Art. 24, direitos sociais e remédios específicos não são tratados como equivalentes. Treinos e reforço de erros respeitam os filtros; retomadas usam o contexto original salvo quando disponível.
- **Banca do enunciado:** prefixo explícito e reconhecido, como `(FUNCAB)`, prevalece sobre padrão herdado de arquivo/portal. Divergência com decisão humana é preservada para revisão. A origem também é usada nas métricas por banca.

A biblioteca mantém sua política de compartilhamento. Manuais do Caçador continuam na ajuda, sem virar material de disciplina ou fonte de XP. A r187 não reescreve estatísticas históricas nem muda gabaritos no banco remoto automaticamente.

## Aplicar pelo GitHub

A proposta existente é https://github.com/WalysonCaio/jornada-cacador/pull/4 . Sua origem continua com o nome `entrega/revisao-r184`, mas inclui r187. Também existe `entrega/revisao-r187`. Sua branch pessoal `melhorias-r184` é outra referência e não é sobrescrita pela entrega.

1. Confira Files changed, relatório e verificações do PR.
2. Faça a homologação visual e com seus dados no ambiente de teste. O PR fica em rascunho enquanto essa etapa não estiver concluída.
3. Depois use Ready for review e Merge pull request.
4. Publique `dist` inteira pelo fluxo Cloudflare do projeto. Commit no GitHub, integração em main e publicação do site são etapas distintas.

## Aplicar pelo ZIP no Windows

Exporte um backup no app em cada aparelho antes de atualizar. Baixe `entregas/r187/jornada-cacador-r187-alteracoes.zip` e extraia **na raiz do código**, preservando `.git` e conferindo alterações locais. Este ZIP é código; não é um backup JSON para importar dentro do aplicativo.

Use Node.js 24 ou superior. Execute **cada comando separadamente**, pressionando Enter antes do próximo. Não cole vários comandos na mesma linha.

```cmd
findstr /C:"r187" dist\sw.js
```

```cmd
git status
```

Crie a branch se ela ainda não existe:

```cmd
git switch -c melhorias-r187
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

Se falhar, confira o erro antes de publicar. O helper abaixo remove/seleciona somente três saídas acidentais antigas reconhecidas por conteúdo; preserva outros arquivos, links, `.swp` pessoais e `-r182`. Se as exclusões já vieram pelo Git, não há nada a remover.

```cmd
node scripts\cleanup-repository-artifacts.mjs --stage
```

Selecione os caminhos revisados, sem incluir automaticamente mudanças pessoais de Android/desktop ou arquivos temporários:

```cmd
git add .github .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase package.json package-lock.json docs
```

```cmd
git diff --cached --stat
```

```cmd
git commit -m "fix(r187): estabiliza paineis e protege integridade das questoes"
```

```cmd
git push -u origin melhorias-r187
```

Se a seleção está vazia, não existe alteração nesses caminhos para criar outro commit. Confira branch e `git log -1 --oneline`; não use `git add .` para contornar a mensagem. Enviar uma branch pessoal não integra main. O PR #4 já reúne a entrega; não precisa abrir outra proposta com os mesmos arquivos.

## Supabase e publicação

A r187 não acrescenta migração SQL ou Edge Function. Se r184–r186 estavam completamente aplicadas, esta é atualização do cliente. Se está saindo da r181, confira os [pré-requisitos r184](../revisao-r184/LEIA-ME.md), incluindo v110 e `material-gemini` atualizada; leis oficiais continuam dependendo de v109/`leis-oficiais` e sincronização do RPC v47. Não reaplique migrações sem conferir o que seu banco já tem.

Com a CLI Cloudflare do seu projeto autenticada, na raiz:

```cmd
npx wrangler deploy
```

Feche e reabra as abas e o app instalado **no PC e no celular**. Uma aba antiga continua executando o JavaScript antigo mesmo quando o service worker já atualizou. Em Menu → Diagnóstico e backup → Verificar agora, Aplicativo deve mostrar **r187**. Ver a versão apenas no GitHub não comprova o deploy.

Não limpe os dados do navegador para tentar corrigir divergências de XP: pode haver progresso ainda não enviado. As proteções de XP/ofensiva da r186 permanecem.

## Preciso regenerar todas as questões?

Não apague nem regenere o banco inteiro. A normalização de apresentação e os bloqueios de integridade já se aplicam aos registros antigos na leitura. Questões com conteúdo colado ficam fora do treino e conservam evidências para revisão.

Na Central de Provas, use Revisar PDF/reanálise do portal ou de todos os seus portais. A leitura nova usa a geometria corrigida. Confira disciplina, assunto, banca, alternativas, cobertura e gabarito antes de aplicar a proposta. A versão atual é preservada enquanto a proposta não for aplicada; pendências continuam bloqueadas depois de aplicá-la.

No relatório baixável, `text_integrity_review` conserva o original e os trechos suspeitos. Cortar um cabeçalho na apresentação não comprova o gabarito nem recupera automaticamente a questão seguinte. Se faltam numeração, assertivas, imagem ou trecho do PDF, será necessário conferir a página e corrigir a extração. Gabarito de IA continua sugestão quando não há validação/fonte confiável.

Esta sessão não reanalisou seus PDFs privados nem aplicou alterações no banco real. O fluxo foi corrigido e testado com cenários reproduzíveis; a conferência factual do seu acervo exige os documentos e execução autenticada no seu ambiente.

## Homologação recomendada

Com a mesma conta/portal, mantenha Resolver aberto durante sincronizações e atualização da biblioteca; confira filtro, foco, scroll, sidebar e contagens. Teste os exemplos dos prints, Português com texto jurídico, CF art. 24 fora de Art. 5º, prefixo FUNCAB, questão com cauda colada, sem gabarito, sair/retomar e mudança de conta/portal. Troca de contexto deve limpar dados antigos; atualização do mesmo contexto deve preservar a tela.

`npm run test:browser` e o workflow manual Homologar navegador ficam disponíveis para seu ambiente. Leia a validação: não foi executada homologação visual no navegador ou no celular nesta sessão.
