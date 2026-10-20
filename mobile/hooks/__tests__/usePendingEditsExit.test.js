import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';
import usePendingEditsExit from '../usePendingEditsExit';
let mockPrevent;
jest.mock('@react-navigation/native', () => ({
  UNSTABLE_usePreventRemove: (prevent, callback) => {
    mockPrevent = { prevent, callback };
  }
}));
test('protects native removal, explains an active request and resumes the original action only after confirmation', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navigation = { setOptions: jest.fn(), dispatch: jest.fn() },
    leave = jest.fn();
  function Probe() {
    usePendingEditsExit(navigation, true, () => true, leave);
    return null;
  }
  let tree;
  act(() => {
    tree = create(<Probe />);
  });
  expect(navigation.setOptions).toHaveBeenCalledWith({
    headerBackButtonMenuEnabled: false
  });
  expect(mockPrevent.prevent).toBe(true);
  const action = { type: 'GO_BACK' };
  act(() => mockPrevent.callback({ data: { action } }));
  expect(alert.mock.calls[0][1]).toContain('Sair não cancela');
  act(() => alert.mock.calls[0][2][0].onPress());
  expect(navigation.dispatch).not.toHaveBeenCalled();
  act(() => mockPrevent.callback({ data: { action } }));
  act(() => alert.mock.calls[1][2][1].onPress());
  expect(leave).toHaveBeenCalledTimes(1);
  expect(mockPrevent.prevent).toBe(false);
  expect(navigation.dispatch).toHaveBeenCalledWith(action);
  act(() => tree.unmount());
  alert.mockRestore();
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function setup(save) {
  const navigation = { setOptions: jest.fn(), dispatch: jest.fn() };
  const leave = jest.fn();
  let exit, tree;
  function Probe() {
    exit = usePendingEditsExit(navigation, true, () => true, leave, save);
    return null;
  }
  act(() => {
    tree = create(<Probe />);
  });
  return { navigation, leave, tree, exit: () => exit };
}
test('back waits for acknowledgement, deduplicates presses and resumes without an unnecessary warning', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const pending = deferred(),
    save = jest.fn(() => pending.promise);
  const editor = setup(save),
    action = { type: 'GO_BACK', source: 'questionnaire' };
  await act(async () => {
    mockPrevent.callback({ data: { action } });
    mockPrevent.callback({ data: { action } });
  });
  expect(editor.exit().saving).toBe(true);
  expect(save).toHaveBeenCalledTimes(1);
  expect(editor.navigation.dispatch).not.toHaveBeenCalled();
  await act(async () => pending.resolve(true));
  expect(alert).not.toHaveBeenCalled();
  expect(editor.leave).toHaveBeenCalledTimes(1);
  expect(editor.navigation.dispatch).toHaveBeenCalledWith(action);
  act(() => editor.tree.unmount());
  alert.mockRestore();
});

test.each(['continue', 'unmount'])(
  'a late acknowledgement cannot navigate after %s',
  async (choice) => {
    const pending = deferred();
    const editor = setup(() => pending.promise);
    await act(async () =>
      mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } })
    );
    act(() =>
      choice === 'continue'
        ? editor.exit().continueEditing()
        : editor.tree.unmount()
    );
    await act(async () => pending.resolve(true));
    expect(editor.navigation.dispatch).not.toHaveBeenCalled();
    expect(editor.leave).not.toHaveBeenCalled();
    if (choice === 'continue') act(() => editor.tree.unmount());
  }
);

test.each(['false', 'reject'])(
  'unconfirmed save (%s) preserves editor until an explicit leave choice',
  async (result) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const editor = setup(() =>
      result === 'reject'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(false)
    );
    await act(async () =>
      mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } })
    );
    expect(alert).toHaveBeenCalledTimes(1);
    expect(editor.exit().saving).toBe(false);
    expect(editor.navigation.dispatch).not.toHaveBeenCalled();
    act(() => alert.mock.calls[0][2][0].onPress());
    expect(editor.leave).not.toHaveBeenCalled();
    act(() => editor.tree.unmount());
    alert.mockRestore();
  }
);

test('opening the explicit warning takes ownership of the choice even if the server replies meanwhile', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const pending = deferred(),
    editor = setup(() => pending.promise);
  const action = { type: 'GO_BACK' };
  await act(async () => mockPrevent.callback({ data: { action } }));
  act(() => editor.exit().leaveWithoutWaiting());
  await act(async () => pending.resolve(true));
  expect(editor.navigation.dispatch).not.toHaveBeenCalled();
  expect(editor.leave).not.toHaveBeenCalled();
  act(() => alert.mock.calls[0][2][1].onPress());
  expect(editor.navigation.dispatch).toHaveBeenCalledWith(action);
  act(() => editor.tree.unmount());
  alert.mockRestore();
});

test('an old native warning cannot navigate a screen that has unmounted or changed account', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const editor = setup(() => Promise.resolve(false));
  await act(async () =>
    mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } })
  );
  act(() => editor.tree.unmount());
  act(() => alert.mock.calls[0][2][1].onPress());
  expect(editor.navigation.dispatch).not.toHaveBeenCalled();
  expect(editor.leave).not.toHaveBeenCalled();
  alert.mockRestore();
});
