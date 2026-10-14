import WorkOrder from '../models/owns/workOrder';

export const isExecutionAssigned = (
  workOrder: WorkOrder,
  userId: number
): boolean =>
  workOrder.primaryUser?.id === userId ||
  (workOrder.assignedTo ?? []).some((user) => user.id === userId) ||
  (workOrder.team?.users ?? []).some((user) => user.id === userId);

export const canExecuteWorkOrder = (
  workOrder: WorkOrder,
  userId: number
): boolean =>
  workOrder.status !== 'COMPLETE' &&
  isExecutionAssigned(workOrder, userId) &&
  workOrder.executionOwner?.id === userId;
