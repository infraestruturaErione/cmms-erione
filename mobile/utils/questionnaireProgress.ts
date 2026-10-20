import { Task } from '../models/tasks';
import { isExecutionTaskComplete } from './workOrderCompletion';
import type { SaveFeedback } from '../hooks/useSaveFeedback';

export function isConfirmedQuestion(
  task: Task,
  states: Record<string, SaveFeedback>
) {
  return (
    isExecutionTaskComplete(task) &&
    ['value', 'notes'].every((field) => {
      const state = states[`${task.id}:${field}`];
      return !state || state === 'saved';
    })
  );
}
export function nextPendingQuestion(
  tasks: Task[],
  states: Record<string, SaveFeedback>,
  after?: number
): number | undefined {
  const start = tasks.findIndex((task) => task.id === after) + 1;
  const ordered = [...tasks.slice(start), ...tasks.slice(0, start)];
  return ordered.find((task) => !isConfirmedQuestion(task, states))?.id;
}
