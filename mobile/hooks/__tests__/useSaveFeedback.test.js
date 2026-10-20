import React from 'react';
import { act, create } from 'react-test-renderer';
import useSaveFeedback from '../useSaveFeedback';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function setup() {
  let feedback, root;
  function Probe() {
    feedback = useSaveFeedback();
    return null;
  }
  act(() => {
    root = create(<Probe />);
  });
  return {
    get api() {
      return feedback;
    },
    root
  };
}

test('shows waiting then saving; success is shown only after server acknowledgement', async () => {
  const probe = setup(),
    request = deferred();
  let saving;
  act(() => probe.api.markEdited('1:value'));
  expect(probe.api.states['1:value']).toBe('waiting');
  act(() => {
    saving = probe.api.trackSave('1:value', () => request.promise);
  });
  expect(probe.api.states['1:value']).toBe('saving');
  await act(async () => {
    request.resolve();
    await saving;
  });
  expect(probe.api.states['1:value']).toBe('saved');
  act(() => probe.root.unmount());
});
test('failure remains visible and never automatically retries', async () => {
  const probe = setup(),
    save = jest.fn(async () => {
      throw new Error('offline');
    });
  await act(async () => {
    await expect(probe.api.trackSave('1:value', save)).rejects.toThrow(
      'offline'
    );
  });
  expect(probe.api.states['1:value']).toBe('error');
  expect(save).toHaveBeenCalledTimes(1);
  act(() => probe.root.unmount());
});
test('an older confirmation cannot mark newer typing as saved', async () => {
  const probe = setup(),
    request = deferred();
  let saving;
  act(() => {
    saving = probe.api.trackSave('1:value', () => request.promise);
  });
  act(() => probe.api.markEdited('1:value'));
  await act(async () => {
    request.resolve();
    await saving;
  });
  expect(probe.api.states['1:value']).toBe('waiting');
  act(() => probe.root.unmount());
});
test('late failures never override a newer confirmed save; answers and notes remain separate', async () => {
  const probe = setup(),
    old = deferred(),
    current = deferred();
  let a, b;
  act(() => {
    a = probe.api.trackSave('1:value', () => old.promise);
    b = probe.api.trackSave('1:value', () => current.promise);
  });
  act(() => probe.api.markEdited('1:notes'));
  await act(async () => {
    current.resolve();
    await b;
  });
  await act(async () => {
    old.reject(new Error('old'));
    await expect(a).rejects.toThrow('old');
  });
  expect(probe.api.states['1:value']).toBe('saved');
  expect(probe.api.states['1:notes']).toBe('waiting');
  act(() => probe.root.unmount());
});
test('unmount does not create retry or a new persistence mechanism', async () => {
  const probe = setup(),
    request = deferred(),
    run = jest.fn(() => request.promise);
  let saving;
  act(() => {
    saving = probe.api.trackSave('1:value', run);
  });
  act(() => probe.root.unmount());
  await act(async () => {
    request.resolve();
    await saving;
  });
  expect(run).toHaveBeenCalledTimes(1);
});
