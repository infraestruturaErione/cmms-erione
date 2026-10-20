jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    deletes: jest.fn()
  },
  getErrorMessage: (e) => e.message
}));
jest.mock('../../../store', () => ({
  flushLocalWorkOrderCache: jest.fn(() => Promise.resolve())
}));
jest.mock('../../../utils/workOrderMedia', () => ({
  getWorkOrderMediaScope: jest.fn(async () => 'scope'),
  getWorkOrderUploadIds: jest.fn(async () => []),
  removeWorkOrderMedia: jest.fn(async () => ({ removedFiles: 0, removedBytes: 0 }))
}));
// Preservation and physical filesystem behavior have their own integration tests.
jest.mock('../../../utils/verifyWorkOrderPreserved', () => ({
  verifyWorkOrderPreserved: jest.fn(async (id) => ({
    workOrder: await require('../../../utils/api').default.get(`work-orders/${id}`),
    confirmedFileIds: new Set()
  }))
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import rootReducer from '../../../store/rootReducer';
import api from '../../../utils/api';
import { flushLocalWorkOrderCache } from '../../../store';
import {
  localWorkOrderDetailsRemoved,
  summarizeWorkOrder
} from '../../../slices/localWorkOrderCache';
import {
  canRemoveWorkOrderFromDevice,
  removeWorkOrderFromDevice
} from '../../../utils/removeWorkOrderFromDevice';
import {
  assertLocalWorkOrderIdle,
  blockLocalWorkOrderRemoval,
  trackLocalCacheRequest
} from '../../../utils/localWorkOrderActivity';
import { getWorkOrderDetails, getPDFReport } from '../../../slices/workOrder';
import { revertAll } from '../../../utils/redux';
import { getUserWorkOrdersOverview } from '../../../slices/analytics/user';

const wo = (id, extra = {}) => ({
  id,
  customId: `WO${id}`,
  title: `OS ${id}`,
  status: 'COMPLETE',
  createdAt: '2026-10-01T10:00:00Z',
  completedOn: '2026-10-02T10:00:00Z',
  signature: `data:image/png;base64,SIGNATURE_${id}`,
  customers: [{ id: 10, name: 'Cliente' }],
  location: { id: 11, name: 'Local' },
  files: [{ id: 30, url: 'https://minio.test/photo?signed=old' }],
  ...extra
});
const page = (content) => ({
  content,
  totalElements: 7,
  totalPages: 1,
  last: true
});
const reduce = (state, type, payload) => rootReducer(state, { type, payload });
function fixture() {
  let state = rootReducer(undefined, { type: '@@init' });
  state = reduce(state, 'workOrders/getWorkOrders', {
    workOrders: page([wo(1), wo(2)]),
    criteria: {}
  });
  state = reduce(state, 'workOrders/getWorkOrderDetails', {
    id: 1,
    workOrder: wo(1)
  });
  state = reduce(state, 'workOrders/getWorkOrdersByLocation', {
    id: 11,
    workOrders: [wo(1), wo(2)]
  });
  state = reduce(state, 'workOrders/getEvents', { events: [wo(1), wo(2)] });
  state = reduce(state, 'assets/getAssetWorkOrders', {
    id: 12,
    workOrders: [wo(1), wo(2)]
  });
  state = reduce(state, 'userStats/getWorkOrdersOverview', {
    stats: { created: 8, completed: 7 }
  });
  state = reduce(state, 'comments/getComments', {
    workOrderId: 1,
    comments: [
      {
        id: 33,
        content: 'Relato',
        files: [{ url: 'https://minio.test/evidence' }]
      }
    ]
  });
  state = reduce(state, 'comments/getComments', {
    workOrderId: 2,
    comments: [{ id: 34, content: 'Outra' }]
  });
  state = reduce(state, 'tasks/getTasks', {
    id: 1,
    tasks: [{ id: 44, value: 'Sim' }]
  });
  state = reduce(state, 'workOrderHistories/getWorkOrderHistories', {
    id: 1,
    workOrderHistories: [{ id: 50 }]
  });
  return state;
}
const prune = (state, id = 1) =>
  rootReducer(
    state,
    localWorkOrderDetailsRemoved(summarizeWorkOrder(wo(id), '2026-10-15'))
  );
const storeFor = (state = fixture()) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: state,
    middleware: (get) => get({ serializableCheck: false })
  });

beforeEach(() => jest.clearAllMocks());

test.each(['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', undefined])(
  'does not allow local removal for %s',
  (status) => {
    expect(canRemoveWorkOrderFromDevice(status)).toBe(false);
  }
);
test('only COMPLETE allows removal', () =>
  expect(canRemoveWorkOrderFromDevice('COMPLETE')).toBe(true));

test('prunes scoped operational caches, keeps a real summary and leaves other OS/catalogs/metrics/exports/hidden modules untouched', () => {
  const before = fixture();
  const after = prune(before);
  expect(after.workOrders.workOrderInfos[1]).toBeUndefined();
  expect(after.workOrders.workOrders.content.map((w) => w.id)).toEqual([2]);
  expect(after.workOrders.workOrders.totalElements).toBe(7);
  expect(after.localWorkOrderCache.pageIds).toEqual([1, 2]);
  expect(after.localWorkOrderCache.summaries[1]).toMatchObject({
    id: 1,
    title: 'OS 1',
    status: 'COMPLETE'
  });
  expect(after.comments.commentsByWorkOrder[1]).toBeUndefined();
  expect(after.comments.commentsByWorkOrder[2]).toEqual(
    before.comments.commentsByWorkOrder[2]
  );
  expect(after.tasks.tasksByWorkOrder[1]).toBeUndefined();
  expect(after.workOrderHistories.workOrderHistories[1]).toBeUndefined();
  expect(after.workOrders.workOrdersByLocation[11].map((w) => w.id)).toEqual([
    2
  ]);
  expect(after.workOrders.calendar.events.map((w) => w.id)).toEqual([2]);
  expect(after.assets.assetInfos[12].workOrders.map((w) => w.id)).toEqual([2]);
  expect(JSON.stringify(after)).not.toContain('SIGNATURE_1');
  for (const key of [
    'files',
    'customers',
    'locations',
    'users',
    'userAnalytics',
    'woAnalytics',
    'exports',
    'parts',
    'labors',
    'additionalCosts',
    'relations'
  ]) {
    expect(after[key]).toBe(before[key]);
  }
  expect(before.workOrders.workOrderInfos[1].workOrder.signature).toContain(
    'SIGNATURE_1'
  );
});

test('background refresh/pagination and late details/comments/tasks cannot repopulate removed data', () => {
  let state = prune(fixture());
  state = reduce(state, 'workOrders/getWorkOrders', {
    workOrders: page([wo(1), wo(2)]),
    criteria: {}
  });
  state = reduce(state, 'workOrders/getMoreWorkOrders', {
    workOrders: page([wo(1), wo(3)])
  });
  state = reduce(state, 'workOrders/getWorkOrderDetails', {
    id: 1,
    workOrder: wo(1)
  });
  state = reduce(state, 'comments/getComments', {
    workOrderId: 1,
    comments: [{ content: 'Late' }]
  });
  state = reduce(state, 'tasks/getTasks', {
    id: 1,
    tasks: [{ value: 'Late' }]
  });
  expect(state.localWorkOrderCache.pageIds).toEqual([1, 2, 3]);
  expect(state.workOrders.workOrderInfos[1]).toBeUndefined();
  expect(state.comments.commentsByWorkOrder[1]).toBeUndefined();
  expect(state.tasks.tasksByWorkOrder[1]).toBeUndefined();
  expect(JSON.stringify(state)).not.toContain('SIGNATURE_1');
});

test('server-side reopening restores the real active OS', () => {
  const state = reduce(prune(fixture()), 'workOrders/getWorkOrders', {
    workOrders: page([wo(1, { status: 'IN_PROGRESS' })]),
    criteria: {}
  });
  expect(state.localWorkOrderCache.summaries[1]).toBeUndefined();
  expect(state.workOrders.workOrders.content[0].status).toBe('IN_PROGRESS');
});

test('legacy relation entries embedding this full OS are evicted locally, without affecting unrelated relations or hidden module configuration', () => {
  let state = fixture();
  state = reduce(state, 'relations/getRelations', {
    id: 2,
    relations: [
      { id: 101, parent: wo(1), child: wo(2) },
      { id: 102, parent: wo(2), child: wo(3) }
    ]
  });
  const after = prune(state);
  expect(after.relations.relationsByWorkOrder[2].map((r) => r.id)).toEqual([
    102
  ]);
  expect(JSON.stringify(after)).not.toContain('SIGNATURE_1');
  expect(after.relations.relationsByWorkOrder[2][0]).toBe(
    state.relations.relationsByWorkOrder[2][1]
  );
  expect(after.labors).toBe(state.labors);
  expect(after.additionalCosts).toBe(state.additionalCosts);
});

test('retains the request itself but reduces its embedded full approved work order to a typed reference', () => {
  let state = fixture();
  state = reduce(state, 'requests/getRequests', {
    requests: { content: [{ id: 66, title: 'Solicitacao', workOrder: wo(1) }] }
  });
  const after = prune(state);
  expect(after.requests.requests.content[0].title).toBe('Solicitacao');
  expect(after.requests.requests.content[0].workOrder).toEqual({
    id: 1,
    customId: 'WO1',
    title: 'OS 1',
    status: 'COMPLETE'
  });
  expect(JSON.stringify(after)).not.toContain('SIGNATURE_1');
});

test('explicit opening reloads full details and fresh signed photo URLs from API', async () => {
  const store = storeFor(prune(fixture()));
  api.get.mockResolvedValue(
    wo(1, { files: [{ id: 30, url: 'https://minio.test/photo?signed=NEW' }] })
  );
  await store.dispatch(getWorkOrderDetails(1, true));
  expect(api.get).toHaveBeenCalledWith('work-orders/1');
  expect(store.getState().localWorkOrderCache.summaries[1]).toBeUndefined();
  expect(
    store.getState().workOrders.workOrderInfos[1].workOrder.files[0].url
  ).toContain('NEW');
});

test('removal performs only a confirmation GET and flushes persistence; server/device B and report inputs remain intact', async () => {
  const official = wo(1);
  const officialBefore = JSON.stringify(official);
  const deviceB = fixture();
  const store = storeFor();
  api.get.mockResolvedValue(official);
  await store.dispatch(removeWorkOrderFromDevice(1));
  expect(api.get.mock.calls).toEqual([['work-orders/1']]);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.deletes).not.toHaveBeenCalled();
  expect(flushLocalWorkOrderCache).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(official)).toBe(officialBefore);
  expect(deviceB.workOrders.workOrderInfos[1].workOrder.signature).toBe(
    official.signature
  );
});

test('fails closed when offline or server status is no longer COMPLETE', async () => {
  const store = storeFor();
  const before = store.getState();
  api.get.mockRejectedValueOnce(new Error('offline'));
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'offline'
  );
  api.get.mockResolvedValueOnce(wo(1, { status: 'IN_PROGRESS' }));
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'concluída'
  );
  expect(store.getState()).toBe(before);
  expect(flushLocalWorkOrderCache).not.toHaveBeenCalled();
});

test('blocks drafts and requests including ones that start during server confirmation', async () => {
  const store = storeFor();
  const unblock = blockLocalWorkOrderRemoval(1);
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'rascunhos'
  );
  expect(api.get).not.toHaveBeenCalled();
  unblock();
  let finish;
  const request = trackLocalCacheRequest(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  expect(() => assertLocalWorkOrderIdle(1)).toThrow();
  finish();
  await request;
  let release;
  api.get.mockImplementationOnce(async () => {
    release = blockLocalWorkOrderRemoval(1);
    return wo(1);
  });
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'rascunhos'
  );
  release();
  expect(store.getState().workOrders.workOrderInfos[1]).toBeDefined();
});

test('activity remains 7 after local removal and a persistence restart, with no full signature retained', async () => {
  const data = {};
  const storage = {
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => {
      data[k] = v;
    },
    removeItem: async (k) => {
      delete data[k];
    }
  };
  const config = {
    key: 'test-local-os',
    timeout: 0,
    storage,
    blacklist: ['userAnalytics', 'woAnalytics', 'exports']
  };
  const create = () => {
    const store = configureStore({
      reducer: persistReducer(config, rootReducer),
      middleware: (get) => get({ serializableCheck: false })
    });
    let persistor;
    const ready = new Promise((resolve) => {
      persistor = persistStore(store, null, resolve);
    });
    return {
      store,
      get persistor() {
        return persistor;
      },
      ready
    };
  };
  const first = create();
  await first.ready;
  first.store.dispatch({
    type: 'workOrders/getWorkOrders',
    payload: { workOrders: page([wo(1), wo(2)]), criteria: {} }
  });
  api.get.mockResolvedValue({ created: 8, completed: 7 });
  await first.store.dispatch(getUserWorkOrdersOverview());
  first.store.dispatch(
    localWorkOrderDetailsRemoved(summarizeWorkOrder(wo(1), 'now'))
  );
  expect(
    first.store.getState().userAnalytics.workOrdersOverview.completed
  ).toBe(7);
  await first.persistor.flush();
  first.persistor.pause();
  const second = create();
  await second.ready;
  await second.store.dispatch(getUserWorkOrdersOverview());
  expect(
    second.store.getState().userAnalytics.workOrdersOverview.completed
  ).toBe(7);
  expect(second.store.getState().workOrders.workOrders.totalElements).toBe(7);
  expect(
    second.store.getState().localWorkOrderCache.summaries[1]
  ).toBeDefined();
  expect(JSON.stringify(second.store.getState())).not.toContain('SIGNATURE_1');
  await second.persistor.flush();
  second.persistor.pause();
});

test('does not report success if durable storage fails; remote data remains untouched', async () => {
  const store = storeFor();
  api.get.mockResolvedValue(wo(1));
  flushLocalWorkOrderCache.mockRejectedValueOnce(new Error('storage full'));
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'storage full'
  );
  expect(api.deletes).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

test('does not prune when a newer local response has already reopened the OS during confirmation', async () => {
  const store = storeFor();
  api.get.mockImplementationOnce(async () => {
    store.dispatch({
      type: 'workOrders/getWorkOrderDetails',
      payload: { id: 1, workOrder: wo(1, { status: 'IN_PROGRESS' }) }
    });
    return wo(1);
  });
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow(
    'concluída'
  );
  expect(store.getState().localWorkOrderCache.summaries[1]).toBeUndefined();
});

test('an account reset during confirmation prevents pruning another session', async () => {
  const store = storeFor();
  store.dispatch({
    type: 'users/getUsersMini',
    payload: { users: [{ id: 2 }] }
  });
  api.get.mockImplementationOnce(async () => {
    store.dispatch(revertAll());
    return wo(1);
  });
  await expect(store.dispatch(removeWorkOrderFromDevice(1))).rejects.toThrow();
  expect(store.getState().localWorkOrderCache.summaries).toEqual({});
});

test('login reset clears the account-specific summaries', () => {
  const state = rootReducer(prune(fixture()), revertAll());
  expect(state.localWorkOrderCache.summaries).toEqual({});
  expect(state.localWorkOrderCache.pageIds).toBeNull();
});

test('individual export keeps its existing API contract before and after local pruning', async () => {
  const store = storeFor();
  api.get.mockResolvedValue({ message: 'https://dev.test/report.pdf' });
  const before = await store.dispatch(getPDFReport(1));
  store.dispatch(
    localWorkOrderDetailsRemoved(summarizeWorkOrder(wo(1), 'now'))
  );
  const after = await store.dispatch(getPDFReport(1));
  expect(before).toBe(after);
  expect(api.get.mock.calls).toEqual([
    ['work-orders/report/1'],
    ['work-orders/report/1']
  ]);
  expect(api.post).not.toHaveBeenCalled();
});

test('serialized operational cache shrinks without retaining attachment URLs or signature in the summary', () => {
  let state = fixture();
  state = reduce(state, 'workOrders/getWorkOrderDetails', {
    id: 1,
    workOrder: wo(1, {
      signature: 'data:image/png;base64,' + 'A'.repeat(100000)
    })
  });
  const after = prune(state);
  expect(JSON.stringify(after).length).toBeLessThan(
    JSON.stringify(state).length - 90000
  );
  const summary = after.localWorkOrderCache.summaries[1];
  expect(Object.keys(summary).sort()).toEqual(
    [
      'id',
      'customId',
      'title',
      'customerNames',
      'locationName',
      'createdAt',
      'completedOn',
      'status',
      'removedAt'
    ].sort()
  );
});
jest.mock('immer', () =>
  jest.requireActual('../../../node_modules/immer/dist/cjs/index.js')
);
