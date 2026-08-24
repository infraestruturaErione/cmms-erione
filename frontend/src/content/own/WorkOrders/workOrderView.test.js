import {
  ACTIVE_WORK_ORDER_STATUSES,
  getWorkOrderCriteriaForView,
  resolveWorkOrderView
} from './workOrderView';

const criteria = {
  filterFields: [
    {
      field: 'status',
      operation: 'in',
      value: '',
      values: ['OPEN', 'IN_PROGRESS', 'COMPLETE'],
      enumName: 'STATUS'
    },
    { field: 'archived', operation: 'eq', value: false }
  ],
  pageNum: 3,
  pageSize: 20
};

describe('workOrderView', () => {
  it('uses the saved per-user view when the URL does not override it', () => {
    expect(resolveWorkOrderView(null, 'calendar', true)).toBe('calendar');
    expect(resolveWorkOrderView(null, 'list', true)).toBe('list');
  });

  it('preserves list as the system default when no preference exists', () => {
    expect(resolveWorkOrderView(null, undefined, true)).toBe('list');
  });

  it('keeps an explicit URL view ahead of the saved preference', () => {
    expect(resolveWorkOrderView('column', 'calendar', true)).toBe('column');
  });

  it('falls back to list when calendar is not authorized', () => {
    expect(resolveWorkOrderView(null, 'calendar', false)).toBe('list');
  });

  it('filters the Kanban query to active statuses on the server', () => {
    const result = getWorkOrderCriteriaForView(criteria, 'column');
    const statusFilter = result.filterFields.find(
      (filterField) => filterField.field === 'status'
    );

    expect(statusFilter?.values).toEqual(['OPEN', 'IN_PROGRESS']);
    expect(statusFilter?.values).not.toContain('COMPLETE');
    expect(result.pageNum).toBe(0);
    expect(criteria.filterFields[0].values).toEqual([
      'OPEN',
      'IN_PROGRESS',
      'COMPLETE'
    ]);
  });

  it('uses every active status when the criteria has no status filter', () => {
    const result = getWorkOrderCriteriaForView(
      {
        ...criteria,
        filterFields: [{ field: 'archived', operation: 'eq', value: false }]
      },
      'column'
    );
    const statusFilter = result.filterFields.find(
      (filterField) => filterField.field === 'status'
    );

    expect(statusFilter?.values).toEqual([
      'OPEN',
      'EN_ROUTE',
      'IN_PROGRESS',
      'ON_HOLD'
    ]);
  });

  it('preserves the original criteria outside the Kanban', () => {
    expect(getWorkOrderCriteriaForView(criteria, 'list')).toBe(criteria);
    expect(getWorkOrderCriteriaForView(criteria, 'calendar')).toBe(criteria);
    expect(ACTIVE_WORK_ORDER_STATUSES).not.toContain('COMPLETE');
  });
});
