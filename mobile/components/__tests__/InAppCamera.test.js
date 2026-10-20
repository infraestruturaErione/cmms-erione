import React from 'react';
import { act, create } from 'react-test-renderer';
import { ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { IconButton } from 'react-native-paper';
import InAppCamera from '../InAppCamera';
const mockCapture = jest.fn();
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockCapture }));
      return React.createElement('CameraSurface', props);
    }),
    useCameraPermissions: () => [{ granted: true }, jest.fn()]
  };
});
let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.clearAllMocks();
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
function render(extra = {}) {
  const onCapture = jest.fn(),
    onClose = jest.fn();
  act(() => {
    tree = create(
      <InAppCamera visible onCapture={onCapture} onClose={onClose} {...extra} />
    );
  });
  const capture = () =>
    tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.testID === 'camera-capture');
  return { onCapture, onClose, capture };
}
test('same-tick double capture starts one native request and locks close/flip', async () => {
  const pending = deferred();
  mockCapture.mockReturnValue(pending.promise);
  const probe = render();
  let request;
  act(() => {
    const press = probe.capture().props.onPress;
    request = press();
    press();
    tree.root
      .findAllByType(IconButton)
      .forEach((button) => button.props.onPress());
  });
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(probe.onClose).not.toHaveBeenCalled();
  expect(probe.capture().props.disabled).toBe(true);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  await act(async () => {
    pending.resolve({ uri: 'file:///one.jpg' });
    await request;
  });
  expect(probe.onCapture).toHaveBeenCalledWith('file:///one.jpg');
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(mockCapture).toHaveBeenCalledWith({ quality: 0.7 });
});

const button = (id) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.props.testID === id);

test('camera controls are siblings, never children of the native camera surface', () => {
  render();
  expect(tree.root.findByType('CameraSurface').props.children).toBeUndefined();
});

test('review stops the spinner and waits for explicit confirmation before adding the photo', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///review.jpg' });
  const probe = render({ confirmCapture: true, multiCapture: true });
  await act(async () => probe.capture().props.onPress());
  expect(probe.onCapture).not.toHaveBeenCalled();
  expect(probe.onClose).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(tree.root.findAllByType('CameraSurface')).toHaveLength(0);
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'file:///review.jpg'
  );
  act(() => {
    const confirm = button('camera-confirm').props.onPress;
    confirm();
    confirm();
  });
  expect(probe.onCapture).toHaveBeenCalledTimes(1);
  expect(probe.onCapture).toHaveBeenCalledWith('file:///review.jpg');
  expect(probe.onClose).toHaveBeenCalledTimes(1);
});

test('retake discards only the unconfirmed photo and permits a fresh capture', async () => {
  mockCapture
    .mockResolvedValueOnce({ uri: 'file:///discard.jpg' })
    .mockResolvedValueOnce({ uri: 'file:///keep.jpg' });
  const probe = render({ confirmCapture: true });
  await act(async () => probe.capture().props.onPress());
  expect(button('camera-confirm-another')).toBeUndefined();
  act(() => button('camera-retake').props.onPress());
  expect(tree.root.findAllByType('CameraSurface')).toHaveLength(1);
  expect(probe.onCapture).not.toHaveBeenCalled();
  await act(async () => probe.capture().props.onPress());
  act(() => button('camera-confirm').props.onPress());
  expect(probe.onCapture).toHaveBeenCalledWith('file:///keep.jpg');
  expect(probe.onCapture).toHaveBeenCalledTimes(1);
});

test('confirm and take another adds once without closing; final confirmation returns to selection', async () => {
  mockCapture
    .mockResolvedValueOnce({ uri: 'file:///a.jpg' })
    .mockResolvedValueOnce({ uri: 'file:///b.jpg' });
  const probe = render({ confirmCapture: true, multiCapture: true });
  await act(async () => probe.capture().props.onPress());
  act(() => {
    const confirm = button('camera-confirm-another').props.onPress;
    confirm();
    confirm();
  });
  expect(probe.onCapture).toHaveBeenCalledTimes(1);
  expect(probe.onClose).not.toHaveBeenCalled();
  await act(async () => probe.capture().props.onPress());
  act(() => button('camera-confirm').props.onPress());
  expect(probe.onCapture.mock.calls).toEqual([
    ['file:///a.jpg'],
    ['file:///b.jpg']
  ]);
  expect(probe.onClose).toHaveBeenCalledTimes(1);
});

test('failed preview cannot be confirmed and can be retaken', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///broken.jpg' });
  const probe = render({ confirmCapture: true });
  await act(async () => probe.capture().props.onPress());
  act(() => tree.root.findByType(Image).props.onError());
  expect(button('camera-confirm').props.disabled).toBe(true);
  act(() => button('camera-confirm').props.onPress());
  expect(probe.onCapture).not.toHaveBeenCalled();
  act(() => button('camera-retake').props.onPress());
  expect(probe.capture().props.disabled).toBe(false);
});

test('closing the review does not add an unconfirmed photo', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///cancel.jpg' });
  const probe = render({ confirmCapture: true });
  await act(async () => probe.capture().props.onPress());
  act(() =>
    tree.root
      .findAllByType(IconButton)
      .find((node) => node.props.accessibilityLabel === 'Fechar câmera')
      .props.onPress()
  );
  expect(probe.onCapture).not.toHaveBeenCalled();
  expect(probe.onClose).toHaveBeenCalledTimes(1);
});

test('consumer failure preserves the preview for an explicit retry without a spinner', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///retry.jpg' });
  const probe = render({ confirmCapture: true });
  probe.onCapture.mockImplementationOnce(() => {
    throw new Error('unavailable');
  });
  await act(async () => probe.capture().props.onPress());
  act(() => button('camera-confirm').props.onPress());
  expect(probe.onClose).not.toHaveBeenCalled();
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'file:///retry.jpg'
  );
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Tente confirmar');
  act(() => button('camera-confirm').props.onPress());
  expect(probe.onClose).toHaveBeenCalledTimes(1);
});

test('hiding and reopening clears an unconfirmed preview without adding it', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///unconfirmed.jpg' });
  const probe = render({ confirmCapture: true });
  await act(async () => probe.capture().props.onPress());
  const update = (visible) =>
    tree.update(<InAppCamera visible={visible} confirmCapture {...probe} />);
  act(() => update(false));
  act(() => update(true));
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(probe.onCapture).not.toHaveBeenCalled();
  expect(probe.capture().props.disabled).toBe(false);
});

test('late capture from a closed session cannot clear the next session capture lock', async () => {
  const old = deferred(),
    current = deferred();
  mockCapture
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise);
  const probe = render({ confirmCapture: true });
  let first, second;
  act(() => {
    first = probe.capture().props.onPress();
  });
  const update = (visible) =>
    tree.update(<InAppCamera visible={visible} confirmCapture {...probe} />);
  act(() => update(false));
  act(() => update(true));
  act(() => {
    second = probe.capture().props.onPress();
  });
  await act(async () => {
    old.resolve({ uri: 'file:///old.jpg' });
    await first;
  });
  expect(probe.capture().props.disabled).toBe(true);
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await act(async () => {
    current.resolve({ uri: 'file:///new.jpg' });
    await second;
  });
  expect(tree.root.findByType(Image).props.source.uri).toBe('file:///new.jpg');
  expect(probe.onCapture).not.toHaveBeenCalled();
});
test('error is visible and releases capture for retry', async () => {
  mockCapture
    .mockRejectedValueOnce(new Error('camera busy'))
    .mockResolvedValueOnce({ uri: 'file:///ok.jpg' });
  const probe = render();
  await act(async () => {
    await probe.capture().props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Não foi possível capturar');
  expect(probe.capture().props.disabled).toBe(false);
  await act(async () => {
    await probe.capture().props.onPress();
  });
  expect(probe.onCapture).toHaveBeenCalledTimes(1);
});
test('optional multiple mode keeps capture available, single mode does not show batch controls', async () => {
  mockCapture.mockResolvedValue({ uri: 'file:///ok.jpg' });
  const probe = render({ multiCapture: true, capturedCount: 3 });
  await act(async () => {
    await probe.capture().props.onPress();
  });
  await act(async () => {
    await probe.capture().props.onPress();
  });
  expect(probe.onCapture).toHaveBeenCalledTimes(2);
  expect(probe.onClose).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Voltar às fotos selecionadas'
  );
  act(() =>
    tree.update(
      <InAppCamera
        visible
        onCapture={probe.onCapture}
        onClose={probe.onClose}
      />
    )
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    'Voltar às fotos selecionadas'
  );
});
test('late result after unmount cannot call the consumer', async () => {
  const pending = deferred();
  mockCapture.mockReturnValue(pending.promise);
  const probe = render();
  let request;
  act(() => {
    request = probe.capture().props.onPress();
  });
  act(() => tree.unmount());
  tree = undefined;
  await act(async () => {
    pending.resolve({ uri: 'file:///late.jpg' });
    await request;
  });
  expect(probe.onCapture).not.toHaveBeenCalled();
});
