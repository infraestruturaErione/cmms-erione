import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  Text
} from 'react-native';
import DailySummaryCard from '../erione/DailySummaryCard';
import FieldEntrance from '../erione/FieldEntrance';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const metrics = [
  { key: 'open', label: 'OS abertas', value: 1240 },
  { key: 'active', label: 'Em atendimento agora', value: 12 },
  { key: 'priority', label: 'Alta prioridade ou atrasada', value: 0 }
];
let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

test('summary uses bundled Erione artwork, preserves metrics and allows full labels to wrap', () => {
  act(() => {
    tree = create(<DailySummaryCard title="Resumo do dia" metrics={metrics} />);
  });
  const labels = tree.root
    .findAllByType(Text)
    .map((node) => node.props.children);
  expect(labels).toEqual(
    expect.arrayContaining(['Resumo do dia', 'ERIONE CMMS', 1240, 12, 0])
  );
  expect(labels.some((label) => /seu turno/i.test(String(label)))).toBe(false);
  for (const metric of metrics) {
    const text = tree.root
      .findAllByType(Text)
      .find((node) => node.props.children === metric.label);
    expect(text.props.numberOfLines).toBeUndefined();
  }
  const art = tree.root.findAllByProps({ testID: 'daily-summary-artwork' })[0];
  expect(art.props.pointerEvents).toBe('none');
  expect(art.props.accessibilityElementsHidden).toBe(true);
  const images = tree.root.findAllByType(Image);
  expect(images).toHaveLength(2);
  expect(images[0].props.source).toEqual(images[1].props.source);
  expect(images.every((image) => !image.props.source?.uri)).toBe(true);
  expect(
    StyleSheet.flatten(
      tree.root.findAllByProps({ testID: 'daily-summary-card' })[0].props.style
    ).borderColor
  ).toBe(ERIONE_MOBILE_IDENTITY.colors.primary);
});

function motionFixture(initialPreference) {
  const remove = jest.fn();
  let changed;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(initialPreference);
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((event, listener) => {
      expect(event).toBe('reduceMotionChanged');
      changed = listener;
      return { remove };
    });
  const start = jest.fn();
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });
  return { timing, start, remove, change: (value) => changed(value) };
}

test('entry is a single short native animation, not restarted by refreshed content', async () => {
  const motion = motionFixture(Promise.resolve(false));
  await act(async () => {
    tree = create(
      <FieldEntrance delay={70}>
        <Text>Primeiro resumo</Text>
      </FieldEntrance>
    );
  });
  expect(motion.timing).toHaveBeenCalledTimes(1);
  expect(motion.timing.mock.calls[0][1]).toMatchObject({
    duration: 300,
    delay: 70,
    useNativeDriver: true,
    isInteraction: false
  });
  await act(async () => {
    tree.update(
      <FieldEntrance delay={70}>
        <Text>Resumo atualizado</Text>
      </FieldEntrance>
    );
  });
  expect(motion.timing).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  tree = undefined;
  expect(motion.remove).toHaveBeenCalledTimes(1);
});

test('reduced motion disables animation and keeps content visible', async () => {
  const motion = motionFixture(Promise.resolve(true));
  await act(async () => {
    tree = create(
      <FieldEntrance>
        <Text>Resumo</Text>
      </FieldEntrance>
    );
  });
  expect(motion.timing).not.toHaveBeenCalled();
});

test('new reduced-motion preference wins over an older pending native response', async () => {
  let resolve;
  const motion = motionFixture(
    new Promise((done) => {
      resolve = done;
    })
  );
  act(() => {
    tree = create(
      <FieldEntrance>
        <Text>Resumo</Text>
      </FieldEntrance>
    );
  });
  act(() => motion.change(true));
  await act(async () => {
    resolve(false);
  });
  expect(motion.timing).not.toHaveBeenCalled();
});

test('unmount before native preference resolves never starts animation', async () => {
  let resolve;
  const motion = motionFixture(
    new Promise((done) => {
      resolve = done;
    })
  );
  act(() => {
    tree = create(
      <FieldEntrance>
        <Text>Resumo</Text>
      </FieldEntrance>
    );
  });
  act(() => tree.unmount());
  tree = undefined;
  await act(async () => {
    resolve(false);
  });
  expect(motion.timing).not.toHaveBeenCalled();
});
