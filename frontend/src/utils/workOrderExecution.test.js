import { canExecuteWorkOrder, isExecutionAssigned } from './workOrderExecution';

describe('execution ownership without changing administrative permissions', () => {
  const wo = {
    status: 'OPEN',
    primaryUser: { id: 1 },
    assignedTo: [{ id: 2 }, { id: 3 }]
  };
  it('requires an explicit owner rather than using primary/first assignment', () => {
    expect(isExecutionAssigned(wo, 1)).toBe(true);
    expect(canExecuteWorkOrder(wo, 1)).toBe(false);
    expect(canExecuteWorkOrder({ ...wo, executionOwner: { id: 3 } }, 3)).toBe(
      true
    );
    expect(canExecuteWorkOrder({ ...wo, executionOwner: { id: 3 } }, 2)).toBe(
      false
    );
  });
  it('does not grant operations to a whole team or a closed OS', () => {
    const teamOrder = {
      ...wo,
      team: { users: [{ id: 4 }, { id: 5 }] },
      executionOwner: { id: 4 }
    };
    expect(canExecuteWorkOrder(teamOrder, 4)).toBe(true);
    expect(canExecuteWorkOrder(teamOrder, 5)).toBe(false);
    expect(canExecuteWorkOrder({ ...teamOrder, status: 'COMPLETE' }, 4)).toBe(
      false
    );
  });
});
