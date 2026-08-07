import { Task } from '../models/owns/tasks';

export const isExecutionTaskComplete = (task: Task): boolean => {
  const value = task.value?.toString().trim();
  if (!value) return false;
  if (task.taskBase.taskType === 'SUBTASK') return value === 'COMPLETE';
  return true;
};
