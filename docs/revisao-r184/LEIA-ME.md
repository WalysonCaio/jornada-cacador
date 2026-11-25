# r184 — revisão de PDFs, disciplinas e responsividade

Entrega de 20/11/2026. Incorpora r182/r183 e foi construída sobre `5fdb99bab539700f6201e4faaf54076838e758cb`. O pacote de alterações inclui todos os arquivos necessários desde o `main` r181 examinado (`52b236036f5207117918aeb84ddd1df89eacdd1d`).

[Correções e limites](REVISAO.md) · [Validação](VALIDACAO.txt) · [Hashes](MANIFESTO.json).

A biblioteca compartilhada permanece com a política existente. Os Manuais do Caçador continuam como ajuda, fora das disciplinas e do material de estudo.

## Preciso regenerar todas as questões?

Use a **reanálise do PDF original**, com comparação e proposta, antes de substituir o banco inteiro. Gerar outra prova por IA pode mudar enunciados, alternativas e gabaritos. A r184 impede esse caminho para provas/simulados.

O novo fluxo relê o arquivo salvo, compara enunciado e alternativas, identifica disciplina/assunto, preserva revisões pessoais e apresenta pendências. Ele não usa IA para reescrever a prova. Gabarito ausente continua pendente; explicação gerada não equivale a uma resposta confirmada.

**Os PDFs da sua conta ainda não foram reanalisados nesta sessão.** A ferramenta foi implementada e testada com dados simulados. Para processar seus arquivos reais, aplique a versão e execute o lote dentro da conta, seguindo os passos abaixo.

## 1. Aplique os arquivos

Baixe `entregas/r184/jornada-cacador-r184-alteracoes.zip` e extraia na raiz da sua cópia do projeto, preservando `.git`. Faça uma cópia da pasta atual e confira diferenças se houver alterações posteriores. O ZIP atualiza código; **não é um backup para importar no aplicativo**. Não precisa aplicar separadamente os ZIPs r182/r183.

Para conferir a entrega em uma pasta separada:

```bash
git clone --branch entrega/revisao-r184 https://github.com/WalysonCaio/jornada-cacador.git jornada-cacador-r184
cd jornada-cacador-r184
npm ci --ignore-scripts
npm test
npm run test:sql
```

Requer Node.js 24 ou superior. Os testes SQL são locais e não alteram seu Supabase.

## 2. Atualize o Supabase antes do frontend

Tenha backup e confira as migrações aplicadas no ambiente de destino. A nova migração é:

```text
supabase/migrations/20261120010000_v110_document_question_reviews.sql
```

Ela cria as propostas privadas de revisão, os RPCs de comparação/aplicação atômica e a primeira gravação segura de materiais. Exige a estrutura existente de campanhas, documentos e `generated_study_content`, incluindo as colunas de proveniência da v101. Não substitui nem executa automaticamente as migrações anteriores.

Se ainda não aplicou a revisão r182, confira também v107 (edital), v108 (privacidade) e v109 (leis), conforme os nomes completos e pré-requisitos do [guia r183](../revisao-r183/LEIA-ME.md). Há duas migrações históricas v106 de finalidades distintas; não rode todos os SQLs antigos indiscriminadamente.

Depois da v110, publique a função **material-gemini** atualizada. Pelo painel Supabase, substitua o `index.ts` inteiro pelo arquivo:

```text
supabase/dashboard/material-gemini/index.ts
```

Essa cópia é autocontida. Não apague imports isolados. Pela CLI autenticada, a alternativa é:

```bash
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
```

Confira que o identificador corresponde ao seu ambiente. Mantenha autenticação e Secrets no servidor. A r184 não exige republicar as outras seis funções por mudança de lógica. A importação de leis da r183 continua dependendo de `leis-oficiais` publicada.

## 3. Publique o frontend

Publique **dist completa**, incluindo `question-review.js`, `ui-r184.css`, módulos, JSON e service worker. O cache é r184. Use o fluxo Cloudflare existente; pela CLI autenticada, na raiz:

```bash
npx wrangler deploy
```

Feche e reabra o aplicativo para receber a versão. GitHub atualizado, migração SQL e deploy de função são etapas distintas.

## 4. Reanalise seus PDFs

1. Entre na sua conta e aguarde a sincronização.
2. Abra **PDFs & Biblioteca** e expanda **Conferir e reanalisar questões dos PDFs**.
3. Escolha **Reanalisar PDFs deste portal** ou **Reanalisar todos os meus portais**. A lista inclui arquivos seus classificados como prova/simulado e materiais/anotações cujo título identifica prova, simulado ou questões. Não acessa documentos privados de outra conta.
4. O lote relê cada original no Storage, ignorando o texto em cache. Processa um PDF por vez e permite **Pausar após este PDF**. Não aplica automaticamente as propostas.
5. Confira os resultados de cada arquivo: questões extraídas, correspondências, novas, antigas não localizadas, classificações pendentes e divergências de gabarito.
6. Use **Baixar relatório completo** para examinar todos os enunciados, alternativas, números, páginas, disciplinas, assuntos e situação das chaves. A tela limita a comparação resumida para não montar milhares de linhas de uma vez.
7. Compare com o PDF, marque a confirmação da proposta e clique **Aplicar esta proposta**. A versão anterior dos registros fica guardada na proposta privada, disponível no relatório exportado. A substituição acontece em uma transação; mudança do conteúdo ou das revisões pessoais desde a comparação exige nova reanálise.
8. Propostas salvas podem ser recuperadas pelo botão **Recuperar propostas pendentes**. A consulta mostra as 100 mais recentes, sem confundi-las com todo o histórico.

### Quando a revisão bloqueia

- **Caderno ambíguo:** informe o caderno correto no campo do PDF e reanalise. Tipo 1 não é escolhido automaticamente nem confundido com Tipo 10.
- **Sem gabarito:** a extração pode ser guardada, mas não ganha uma alternativa correta artificial. Use o fluxo existente **Adicionar gabarito depois** quando houver fonte conferível. O novo lote não incorpora automaticamente um arquivo separado que tenha ficado selecionado no formulário de upload.
- **PDF digitalizado ou páginas com falha/limite:** aplique OCR ou corrija o arquivo e tente novamente. Extração parcial não substitui o conteúdo ativo.
- **Páginas sem texto:** confira o original. A continuação exige confirmação explícita de que são páginas em branco; páginas com imagens/questões precisam de OCR ou conferência apropriada.
- **Questão visual sem figura:** permanece pendente de conferência no PDF e fora do treino da disciplina. A r184 não afirma ter transcrito imagens.
- **Questão antiga não localizada:** permanece guardada, marcada para conferência e fora dos treinos; não é apagada como se fosse uma duplicata comprovada.
- **Classificação ambígua:** permanece pendente até conferir na fila de revisão de questões. Referência à Constituição, por exemplo, não basta para concluir que um item de Administrativo pertence a Constitucional.
- **Arquivo com categoria/título incorretos:** confira sua identificação antes de incluí-lo. A versão não converte automaticamente apostilas e editais em provas.

O histórico de respostas/XP não é apagado nem recalculado retroativamente. A nova classificação vale para os próximos estudos; indicadores históricos continuam representando os registros da época. Uma revisão pessoal recente tem prioridade e não deve ser sobrescrita pela heurística.

## 5. Passo a passo do GitHub

Se usar a branch pronta `entrega/revisao-r184`, o código já foi enviado: compare-a com `main` e use o pull request desta entrega. Confira Files changed e aguarde **Validar projeto** antes de integrar.

Se extraiu o ZIP na sua pasta local, no CMD execute um comando por vez, sem comentários com `#`:

```cmd
cd "C:\Users\Walyson Caio\Documents\jornada-cacador"
git status
git switch -c melhorias-r184
git diff --stat
git add .github .gitignore README.md GUIA-UNIFICADO.md dist scripts supabase package.json package-lock.json docs
git diff --cached --stat
git commit -m "fix(r184): revisao segura de PDFs, disciplinas e responsividade"
git push -u origin melhorias-r184
```

Se a branch já existe, use `git switch melhorias-r184`. Não execute `git init` de novo. Confira os arquivos selecionados e não envie `.env`, chaves ou dados pessoais. Se houver divergência no push, confira o histórico antes de integrar; não use `--force` como solução automática.

No GitHub, abra Compare & pull request de `melhorias-r184` para `main`, confira e integre após os testes. Configure a regra de proteção do branch para exigir a verificação; a existência do workflow não liga essa configuração automaticamente.

## 6. Homologue no seu ambiente

Confira tema claro/escuro, leitores e botões em 320/360/390/412 px, tablet e desktop. Teste um PDF com gabarito, outro sem chave, um com dois cadernos e um com página digitalizada. Responda uma questão antes de reanalisar para conferir preservação do histórico. Teste também troca de conta/portal durante a leitura.

A suíte de navegador existente pode ser executada no seu computador ou workflow manual:

```bash
npx playwright install chromium
npm run test:browser
```

A validação de navegador não foi executada nesta sessão pelas condições descritas em `VALIDACAO.txt`. Não foram executados SQL remoto, deploy Supabase/Cloudflare, APK/EXE ou merge automático em `main`.
