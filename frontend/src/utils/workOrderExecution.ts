import WorkOrder from '../models/owns/workOrder';

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
