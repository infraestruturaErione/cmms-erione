import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '@mui/material/styles';
import { PureLightTheme } from '../../../theme/schemes/PureLightTheme';
import WorkOrders from './index';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';

const mockGetWorkOrders = jest.fn(() => Promise.resolve());
const mockTableProps = jest.fn();
const mockDispatch = (action) => action;
const mockAuth = {
  user: { id: 1, uiConfiguration: { vendorsAndCustomers: true } },
  userSettings: { defaultWorkOrderView: 'list' },
  hasViewPermission: () => true,
  hasViewOtherPermission: () => true,
  hasCreatePermission: () => false,
  hasFeature: () => false,
  patchUserSettings: jest.fn(),
  fetchUserSettings: jest.fn()
};
const mockState = {
  workOrders: {
    workOrders: { content: [], totalElements: 0 },
    loadingGet: false,
    lastFetchedCriteria: null
  },
  tasks: { tasksByWorkOrder: {}, loadingTasks: {} },
  locations: { locations: [], locationsMini: [] },
  assets: { assetInfos: {}, assetsMini: [] },
  customers: { singleCustomer: null, customersMini: [] },
  users: { usersMini: [] },
  teams: { teamsMini: [] },
  categories: { categories: {} },
  customFields: { customFields: [] }
};
jest.mock('../../../store', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (select) => select(mockState)
}));
jest.mock('../../../hooks/useAuth', () => () => mockAuth);
jest.mock('../../../hooks/useExport', () => ({
  useExport: () => ({ exportEntity: jest.fn(), loadingExport: {} })
}));
jest.mock('../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({})
}));
jest.mock('../../../contexts/TitleContext', () => ({
  TitleContext: require('react').createContext({})
}));
jest.mock('../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({})
}));
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: {},
  getErrorMessage: () => 'error'
}));
jest.mock('../../../utils/woBase', () => ({ getWOBaseValues: () => ({}) }));
jest.mock('../../../config', () => ({ IS_LOCALHOST: true }));
jest.mock('../../../i18n/i18n', () => ({
  __esModule: true,
  default: { dir: () => 'ltr' }
}));
jest.mock('../../../slices/workOrder', () => ({
  getWorkOrders: (...args) => mockGetWorkOrders(...args)
}));
jest.mock('../../../slices/task', () => ({}));
jest.mock('../../../slices/location', () => ({}));
jest.mock('../../../slices/asset', () => ({}));
jest.mock('../../../slices/customer', () => ({}));
jest.mock('../../../slices/customField', () => ({}));
jest.mock('../type', () => ({
  getCustomFieldsIFields: () => [],
  getCustomFieldsRequiredShape: () => ({})
}));
jest.mock('../components/form', () => () => null);
jest.mock('../components/UserAvatars', () => () => null);
jest.mock('../components/PriorityWrapper', () => () => null);
jest.mock('../components/ConfirmDialog', () => () => null);
jest.mock('../components/SplitButton', () => () => null);
jest.mock('./Details/WorkOrderDetails', () => () => null);
jest.mock('./WorkOrderKpiCards', () => () => null);
jest.mock('./Calendar', () => () => null);
jest.mock('./Board/WorkOrderBoard', () => () => null);
jest.mock('./Filters/MoreFilters', () => () => null);
jest.mock('../components/CustomDatagrid2', () => (props) => {
  mockTableProps(props);
  return require('react').createElement(
    'button',
    {
      'data-page': props.pagination.pageIndex,
      onClick: () => props.onPaginationChange({ pageIndex: 3, pageSize: 10 })
    },
    'page 4'
  );
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key)
  })
}));

const defaults = [
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
    values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'],
    value: '',
    enumName: 'STATUS'
  },
  { field: 'archived', operation: 'eq', value: false }
];
const key = 'erione.workOrders.filterFields';
let container;
const latestCriteria = () => mockGetWorkOrders.mock.calls.at(-1)[0];
const button = (text) =>
  Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent.includes(text)
  );
const mount = () =>
  act(() => {
    ReactDOM.render(
      <ThemeProvider theme={PureLightTheme}>
        <HelmetProvider>
          <MemoryRouter initialEntries={['/app/work-orders']}>
            <TitleContext.Provider value={{ setTitle: () => {} }}>
              <CustomSnackBarContext.Provider
                value={{ showSnackBar: () => {} }}
              >
                <CompanySettingsContext.Provider
                  value={{ getWOFieldsAndShapes: () => [[], {}] }}
                >
                  <WorkOrders />
                </CompanySettingsContext.Provider>
              </CustomSnackBarContext.Provider>
            </TitleContext.Provider>
          </MemoryRouter>
        </HelmetProvider>
      </ThemeProvider>,
      container
    );
  });
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  mockGetWorkOrders.mockClear();
  mockTableProps.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('restores the saved search visibly and preserves the existing request contract', () => {
  const search = {
    field: 'title',
    operation: 'cn',
    value: 'WO71',
    alternatives: [{ field: 'customId', operation: 'cn', value: 'WO71' }]
  };
  localStorage.setItem(key, JSON.stringify([...defaults, search]));
  mount();
  expect(container.querySelector('input').value).toBe('WO71');
  expect(latestCriteria().filterFields).toEqual([...defaults, search]);
  expect(latestCriteria()).not.toHaveProperty('search');
});

it('resets both pagination and the query to page zero when the search changes', () => {
  mount();
  act(() => Simulate.click(button('page 4')));
  expect(latestCriteria().pageNum).toBe(3);
  act(() =>
    Simulate.change(container.querySelector('input'), {
      target: { value: 'bomba' }
    })
  );
  act(() => jest.advanceTimersByTime(1300));
  expect(latestCriteria().pageNum).toBe(0);
  expect(button('page 4').getAttribute('data-page')).toBe('0');
  expect(latestCriteria().filterFields.at(-1)).toEqual({
    field: 'title',
    operation: 'cn',
    value: 'bomba',
    alternatives: [
      { field: 'description', operation: 'cn', value: 'bomba' },
      { field: 'feedback', operation: 'cn', value: 'bomba' },
      { field: 'customId', operation: 'cn', value: 'bomba' }
    ]
  });
});

it('restores defaults and cancels a pending search so it cannot resurrect removed filters', () => {
  localStorage.setItem(
    key,
    JSON.stringify([
      ...defaults,
      { field: 'customers', operation: 'inm', value: '', values: [7] }
    ])
  );
  mount();
  act(() => Simulate.click(button('page 4')));
  act(() =>
    Simulate.change(container.querySelector('input'), {
      target: { value: 'pendente' }
    })
  );
  act(() => Simulate.click(button('Restaurar filtros')));
  act(() => jest.advanceTimersByTime(1400));
  expect(container.querySelector('input').value).toBe('');
  expect(latestCriteria().filterFields).toEqual(defaults);
  expect(latestCriteria().pageNum).toBe(0);
  expect(JSON.parse(localStorage.getItem(key))).toEqual(defaults);
});

it('preserves advanced filters while changing archived state and resets pagination', () => {
  const customer = {
    field: 'customers',
    operation: 'inm',
    joinType: 'LEFT',
    value: '',
    values: [7]
  };
  localStorage.setItem(key, JSON.stringify([...defaults, customer]));
  mount();
  act(() => Simulate.click(button('page 4')));
  act(() => Simulate.click(button('archived_work_orders')));
  expect(latestCriteria().pageNum).toBe(0);
  expect(latestCriteria().filterFields).toContainEqual(customer);
  expect(
    latestCriteria().filterFields.find((filter) => filter.field === 'archived')
      .value
  ).toBe(true);
});

it('clears only the free-text search and cancels pending typing while keeping the customer filter', () => {
  const customer = {
    field: 'customers',
    operation: 'inm',
    value: '',
    values: [7]
  };
  localStorage.setItem(key, JSON.stringify([...defaults, customer]));
  mount();
  act(() =>
    Simulate.change(container.querySelector('input'), {
      target: { value: 'bomba' }
    })
  );
  act(() => jest.advanceTimersByTime(1300));
  act(() =>
    Simulate.change(container.querySelector('input'), {
      target: { value: 'bomba nova' }
    })
  );
  act(() =>
    Simulate.click(container.querySelector('button[aria-label="Limpar"]'))
  );
  act(() => jest.advanceTimersByTime(1400));
  expect(container.querySelector('input').value).toBe('');
  expect(latestCriteria().filterFields).toEqual([...defaults, customer]);
});

it('uses a two-pixel underline with the real theme instead of a 38px overlay', () => {
  mount();
  const indicator = container.querySelector('.MuiTabs-indicator');
  const style = getComputedStyle(indicator);
  expect(style.minHeight).toBe('2px');
  expect(style.height).toBe('2px');
  expect(style.boxShadow).toBe('none');
  expect(
    container.querySelector('[role="tab"][aria-selected="true"]').textContent
  ).toBe('list_view');
});

it('applies compact defaults but keeps hidden data available through the existing column controls', () => {
  mount();
  const props = mockTableProps.mock.calls.at(-1)[0];
  expect(props.columnOrder).toEqual([
    'customId',
    'status',
    'title',
    'priority',
    'assignedTo',
    'location',
    'category'
  ]);
  expect(props.columns.some((column) => column.id === 'description')).toBe(
    true
  );
  expect(props.columnVisibility.description).toBe(false);
  act(() =>
    props.onColumnVisibilityChange((previous) => ({
      ...previous,
      description: true
    }))
  );
  expect(mockTableProps.mock.calls.at(-1)[0].columnVisibility.description).toBe(
    true
  );
  expect(
    JSON.parse(localStorage.getItem('workOrderTableState')).columnVisibility
      .description
  ).toBe(true);
});

it('preserves saved column order, widths, visibility and pinned columns', () => {
  const saved = {
    columnOrder: ['description', 'title', 'status'],
    columnSizing: { title: 375 },
    columnVisibility: {},
    pinnedColumns: ['title']
  };
  localStorage.setItem('workOrderTableState', JSON.stringify(saved));
  mount();
  const props = mockTableProps.mock.calls.at(-1)[0];
  expect(props.columnOrder).toEqual(saved.columnOrder);
  expect(props.columnSizing).toEqual(saved.columnSizing);
  expect(props.columnVisibility).toEqual(saved.columnVisibility);
  expect(props.pinnedColumns).toEqual(saved.pinnedColumns);
});
