jest.mock('../../../config', () => ({
  getApiUrl: async () => 'http://dev.test/api/'
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import api from '../../../utils/api';
import { assertLocalWorkOrderIdle } from '../../../utils/localWorkOrderActivity';

const response = { ok: true, text: async () => '{"ok":true}' };
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test.each(['get', 'post', 'patch', 'deletes'])(
  'tracks %s before async setup, releasing on success, without changing request contract',
  async (method) => {
    global.fetch = jest.fn(async () => response);
    const request =
      method === 'post' || method === 'patch'
        ? api[method]('test', { value: 1 })
        : api[method]('test');
    expect(() => assertLocalWorkOrderIdle(1)).toThrow();
    await request;
    expect(() => assertLocalWorkOrderIdle(1)).not.toThrow();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://dev.test/api/test',
      expect.any(Object)
    );
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe(
      { get: undefined, post: 'POST', patch: 'PATCH', deletes: 'DELETE' }[
        method
      ]
    );
  }
);

test('a failed upload/request also releases its blocker', async () => {
  global.fetch = jest.fn(async () => {
    throw new Error('offline');
  });
  await expect(api.post('files/upload', {})).rejects.toThrow('offline');
  expect(() => assertLocalWorkOrderIdle(1)).not.toThrow();
});
