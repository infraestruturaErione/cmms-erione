import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ThemeProvider } from '@mui/material/styles';
import { PureLightTheme } from '../../../../theme/schemes/PureLightTheme';
import WorkOrderBulkReport from './index';

const mockSnack = jest.fn();
const mockDispatch = jest.fn((action) =>
  Promise.resolve(action.kind === 'generate' ? '/qa-report.pdf' : [])
);
jest.mock('../../../../store', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) =>
    selector({ customers: { customersMini: [{ id: 7, name: 'Cliente QA' }] } })
}));
jest.mock('../../../../slices/customer', () => ({
  getCustomersMini: () => ({ kind: 'customers' })
}));
jest.mock('../../../../slices/workOrder', () => ({
  getBulkPDFReport: (payload) => ({ kind: 'generate', payload }),
  getBulkPDFReportHistory: () => ({ kind: 'history' }),
  downloadBulkPDFReportFromHistory: (id) => ({ kind: 'download', id })
}));
jest.mock('../../../../contexts/TitleContext', () => ({
  TitleContext: require('react').createContext({ setTitle: () => {} })
}));
jest.mock('../../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({
    showSnackBar: (...args) => mockSnack(...args)
  })
}));
jest.mock('../../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({
    getFormattedDate: (v) => v
  })
}));
jest.mock('../../Analytics/AnalyticsLayout', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}));
jest.mock('react-helmet-async', () => ({ Helmet: () => null }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));
jest.mock('../../../../i18n/i18n', () => ({
  __esModule: true,
  default: { t: (key) => key, dir: () => 'ltr', language: 'pt-BR' }
}));
jest.mock('../../../../utils/api', () => ({
  getErrorMessage: () => 'request_failed'
}));

let container;
const flush = async () =>
  act(async () => {
    await Promise.resolve();
  });
const input = (label) =>
  document.getElementById(
    Array.from(container.querySelectorAll('label')).find((node) =>
      node.textContent.startsWith(label)
    ).htmlFor
  );
const select = async (label, option) => {
  act(() => Simulate.mouseDown(input(label), { button: 0 }));
  const item = Array.from(document.querySelectorAll('[role="option"]')).find(
    (node) => node.textContent === option
  );
  expect(item).toBeDefined();
  act(() => Simulate.click(item));
  await flush();
};
const change = (label, value) =>
  act(() => Simulate.change(input(label), { target: { value } }));
const submit = async () => {
  act(() => Simulate.submit(container.querySelector('form')));
  await flush();
};
const generated = () =>
  mockDispatch.mock.calls
    .map(([action]) => action)
    .filter((action) => action.kind === 'generate');
beforeEach(async () => {
  jest.clearAllMocks();
  window.open = jest.fn();
  mockDispatch.mockImplementation((action) =>
    Promise.resolve(action.kind === 'generate' ? '/qa-report.pdf' : [])
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    ReactDOM.render(
      <ThemeProvider theme={PureLightTheme}>
        <WorkOrderBulkReport />
      </ThemeProvider>,
      container
    );
  });
  await flush();
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

test('opens with completed-only scope and neutral empty date fields', () => {
  expect(input('bulk_report_scope').textContent).toBe(
    'bulk_report_scope_completed'
  );
  expect(input('bulk_report_period_field').textContent).toBe('COMPLETED_ON');
  expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
});
test('empty date becomes invalid only after blur', () => {
  act(() => Simulate.blur(input('start_date')));
  expect(input('start_date').getAttribute('aria-invalid')).toBe('true');
  expect(input('end_date').getAttribute('aria-invalid')).toBe('false');
});
test('submission explains missing dates and never dispatches a generation', async () => {
  await select('customer', 'Cliente QA');
  await submit();
  expect(generated()).toHaveLength(0);
  expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
  expect(mockSnack).toHaveBeenCalledWith(
    'bulk_report_period_required',
    'error'
  );
});
test('all scope switches completion to creation and removes completion option', async () => {
  await select('bulk_report_scope', 'bulk_report_scope_all');
  expect(input('bulk_report_period_field').textContent).toBe('CREATED_AT');
  act(() =>
    Simulate.mouseDown(input('bulk_report_period_field'), { button: 0 })
  );
  const options = Array.from(document.querySelectorAll('[role="option"]'));
  expect(options.map((n) => n.textContent)).toEqual(
    expect.arrayContaining(['CREATED_AT', 'CHECK_IN_AT'])
  );
  expect(options.map((n) => n.textContent)).not.toContain('COMPLETED_ON');
  act(() =>
    Simulate.click(options.find((n) => n.textContent === 'CREATED_AT'))
  );
});
test('all request includes selected customer, scope and unchanged civil dates', async () => {
  await select('customer', 'Cliente QA');
  await select('bulk_report_scope', 'bulk_report_scope_all');
  change('start_date', '2026-10-01');
  change('end_date', '2026-10-31');
  await submit();
  expect(generated()[0].payload).toEqual({
    customerId: 7,
    scope: 'ALL',
    periodField: 'CREATED_AT',
    start: '2026-10-01',
    end: '2026-10-31',
    cnpj: undefined
  });
  expect(window.open).toHaveBeenCalledWith('/qa-report.pdf');
});
test('default request still sends only completed with completion dates', async () => {
  await select('customer', 'Cliente QA');
  change('start_date', '2026-10-01');
  change('end_date', '2026-10-31');
  await submit();
  expect(generated()[0].payload).toMatchObject({
    scope: 'COMPLETED',
    periodField: 'COMPLETED_ON',
    customerId: 7
  });
});
test('reversed dates block generation and correction clears errors', async () => {
  await select('customer', 'Cliente QA');
  change('start_date', '2026-10-31');
  change('end_date', '2026-10-01');
  await submit();
  expect(generated()).toHaveLength(0);
  expect(mockSnack).toHaveBeenCalledWith(
    'bulk_report_period_reversed',
    'error'
  );
  change('end_date', '2026-10-31');
  await submit();
  expect(generated()).toHaveLength(1);
  expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
});
test('switching scope preserves customer, dates and explicit checkin selection', async () => {
  await select('customer', 'Cliente QA');
  change('start_date', '2026-10-01');
  change('end_date', '2026-10-31');
  await select('bulk_report_period_field', 'CHECK_IN_AT');
  await select('bulk_report_scope', 'bulk_report_scope_all');
  await select('bulk_report_scope', 'bulk_report_scope_completed');
  await submit();
  expect(generated()[0].payload).toMatchObject({
    scope: 'COMPLETED',
    customerId: 7,
    periodField: 'CHECK_IN_AT',
    start: '2026-10-01',
    end: '2026-10-31'
  });
});
