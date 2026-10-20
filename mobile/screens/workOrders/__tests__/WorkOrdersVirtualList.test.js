import React from 'react';
import { act, create } from 'react-test-renderer';
import { FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { IconButton, PaperProvider } from 'react-native-paper';
import WorkOrdersScreen from '../WorkOrdersScreen';
import EnumFilter from '../EnumFilter';
import QuickFilter from '../QuickFilter';
let mockState;
const mockDispatch = jest.fn(async () => {});
jest.mock('../../../store', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select(mockState)
}));
jest.mock('../../../hooks/useAuth', () => () => ({
  user: { id: 1 },
  hasViewOtherPermission: () => true
}));
jest.mock('../../../slices/workOrder', () => ({
  getWorkOrders: (criteria) => ({ type: 'load', criteria }),
  getMoreWorkOrders: (criteria, page) => ({ type: 'more', criteria, page })
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../EnumFilter', () => () => null);
jest.mock('../QuickFilter', () => () => null);
jest.mock('../components/FieldOrderCard', () => ({
  __esModule: true,
  default: 'OSCard'
}));
jest.mock('../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({
    getFormattedDate: (value) => value
  })
}));
const criteria = {
  filterFields: [
    {
      field: 'priority',
      operation: 'in',
      values: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
      value: '',
      enumName: 'PRIORITY'
    },
    {
      field: 'status',
      operation: 'in',
      values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'],
      value: '',
      enumName: 'STATUS'
    },
    { field: 'archived', operation: 'eq', value: false }
  ],
  pageSize: 10,
  pageNum: 0,
  direction: 'DESC'
};
let tree;
jest.useFakeTimers();
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  jest.clearAllTimers();
  mockDispatch.mockClear();
});

function renderEmpty(filterFields = criteria.filterFields) {
  mockState = {
    workOrders: {
      workOrders: { content: [], totalElements: 0 },
      workOrderInfos: {},
      currentPageNum: 0,
      lastPage: true,
      activeCriteria: criteria,
      requestedCriteria: criteria
    },
    localWorkOrderCache: { summaries: {}, pageIds: null }
  };
  act(() => {
    tree = create(
      <PaperProvider>
        <WorkOrdersScreen
          navigation={{ push: jest.fn(), navigate: jest.fn() }}
          route={{ params: { filterFields } }}
        />
      </PaperProvider>
    );
  });
}
const tabs = () =>
  tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => node.props.accessibilityRole === 'tab');
const query = async () => {
  await act(async () => tree.root.findByType(RefreshControl).props.onRefresh());
  return mockDispatch.mock.calls
    .filter(([action]) => action.type === 'load')
    .at(-1)[0].criteria;
};
test('active has no status/priority controls; history retains them even after custom status selection', async () => {
  renderEmpty();
  expect(tree.root.findAllByType(EnumFilter)).toHaveLength(0);
  act(() => tabs()[1].props.onPress());
  expect(tree.root.findAllByType(EnumFilter)).toHaveLength(2);
  let fields = (await query()).filterFields;
  expect(fields.find((f) => f.field === 'status').values).toEqual(['COMPLETE']);
  const custom = fields.map((f) =>
    f.field === 'priority'
      ? { ...f, values: ['HIGH'] }
      : f.field === 'status'
      ? { ...f, values: ['OPEN', 'COMPLETE'] }
      : f
  );
  act(() => tree.root.findAllByType(EnumFilter)[0].props.onChange(custom));
  expect(tabs()[1].props.accessibilityState.selected).toBe(true);
  expect(tree.root.findAllByType(EnumFilter)).toHaveLength(2);
  act(() => tabs()[0].props.onPress());
  expect(tree.root.findAllByType(EnumFilter)).toHaveLength(0);
  fields = (await query()).filterFields;
  expect(fields.find((f) => f.field === 'priority').values).toEqual([
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH'
  ]);
  expect(fields.find((f) => f.field === 'status').values).toEqual([
    'OPEN',
    'EN_ROUTE',
    'IN_PROGRESS',
    'ON_HOLD'
  ]);
  expect(fields.some((f) => f.field === 'assignedToUser')).toBe(false);
});

test('active never silently retains a route priority restriction and clearing history preserves Minhas OS choice', async () => {
  renderEmpty([
    ...criteria.filterFields.map((f) =>
      f.field === 'priority' ? { ...f, values: ['HIGH'] } : f
    ),
    { field: 'assignedToUser', operation: 'eq', value: 1 }
  ]);
  expect(
    (await query()).filterFields.find((f) => f.field === 'priority').values
  ).toEqual(['NONE', 'LOW', 'MEDIUM', 'HIGH']);
  act(() => tabs()[1].props.onPress());
  let fields = (await query()).filterFields;
  act(() =>
    tree.root
      .findAllByType(EnumFilter)[0]
      .props.onChange(
        fields.map((f) =>
          f.field === 'priority' ? { ...f, values: ['LOW'] } : f
        )
      )
  );
  const reset = tree.root
    .findAllByType(IconButton)
    .find((node) => node.props.icon === 'close');
  act(() => reset.props.onPress());
  fields = (await query()).filterFields;
  expect(fields.find((f) => f.field === 'status').values).toEqual(['COMPLETE']);
  expect(fields.find((f) => f.field === 'assignedToUser').value).toBe(1);
  act(() =>
    tree.root
      .findByType(QuickFilter)
      .props.onChange(fields.filter((f) => f.field !== 'assignedToUser'))
  );
  act(() => tabs()[0].props.onPress());
  expect(
    (await query()).filterFields.some((f) => f.field === 'assignedToUser')
  ).toBe(false);
});
test.each([50, 200, 500])(
  'retains %i loaded records but uses a virtual window, stable keys and one guarded next page',
  async (count) => {
    const records = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      customId: String(i + 1),
      title: 'OS',
      status: 'OPEN',
      priority: 'NONE',
      assignedTo: [],
      customers: []
    }));
    mockState = {
      workOrders: {
        workOrders: { content: records, totalElements: 1000 },
        workOrderInfos: {},
        currentPageNum: 2,
        lastPage: false,
        activeCriteria: criteria,
        requestedCriteria: criteria
      },
      localWorkOrderCache: { summaries: {}, pageIds: null }
    };
    act(() => {
      tree = create(
        <PaperProvider>
          <WorkOrdersScreen
            navigation={{ push: jest.fn(), navigate: jest.fn() }}
            route={{ params: { filterFields: criteria.filterFields } }}
          />
        </PaperProvider>
      );
    });
    const list = tree.root.findByType(FlatList);
    expect(list.props.data).toHaveLength(count);
    expect(list.props.initialNumToRender).toBe(5);
    expect(tree.root.findAllByType('OSCard').length).toBeLessThan(count);
    expect(list.props.keyExtractor(list.props.data[20])).toBe('21');
    let resolve;
    mockDispatch.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    await act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
    });
    expect(
      mockDispatch.mock.calls.filter(([action]) => action.type === 'more')
    ).toHaveLength(1);
    expect(
      mockDispatch.mock.calls.find(([action]) => action.type === 'more')[0].page
    ).toBe(3);
    await act(async () => resolve());
    await act(async () =>
      tree.root.findByType(RefreshControl).props.onRefresh()
    );
    const refresh = mockDispatch.mock.calls.find(
      ([action]) => action.type === 'load'
    )[0];
    expect(refresh.criteria).toEqual(criteria);
    expect(
      refresh.criteria.filterFields.some(
        (filter) => filter.field === 'assignedToUser'
      )
    ).toBe(false);
  }
);
