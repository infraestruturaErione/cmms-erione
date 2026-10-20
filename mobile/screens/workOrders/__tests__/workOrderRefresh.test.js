jest.mock('immer', () =>
  jest.requireActual('../../../node_modules/immer/dist/cjs/index.js')
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    deletes: jest.fn()
  },
  getErrorMessage: (error) => error.message
}));
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from '../../../store/rootReducer';
import api from '../../../utils/api';
import {
  getWorkOrders,
  getMoreWorkOrders,
  refreshCurrentWorkOrders
} from '../../../slices/workOrder';
import { getTasks } from '../../../slices/task';
import { revertAll } from '../../../utils/redux';
import {
  localWorkOrderDetailsRemoved,
  summarizeWorkOrder
} from '../../../slices/localWorkOrderCache';
import {
  firstWorkOrderPage,
  sameWorkOrderQuery,
  refreshWorkOrderView
} from '../../../utils/workOrderRefresh';

const query = (user = 1) => ({
  filterFields: [{ field: 'assignedToUser', operation: 'eq', value: user }],
  pageSize: 10,
  pageNum: 0,
  direction: 'DESC'
});
const wo = (id) => ({
  id,
  customId: `WO${id}`,
  status: 'COMPLETE',
  title: `OS ${id}`,
  files: [],
  customers: []
});
const page = (...ids) => ({
  content: ids.map(wo),
  totalElements: 30,
  last: false,
  size: 10
});
const makeStore = (state) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: state,
    middleware: (get) => get({ serializableCheck: false })
  });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
beforeEach(() => jest.clearAllMocks());

test('refresh criteria retain disabled Minhas OS, search, status, priority and direction; only the page resets', () => {
  const filters = {
    filterFields: [
      { field: 'status', operation: 'in', values: ['COMPLETE'] },
      { field: 'title', operation: 'cn', value: 'portao' },
      { field: 'priority', operation: 'in', values: ['HIGH'] }
    ],
    direction: 'ASC',
    pageNum: 3,
    pageSize: 10
  };
  const refreshed = firstWorkOrderPage(filters);
  expect(refreshed).toEqual({ ...filters, pageNum: 0 });
  expect(refreshed.filterFields.some((f) => f.field === 'assignedToUser')).toBe(
    false
  );
  expect(filters.pageNum).toBe(3);
});

test('same-query pending calls do not duplicate the API request', async () => {
  const store = makeStore();
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  const first = store.dispatch(getWorkOrders(query()));
  await store.dispatch(getWorkOrders(query()));
  expect(api.post).toHaveBeenCalledTimes(1);
  pending.resolve(page(1));
  await first;
  expect(store.getState().workOrders.loadingList).toBe(false);
});

test('out-of-order initial requests cannot overwrite newer rows, criteria OR local summary page IDs', async () => {
  const store = makeStore();
  const older = deferred(),
    newer = deferred();
  api.post
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const a = store.dispatch(getWorkOrders(query(1))),
    b = store.dispatch(getWorkOrders(query(2)));
  newer.resolve(page(2));
  await b;
  older.resolve(page(1));
  await a;
  expect(
    store.getState().workOrders.workOrders.content.map((w) => w.id)
  ).toEqual([2]);
  expect(store.getState().workOrders.activeCriteria).toEqual(query(2));
  expect(store.getState().localWorkOrderCache.pageIds).toEqual([2]);
});

test('an old failure/finalizer does not replace the newest error or stop a newer spinner', async () => {
  const store = makeStore();
  const older = deferred(),
    newer = deferred();
  api.post
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  const a = store.dispatch(getWorkOrders(query(1))),
    b = store.dispatch(getWorkOrders(query(2)));
  older.reject(new Error('old failure'));
  await a;
  expect(store.getState().workOrders.loadingList).toBe(true);
  expect(store.getState().workOrders.errorGet).toBeNull();
  newer.reject(new Error('new failure'));
  await b;
  expect(store.getState().workOrders.errorGet).toBe('new failure');
});

test('same-filter refresh failure preserves cached OS and lightweight summaries', async () => {
  const store = makeStore();
  api.post.mockResolvedValueOnce(page(1, 2));
  await store.dispatch(getWorkOrders(query()));
  store.dispatch(
    localWorkOrderDetailsRemoved(summarizeWorkOrder(wo(1), 'now'))
  );
  const previous = store.getState();
  api.post.mockRejectedValueOnce(new Error('offline'));
  await store.dispatch(getWorkOrders(query()));
  const state = store.getState();
  expect(state.workOrders.workOrders).toEqual(previous.workOrders.workOrders);
  expect(state.localWorkOrderCache.summaries[1]).toEqual(
    previous.localWorkOrderCache.summaries[1]
  );
  expect(state.localWorkOrderCache.pageIds).toEqual([1, 2]);
  expect(sameWorkOrderQuery(state.workOrders.activeCriteria, query())).toBe(
    true
  );
  expect(sameWorkOrderQuery(state.workOrders.activeCriteria, query(99))).toBe(
    false
  );
});

test('page failure can be retried explicitly without duplicating rows or skipping a page', async () => {
  const store = makeStore();
  api.post.mockResolvedValueOnce(page(1));
  await store.dispatch(getWorkOrders(query()));
  api.post.mockRejectedValueOnce(new Error('page offline'));
  await store.dispatch(getMoreWorkOrders(query(), 1));
  expect(store.getState().workOrders.currentPageNum).toBe(0);
  expect(store.getState().workOrders.errorMore).toBe('page offline');
  api.post.mockResolvedValueOnce(page(1, 2));
  await store.dispatch(getMoreWorkOrders(query(), 1));
  expect(store.getState().workOrders.currentPageNum).toBe(1);
  expect(
    store.getState().workOrders.workOrders.content.map((w) => w.id)
  ).toEqual([1, 2]);
  expect(store.getState().workOrders.errorMore).toBeNull();
});

test('a stale next page cannot leak into a newly selected filter or its summary IDs', async () => {
  const store = makeStore();
  api.post.mockResolvedValueOnce(page(1));
  await store.dispatch(getWorkOrders(query()));
  const old = deferred();
  api.post.mockReturnValueOnce(old.promise);
  const a = store.dispatch(getMoreWorkOrders(query(), 1));
  api.post.mockResolvedValueOnce(page(3));
  await store.dispatch(getWorkOrders(query(2)));
  old.resolve(page(1, 2));
  await a;
  expect(store.getState().localWorkOrderCache.pageIds).toEqual([3]);
  expect(
    store.getState().workOrders.workOrders.content.map((w) => w.id)
  ).toEqual([3]);
});

test('a session reset rejects an old account response', async () => {
  const store = makeStore();
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  const request = store.dispatch(getWorkOrders(query()));
  store.dispatch(revertAll());
  pending.resolve(page(1));
  await request;
  expect(store.getState().workOrders.workOrders.content).toEqual([]);
  expect(store.getState().localWorkOrderCache.pageIds).toBeNull();
});

test('a persisted loading flag never prevents a fresh request after app restart', async () => {
  const state = rootReducer(undefined, { type: '@@init' });
  const store = makeStore({
    ...state,
    workOrders: {
      ...state.workOrders,
      loadingList: true,
      listRequestId: 'persisted-dead-request',
      requestedCriteria: query()
    }
  });
  api.post.mockResolvedValueOnce(page(1));
  await store.dispatch(getWorkOrders(query()));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(store.getState().workOrders.loadingList).toBe(false);
});

test('background refresh is still best-effort and uses the currently selected criteria', async () => {
  const store = makeStore();
  api.post.mockResolvedValueOnce(page(1));
  await store.dispatch(getWorkOrders(query()));
  api.post.mockRejectedValueOnce(new Error('background offline'));
  await store.dispatch(refreshCurrentWorkOrders());
  expect(api.post.mock.calls[1][1]).toEqual(query());
  expect(store.getState().workOrders.errorGet).toBeNull();
  expect(store.getState().workOrders.listRequestSilent).toBe(true);
});

test('a successful background refresh clears an older visible list error', async () => {
  const store = makeStore();
  api.post.mockResolvedValueOnce(page(1));
  await store.dispatch(getWorkOrders(query()));
  api.post.mockRejectedValueOnce(new Error('offline'));
  await store.dispatch(getWorkOrders(query()));
  expect(store.getState().workOrders.errorGet).toBe('offline');
  api.post.mockResolvedValueOnce(page(2));
  await store.dispatch(refreshCurrentWorkOrders());
  expect(store.getState().workOrders.errorGet).toBeNull();
  expect(
    store.getState().workOrders.workOrders.content.map((w) => w.id)
  ).toEqual([2]);
});

test('explicit detail refresh requests OS, comments and extras, and reports separate errors', async () => {
  const calls = [];
  const result = await refreshWorkOrderView({
    pruned: false,
    loadDetails: async () => {
      calls.push('details');
    },
    loadComments: async () => {
      calls.push('comments');
      throw new Error('comments offline');
    },
    loadExtras: async () => {
      calls.push('tasks');
    }
  });
  expect(calls).toEqual(['details', 'comments', 'tasks']);
  expect(result.detailsError).toBeNull();
  expect(result.commentsError.message).toBe('comments offline');
});

test('pruned summary loads nothing else until explicit OS reload succeeds', async () => {
  const comments = jest.fn(),
    extras = jest.fn();
  const result = await refreshWorkOrderView({
    pruned: true,
    loadDetails: async () => {
      throw new Error('offline');
    },
    loadComments: comments,
    loadExtras: extras
  });
  expect(result.detailsError.message).toBe('offline');
  expect(comments).not.toHaveBeenCalled();
  expect(extras).not.toHaveBeenCalled();
  const order = [];
  await refreshWorkOrderView({
    pruned: true,
    loadDetails: async () => order.push('details'),
    loadComments: async () => order.push('comments'),
    loadExtras: async () => order.push('tasks')
  });
  expect(order).toEqual(['details', 'comments', 'tasks']);
});

test('strict task refresh reports an error; legacy background task loads retain their existing contract', async () => {
  const store = makeStore();
  api.get.mockRejectedValue(new Error('tasks offline'));
  await expect(store.dispatch(getTasks(1, true))).rejects.toThrow(
    'tasks offline'
  );
  await expect(store.dispatch(getTasks(1))).resolves.toBeUndefined();
  expect(store.getState().tasks.loadingTasks[1]).toBe(false);
});
