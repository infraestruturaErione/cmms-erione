export type WorkOrderAssignmentMode = 'COLLABORATORS' | 'TEAM';

export const getWorkOrderAssignmentValues = <T>(
  mode: WorkOrderAssignmentMode,
  collaborators: T[],
  team: T | null
) => {
  if (mode === 'TEAM') {
    return {
      primaryUser: null,
      assignedTo: [] as T[],
      team
    };
  }

  return {
    primaryUser: collaborators[0] ?? null,
    assignedTo: collaborators.slice(1),
    team: null
  };
};
