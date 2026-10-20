import React from 'react';
import { act, create } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import FieldOrderCard from '../components/FieldOrderCard';
import { FieldHero } from '../../../components/erione/FieldWorkOrderUI';

const base = {
  customId: 'WO000085',
  title: 'Verificar o portão principal e os leitores de acesso da unidade',
  status: 'Aberto',
  statusColor: '#2A4899',
  customer: 'Cliente de teste',
  location: 'Unidade central',
  address: 'Rua do Comércio, 25 - Centro',
  createdAt: '16/10/2026 11:20',
  action: 'Continuar atendimento'
};
jest.useFakeTimers();
const render = (props = {}) => {
  let tree;
  act(() => {
    tree = create(<FieldOrderCard {...base} {...props} />);
  });
  return tree;
};
const labels = (tree) =>
  tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children);

test('card keeps title, address and opening date without clipping and opens details once', () => {
  const onPress = jest.fn();
  const tree = render({ onPress });
  expect(labels(tree)).toEqual(
    expect.arrayContaining([base.title, base.location, base.address])
  );
  const title = tree.root.findAll(
    (node) => node.props.children === base.title
  )[0];
  expect(title.props.numberOfLines).toBeUndefined();
  const press = tree.root.findByType(TouchableOpacity);
  expect(press.props.accessibilityLabel).toContain(base.customId);
  act(() => press.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('lightweight summary explains online consultation and does not offer removal or writes', () => {
  const tree = render({
    summary: true,
    action: 'Consultar detalhes online',
    status: 'Concluído'
  });
  expect(
    labels(tree).some((label) =>
      label.includes('Consulte novamente pela internet')
    )
  ).toBe(true);
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(1);
  act(() => tree.unmount());
});

test('companion is explicitly read-only without an execution action button', () => {
  const tree = render({
    companion: true,
    action: 'Ronaldo está executando esta OS'
  });
  expect(labels(tree)).toContain('SOMENTE LEITURA');
  expect(tree.root.findAllByType(TouchableOpacity)).toHaveLength(1);
  act(() => tree.unmount());
});

test('hero wraps a long heading and a large result count instead of truncating them', () => {
  let tree;
  act(() => {
    tree = create(
      <FieldHero
        eyebrow="OPERAÇÃO EM CAMPO"
        title={base.title}
        count={1240}
        countLabel="resultados"
      />
    );
  });
  const title = tree.root.findAll(
    (node) => node.props.children === base.title
  )[0];
  expect(title.props.numberOfLines).toBeUndefined();
  expect(title.props.accessibilityRole).toBe('header');
  act(() => tree.unmount());
});
