import { getWorkOrderColumnVisibility, PRIMARY_WORK_ORDER_COLUMNS, DEFAULT_WORK_ORDER_COLUMN_VISIBILITY } from './workOrderColumns';

beforeEach(() => localStorage.clear());

it('starts with the seven operational columns and retains secondary columns as configurable', () => {
  const visibility = getWorkOrderColumnVisibility();
  expect(PRIMARY_WORK_ORDER_COLUMNS).toEqual(['customId', 'status', 'title', 'priority', 'assignedTo', 'location', 'category']);
  PRIMARY_WORK_ORDER_COLUMNS.forEach((id) => expect(visibility[id]).not.toBe(false));
  expect(visibility.description).toBe(false);
  expect(visibility.locationAddress).toBe(false);
  expect(visibility.asset).toBe(false);
});

it.each([{}, { description: true, status: false, createdAt: true }])('preserves existing visibility verbatim: %j', (visibility) => {
  const saved = JSON.stringify({ columnVisibility: visibility, columnSizing: { title: 375 }, columnOrder: ['description', 'title'] });
  localStorage.setItem('workOrderTableState', saved);
  expect(getWorkOrderColumnVisibility()).toEqual(visibility);
  expect(localStorage.getItem('workOrderTableState')).toBe(saved);
});

it('preserves older preferences with only customized widths or order', () => {
  localStorage.setItem('workOrderTableState', JSON.stringify({ columnSizing: { title: 375 } }));
  expect(getWorkOrderColumnVisibility()).toEqual({});
});

it('falls back safely when saved preferences cannot be read', () => {
  localStorage.setItem('workOrderTableState', '{broken');
  expect(getWorkOrderColumnVisibility()).toEqual(DEFAULT_WORK_ORDER_COLUMN_VISIBILITY);
});
