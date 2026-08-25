import { getWorkOrderAssignmentValues } from './workOrderAssignment';

const option = (value) => ({ label: `User ${value}`, value });

describe('getWorkOrderAssignmentValues', () => {
  it('maps one collaborator to primaryUser only', () => {
    const userA = option(1);

    expect(
      getWorkOrderAssignmentValues('COLLABORATORS', [userA], null)
    ).toEqual({ primaryUser: userA, assignedTo: [], team: null });
  });

  it('maps the first of three collaborators as primary and keeps the rest assigned', () => {
    const users = [option(1), option(2), option(3)];

    expect(
      getWorkOrderAssignmentValues('COLLABORATORS', users, null)
    ).toEqual({
      primaryUser: users[0],
      assignedTo: [users[1], users[2]],
      team: null
    });
  });

  it('maps team mode without leaking collaborators', () => {
    const team = { label: 'Team X', value: 10 };

    expect(
      getWorkOrderAssignmentValues(
        'TEAM',
        [option(1), option(2), option(3)],
        team
      )
    ).toEqual({ primaryUser: null, assignedTo: [], team });
  });
});
