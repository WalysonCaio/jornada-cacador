# Hotfix Gemini 400 — v65.2

O relatório do documento **ACENTUAÇÃO GRÁFICA** confirma que o arquivo chegou à etapa `generation` usando o fluxo `direct-stable`. Portanto, armazenamento, autenticação e fila funcionaram; a recusa ocorreu no `generateContent` do Gemini.

## Correção

- O aplicativo continua tentando primeiro o File API, adequado para arquivos grandes.
- Se o Gemini devolver HTTP 400, PDFs de até 14 MB são reenviados automaticamente como `inline_data` em base64.
- Esse é o formato utilizado nas primeiras versões que processavam os materiais corretamente.
- A tentativa inline também possui fallback de esquema estruturado para JSON flexível.
- A mensagem de erro agora inclui o motivo seguro devolvido pelo Gemini, sem expor a chave da API.

## Publicação

```bat
npx supabase functions deploy material-gemini --project-ref jybislbbblyjsrcdegjt
```

Não há SQL novo e não é necessário publicar outras funções.

Depois, clique novamente em **Gerar conteúdo** no PDF já salvo.
