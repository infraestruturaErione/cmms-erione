import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button, PaperProvider, TextInput } from 'react-native-paper';
import TasksScreen from '../TasksScreen';
import { Alert } from 'react-native';
let mockPrevent;
let mockState,
  mockUser,
  mockFail = false;
const mockDispatch = jest.fn(async (action) => {
  if (action?.type === 'patch') {
    if (mockFail) throw new Error('offline');
    mockState.tasks.tasksByWorkOrder[1] =
      mockState.tasks.tasksByWorkOrder[1].map((task) =>
        task.id === action.payload.id ? action.payload : task
      );
  }
});
jest.mock('../../../store', () => ({
  __esModule: true,
  default: { getState: () => mockState },
  useSelector: (select) => select(mockState),
  useDispatch: () => mockDispatch
}));
jest.mock('../../../hooks/useAuth', () => () => ({ user: mockUser }));
jest.mock('../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({
    showSnackBar: jest.fn()
  })
}));
jest.mock('../../../utils/api', () => ({
  onWorkOrderExecutionConflict: () => () => {}
}));
jest.mock('../../../slices/workOrder', () => ({
  getWorkOrderDetails: () => ({ type: 'get' })
}));
jest.mock('../../../slices/task', () => ({
  getTasks: () => ({ type: 'get' }),
  patchTask: (_wo, id, edit) => ({
    type: 'patch',
    payload: edit(
      mockState.tasks.tasksByWorkOrder[1].find((task) => task.id === id)
    )
  })
}));
jest.mock('../../../components/WorkOrderImage', () => ({
  __esModule: true,
  default: () => null,
  WorkOrderImageViewer: () => null
}));
jest.mock('../../../hooks/useLocalWorkOrderRemovalBlock', () => jest.fn());
jest.mock('@react-navigation/native', () => ({
  UNSTABLE_usePreventRemove: (prevent, callback) => {
    mockPrevent = { prevent, callback };
  }
}));
jest.useFakeTimers();
let tree;
const task = (value = '') => ({
  id: 2,
  value,
  notes: '',
  images: [],
  taskBase: { id: 4, label: 'Problema', taskType: 'TEXT', options: [] }
});
const navigation = {
  setOptions: jest.fn(),
  dispatch: jest.fn(),
  goBack: jest.fn()
};
const props = () => ({
  navigation,
  route: {
    params: { workOrderId: 1, tasksProps: mockState.tasks.tasksByWorkOrder[1] }
  }
});
const render = () =>
  act(() => {
    tree = create(
      <PaperProvider>
        <TasksScreen {...props()} />
      </PaperProvider>
    );
  });
const input = () =>
  tree.root
    .findAllByType(TextInput)
    .find((node) => node.props.label === 'value');
beforeEach(() => {
  navigation.dispatch.mockClear();
  mockFail = false;
  mockDispatch.mockClear();
  mockUser = { id: 1, companyId: 1, role: { code: 'TECHNICIAN' } };
  mockState = {
    tasks: { session: 0, tasksByWorkOrder: { 1: [task()] } },
    workOrders: {
      workOrderInfos: {
        1: {
          workOrder: {
            id: 1,
            status: 'IN_PROGRESS',
            primaryUser: { id: 1 },
            executionOwner: { id: 1 }
          }
        }
      }
    }
  };
});

test('two filled answers immediately followed by Back are confirmed without a misleading pending dialog', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockState.tasks.tasksByWorkOrder[1].push({ ...task(), id: 3 });
  render();
  const fields = () =>
    tree.root
      .findAllByType(TextInput)
      .filter((node) => node.props.label === 'value');
  act(() => {
    fields()[0].props.onChangeText('Problema encontrado');
    fields()[1].props.onChangeText('Solucao executada');
  });
  const action = { type: 'GO_BACK' };
  expect(mockPrevent.prevent).toBe(true);
  await act(async () => mockPrevent.callback({ data: { action } }));
  expect(mockState.tasks.tasksByWorkOrder[1].map((task) => task.value)).toEqual(
    ['Problema encontrado', 'Solucao executada']
  );
  expect(
    mockDispatch.mock.calls.filter(([action]) => action.type === 'patch')
  ).toHaveLength(2);
  expect(alert).not.toHaveBeenCalled();
  expect(navigation.dispatch).toHaveBeenCalledWith(action);
  expect(mockPrevent.prevent).toBe(false);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(
    mockDispatch.mock.calls.filter(([action]) => action.type === 'patch')
  ).toHaveLength(2);
  alert.mockRestore();
});

test('failed exit confirmation leaves the typed answer visible and does not navigate', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render();
  act(() => input().props.onChangeText('Nao perder esta resposta'));
  mockFail = true;
  await act(async () =>
    mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } })
  );
  expect(alert).toHaveBeenCalledTimes(1);
  expect(input().props.value).toBe('Nao perder esta resposta');
  expect(navigation.dispatch).not.toHaveBeenCalled();
  act(() => alert.mock.calls[0][2][0].onPress());
  expect(mockPrevent.prevent).toBe(true);
  alert.mockRestore();
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.clearAllTimers();
});
test('real input failure preserves text, and retry sends latest text rather than failed payload', async () => {
  render();
  mockFail = true;
  act(() => input().props.onChangeText('ABC'));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(input().props.value).toBe('ABC');
  expect(JSON.stringify(tree.toJSON())).toContain('Tentar enviar novamente');
  act(() => input().props.onChangeText('ABCD'));
  mockFail = false;
  // A new edit changes error to waiting; its existing debounce sends the newest text.
  await act(async () => jest.advanceTimersByTime(1000));
  expect(
    mockDispatch.mock.calls
      .filter(([action]) => action.type === 'patch')
      .map(([action]) => action.payload.value)
  ).toEqual(['ABC', 'ABCD']);
  expect(input().props.value).toBe('ABCD');
});
test('an account/scope change remounts the editor instead of leaking another account draft', () => {
  render();
  act(() => input().props.onChangeText('private account one'));
  mockUser = { id: 3, companyId: 2, role: { code: 'TECHNICIAN' } };
  mockState = {
    tasks: { session: 1, tasksByWorkOrder: { 1: [task('account two')] } },
    workOrders: {
      workOrderInfos: {
        1: {
          workOrder: {
            id: 1,
            status: 'IN_PROGRESS',
            primaryUser: { id: 3 },
            executionOwner: { id: 3 }
          }
        }
      }
    }
  };
  act(() =>
    tree.update(
      <PaperProvider>
        <TasksScreen {...props()} />
      </PaperProvider>
    )
  );
  expect(input().props.value).toBe('account two');
  act(() => jest.advanceTimersByTime(1000));
  expect(
    mockDispatch.mock.calls.filter(([action]) => action.type === 'patch')
  ).toHaveLength(0);
});
test('companion sees read-only notice and disabled answers without operational write', () => {
  mockUser = { id: 3, companyId: 1, role: { code: 'TECHNICIAN' } };
  render();
  expect(input().props.disabled).toBe(true);
  act(() => input().props.onChangeText('forbidden'));
  act(() => jest.advanceTimersByTime(1000));
  expect(
    mockDispatch.mock.calls.filter(([action]) => action.type === 'patch')
  ).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Somente leitura');
  expect(
    tree.root
      .findAllByType(Button)
      .some((button) => button.props.children === 'Ir para próxima pendente')
  ).toBe(true);
});
