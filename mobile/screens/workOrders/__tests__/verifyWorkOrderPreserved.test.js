jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    deletes: jest.fn(),
    patch: jest.fn()
  }
}));
jest.mock('immer', () =>
  jest.requireActual('../../../node_modules/immer/dist/cjs/index.js')
);
jest.mock('../../../store', () => ({
  flushLocalWorkOrderCache: jest.fn(async () => {})
}));
jest.mock('../../../utils/workOrderMedia', () => ({
  getWorkOrderMediaScope: jest.fn(async () => 'scope'),
  getWorkOrderUploadIds: jest.fn(async () => [11]),
  removeWorkOrderMedia: jest.fn(async () => ({
    removedBytes: 1234,
    removedFiles: 1
  }))
}));
import api from '../../../utils/api';
import { verifyWorkOrderPreserved } from '../../../utils/verifyWorkOrderPreserved';
import { removeWorkOrderFromDevice } from '../../../utils/removeWorkOrderFromDevice';
import { removeWorkOrderMedia } from '../../../utils/workOrderMedia';
import { flushLocalWorkOrderCache } from '../../../store';
import { blockLocalWorkOrderRemoval } from '../../../utils/localWorkOrderActivity';

const file = { id: 11, url: 'https://minio.test/photo?signature=valid' };
const wo = {
  id: 1,
  status: 'COMPLETE',
  signature: 'data:image/png;base64,signature',
  files: [file]
};
const comments = [{ id: 2, content: 'Relato', files: [file] }];
const tasks = [{ id: 3, value: 'Resolvido', notes: 'Nota', images: [] }];
const local = () => ({ workOrder: wo, comments, tasks });
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(async (path) =>
    path.startsWith('tasks/') ? tasks : wo
  );
  api.post.mockResolvedValue(comments);
  global.fetch = jest.fn(async () => ({
    status: 206,
    headers: { get: () => 'bytes 0-0/4096' }
  }));
});
afterAll(() => {
  global.fetch = originalFetch;
});

test('confirms complete OS, signature, answers, attachment links AND physical server object, without remote mutation', async () => {
  const result = await verifyWorkOrderPreserved(1, local(), [11]);
  expect(result.confirmedFileIds).toEqual(new Set([11]));
  expect(api.get.mock.calls).toEqual([
    ['work-orders/1'],
    ['tasks/work-order/1'],
    ['work-orders/1']
  ]);
  expect(api.post).toHaveBeenCalledWith('comments/search/1', {});
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    file.url,
    expect.objectContaining({ method: 'GET', headers: { Range: 'bytes=0-0' } })
  );
  expect(api.deletes).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

const historyEvent = {
  id: 14747227,
  system: true,
  content: 'Status: Concluído',
  createdAt: '2026-10-16T12:41:00Z',
  user: { id: 7 },
  files: []
};

test.each([
  ['missing event', null],
  ['changed content', { content: 'Outro evento' }],
  ['changed author', { user: { id: 8 } }],
  ['changed time', { createdAt: '2026-10-16T12:42:00Z' }],
  ['changed files', { files: [file] }],
  ['human comment instead of system event', { system: false }]
])(
  'still blocks cleanup for automatic history with %s',
  async (_label, change) => {
    api.post.mockResolvedValue([
      ...comments,
      ...(change ? [{ ...historyEvent, ...change }] : [])
    ]);
    await expect(
      verifyWorkOrderPreserved(
        1,
        {
          ...local(),
          comments: [...comments, historyEvent]
        },
        []
      )
    ).rejects.toThrow('evento do histórico');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(removeWorkOrderMedia).not.toHaveBeenCalled();
  }
);

test('does not reuse one server event to confirm two identical local history entries', async () => {
  api.post.mockResolvedValue([...comments, { ...historyEvent, id: 99 }]);
  await expect(
    verifyWorkOrderPreserved(
      1,
      {
        ...local(),
        comments: [...comments, historyEvent, { ...historyEvent, id: 100 }]
      },
      []
    )
  ).rejects.toThrow('evento do histórico');
  api.post.mockResolvedValue([
    ...comments,
    { ...historyEvent, id: 99 },
    { ...historyEvent, id: 101 }
  ]);
  await expect(
    verifyWorkOrderPreserved(
      1,
      {
        ...local(),
        comments: [...comments, historyEvent, { ...historyEvent, id: 100 }]
      },
      []
    )
  ).resolves.toBeDefined();
});

test('incomplete system-event identity is not accepted, even when both copies omit the same data', async () => {
  for (const change of [{ user: undefined }, { createdAt: undefined }]) {
    const incomplete = { ...historyEvent, ...change };
    api.post.mockResolvedValue([...comments, incomplete]);
    await expect(
      verifyWorkOrderPreserved(
        1,
        {
          ...local(),
          comments: [...comments, incomplete]
        },
        []
      )
    ).rejects.toThrow('evento do histórico');
  }
});

test('real reports still need the persisted ID; a random history ID collision cannot confirm them', async () => {
  api.post.mockResolvedValue([{ ...comments[0], id: 99 }]);
  await expect(verifyWorkOrderPreserved(1, local(), [])).rejects.toThrow(
    'relato #2'
  );
  api.post.mockResolvedValue([
    {
      ...historyEvent,
      id: comments[0].id,
      content: comments[0].content,
      files: [file]
    }
  ]);
  await expect(verifyWorkOrderPreserved(1, local(), [])).rejects.toThrow(
    'relato #2'
  );
});

test('preserves the same automatic history event when the API generates a different display ID', async () => {
  api.post.mockResolvedValue([...comments, { ...historyEvent, id: 98765432 }]);
  await expect(
    verifyWorkOrderPreserved(
      1,
      {
        ...local(),
        comments: [...comments, historyEvent]
      },
      [11]
    )
  ).resolves.toMatchObject({ confirmedFileIds: new Set([11]) });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(api.deletes).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

test.each([
  [{ tasks: [{ ...tasks[0], value: 'unsaved' }] }, 'resposta'],
  [{ tasks: [{ ...tasks[0], notes: 'unsaved note' }] }, 'notas'],
  [{ tasks: [{ ...tasks[0], id: 999 }] }, 'pergunta não encontrada'],
  [{ comments: [{ ...comments[0], content: 'draft report' }] }, 'relato #2']
])(
  'diagnoses a mismatching section without disclosing or discarding its content',
  async (change, section) => {
    await expect(
      verifyWorkOrderPreserved(1, { ...local(), ...change }, [])
    ).rejects.toThrow(section);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(removeWorkOrderMedia).not.toHaveBeenCalled();
  }
);

test('does not silently treat empty, null, undefined, or numeric/string answers as equivalent', async () => {
  for (const value of [null, undefined, '', 0, '0']) {
    await expect(
      verifyWorkOrderPreserved(
        1,
        { ...local(), tasks: [{ ...tasks[0], value }] },
        []
      )
    ).rejects.toThrow('resposta');
  }
});

test.each([403, 404, 500, 200])(
  'refuses to erase local files if object verification returns %s',
  async (status) => {
    global.fetch.mockResolvedValue({ status, headers: { get: () => null } });
    await expect(verifyWorkOrderPreserved(1, local(), [11])).rejects.toThrow(
      'confirmar'
    );
  }
);

test('offline/expired URL/missing attachment/signature/unsaved answer all fail closed', async () => {
  global.fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(verifyWorkOrderPreserved(1, local(), [11])).rejects.toThrow(
    'offline'
  );
  await expect(verifyWorkOrderPreserved(1, local(), [99])).rejects.toThrow(
    'arquivos locais'
  );
  await expect(
    verifyWorkOrderPreserved(
      1,
      { ...local(), workOrder: { ...wo, signature: 'pending' } },
      []
    )
  ).rejects.toThrow('assinatura');
  await expect(
    verifyWorkOrderPreserved(
      1,
      { ...local(), tasks: [{ ...tasks[0], value: 'unsaved' }] },
      []
    )
  ).rejects.toThrow('dados locais');
  api.get.mockResolvedValueOnce({ ...wo, status: 'IN_PROGRESS' });
  await expect(verifyWorkOrderPreserved(1, local(), [])).rejects.toThrow(
    'concluida'
  );
});

function context() {
  const state = {
    users: {},
    workOrders: { workOrderInfos: { 1: { workOrder: wo } } },
    comments: { commentsByWorkOrder: { 1: comments } },
    tasks: { tasksByWorkOrder: { 1: tasks } }
  };
  return { state, dispatch: jest.fn(), getState: () => state };
}

test('complete cleanup action accepts stable history data with changing display IDs, retaining all other guards', async () => {
  const { state, dispatch, getState } = context();
  state.comments.commentsByWorkOrder[1] = [...comments, historyEvent];
  api.post.mockResolvedValue([...comments, { ...historyEvent, id: 12345678 }]);
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).resolves.toMatchObject({ removedFiles: 1 });
  expect(flushLocalWorkOrderCache).toHaveBeenCalledTimes(1);
  expect(removeWorkOrderMedia).toHaveBeenCalledWith(
    'scope',
    1,
    new Set([11]),
    expect.any(Function)
  );
  expect(api.deletes).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
});

test('whole action persists lightweight summary BEFORE physically deleting confirmed files', async () => {
  const { dispatch, getState } = context();
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).resolves.toEqual({ removedBytes: 1234, removedFiles: 1 });
  const summary = dispatch.mock.calls[0][0].payload;
  expect(summary.id).toBe(1);
  expect(summary.files).toBeUndefined();
  expect(summary.signature).toBeUndefined();
  expect(flushLocalWorkOrderCache.mock.invocationCallOrder[0]).toBeLessThan(
    removeWorkOrderMedia.mock.invocationCallOrder[0]
  );
  expect(removeWorkOrderMedia).toHaveBeenCalledWith(
    'scope',
    1,
    new Set([11]),
    expect.any(Function)
  );
});

test('no pruning/deletion when preservation fails, and no physical deletion when persistence fails', async () => {
  const { dispatch, getState } = context();
  global.fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).rejects.toThrow('offline');
  expect(dispatch).not.toHaveBeenCalled();
  expect(removeWorkOrderMedia).not.toHaveBeenCalled();
  flushLocalWorkOrderCache.mockRejectedValueOnce(new Error('storage full'));
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).rejects.toThrow('storage full');
  expect(removeWorkOrderMedia).not.toHaveBeenCalled();
});

test('pending draft and account switch during remote verification prevent deletion', async () => {
  const { state, dispatch, getState } = context();
  const release = blockLocalWorkOrderRemoval(1);
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).rejects.toThrow('rascunhos');
  release();
  global.fetch.mockImplementationOnce(async () => {
    state.users = {};
    return { status: 206, headers: { get: () => 'bytes 0-0/4096' } };
  });
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).rejects.toThrow('concluída');
  expect(dispatch).not.toHaveBeenCalled();
  expect(removeWorkOrderMedia).not.toHaveBeenCalled();
});

test('a server reopening during object verification prevents pruning', async () => {
  const { dispatch, getState } = context();
  global.fetch.mockImplementationOnce(async () => {
    api.get.mockResolvedValueOnce({ ...wo, status: 'IN_PROGRESS' });
    return { status: 206, headers: { get: () => 'bytes 0-0/4096' } };
  });
  await expect(
    removeWorkOrderFromDevice(1)(dispatch, getState)
  ).rejects.toThrow('reaberta');
  expect(dispatch).not.toHaveBeenCalled();
  expect(removeWorkOrderMedia).not.toHaveBeenCalled();
});

test('a draft in another OS also blocks physical cleanup of a potentially shared temporary file', async () => {
  const { dispatch, getState } = context();
  const release = blockLocalWorkOrderRemoval(2);
  try {
    await expect(
      removeWorkOrderFromDevice(1)(dispatch, getState)
    ).rejects.toThrow('rascunhos');
    expect(api.get).not.toHaveBeenCalled();
    expect(removeWorkOrderMedia).not.toHaveBeenCalled();
  } finally {
    release();
  }
});
