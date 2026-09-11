import { getWorkOrderSearchText, isDefaultFilter, removeWorkOrderFilter } from './filterSummary';

const defaults = [
  { field: 'status', operation: 'in', value: '', values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'], enumName: 'STATUS' },
  { field: 'priority', operation: 'in', value: '', values: ['NONE', 'LOW', 'MEDIUM', 'HIGH'], enumName: 'PRIORITY' },
  { field: 'archived', operation: 'eq', value: false }
];

it('recognizes default selections regardless of selection order, but never hides OR predicates', () => {
  expect(isDefaultFilter({ ...defaults[0], values: [...defaults[0].values].reverse() }, defaults)).toBe(true);
  expect(isDefaultFilter({ ...defaults[0], values: ['COMPLETE'] }, defaults)).toBe(false);
  expect(isDefaultFilter({ ...defaults[0], values: [] }, defaults)).toBe(false);
  expect(isDefaultFilter({ ...defaults[0], alternatives: [{ field: 'title', operation: 'cn', value: 'A' }] }, defaults)).toBe(false);
});

it('restores an enum default without dropping another filter or changing its query tree', () => {
  const customer = Object.freeze({ field: 'customers', operation: 'inm', joinType: 'LEFT', value: '', values: [19] });
  const filters = Object.freeze([{ ...defaults[0], values: ['COMPLETE'] }, customer]);
  const result = removeWorkOrderFilter(filters, 0, defaults);
  expect(result).toEqual([defaults[0], customer]);
  expect(result[1]).toBe(customer);
  expect(result[0].values).not.toBe(defaults[0].values);
  expect(filters[0].values).toEqual(['COMPLETE']);
});

it('removes only the selected date boundary and preserves the other boundary', () => {
  const start = { field: 'createdAt', operation: 'ge', value: '2026-09-01', enumName: 'JS_DATE' };
  const end = { field: 'createdAt', operation: 'le', value: '2026-09-10', enumName: 'JS_DATE' };
  expect(removeWorkOrderFilter([start, end], 0, defaults)).toEqual([end]);
});

it('recovers a saved search and removes its entire OR group without touching other filters', () => {
  const search = { field: 'title', operation: 'cn', value: 'bomba', alternatives: [
    { field: 'description', operation: 'cn', value: 'bomba' },
    { field: 'feedback', operation: 'cn', value: 'bomba' },
    { field: 'customId', operation: 'cn', value: 'bomba' }
  ] };
  expect(getWorkOrderSearchText([...defaults, search])).toBe('bomba');
  expect(getWorkOrderSearchText(defaults)).toBe('');
  expect(removeWorkOrderFilter([...defaults, search], defaults.length, defaults)).toEqual(defaults);
});
