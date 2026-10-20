import React from 'react';
import { act, create } from 'react-test-renderer';
import useTaskEdits from '../useTaskEdits';
import { serialTaskWrite } from '../../utils/serialTaskWrites';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
let tree, edits;
const setup = (save, canEdit = true, baseline = []) => {
  function Probe() {
    edits = useTaskEdits(save, canEdit, baseline);
    return null;
  }
  act(() => {
    tree = create(<Probe />);
  });
};
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
});

test('unchanged blur does not create a draft, including after an acknowledgement before store refresh', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  setup(save, true, [{ id: 1, value: 'original', notes: '' }]);
  act(() => edits.edit(1, 'value', 'original'));
  expect(edits.hasPending).toBe(false);
  act(() => edits.edit(1, 'value', 'updated'));
  await act(async () => expect(await edits.savePending()).toBe(true));
  expect(edits.hasPending).toBe(false);
  expect(edits.isBusy()).toBe(false);
  act(() => edits.edit(1, 'value', 'updated'));
  await act(async () => expect(await edits.savePending()).toBe(true));
  expect(save).toHaveBeenCalledTimes(1);
});

test('explicit exit flushes both answers and notes without waiting for input debounce', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  setup(save);
  act(() => {
    edits.edit(1, 'value', 'problem');
    edits.edit(2, 'value', 'solution');
    edits.edit(2, 'notes', 'details');
  });
  await act(async () => expect(await edits.savePending()).toBe(true));
  expect(save.mock.calls).toEqual([
    [1, 'value', 'problem'],
    [2, 'value', 'solution'],
    [2, 'notes', 'details']
  ]);
  expect(edits.hasPending).toBe(false);
});

test('exit joins an existing write without duplicating it; failed flush keeps the draft', async () => {
  const request = deferred();
  const save = jest.fn(() => request.promise);
  setup(save);
  act(() => edits.edit(1, 'value', 'answer'));
  let first, flush;
  await act(async () => {
    first = edits.save(1, 'value').catch(() => false);
    flush = edits.savePending();
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => {
    request.reject(new Error('offline'));
    expect(await first).toBe(false);
    expect(await flush).toBe(false);
  });
  expect(edits.hasPending).toBe(true);
  expect(edits.overlay({ id: 1 }).value).toBe('answer');
});
test('failure preserves latest typing; retry sends current value and has a synchronous duplicate guard', async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  setup(save);
  act(() => edits.edit(1, 'value', 'ABC'));
  await act(async () => {
    await expect(edits.save(1, 'value')).rejects.toThrow('offline');
  });
  expect(edits.states['1:value']).toBe('error');
  act(() => edits.edit(1, 'value', 'ABCD'));
  let a, b;
  await act(async () => {
    a = edits.save(1, 'value');
    b = edits.save(1, 'value');
    await a;
  });
  expect(a).toBe(b);
  expect(save).toHaveBeenLastCalledWith(1, 'value', 'ABCD');
  expect(edits.states['1:value']).toBe('saved');
  expect(edits.hasPending).toBe(false);
});
test('old acknowledgement does not confirm later typing and remote data cannot replace draft', async () => {
  const pending = deferred();
  setup(() => pending.promise);
  act(() => edits.edit(1, 'value', 'A'));
  let request;
  await act(async () => {
    request = edits.save(1, 'value');
  });
  act(() => edits.edit(1, 'value', 'B'));
  await act(async () => {
    pending.resolve();
    await request;
  });
  expect(edits.states['1:value']).toBe('waiting');
  expect(edits.overlay({ id: 1, value: 'A' }).value).toBe('B');
  expect(edits.hasPending).toBe(true);
});
test('notes stay separate; read-only cannot edit or retry', async () => {
  const save = jest.fn();
  setup(save, false);
  act(() => edits.edit(1, 'notes', 'forbidden'));
  await act(async () => {
    expect(await edits.save(1, 'notes')).toBe(false);
  });
  expect(save).not.toHaveBeenCalled();
  expect(edits.hasPending).toBe(false);
});
test('leaving does not claim cancellation of a started request or start an unsent draft', async () => {
  const pending = deferred(),
    save = jest.fn(() => pending.promise);
  setup(save);
  act(() => edits.edit(1, 'value', 'A'));
  let request;
  await act(async () => {
    request = edits.save(1, 'value');
  });
  act(() => {
    edits.edit(1, 'value', 'B');
    edits.leave();
    tree.unmount();
  });
  tree = undefined;
  pending.resolve();
  await request;
  expect(save).toHaveBeenCalledTimes(1);
});
test('writes to the same task serialize even across different screen sessions; failure releases next explicit write', async () => {
  const store = {},
    pending = deferred(),
    calls = [];
  const a = serialTaskWrite(store, 'task1', async () => {
    calls.push('A');
    await pending.promise;
  });
  const b = serialTaskWrite(store, 'task1', async () => {
    calls.push('B');
  });
  await Promise.resolve();
  expect(calls).toEqual(['A']);
  pending.resolve();
  await Promise.all([a, b]);
  expect(calls).toEqual(['A', 'B']);
  await expect(
    serialTaskWrite(store, 'task1', async () => {
      throw new Error('failed');
    })
  ).rejects.toThrow('failed');
  await expect(serialTaskWrite(store, 'task1', async () => 42)).resolves.toBe(
    42
  );
});
