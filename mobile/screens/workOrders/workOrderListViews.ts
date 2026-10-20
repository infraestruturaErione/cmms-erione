import { FilterField } from '../../models/page';

export const ACTIVE_LIST_STATUSES = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD'
];
export type WorkOrderListView = 'active' | 'history' | 'custom';

export function getWorkOrderListView(
  filters: FilterField[]
): WorkOrderListView {
  const values = filters.find((f) => f.field === 'status')?.values ?? [];
  if (values.length === 1 && values[0] === 'COMPLETE') return 'history';
  if (
    values.length === ACTIVE_LIST_STATUSES.length &&
    ACTIVE_LIST_STATUSES.every((v) => values.includes(v))
  )
    return 'active';
  return 'custom';
}

// Active work has no hidden priority restriction. Scope and search stay intact.
export function selectWorkOrderListView(
  filters: FilterField[],
  view: 'active' | 'history'
): FilterField[] {
  const values = view === 'history' ? ['COMPLETE'] : [...ACTIVE_LIST_STATUSES];
  const next: FilterField[] = filters.some((f) => f.field === 'status')
    ? filters.map(
        (filter): FilterField =>
          filter.field === 'status'
            ? {
                ...filter,
                operation: 'in',
                value: '',
                values: [...values],
                enumName: 'STATUS'
              }
            : filter
      )
    : [
        ...filters,
        {
          field: 'status',
          operation: 'in',
          values,
          value: '',
          enumName: 'STATUS'
        }
      ];
  return view === 'active'
    ? next.map(
        (filter): FilterField =>
          filter.field === 'priority'
            ? {
                ...filter,
                operation: 'in',
                value: '',
                values: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
                enumName: 'PRIORITY'
              }
            : filter
      )
    : next;
}
