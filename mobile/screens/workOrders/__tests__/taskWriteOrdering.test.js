jest.mock('immer', () =>
  jest.requireActual('../../../node_modules/immer/dist/cjs/index.js')
);
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() }
}));
import { configureStore } from '@reduxjs/toolkit';
import taskSlice, { reducer, patchTask, getTasks } from '../../../slices/task';
import api from '../../../utils/api';
import { revertAll } from '../../../utils/redux';
import {
  reducer as workOrderReducer,
  startWorkOrderExecution,
  departWorkOrder,
  checkInWorkOrder,
  checkOutWorkOrder,
  changeWorkOrderStatus,
  getWorkOrderDetails
} from '../../../slices/workOrder';
import {
  reducer as commentsReducer,
  createComment
} from '../../../slices/comment';
const defer = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const setup = () => {
  const store = configureStore({ reducer: { tasks: reducer } });
  store.dispatch(
    taskSlice.actions.getTasks({
      id: 1,
      tasks: [{ id: 2, value: 'old', notes: 'old note' }]
    })
  );
  return store;
};
beforeEach(() => jest.clearAllMocks());
test.each([
  startWorkOrderExecution,
  departWorkOrder,
  checkInWorkOrder,
  checkOutWorkOrder,
  changeWorkOrderStatus,
  getWorkOrderDetails
])(
  'late operational result does not restore another account OS: %p',
  async (thunk) => {
    const store = configureStore({
        reducer: { tasks: reducer, workOrders: workOrderReducer }
      }),
      pending = defer();
    api.get.mockReturnValue(pending.promise);
    api.post.mockReturnValue(pending.promise);
    api.patch.mockReturnValue(pending.promise);
    const request = store.dispatch(thunk(1, { status: 'COMPLETE' }));
    store.dispatch(revertAll());
    pending.resolve({ id: 1, status: 'IN_PROGRESS' });
    await request;
    expect(store.getState().workOrders.workOrderInfos).toEqual({});
  }
);
test('late evidence/comment acknowledgement cannot repopulate a different account', async () => {
  const store = configureStore({
      reducer: { tasks: reducer, comments: commentsReducer }
    }),
    pending = defer();
  api.post.mockReturnValue(pending.promise);
  const request = store.dispatch(
    createComment({ workOrder: { id: 1 }, content: 'relato', files: [] })
  );
  store.dispatch(revertAll());
  pending.resolve({
    id: 5,
    user: { id: 1 },
    content: 'old account',
    files: []
  });
  await request;
  expect(store.getState().comments.commentsByWorkOrder).toEqual({});
});
test('a GET started before a confirmed edit cannot overwrite its new value', async () => {
  const store = setup(),
    pending = defer();
  api.get.mockReturnValue(pending.promise);
  const read = store.dispatch(getTasks(1, true));
  api.patch.mockResolvedValue({ id: 2, value: 'new', notes: 'old note' });
  await store.dispatch(
    patchTask(1, 2, { id: 2, value: 'new', notes: 'old note' })
  );
  pending.resolve([{ id: 2, value: 'old', notes: 'old note' }]);
  await read;
  expect(store.getState().tasks.tasksByWorkOrder[1][0].value).toBe('new');
});
test('same task writes serialize server calls and merge with the newest acknowledged fields', async () => {
  const store = setup(),
    pending = defer();
  api.patch
    .mockReturnValueOnce(pending.promise)
    .mockImplementationOnce(async (_url, body) => body);
  const a = store.dispatch(
    patchTask(1, 2, (task) => ({ ...task, value: 'A' }))
  );
  const b = store.dispatch(
    patchTask(1, 2, (task) => ({ ...task, notes: 'new note' }))
  );
  await Promise.resolve();
  expect(api.patch).toHaveBeenCalledTimes(1);
  pending.resolve({ id: 2, value: 'A', notes: 'old note' });
  await Promise.all([a, b]);
  expect(api.patch.mock.calls[1][1]).toEqual({
    id: 2,
    value: 'A',
    notes: 'new note'
  });
  expect(store.getState().tasks.tasksByWorkOrder[1][0].notes).toBe('new note');
});
test('logout prevents late writes and queued writes from repopulating the new account', async () => {
  const store = setup(),
    pending = defer();
  api.patch.mockReturnValueOnce(pending.promise);
  const a = store.dispatch(patchTask(1, 2, { id: 2, value: 'A' }));
  const b = store.dispatch(patchTask(1, 2, { id: 2, value: 'B' }));
  const failed = expect(b).rejects.toThrow('conta');
  await Promise.resolve();
  store.dispatch(revertAll());
  pending.resolve({ id: 2, value: 'A' });
  await a;
  await failed;
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(store.getState().tasks.tasksByWorkOrder).toEqual({});
});
test('a task read started in the previous account cannot restore its records after reset', async () => {
  const store = setup(),
    pending = defer();
  api.get.mockReturnValue(pending.promise);
  const a = store.dispatch(getTasks(1, true));
  store.dispatch(revertAll());
  pending.resolve([{ id: 2, value: 'old account' }]);
  await a;
  expect(store.getState().tasks.tasksByWorkOrder).toEqual({});
});
