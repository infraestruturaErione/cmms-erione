import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { PureLightTheme } from '../../../theme/schemes/PureLightTheme';
import Customers from '../VendorsAndCustomers/Customers';
import LocationsToolbar from '../Locations/components/LocationsToolbar';
import { getLocationColumns } from '../Locations/config/locationColumns';

const mockGetCustomers = jest.fn(() => Promise.resolve());
const mockTable = jest.fn();
const mockPagination = jest.fn();
const mockAuth = { hasCreatePermission: () => true, hasEditPermission: () => true,
  hasDeletePermission: () => true, hasViewPermission: () => true,
  hasViewOtherPermission: () => true, hasFeature: () => false };
const mockState = { customers: { customers: { content: [], totalElements: 42 }, loadingGet: false }, customFields: { customFields: [] } };
jest.mock('../../../store', () => ({ useDispatch: () => (action) => action, useSelector: (select) => select(mockState) }));
jest.mock('../../../hooks/useAuth', () => () => mockAuth);
jest.mock('../../../hooks/useExport', () => ({ useExport: () => ({ exportEntity: jest.fn(), loadingExport: {} }) }));
jest.mock('../../../hooks/useTableState', () => () => ({ pagination: { pageIndex: 0, pageSize: 10 }, setPagination: mockPagination, sorting: [] }));
jest.mock('../../../slices/customer', () => ({ getCustomers: (...args) => mockGetCustomers(...args) }));
jest.mock('../../../slices/customField', () => ({}));
jest.mock('../../../contexts/CustomSnackBarContext', () => ({ CustomSnackBarContext: require('react').createContext({ showSnackBar: jest.fn() }) }));
jest.mock('../../../utils/api', () => ({ getErrorMessage: () => 'error' }));
jest.mock('../../../i18n/i18n', () => ({ __esModule: true, default: { dir: () => 'ltr' } }));
jest.mock('../VendorsAndCustomers/CustomerForm', () => () => null);
jest.mock('./ConfirmDialog', () => () => null);
jest.mock('./CustomDatagrid2', () => (props) => { mockTable(props); return require('react').createElement('div'); });
jest.mock('./SplitButton', () => (props) => require('react').createElement('button', { onClick: props.onMainClick }, props.label));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback) => typeof fallback === 'string' ? fallback : key }) }));

let container;
const mount = (node) => act(() => {
  ReactDOM.render(<ThemeProvider theme={PureLightTheme}><MemoryRouter>{node}</MemoryRouter></ThemeProvider>, container);
});
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); jest.clearAllTimers(); jest.useRealTimers(); });

test('Customers preserves search debounce and the existing OR fields', () => {
  mount(<Customers />);
  const initial = mockGetCustomers.mock.calls.length;
  act(() => Simulate.change(container.querySelector('input'), { target: { value: 'Erione' } }));
  act(() => jest.advanceTimersByTime(399));
  expect(mockGetCustomers).toHaveBeenCalledTimes(initial);
  act(() => jest.advanceTimersByTime(1));
  const criteria = mockGetCustomers.mock.calls.at(-1)[0];
  expect(criteria.pageNum).toBe(0);
  expect(criteria.pageSize).toBe(10);
  const encoded = JSON.stringify(criteria.filterFields);
  ['name', 'cnpj', 'phone', 'email', 'Erione'].forEach((value) => expect(encoded).toContain(value));
});

test('Customers preserves totalElements and pagination callback', () => {
  mount(<Customers />);
  expect(mockTable.mock.calls.at(-1)[0].totalRows).toBe(42);
  const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Próximo');
  act(() => Simulate.click(next));
  expect(mockPagination).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 });
});

const toolbarProps = () => ({ currentTab: 'list', showMapTab: true, onTabsChange: jest.fn(),
  onRefresh: jest.fn(), searchQuery: '', onSearchQueryChange: jest.fn(), onSearchClear: jest.fn(),
  customerFilter: null, customersMini: [{ id: 1, name: 'Cliente A' }], onCustomerFilterChange: jest.fn(),
  onClearCustomerFilter: jest.fn(), hasBothFilters: false, onClearFilters: jest.fn(), resultsCount: 42, onOpenAddModal: jest.fn() });

test('Locations selected tab has visible label and a thin indicator under the real theme', () => {
  const props = toolbarProps(); mount(<LocationsToolbar {...props} />);
  const selected = container.querySelector('[role="tab"][aria-selected="true"]');
  expect(selected.textContent).toBe('list_view');
  expect(container.querySelector('.MuiTabs-indicator').style.height).toBe('2px');
  expect(container.querySelector('.MuiTabs-indicator').style.minHeight).toBe('2px');
  act(() => Simulate.click(container.querySelectorAll('[role="tab"]')[1]));
  expect(props.onTabsChange).toHaveBeenCalledWith('map');
});

test('Locations creation, refresh and search still invoke their original callbacks', () => {
  const props = toolbarProps(); mount(<LocationsToolbar {...props} />);
  act(() => Simulate.click(container.querySelector('[aria-label="Atualizar"]')));
  const create = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Novo endereço');
  act(() => Simulate.click(create));
  act(() => Simulate.change(container.querySelector('input'), { target: { value: 'PC 12' } }));
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  expect(props.onOpenAddModal).toHaveBeenCalledTimes(1);
  expect(props.onSearchQueryChange).toHaveBeenCalledWith('PC 12');
});

test.each([
  { list: [] },
  { list: [{ id: 1, name: 'Cliente A' }] },
  { list: [{ id: 1, name: 'Cliente A' }, { id: 2, name: 'Cliente B' }] }
])(
  'Location customer cell accepts zero, one or multiple associations: %j', ({ list }) => {
    const column = getLocationColumns({ t: (key, fallback) => fallback || key })[0];
    mount(column.cell({ getValue: () => list }));
    expect(container.textContent).toContain(list.length ? 'Cliente A' : 'Sem cliente vinculado');
    if (list.length > 1) expect(container.textContent).toContain('+1');
  }
);
