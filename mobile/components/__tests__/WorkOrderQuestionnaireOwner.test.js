import React from 'react';
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { SheetManager } from 'react-native-actions-sheet';
import SingleTask from '../SingleTask';
import { canExecuteWorkOrder } from '../../utils/workOrderExecution';

jest.mock('../../hooks/useAuth', () => () => ({ user: { id: 1 } }));
jest.mock('../WorkOrderImage', () => ({
  __esModule: true,
  default: () => null
}));
jest.useFakeTimers();
const order = {
  id: 85,
  status: 'IN_PROGRESS',
  primaryUser: { id: 2 },
  assignedTo: [{ id: 1 }, { id: 2 }],
  executionOwner: { id: 1 }
};
let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.clearAllTimers();
  jest.restoreAllMocks();
});
const task = (type) => ({
  id: 9,
  value: '',
  notes: '',
  images: [],
  taskBase: {
    id: 10,
    label: 'Pergunta da OS',
    taskType: type,
    user: { id: 2, firstName: 'Atribuicao', lastName: 'antiga' },
    options: [{ label: 'Sim' }, { label: 'Nao' }]
  }
});
function render(type, workOrder = order, extra = {}) {
  const save = jest.fn();
  act(() => {
    tree = create(
      <SingleTask
        task={task(type)}
        workOrderId={85}
        readOnly={!canExecuteWorkOrder(workOrder, 1)}
        notes={new Map()}
        handleChange={save}
        {...extra}
      />
    );
  });
  return save;
}

test.each(['TEXT', 'NUMBER', 'METER'])(
  'actual executor can answer %s despite another legacy task assignee',
  (type) => {
    const save = render(type);
    const input = tree.root.findByType(TextInput);
    expect(input.props.disabled).toBe(false);
    act(() =>
      input.props.onChangeText(type === 'TEXT' ? 'Atendimento feito' : '123')
    );
    act(() => jest.advanceTimersByTime(1000));
    expect(save).toHaveBeenCalledWith(
      type === 'TEXT' ? 'Atendimento feito' : '123',
      9
    );
  }
);

test.each(['SUBTASK', 'INSPECTION', 'MULTIPLE'])(
  'actual executor can answer %s choice despite another legacy task assignee',
  (type) => {
    const show = jest.spyOn(SheetManager, 'show').mockResolvedValue();
    const save = render(type);
    const choice = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(TextInput).length > 0);
    expect(choice.props.disabled).toBe(false);
    act(() => choice.props.onPress());
    const payload = show.mock.calls[0][1].payload;
    act(() => payload.setValue(payload.items[0].value));
    expect(save).toHaveBeenCalledWith(payload.items[0].value, 9);
  }
);

test.each([
  ['companion', { ...order, executionOwner: { id: 2 } }],
  ['unclaimed shared OS', { ...order, executionOwner: null }],
  ['completed OS', { ...order, status: 'COMPLETE' }]
])(
  '%s remains blocked even if input change is invoked directly',
  (_, workOrder) => {
    const save = render('TEXT', workOrder);
    const input = tree.root.findByType(TextInput);
    expect(input.props.disabled).toBe(true);
    act(() => input.props.onChangeText('Nao pode salvar'));
    act(() => jest.advanceTimersByTime(1500));
    expect(save).not.toHaveBeenCalled();
  }
);

test('legacy assignee restriction outside OS context remains unchanged', () => {
  const save = render('TEXT', order, {
    workOrderId: undefined,
    readOnly: false
  });
  const input = tree.root.findByType(TextInput);
  expect(input.props.disabled).toBe(true);
  act(() => input.props.onChangeText('Nao pode salvar'));
  act(() => jest.advanceTimersByTime(1500));
  expect(save).not.toHaveBeenCalled();
});

test.each(['SUBTASK', 'INSPECTION', 'MULTIPLE'])(
  'companion cannot open or mutate a %s choice',
  (type) => {
    const show = jest.spyOn(SheetManager, 'show').mockResolvedValue();
    const save = render(type, { ...order, executionOwner: { id: 2 } });
    const choice = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(TextInput).length > 0);
    expect(choice.props.disabled).toBe(true);
    act(() => choice.props.onPress());
    expect(show).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  }
);

test('losing execution cancels a pending debounced answer', () => {
  const save = render('TEXT');
  act(() => tree.root.findByType(TextInput).props.onChangeText('Rascunho'));
  act(() =>
    tree.update(
      <SingleTask
        task={task('TEXT')}
        workOrderId={85}
        readOnly
        notes={new Map()}
        handleChange={save}
      />
    )
  );
  act(() => jest.advanceTimersByTime(1500));
  expect(save).not.toHaveBeenCalled();
});
