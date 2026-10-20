import {
  getWorkOrderListView,
  selectWorkOrderListView,
  ACTIVE_LIST_STATUSES
} from '../workOrderListViews';

const filters = () => [
  { field: 'assignedToUser', operation: 'eq', value: 9 },
  { field: 'archived', operation: 'eq', value: false },
  { field: 'title', operation: 'cn', value: 'portão' },
  { field: 'priority', operation: 'in', values: ['HIGH'] },
  {
    field: 'status',
    operation: 'in',
    values: [...ACTIVE_LIST_STATUSES],
    enumName: 'STATUS'
  }
];

test('returning to active removes hidden priority restrictions without changing scope or search', () => {
  const previous = filters();
  const next = selectWorkOrderListView(previous, 'active');
  expect(next.find((f) => f.field === 'priority').values).toEqual([
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH'
  ]);
  expect(next.filter((f) => !['priority', 'status'].includes(f.field))).toEqual(
    previous.filter((f) => !['priority', 'status'].includes(f.field))
  );
  expect(previous.find((f) => f.field === 'priority').values).toEqual(['HIGH']);
  expect(
    selectWorkOrderListView([], 'active').some(
      (f) => f.field === 'assignedToUser'
    )
  ).toBe(false);
});

test('history only replaces status on explicit selection; scope/search/priority stay unchanged', () => {
  const previous = filters();
  const next = selectWorkOrderListView(previous, 'history');
  expect(getWorkOrderListView(next)).toBe('history');
  expect(next.filter((f) => f.field !== 'status')).toEqual(
    previous.filter((f) => f.field !== 'status')
  );
  expect(previous.at(-1).values).toEqual(ACTIVE_LIST_STATUSES);
  expect(getWorkOrderListView(selectWorkOrderListView(next, 'active'))).toBe(
    'active'
  );
});

test('mixed/custom advanced filters do not become history or active automatically', () => {
  const previous = [
    { field: 'status', operation: 'in', values: ['OPEN', 'COMPLETE'] }
  ];
  expect(getWorkOrderListView(previous)).toBe('custom');
  expect(previous[0].values).toEqual(['OPEN', 'COMPLETE']);
});

test('history shortcut does not reintroduce Minhas OS when disabled', () => {
  const previous = filters().filter((f) => f.field !== 'assignedToUser');
  const next = selectWorkOrderListView(previous, 'history');
  expect(next.some((f) => f.field === 'assignedToUser')).toBe(false);
  expect(
    getWorkOrderListView([...next.filter((f) => f.field !== 'status')])
  ).toBe('custom');
  expect(getWorkOrderListView(selectWorkOrderListView([], 'history'))).toBe(
    'history'
  );
});

test('an explicit view selection replaces an equality status criterion with the standard list criterion', () => {
  const previous = [{ field: 'status', operation: 'eq', value: 'OPEN' }];
  const next = selectWorkOrderListView(previous, 'history');
  expect(next[0]).toEqual({
    field: 'status',
    operation: 'in',
    value: '',
    values: ['COMPLETE'],
    enumName: 'STATUS'
  });
  expect(previous[0].value).toBe('OPEN');
});
