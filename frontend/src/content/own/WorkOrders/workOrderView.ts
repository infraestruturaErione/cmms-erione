import { SearchCriteria } from '../../../models/owns/page';

export type WorkOrderView = 'list' | 'calendar' | 'column';

export const DEFAULT_WORK_ORDER_VIEW: WorkOrderView = 'list';

export const ACTIVE_WORK_ORDER_STATUSES = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD'
] as const;
const ACTIVE_WORK_ORDER_STATUS_SET = new Set<string>(
  ACTIVE_WORK_ORDER_STATUSES
);

export const isWorkOrderView = (value?: string | null): value is WorkOrderView =>
  value === 'list' || value === 'calendar' || value === 'column';

export const resolveWorkOrderView = (
  viewParam: string | null,
  savedView: string | null | undefined,
  canViewCalendar: boolean
): WorkOrderView => {
  const requestedView = isWorkOrderView(viewParam)
    ? viewParam
    : isWorkOrderView(savedView)
    ? savedView
    : DEFAULT_WORK_ORDER_VIEW;

  return requestedView === 'calendar' && !canViewCalendar
    ? DEFAULT_WORK_ORDER_VIEW
    : requestedView;
};

export const getWorkOrderCriteriaForView = (
  criteria: SearchCriteria,
  view: WorkOrderView
): SearchCriteria => {
  if (view !== 'column') return criteria;

  const statusFilter = criteria.filterFields.find(
    (filterField) => filterField.field === 'status'
  );
  const selectedStatuses: string[] = Array.isArray(statusFilter?.values)
    ? statusFilter.values.map(String)
    : [...ACTIVE_WORK_ORDER_STATUSES];
  const activeStatuses = selectedStatuses.filter((status) =>
    ACTIVE_WORK_ORDER_STATUS_SET.has(status)
  );

  return {
    ...criteria,
    pageNum: 0,
    filterFields: [
      ...criteria.filterFields.filter(
        (filterField) => filterField.field !== 'status'
      ),
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: activeStatuses,
        enumName: 'STATUS'
      }
    ]
  };
};
