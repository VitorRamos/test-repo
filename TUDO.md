# TUDO (Pendências e Melhorias)

- Implementar fluxo de pagamento (escrow), incluindo `pending_payment` e liberação ao confirmar código.
- Gerar e armazenar códigos de aula de forma persistente e segura (ainda sem migrations).
- Criar tela de avaliação do instrutor, desbloqueada apenas após validação do código.
- Exibir informações do aluno para o instrutor nas listas de aulas (nome/contato).
- Bloquear confirmação de código fora do horário da aula (regra de data/horário).
- Criar testes E2E para fluxo de agendamento, confirmação, cancelamento e validação de código.
- Adicionar controle de disponibilidade do instrutor e evitar conflitos de horário.
- Implementar notificações (email ou in-app) para confirmações/cancelamentos.
