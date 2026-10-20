import React from 'react';
import { act, create } from 'react-test-renderer';
import usePageRequestGate from '../usePageRequestGate';
test('repeated end-reached events request one page, then release for explicit retry', async () => {
  let gate, resolve;
  function Probe() {
    gate = usePageRequestGate();
    return null;
  }
  let tree;
  act(() => {
    tree = create(<Probe />);
  });
  const load = jest.fn(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const a = gate(true, load);
  gate(true, load);
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  resolve();
  await a;
  expect(gate(false, load)).toBeUndefined();
  await expect(
    gate(true, async () => {
      throw new Error('offline');
    })
  ).rejects.toThrow('offline');
  await expect(gate(true, async () => 42)).resolves.toBe(42);
  act(() => tree.unmount());
});
