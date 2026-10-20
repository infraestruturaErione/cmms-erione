jest.mock('immer', () =>
  jest.requireActual('../../../node_modules/immer/dist/cjs/index.js')
);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    deletes: jest.fn()
  },
  getErrorMessage: (error) => error.message
}));

import React, { useEffect, useState } from 'react';
import { act, create } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import { IconButton, Searchbar } from 'react-native-paper';
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from '../../../store/rootReducer';
import api from '../../../utils/api';
import { getWorkOrders, getMoreWorkOrders } from '../../../slices/workOrder';
import {
  applyWorkOrderSearch,
  getWorkOrderSearchText
} from '../workOrderSearch';
import WorkOrderSearchBar from '../components/WorkOrderSearchBar';
import { selectWorkOrderListView } from '../workOrderListViews';

jest.useFakeTimers();
const initial = () => ({
  filterFields: [
    { field: 'assignedToUser', operation: 'eq', value: 7 },
    { field: 'archived', operation: 'eq', value: false },
    {
      field: 'status',
      operation: 'in',
      value: '',
      values: ['OPEN', 'IN_PROGRESS']
    },
    { field: 'priority', operation: 'in', value: '', values: ['HIGH'] }
  ],
  pageNum: 0,
  pageSize: 10,
  direction: 'DESC'
});
let tree, controls, store;
function Harness({ criteria: startingCriteria }) {
  const [criteria, setCriteria] = useState(startingCriteria);
  useEffect(() => {
    store.dispatch(getWorkOrders(criteria));
  }, [criteria]);
  controls = {
    criteria,
    setCriteria,
    refresh: () => store.dispatch(getWorkOrders({ ...criteria, pageNum: 0 })),
    more: () => store.dispatch(getMoreWorkOrders(criteria, 1))
  };
  return (
    <WorkOrderSearchBar
      appliedQuery={getWorkOrderSearchText(criteria)}
      onSubmit={(text) =>
        setCriteria((previous) => applyWorkOrderSearch(previous, text))
      }
    />
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  api.post.mockResolvedValue({
    content: [],
    totalElements: 30,
    size: 10,
    last: false
  });
  store = configureStore({
    reducer: rootReducer,
    middleware: (get) => get({ serializableCheck: false })
  });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.clearAllTimers();
  jest.restoreAllMocks();
});
async function mount(criteria = initial()) {
  await act(async () => {
    tree = create(<Harness criteria={criteria} />);
  });
}
const bar = () => tree.root.findByType(Searchbar);
const type = async (value) => {
  await act(async () => {
    bar().props.onChangeText(value);
  });
};
const submit = async (value = bar().props.value) => {
  await act(async () => {
    bar().props.onSubmitEditing({ nativeEvent: { text: value } });
  });
};
const lastRequest = () => api.post.mock.calls.at(-1)[1];

test('typing letters, deleting text and pausing do not request or change applied criteria', async () => {
  await mount();
  const previous = controls.criteria;
  for (const text of ['W', 'WO', 'WO85', 'W', '']) await type(text);
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(controls.criteria).toBe(previous);
});

test.each(['keyboard', 'magnifier'])(
  '%s applies one trimmed search and preserves every scope/status/priority filter',
  async (method) => {
    await mount();
    await type('  WO85  ');
    if (method === 'keyboard') await submit();
    else
      await act(async () => {
        bar().props.onIconPress();
      });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(lastRequest().filterFields.slice(0, 4)).toEqual(
      initial().filterFields
    );
    expect(getWorkOrderSearchText(lastRequest())).toBe('WO85');
    expect(
      lastRequest()
        .filterFields.at(-1)
        .alternatives.map((item) => item.field)
    ).toEqual(['description', 'feedback', 'customId']);
    expect(Keyboard.dismiss).toHaveBeenCalled();
  }
);

test('IME final text is used on submit even before the draft change callback', async () => {
  await mount();
  await submit('WO123');
  expect(getWorkOrderSearchText(lastRequest())).toBe('WO123');
  expect(bar().props.value).toBe('WO123');
});

test('repeated Enter and magnifier submissions of the same term do not duplicate requests', async () => {
  await mount();
  await type('WO85');
  await submit();
  await submit();
  await act(async () => {
    bar().props.onIconPress();
    bar().props.onIconPress();
  });
  expect(api.post).toHaveBeenCalledTimes(2);
});

test('real clear button resets the applied search with one request, keeping other filters', async () => {
  await mount(applyWorkOrderSearch(initial(), 'WO85'));
  await type('outro rascunho');
  const clear = tree.root
    .findAllByType(IconButton)
    .find(
      (node) =>
        node.props.accessibilityLabel === 'Limpar busca de ordens de serviço'
    );
  await act(async () => {
    clear.props.onPress({});
  });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(lastRequest().filterFields).toEqual(initial().filterFields);
  expect(bar().props.value).toBe('');
});

test('backspace to empty does not clear the applied query until confirmed', async () => {
  await mount(applyWorkOrderSearch(initial(), 'WO85'));
  await type('');
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(getWorkOrderSearchText(controls.criteria)).toBe('WO85');
  await submit();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(getWorkOrderSearchText(lastRequest())).toBe('');
});

test('refresh and pagination keep the applied term, never an unsubmitted draft', async () => {
  await mount(applyWorkOrderSearch(initial(), 'WO85'));
  await type('nao enviado');
  await act(async () => {
    await controls.refresh();
  });
  expect(getWorkOrderSearchText(lastRequest())).toBe('WO85');
  await act(async () => {
    await controls.more();
  });
  expect(lastRequest().pageNum).toBe(1);
  expect(getWorkOrderSearchText(lastRequest())).toBe('WO85');
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(bar().props.value).toBe('nao enviado');
});

test('history selection keeps submitted search and draft separate; external reset syncs the input', async () => {
  await mount(applyWorkOrderSearch(initial(), 'WO85'));
  await type('nao enviado');
  await act(async () => {
    controls.setCriteria((previous) => ({
      ...previous,
      filterFields: selectWorkOrderListView(previous.filterFields, 'history')
    }));
  });
  expect(getWorkOrderSearchText(lastRequest())).toBe('WO85');
  expect(
    lastRequest().filterFields.find((item) => item.field === 'status').values
  ).toEqual(['COMPLETE']);
  expect(bar().props.value).toBe('nao enviado');
  await act(async () => {
    controls.setCriteria(initial());
  });
  expect(bar().props.value).toBe('');
  expect(api.post).toHaveBeenCalledTimes(3);
});

test('whitespace/empty and short searches keep disabled Minhas OS and never mutate the original criteria', () => {
  const previous = initial();
  previous.filterFields = previous.filterFields.filter(
    (item) => item.field !== 'assignedToUser'
  );
  previous.pageNum = 4;
  previous.direction = 'ASC';
  previous.pageSize = 20;
  const snapshot = JSON.stringify(previous);
  const searched = applyWorkOrderSearch(previous, '  0  ');
  expect(searched).toMatchObject({
    pageNum: 0,
    direction: 'ASC',
    pageSize: 20
  });
  expect(getWorkOrderSearchText(searched)).toBe('0');
  const cleared = applyWorkOrderSearch(searched, '  ');
  expect(cleared.filterFields).toEqual(previous.filterFields);
  expect(JSON.stringify(previous)).toBe(snapshot);
  expect(applyWorkOrderSearch(cleared, '')).toBe(cleared);
});
