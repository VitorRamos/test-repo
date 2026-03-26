# TUDO (Pendências e Melhorias)

- Implementar fluxo de pagamento (escrow), incluindo `pending_payment` e liberação ao confirmar código.
- Adicionar migrations para novas colunas de `lessons` e tabela `reviews` (incluindo `is_public`).
- Exibir informações do aluno para o instrutor nas listas de aulas (nome/contato).
- Bloquear confirmação de código fora do horário da aula (regra de data/horário).
- Impedir overlap entre slots de disponibilidade do próprio instrutor.
- Permitir múltiplos horários no mesmo dia com edição inline.
- Implementar notificações (email ou in-app) para confirmações/cancelamentos.
- Cancelar automaticamente pedidos pendentes conflitantes quando uma aula é confirmada.
- Adicionar testes E2E para disponibilidade inválida, conflitos na confirmação e horários indisponíveis.
- Revisar ordenação e UX das listas de aulas do instrutor (pendentes, confirmadas, concluídas).
- Exibir disponibilidade pública do instrutor de forma segura e resumida, sem expor dados desnecessários.
- Paginal inicial do instrutor e a painel (tambem renomear o painel)