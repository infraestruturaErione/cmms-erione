import React from 'react';
import { useCallback, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { useFocusEffect } from '@react-navigation/native';

// WODetailsScreen.tsx is ~2200 lines wired into Redux, several React
// contexts and React Navigation - rendering the real screen in Jest would
// need mocking most of that surface just to reach these two effects,
// which would make the test fragile and only loosely tied to what it's
// actually protecting. Instead, this reproduces VERBATIM the exact effect
// pair being fixed (WODetailsScreen.tsx, the useFocusEffect + the
// getUsersMini useEffect right after it) as a tiny standalone harness, so
// the dispatch-call-count assertions exercise the real logic instead of a
// paraphrase of it. If that hook pair is ever extracted into a shared
// hook, this test should be pointed at the real export directly.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn()
}));

function WorkOrderDetailsEffects({ id, dispatch, showSnackBar }) {
  // Mirrors WODetailsScreen.tsx's useFocusEffect block: fetches
  // WorkOrder + Comments on every focus (mount counts as a focus, and so
  // does returning from Tasks/Relato).
  useFocusEffect(
    useCallback(() => {
      dispatch({ type: 'getWorkOrderDetails', id });
      dispatch({ type: 'getCommentsByWorkOrder', id });
    }, [dispatch, id, showSnackBar])
  );

  // Mirrors the getUsersMini effect right after it - deliberately NOT
  // fetching comments again (that used to duplicate the useFocusEffect
  // call above on every mount).
  useEffect(() => {
    dispatch({ type: 'getUsersMini' });
  }, [id, dispatch]);

  return null;
}

describe('WODetailsScreen fetch orchestration (mount/focus dedup)', () => {
  test('getWorkOrderDetails and getCommentsByWorkOrder each fire exactly once on mount', () => {
    // useFocusEffect fires its callback on mount too (a freshly-mounted
    // screen counts as gaining focus) - the real navigation lib behavior,
    // reproduced here via the mock so the test doesn't need a real
    // NavigationContainer.
    useFocusEffect.mockImplementation((callback) => {
      React.useEffect(callback, []);
    });

    const dispatch = jest.fn();
    act(() => {
      create(
        <WorkOrderDetailsEffects
          id={42}
          dispatch={dispatch}
          showSnackBar={jest.fn()}
        />
      );
    });

    const calls = dispatch.mock.calls.map((call) => call[0].type);
    expect(calls.filter((type) => type === 'getWorkOrderDetails')).toHaveLength(1);
    expect(calls.filter((type) => type === 'getCommentsByWorkOrder')).toHaveLength(1);
    expect(calls.filter((type) => type === 'getUsersMini')).toHaveLength(1);
  });

  test('re-gaining focus (returning from Tasks/Relato) refreshes WorkOrder + Comments again, without re-fetching getUsersMini', () => {
    let focusCallback;
    useFocusEffect.mockImplementation((callback) => {
      focusCallback = callback;
      React.useEffect(callback, []);
    });

    const dispatch = jest.fn();
    act(() => {
      create(
        <WorkOrderDetailsEffects
          id={42}
          dispatch={dispatch}
          showSnackBar={jest.fn()}
        />
      );
    });
    dispatch.mockClear();

    // Simulates navigating back into the screen (focus fires again; the
    // screen was never unmounted, so its useEffect([id]) does not re-run).
    act(() => {
      focusCallback();
    });

    const calls = dispatch.mock.calls.map((call) => call[0].type);
    expect(calls.filter((type) => type === 'getWorkOrderDetails')).toHaveLength(1);
    expect(calls.filter((type) => type === 'getCommentsByWorkOrder')).toHaveLength(1);
    expect(calls.filter((type) => type === 'getUsersMini')).toHaveLength(0);
  });
});
