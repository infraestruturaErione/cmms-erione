import {
  isConfirmedQuestion,
  nextPendingQuestion
} from '../../../utils/questionnaireProgress';
const tasks = [
  { id: 1, value: 'A', taskBase: { taskType: 'TEXT' } },
  { id: 2, value: 'B', taskBase: { taskType: 'TEXT' } },
  { id: 3, value: '', taskBase: { taskType: 'TEXT' } }
];
test.each(['waiting', 'saving', 'error'])(
  'draft or %s is still pending, even when the displayed input is filled',
  (state) => {
    expect(isConfirmedQuestion(tasks[1], { '2:value': state })).toBe(false);
    expect(nextPendingQuestion(tasks, { '2:value': state }, 1)).toBe(2);
  }
);
test('notes pending prevent compacting, and completed questions can be revised', () => {
  expect(isConfirmedQuestion(tasks[0], { '1:notes': 'error' })).toBe(false);
  expect(isConfirmedQuestion(tasks[0], { '1:value': 'saved' })).toBe(true);
  expect(nextPendingQuestion(tasks, {}, 1)).toBe(3);
  expect(nextPendingQuestion(tasks, { '1:value': 'waiting' }, 3)).toBe(1);
  expect(nextPendingQuestion(tasks.slice(0, 2), {}, 2)).toBeUndefined();
});
test('SUBTASK OPEN is not completed and no new task-type rule is introduced', () => {
  expect(
    isConfirmedQuestion(
      { id: 4, value: 'OPEN', taskBase: { taskType: 'SUBTASK' } },
      {}
    )
  ).toBe(false);
});
