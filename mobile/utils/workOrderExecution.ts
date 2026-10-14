import WorkOrder from '../models/workOrder';

export const isExecutionAssigned = (
  workOrder: WorkOrder,
  userId: number
): boolean =>
  workOrder.primaryUser?.id === userId ||
  (workOrder.assignedTo ?? []).some((user) => user.id === userId) ||
  (workOrder.team?.users ?? []).some((user) => user.id === userId);

export const isSoleExecutionAssignee = (
  workOrder: WorkOrder,
  userId: number
): boolean => {
  if (workOrder.team && !Array.isArray(workOrder.team.users)) return false;
  const ids = new Set(
    [
      workOrder.primaryUser?.id,
      ...(workOrder.assignedTo ?? []).map((user) => user.id),
      ...(workOrder.team?.users ?? []).map((user) => user.id)
    ].filter((id) => id != null)
  );
  return ids.size === 1 && ids.has(userId);
};

export const canExecuteWorkOrder = (
  workOrder: WorkOrder,
  userId: number
): boolean =>
  workOrder.status !== 'COMPLETE' &&
  isExecutionAssigned(workOrder, userId) &&
  (workOrder.executionOwner
    ? workOrder.executionOwner.id === userId
    : isSoleExecutionAssignee(workOrder, userId));

export const getWorkOrderCompanionLabel = (
  workOrder: WorkOrder,
  userId: number
): string | null => {
  const owner = workOrder.executionOwner;
  if (workOrder.status === 'COMPLETE' || !owner || owner.id === userId) {
    return null;
  }
  const name = [owner.firstName, owner.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return `Em execução por ${name || 'outro técnico'}`;
};

export const getQuestionnaireReadOnlyMessage = (
  workOrder: WorkOrder,
  userId: number
): string => {
  if (workOrder.status === 'COMPLETE') {
    return 'Esta OS foi concluída. Você pode consultar as respostas, notas e fotos do questionário.';
  }
  const owner = workOrder.executionOwner;
  if (owner && owner.id !== userId) {
    const name = [owner.firstName, owner.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return `Esta OS está sendo executada por ${
      name || 'outro técnico'
    }. Você pode acompanhar as respostas, notas e fotos, mas não alterá-las.`;
  }
  if (!owner) {
    return 'A execução desta OS ainda não foi assumida. Para preencher o questionário, o técnico responsável precisa iniciar a execução nos detalhes da OS.';
  }
  return 'Você pode consultar as respostas, notas e fotos. Seu acesso atual não permite alterar este questionário.';
};
