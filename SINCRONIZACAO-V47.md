# Sincronização precisa — versão 47

## Problema corrigido

A versão anterior escolhia entre o estado local e o estado remoto comparando datas. Um celular com cache antigo podia salvar novamente uma ofensiva já apagada e, por ter uma data local mais nova, sobrescrever o notebook.

## Novo funcionamento

- O Supabase é a autoridade sobre a revisão atual.
- Cada sincronização aceita incrementa `server_revision`.
- Um aparelho só publica se estiver baseado na revisão atual.
- Em conflito, o estado do servidor vence e o aparelho desatualizado é atualizado.
- Redefinições recebem um `reset_epoch` crescente.
- Um estado anterior ao último `reset_epoch` nunca é aceito.
- O site consulta o servidor no login, ao ganhar foco, ao voltar do segundo plano, no evento `pageshow` e a cada 30 segundos enquanto estiver visível.
- Alterações locais são enviadas aproximadamente 900 ms depois de serem salvas.
- O painel de diagnóstico mostra a revisão conhecida pelo aparelho.

## Publicação

1. Execute `supabase/migrations/20261001_precise_device_sync.sql` no SQL Editor.
2. Publique `system-diagnostics` novamente.
3. Envie `dist/index.html`, `dist/sw.js`, `scripts/validate-project.mjs` e a migração ao GitHub.
4. Aguarde o Cloudflare e atualize com `Ctrl + F5`.
5. Abra primeiro o aparelho que contém o progresso correto.
6. Toque em **Minha conta > Sincronizar agora**.
7. Se deseja realmente zerar a ofensiva antiga, use **Redefinir progresso deste portal** nesse aparelho e confirme a senha.
8. Nos outros aparelhos, feche e abra o aplicativo ou toque em **Sincronizar agora**.

## Critério de teste

No diagnóstico, todos os aparelhos devem mostrar o mesmo número de revisão depois da sincronização. A ofensiva, histórico, missões concluídas e tempo estudado também devem coincidir.
