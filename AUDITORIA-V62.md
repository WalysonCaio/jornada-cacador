# Auditoria final — Jornada do Caçador v62

Data: 03/10/2026

## Correções desta revisão

- O cronômetro não volta mais de `49:xx` para `50:00` durante a sincronização.
- Ao retomar uma sessão salva, o servidor nunca pode aumentar o tempo local restante.
- O cronômetro continua salvo entre atualização da página e troca de aparelho.
- O service worker não armazena respostas do Supabase, PDFs privados ou APIs externas.
- O PWA aceita retrato e paisagem em celular e tablet.
- O instalador Windows aponta para `https://jornada.wcaio.workers.dev`.
- `index.html` e `sw.js` são entregues sem cache persistente para reduzir versões antigas.
- Os diagnósticos usam o dia de São Paulo e mostram o limite de 10 análises concluídas.
- Falha de PDF não consome a cota de análises concluídas; nova tentativa fica pendente.
- A exclusão de redação confirma a remoção no Storage antes de apagar o registro.
- Se o cadastro de uma redação falhar após o upload, o arquivo órfão é removido.
- O limite de fallback de PDF foi uniformizado em 10 análises concluídas por dia.

## Regras verificadas no código

- Um único edital ativo por portal, reforçado também no banco de dados.
- Edital gera mapa e missões; material de estudo gera resumos, flashcards e trilhas.
- Ordem pedagógica e pré-requisitos fazem parte do mapa criado pelo edital.
- Missão diária permanece estável e só é trocada por ação explícita.
- Ofensiva exige missão concluída e pelo menos 50 minutos de estudo.
- Trilha e batalha usam conjuntos separados e embaralham alternativas.
- Erros alimentam revisão, urgência e caderno de erros.
- Exclusões e redefinições sensíveis exigem confirmação da senha atual.
- Corações da trilha têm recuperação temporizada.

## Validações executadas

- Sintaxe do JavaScript principal, melhorias, service worker e aplicativo desktop.
- IDs HTML duplicados e referências a elementos inexistentes.
- Busca por chaves privadas nos arquivos públicos.
- Regras de segurança do cache e cabeçalhos HTTP.
- Modelo do cronômetro para retomada local, remota e sessão nova.
- Integridade do pacote ZIP final.

## Limitações honestas da auditoria

- Chamadas reais ao Gemini, Groq e ao projeto Supabase dependem das suas chaves, cotas e dados de produção; não foram consumidas na validação local.
- O navegador automatizado não estava instalado neste ambiente. A responsividade foi revisada no CSS e na estrutura, mas o teste visual final deve ser feito no seu celular.
- Conteúdo jurídico e questões geradas por IA devem continuar exibindo fonte e ser conferidos quando forem decisivos para o estudo.
- O `dist/index.html` ainda é grande e contém camadas históricas. Está validado, mas uma futura refatoração em módulos reduzirá o custo de manutenção. Não recomendo fazer essa mudança antes de alguns dias de uso estável.

## Teste de aceitação recomendado

1. Inicie o foco, espere passar de `49:30`, atualize a página e confirme que não voltou a 50 minutos.
2. Pause no celular e retome no computador.
3. Envie um PDF válido e um inválido; somente o concluído deve consumir a cota.
4. Abra uma disciplina no celular, responda uma questão e avance.
5. Confirme que um edital não cria resumos e que um material não substitui o edital.
6. Reabra o aplicativo instalado e confira no diagnóstico a versão 62.
