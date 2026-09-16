const {
  getRequestCreationAction
} = require('./requestCreationFlow');

describe('Request creation flow', () => {
  test('Requester with one allowed customer uses QuickRequest', () => {
    expect(getRequestCreationAction('REQUESTER', 1)).toBe('quick');
  });

  test('Requester with multiple allowed customers uses QuickRequest', () => {
    expect(getRequestCreationAction('REQUESTER', 3)).toBe('quick');
  });

  test('Requester without allowed customers keeps the existing block', () => {
    expect(getRequestCreationAction('REQUESTER', 0)).toBe('blocked');
  });

  test.each(['ADMIN', 'LIMITED_ADMIN', 'TECHNICIAN'])(
    '%s keeps the legacy administrative creation flow',
    (roleCode) => {
      expect(getRequestCreationAction(roleCode, 0)).toBe('legacy');
    }
  );
});
