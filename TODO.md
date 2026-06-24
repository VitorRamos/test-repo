# TODO (Pendências e Melhorias)

## Concluído

- Confirmar ao cancelar uma aula (instrutor).
- Filtro padrão em `My Bookings` definido para `all`.
- Validar CPF, email e licença DETRAN.
- Unificar disponibilidade, solicitações e aulas confirmadas em um calendário interativo no dashboard do instrutor.
- Reutilizar a visualização em calendário em `My Bookings`.
- Permitir seleção múltipla e drag-select no calendário do instrutor.
- Publicar disponibilidade direto pela agenda, sem formulário separado.
- Agrupar disponibilidades selecionadas por faixa de horário e intervalos de datas para remoção.
- Exibir erro inline ao validar código inválido na agenda do instrutor.
- Compactar a agenda para mostrar calendário e painel lateral ao mesmo tempo.
- Mover ações rápidas da agenda para o topo do painel lateral.
- Adicionar filtro de seleção na agenda do instrutor (`Com eventos`, `Disponibilidades`, `Solicitações e aulas`).
- Atualizar `tests/e2e.py` para o novo fluxo da agenda e melhorar reuso de contas.
- Separar a agenda do instrutor em abas (`Disponibilidades`, `Solicitações`, `Confirmadas`) com ações por contexto.
- Estabilizar o layout do painel lateral da agenda ao trocar abas e seleção de dias.
- Corrigir regras de ações em massa na agenda (`Confirmar todas` / `Cancelar todas`) por aba.
- Melhorar filtros dos instrutores com autocomplete na busca da Home.
- Manter filtros da Home em tempo real sem causar salto de scroll ao digitar com a lista já rolada.
- Mostrar instrutores que solicitei no card da tela inicial.
- Em agendamentos ao clikar no instructor deve ir para o card dele
- Esses cards de stats podem ir para o card Ganhos em instrutor e nomear esse card de outra coisa que melhor represente
- Confirmar ao aceitar uma aula que ira cancelar outra devido ao overlap (criar um test para isso)
- Exibir informações do aluno para o instrutor nas listas de aulas (nome/contato).
- Limpar canceladas, instrutor e aluno.
- Expandir E2E para drag-select no calendário, navegação entre abas da agenda, filtro de seleção da agenda e remoção agrupada de disponibilidades.

## Em PR (remoto `instructor-main` em VitorRamos/test-repo)

- Implementar fluxo de pagamento (escrow), incluindo `pending_payment` e liberação ao confirmar código. → PR #2 `feat/payment-escrow`
- Bloquear confirmação de código fora do horário da aula (regra de data/horário). → PR #3 `feat/code-time-window`
- Implementar notificações (email ou in-app) para confirmações/cancelamentos. → PR #4 `feat/in-app-notifications`
- Revisar ordenação e UX das listas de aulas do instrutor (pendentes, confirmadas, concluídas). → PR #5 `feat/instructor-lesson-list-ux`
- Exibir disponibilidade pública do instrutor de forma segura e resumida, sem expor dados desnecessários. → PR #6 `feat/public-availability-summary`
- Evoluir filtro dos instrutores com mapa e busca mais avançada. → PR #7 `feat/instructor-map-search`
- Substituir identificadores do aluno por nickname consistente no backend/frontend. → PR `feat/student-nickname`
- Foto instrutor → PR #8 `feat/instructor-photo`

## Pendente

(nenhum — itens acima abertos como PRs)
