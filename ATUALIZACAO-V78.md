# Jornada do Caçador — Atualização 78

## Caderno Inteligente

A atualização adiciona uma quarta área em **Estudar** chamada **Caderno IA**.

Recursos:

- agrupamento dos materiais processados por disciplina;
- escolha de até cinco PDFs por consulta;
- guia de estudo fundamentado nas fontes selecionadas;
- Tutor que exige indicação de arquivo e página quando essa referência estiver disponível;
- cache local para não repetir chamadas idênticas;
- confirmação do consumo antes de chamar o assistente;
- quiz adaptativo usando questões já geradas, sem nova chamada de IA;
- painel de cobertura entre edital, resumos e questões;
- relatório estimado de lacunas por disciplina;
- limpeza do cache do Caderno Inteligente ao redefinir completamente o perfil.

## Controle de consumo

- Nenhuma geração é iniciada automaticamente.
- Guia de estudo: uma chamada do limite diário do assistente.
- Pergunta ao Tutor: uma chamada do limite diário do assistente.
- Quiz adaptativo: nenhuma chamada de IA.
- Uma combinação já processada de fontes e comando é recuperada do cache sem novo consumo.
- O contexto é limitado a 22 mil caracteres e cinco fontes.
- Não foram implementados mapa mental nem resumo em áudio.

## Infraestrutura

Esta versão não exige migração SQL nem nova publicação das Edge Functions. O Caderno Inteligente utiliza a função `assistente-pmpe` já existente, com DeepSeek principal e Groq como reserva.
