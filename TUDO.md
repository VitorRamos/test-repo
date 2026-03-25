# TUDO (Pendências e Melhorias)

- Implementar fluxo de pagamento (escrow), incluindo `pending_payment` e liberação ao confirmar código.
- Adicionar migrations para novas colunas de `lessons` e tabela `reviews` (incluindo `is_public`).
- Exibir informações do aluno para o instrutor nas listas de aulas (nome/contato).
- Bloquear confirmação de código fora do horário da aula (regra de data/horário).
- Criar testes E2E para fluxo de agendamento, confirmação, cancelamento e validação de código.
- Adicionar controle de disponibilidade do instrutor e evitar conflitos de horário.
- Mostrar disponibilidade no card público do instrutor.
- Impedir overlap entre slots de disponibilidade do próprio instrutor.
- Permitir múltiplos horários no mesmo dia com edição inline.
- Implementar notificações (email ou in-app) para confirmações/cancelamentos.
- Remove unused apis (update review)
