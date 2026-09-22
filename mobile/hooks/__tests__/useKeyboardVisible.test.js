import React from 'react';
import { act, create } from 'react-test-renderer';
import { Keyboard, Platform } from 'react-native';
import useKeyboardVisible from '../useKeyboardVisible';

function Probe() {
  const visible = useKeyboardVisible();
  return <probe-result data-visible={visible ? 'sim' : 'nao'} />;
}

describe('useKeyboardVisible', () => {
  let listeners;
  let removeSpy;

  const render = () => {
    let root;
    act(() => {
      root = create(<Probe />);
    });
    return root;
  };
  const visibleOf = (root) =>
    root.root.findByType('probe-result').props['data-visible'];
  const emit = (event) => {
    act(() => {
      (listeners[event] ?? []).forEach((callback) => callback());
    });
  };

  beforeEach(() => {
    listeners = {};
    removeSpy = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, cb) => {
      listeners[event] = [...(listeners[event] ?? []), cb];
      return { remove: removeSpy };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('comeca fechado e acompanha abrir/fechar no Android (eventos did*)', () => {
    Platform.OS = 'android';
    const root = render();
    expect(visibleOf(root)).toBe('nao');

    emit('keyboardDidShow');
    expect(visibleOf(root)).toBe('sim');

    emit('keyboardDidHide');
    expect(visibleOf(root)).toBe('nao');
  });

  it('usa os eventos will* no iOS, que chegam antes da animacao', () => {
    Platform.OS = 'ios';
    const root = render();

    emit('keyboardWillShow');
    expect(visibleOf(root)).toBe('sim');

    emit('keyboardWillHide');
    expect(visibleOf(root)).toBe('nao');
  });

  it('remove os listeners ao desmontar', () => {
    const root = render();

    act(() => {
      root.unmount();
    });

    expect(removeSpy).toHaveBeenCalledTimes(2);
  });
});
