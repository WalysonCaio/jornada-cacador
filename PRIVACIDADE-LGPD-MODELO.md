# Modelo de checklist para a Política de Privacidade (LGPD)

Isto NÃO é aconselhamento jurídico. É um roteiro, baseado no que o código faz hoje, para você preencher e, de preferência, revisar com um advogado. A página `privacidade.html` atual é curta e não traz vários itens que a LGPD (art. 9º) pede.

## 1. Quem é o controlador e como falar com ele
- Nome/razão social e CPF/CNPJ do responsável: **[PREENCHER]**
- E-mail de contato para privacidade: **[PREENCHER]**
- Encarregado (DPO) e canal público de atendimento (Art. 41, § 1º da LGPD): **privacidade@jornadadocacador.com.br**

## 2. Dados tratados (inventário feito a partir do código)
| Dado | Onde fica | Finalidade |
|---|---|---|
| Nome, e-mail, senha (hash) | Supabase Auth | conta e login |
| Progresso, XP, sequência, flashcards, erros | `user_state` | estudo e sincronização |
| PDFs enviados e texto extraído | Storage + `study_documents` | análise e resumos |
| Resumos, flashcards e questões gerados | `generated_study_content` | estudo |
| Redações (texto/imagem) e notas | `essay_submissions` | correção |
| Chave Gemini pessoal | Supabase Vault | análise com cota própria |
| Mensagens do chat, duelos, ranking, TAF | tabelas `hunter_*` | recursos de comunidade |
| Perfil público (nome de exibição) | `user_state.publicProfile` | ranking e biblioteca |

## 3. Bases legais, retenção e direitos
- Base legal por finalidade (execução do serviço, consentimento para compartilhamento): **[PREENCHER]**
- Prazo de guarda e o que acontece ao excluir a conta (a exclusão existe em `account-security`): **[PREENCHER]**
- Como o titular pede acesso, correção, portabilidade e exclusão: **[PREENCHER]**

## 4. Compartilhamento e operadores (precisam constar)
- Supabase (banco, autenticação, arquivos) e Cloudflare (hospedagem).
- **Google (Gemini)** — recebe trechos dos seus materiais para análise.
- **DeepSeek (China) e Groq (EUA)** — só aparecem se houver chave configurada; **se forem usados, é transferência internacional e deve ser informada**. Se não forem necessários, remova as chaves.
- **Biblioteca comunitária:** resumos e questões de materiais marcados como compartilhados ficam visíveis a outros usuários logados; hoje o padrão é compartilhar. Informe isso no envio do arquivo e na política, e deixe o botão de desligar visível.
- Não envie ao compartilhamento material protegido por direitos autorais de terceiros sem autorização.

## 5. Menores de idade e segurança
- Idade mínima aceita e tratamento de menores: **[PREENCHER]**
- Medidas de segurança (RLS, criptografia em trânsito, Vault para chaves): descreva em linguagem simples.
