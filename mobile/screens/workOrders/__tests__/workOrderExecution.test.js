import {
  canExecuteWorkOrder,
  getWorkOrderCompanionLabel,
  getQuestionnaireReadOnlyMessage,
  isExecutionAssigned
} from '../../../utils/workOrderExecution';

const order = (extra = {}) => ({
  status: 'OPEN',
  primaryUser: { id: 1 },
  assignedTo: [{ id: 2 }, { id: 3 }],
  ...extra
});

describe('single shared execution', () => {
  it('allows the sole technician to operate without a separate claim, deduplicating assignments', () => {
    const solo = order({ primaryUser: { id: 2 }, assignedTo: [{ id: 2 }] });
    expect(canExecuteWorkOrder(solo, 2)).toBe(true);
    expect(canExecuteWorkOrder(solo, 3)).toBe(false);
    expect(canExecuteWorkOrder({ ...solo, executionOwner: { id: 3 } }, 2)).toBe(
      false
    );
    expect(canExecuteWorkOrder({ ...solo, status: 'COMPLETE' }, 2)).toBe(false);
  });
  it('requires a claim when there are several people or the team membership is unknown', () => {
    expect(canExecuteWorkOrder(order(), 2)).toBe(false);
    expect(
      canExecuteWorkOrder(
        order({
          primaryUser: null,
          assignedTo: [],
          team: { users: [{ id: 2 }] }
        }),
        2
      )
    ).toBe(true);
    expect(
      canExecuteWorkOrder(
        order({ primaryUser: { id: 2 }, assignedTo: [], team: { id: 7 } }),
        2
      )
    ).toBe(false);
    expect(
      canExecuteWorkOrder(
        order({
          primaryUser: null,
          assignedTo: [],
          team: { users: [{ id: 2 }, { id: 3 }] }
        }),
        2
      )
    ).toBe(false);
  });
  it('labels the companion card with the actual operator', () => {
    const wo = order({
      executionOwner: { id: 3, firstName: 'Fabricio', lastName: 'Souza' }
    });
    expect(getWorkOrderCompanionLabel(wo, 2)).toBe(
      'Em execução por Fabricio Souza'
    );
    expect(getWorkOrderCompanionLabel(wo, 3)).toBeNull();
  });
  it('does not invent an active operator for unclaimed or completed cards', () => {
    expect(getWorkOrderCompanionLabel(order(), 2)).toBeNull();
    expect(
      getWorkOrderCompanionLabel(
        order({ status: 'COMPLETE', executionOwner: { id: 3 } }),
        2
      )
    ).toBeNull();
    expect(
      getWorkOrderCompanionLabel(order({ executionOwner: { id: 3 } }), 2)
    ).toBe('Em execução por outro técnico');
  });
  it('explains read-only mode using the actual operator name', () => {
    const wo = order({
      executionOwner: { id: 3, firstName: 'Fabricio', lastName: 'Souza' }
    });
    expect(getQuestionnaireReadOnlyMessage(wo, 2)).toContain('Fabricio Souza');
    expect(getQuestionnaireReadOnlyMessage(wo, 2)).toContain(
      'mas não alterá-las'
    );
  });
  it('does not describe a closed OS as currently being executed', () => {
    const wo = order({ status: 'COMPLETE', executionOwner: { id: 3 } });
    expect(getQuestionnaireReadOnlyMessage(wo, 2)).toContain('foi concluída');
    expect(getQuestionnaireReadOnlyMessage(wo, 2)).not.toContain(
      'sendo executada'
    );
  });
  it('does not invent an operator before execution has started', () => {
    expect(getQuestionnaireReadOnlyMessage(order(), 2)).toContain(
      'ainda não foi assumida'
    );
    expect(getQuestionnaireReadOnlyMessage(order(), 2)).not.toContain(
      'outro técnico'
    );
  });
  it('handles unnamed operators and restricted access without misleading ownership', () => {
    expect(
      getQuestionnaireReadOnlyMessage(order({ executionOwner: { id: 3 } }), 2)
    ).toContain('outro técnico');
    expect(
      getQuestionnaireReadOnlyMessage(order({ executionOwner: { id: 2 } }), 2)
    ).toContain('Seu acesso atual');
  });
  it('opening an unclaimed OS does not imply execution permission', () => {
    expect(isExecutionAssigned(order(), 2)).toBe(true);
    expect(canExecuteWorkOrder(order(), 2)).toBe(false);
  });
  it('only the actual owner executes, independent of assigned list position', () => {
    const wo = order({ executionOwner: { id: 3 } });
    expect(canExecuteWorkOrder(wo, 3)).toBe(true);
    expect(canExecuteWorkOrder(wo, 2)).toBe(false);
    expect(canExecuteWorkOrder(wo, 1)).toBe(false);
  });
  it('team membership remains eligibility, not ownership of the whole team', () => {
    const wo = order({
      assignedTo: [],
      team: { users: [{ id: 4 }, { id: 5 }] },
      executionOwner: { id: 5 }
    });
    expect(isExecutionAssigned(wo, 4)).toBe(true);
    expect(canExecuteWorkOrder(wo, 4)).toBe(false);
    expect(canExecuteWorkOrder(wo, 5)).toBe(true);
  });
  it('closed OS and removed users cannot mutate operational data', () => {
    expect(
      canExecuteWorkOrder(
        order({ status: 'COMPLETE', executionOwner: { id: 2 } }),
        2
      )
    ).toBe(false);
    expect(
      canExecuteWorkOrder(
        order({ assignedTo: [], executionOwner: { id: 2 } }),
        2
      )
    ).toBe(false);
  });
});
