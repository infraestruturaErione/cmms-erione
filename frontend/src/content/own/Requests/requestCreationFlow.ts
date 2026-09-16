export type RequestCreationAction = 'blocked' | 'quick' | 'legacy';

export const getRequestCreationAction = (
  roleCode?: string,
  allowedCustomersCount = 0
): RequestCreationAction => {
  if (roleCode !== 'REQUESTER') return 'legacy';
  if (allowedCustomersCount === 0) return 'blocked';
  return 'quick';
};
