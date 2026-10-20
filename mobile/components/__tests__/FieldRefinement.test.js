import React from 'react';
import { act, create } from 'react-test-renderer';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Button,
  Dialog,
  PaperProvider,
  TouchableRipple
} from 'react-native-paper';
import { FieldSectionTitle } from '../erione/FieldWorkOrderUI';
import { ErionePrimaryButton } from '../erione/ErioneUI';
import AuthenticatedUserIdentity from '../erione/AuthenticatedUserIdentity';
import LocalRemovalDialog from '../../screens/workOrders/components/LocalRemovalDialog';
import { authenticatedIdentity } from '../../utils/authenticatedIdentity';
import { fieldTabBarStyle } from '../../navigation/fieldNavigationLayout';

let mockUser;
jest.mock('../../hooks/useAuth', () => () => ({ user: mockUser }));
jest.useFakeTimers();
const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
const labels = (tree) =>
  tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children);

test('execution title and long status are vertically separate, not competing horizontal siblings', () => {
  const title = 'Execução em campo';
  const status = 'Atendimento de campo encerrado';
  const tree = render(
    <FieldSectionTitle
      icon="map-marker-check-outline"
      title={title}
      helper="Acompanhe as etapas do atendimento em campo."
      status={status}
    />
  );
  const statusNode = tree.root.findAllByProps({
    testID: 'field-section-status'
  })[0];
  expect(StyleSheet.flatten(statusNode.props.style)).toMatchObject({
    maxWidth: '100%'
  });
  expect(
    StyleSheet.flatten(statusNode.parent.props.style)?.flexDirection
  ).not.toBe('row');
  expect(labels(tree)).toEqual(expect.arrayContaining([title, status]));
  expect(
    tree.root
      .findAll(
        (node) =>
          node.props.children === title || node.props.children === status
      )
      .every((node) => node.props.numberOfLines === undefined)
  ).toBe(true);
  act(() => tree.unmount());
});

test.each([1, 1.3, 2, 3])(
  'tab bar reserves layout space, without absolute overlay, at font scale %s',
  (scale) => {
    const style = fieldTabBarStyle(scale);
    expect(style.position).not.toBe('absolute');
    expect(style.height).toBeGreaterThanOrEqual(38 + 32 * scale);
    expect(style.bottom).toBeUndefined();
  }
);

test('primary actions allow wrapping and suppress duplicate touches while busy', () => {
  const onPress = jest.fn();
  const tree = render(
    <ErionePrimaryButton wrapLabel onPress={onPress} loading>
      Continuar o atendimento desta ordem de serviço
    </ErionePrimaryButton>
  );
  expect(tree.root.findByType(TouchableRipple).props.disabled).toBe(true);
  expect(
    tree.root.findByType(TouchableRipple).props.accessibilityState.busy
  ).toBe(true);
  expect(
    tree.root
      .findAll(
        (node) =>
          node.props.children ===
          'Continuar o atendimento desta ordem de serviço'
      )
      .every((node) => node.props.numberOfLines === undefined)
  ).toBe(true);
  act(() => tree.unmount());
});

test.each([
  ['11987654321', '(11) 98765-4321'],
  ['(11) 3456-7890', '(11) 3456-7890'],
  ['+55 11 98765-4321', '+55 (11) 98765-4321'],
  ['+1 212 555 0199', '+1 212 555 0199'],
  [null, 'Telefone não informado'],
  [' ', 'Telefone não informado']
])(
  'formats own telephone %s without inventing unavailable data',
  (phone, expected) => {
    expect(authenticatedIdentity({ phone }).phone).toBe(expected);
  }
);

test('identity follows only current auth user, including account change and missing/long data', () => {
  mockUser = {
    firstName: 'Técnica',
    lastName: 'Autenticada',
    phone: '11987654321'
  };
  const tree = render(<AuthenticatedUserIdentity />);
  expect(labels(tree)).toEqual(
    expect.arrayContaining(['Técnica Autenticada', '(11) 98765-4321'])
  );
  mockUser = {
    firstName: 'Nome muito extenso de outra conta autenticada',
    lastName: 'Sobrenome extenso',
    phone: undefined
  };
  act(() => tree.update(<AuthenticatedUserIdentity />));
  expect(labels(tree)).not.toContain('Técnica Autenticada');
  expect(labels(tree)).not.toContain('(11) 98765-4321');
  expect(labels(tree)).toContain('Telefone não informado');
  mockUser = null;
  act(() => tree.update(<AuthenticatedUserIdentity />));
  expect(labels(tree)).toContain('Nome não informado');
  act(() => tree.unmount());
});

test('cleanup dialog scrolls, shows failure inline, and disables dismissal/actions during verification', () => {
  const onConfirm = jest.fn();
  const onDismiss = jest.fn();
  const element = (busy) => (
    <PaperProvider>
      <LocalRemovalDialog
        visible
        busy={busy}
        error="Resposta diferente no questionário. Nada foi apagado."
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    </PaperProvider>
  );
  const tree = render(element(false));
  act(() => jest.runOnlyPendingTimers());
  expect(tree.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  expect(labels(tree)).toContain(
    'Resposta diferente no questionário. Nada foi apagado.'
  );
  const confirm = tree.root.findByType(ErionePrimaryButton);
  act(() => confirm.props.onPress());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  act(() => tree.update(element(true)));
  expect(tree.root.findByType(Dialog).props.dismissable).toBe(false);
  expect(tree.root.findByType(ErionePrimaryButton).props.disabled).toBe(true);
  expect(
    tree.root.findAllByType(Button).every((button) => button.props.disabled)
  ).toBe(true);
  act(() => tree.unmount());
});
