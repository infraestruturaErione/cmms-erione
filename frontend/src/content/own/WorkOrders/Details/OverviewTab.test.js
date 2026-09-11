import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OverviewTab from './OverviewTab';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import LocationMiniMap from './LocationMiniMap';

const mockGetPendingRequirements = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, defaultValue) => defaultValue || key })
}));
jest.mock('../../type', () => ({
  getCustomFieldValuesForDetails: () => []
}));
jest.mock('./PendingRequirements', () => ({
  getPendingRequirements: (...args) => mockGetPendingRequirements(...args)
}));
jest.mock('./FieldExecutionTimeline', () => jest.fn(() => 'execution-timeline'));
jest.mock('./LocationMiniMap', () => jest.fn(() => 'location-map'));

const makeWorkOrder = (overrides = {}) => ({
  id: 71,
  customId: 'WO000071',
  status: 'IN_PROGRESS',
  description: `LONG-DESCRIPTION ${'Atendimento detalhado. '.repeat(200)}`,
  customers: [{ id: 1, name: 'Cliente A' }, { id: 2, name: 'Cliente B' }],
  primaryUser: { id: 9 },
  team: { name: 'Equipe Norte' },
  assignedTo: [{ id: 10, firstName: 'Ana', lastName: 'Silva' }],
  location: {
    id: 4,
    name: 'Unidade Central',
    address: 'Rua das Flores, 20',
    referenceType: 'PC',
    referenceCode: '04',
    latitude: -23.5,
    longitude: -46.6
  },
  createdBy: 8,
  createdAt: '2026-09-01',
  dueDate: '2026-09-15',
  ...overrides
});

const renderOverview = (workOrder) => {
  const props = {
    workOrder,
    getFormattedDate: (value) => value || '',
    getUserNameById: (id) => `Pessoa ${id}`,
    fieldReportText: 'Relato preservado',
    tasks: [],
    comments: []
  };
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<OverviewTab {...props} />);
  container.querySelectorAll('style').forEach((style) => style.remove());
  return { container, text: container.textContent, props };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPendingRequirements.mockReturnValue([
    { key: 'fieldReport', labelKey: 'field_report', done: false }
  ]);
  FieldExecutionTimeline.mockReturnValue('execution-timeline');
  LocationMiniMap.mockReturnValue('location-map');
});

it('shows an operational summary before the two-column context and description', () => {
  const { text } = renderOverview(makeWorkOrder());
  ['Cliente A', 'Unidade Central', 'Pessoa 9', 'Equipe Norte'].forEach((value) => {
    expect(text.indexOf(value)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(value)).toBeLessThan(text.indexOf('LONG-DESCRIPTION'));
  });
  expect(text.indexOf('Ana Silva')).toBeGreaterThan(text.indexOf('LONG-DESCRIPTION'));
  expect(text.indexOf('field_report')).toBeLessThan(text.indexOf('LONG-DESCRIPTION'));
  expect(text.indexOf('LONG-DESCRIPTION')).toBeLessThan(text.indexOf('execution-timeline'));
  expect(text.match(/Pessoa 9/g)).toHaveLength(1);
  expect(text.match(/Ana Silva/g)).toHaveLength(1);
});

it('preserves all customer links, location reference, coordinates and delegated execution data', () => {
  const workOrder = makeWorkOrder();
  const { container, text, props } = renderOverview(workOrder);
  expect(container.querySelector('a[href="/app/vendors-customers/customers/1"]').textContent).toBe('Cliente A');
  expect(container.querySelector('a[href="/app/vendors-customers/customers/2"]').textContent).toBe('Cliente B');
  expect(container.querySelector('a[href="/app/locations/4"]').textContent).toBe('Unidade Central');
  expect(text).toContain('PC 04 - Rua das Flores, 20');
  expect(LocationMiniMap.mock.calls[0][0]).toMatchObject({ latitude: -23.5, longitude: -46.6, height: 160 });
  expect(mockGetPendingRequirements.mock.calls[0][0]).toBe(workOrder);
  expect(FieldExecutionTimeline.mock.calls[0][0].workOrder).toBe(workOrder);
});

it('handles missing context without inventing an assignment or rendering a map', () => {
  const { text, container } = renderOverview(makeWorkOrder({
    customers: [], location: null, primaryUser: null, team: null, assignedTo: []
  }));
  expect(text).toContain('—');
  expect(text).not.toContain('Pessoa 9');
  expect(text).not.toContain('undefined');
  expect(container.querySelector('a[href^="/app/locations/"]')).toBeNull();
  expect(LocationMiniMap).not.toHaveBeenCalled();
});

it('shows no alert when every configured requirement is already complete', () => {
  mockGetPendingRequirements.mockReturnValue([
    { key: 'signature', labelKey: 'signature', done: true }
  ]);
  const { text } = renderOverview(makeWorkOrder({ status: 'COMPLETE' }));
  expect(text).toContain('Nenhuma');
  expect(text).not.toContain('signature');
});

it('keeps multiple incomplete requirements compact in the summary', () => {
  mockGetPendingRequirements.mockReturnValue([
    { key: 'signature', labelKey: 'signature', done: false },
    { key: 'checklist', labelKey: 'service_checklist', done: false },
    { key: 'photos', labelKey: 'photos', done: false },
    { key: 'mileage', labelKey: 'mileage_traveled', done: false }
  ]);
  const { text } = renderOverview(makeWorkOrder());
  expect(text).toContain('signature · service_checklist +2');
});

it('keeps completion metadata and description visible without introducing action controls', () => {
  const { text, container } = renderOverview(makeWorkOrder({
    status: 'COMPLETE',
    completedBy: { id: 12, firstName: 'João', lastName: 'Souza' },
    completedOn: '2026-09-10',
    feedback: 'Serviço aprovado'
  }));
  expect(text).toContain('João Souza');
  expect(text).toContain('2026-09-10');
  expect(text).toContain('Serviço aprovado');
  expect(text).toContain('LONG-DESCRIPTION');
  expect(container.querySelectorAll('button, input, select')).toHaveLength(0);
});
