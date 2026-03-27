# TUDO (Pendências e Melhorias)

## Concluído

- Confirmar ao cancelar uma aula (instrutor).
- Filtro padrão ativo em `My Bookings`.
- Validar CPF, email e licença DETRAN.

## Pendente

- Implementar fluxo de pagamento (escrow), incluindo `pending_payment` e liberação ao confirmar código.
- Adicionar migrations para novas colunas de `lessons` e tabela `reviews` (incluindo `is_public`).
- Adicionar migrations formais para `availability.start_date`, `availability.end_date` e `availability.days_of_week`.
- Exibir informações do aluno para o instrutor nas listas de aulas (nome/contato).
- Bloquear confirmação de código fora do horário da aula (regra de data/horário).
- Permitir múltiplos horários no mesmo dia com edição inline.
- Implementar notificações (email ou in-app) para confirmações/cancelamentos.
- Adicionar testes E2E para disponibilidade inválida, conflitos na confirmação e horários indisponíveis.
- Expandir E2E para booking múltiplo, filtros da central do instrutor e merge de disponibilidade.
- Revisar ordenação e UX das listas de aulas do instrutor (pendentes, confirmadas, concluídas).
- Exibir disponibilidade pública do instrutor de forma segura e resumida, sem expor dados desnecessários.
- Melhorar filtro do instrutores (mapa?)
- Mesclar horarios que se sobrepoem instrutor
- Horario solicitacao card booking
- Mostrar instructores que solicitei no card da tela inicial
- Nao mudar muito de tamanho ao selecionar varias datas card inicial
- Criar um calendario mostrando os dias que tenho aula (mesma coisa para o instrutor)
- Confirmar ao aceitar uma aula que ira cancelar outra devido ao overlap (criar um test para isso)
- Esses cards de stats podem ir para o card Ganhos em instrutor e nomear esse card de outra coisa que melhor represente
- Nao mostrar email do estudante para instrutor/publico
- O booking ainda esta confuso a parte de apertar dois butoes algunmas pessoas acharam que so selecionar e o suficiente (tambem querem exlcuir faixas para ferias por exemplo)
- O filtro pode ter autocompletar