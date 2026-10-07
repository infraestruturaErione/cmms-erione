import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ThemeProvider } from '@mui/material/styles';
import { PureLightTheme } from '../../../../theme/schemes/PureLightTheme';
import FieldExecutionSection from './FieldExecutionSection';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getCoordinates } from '../../../../utils/geolocation';
import {
  getDistanceInMeters,
  formatDistanceLabel
} from '../fieldExecutionRules';

const mockDispatch = jest.fn(() => Promise.resolve());
const mockSnack = jest.fn();
jest.mock('../../../../store', () => ({ useDispatch: () => mockDispatch }));
jest.mock('../../../../utils/geolocation', () => ({
  getCoordinates: jest.fn()
}));
jest.mock('../../../../utils/api', () => ({
  getErrorMessage: () => 'action_error'
}));
jest.mock('../../../../slices/workOrder', () => ({
  departWorkOrder: (id, payload) => ({ type: 'depart', id, payload }),
  checkInWorkOrder: (id, payload) => ({ type: 'check-in', id, payload }),
  checkOutWorkOrder: (id, payload) => ({ type: 'check-out', id, payload })
}));
jest.mock('src/i18n/i18n', () => ({
  __esModule: true,
  default: { dir: () => 'ltr' }
}));
jest.mock('../../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({})
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) =>
      values ? `${key} ${values.date || ''} ${values.user || ''}` : key
  })
}));

const created = '2026-10-07T16:00:00Z';
const departure = '2026-10-07T16:08:00Z';
const arrival = '2026-10-07T16:22:00Z';
const checkout = '2026-10-07T16:42:00Z';
const makeOrder = (overrides = {}) => ({
  id: 71,
  status: 'OPEN',
  createdAt: created,
  departureAt: null,
  checkInAt: null,
  checkOutAt: null,
  location: { latitude: 0, longitude: 0 },
  ...overrides
});
let container;
const render = (order, canEdit = true) =>
  act(() => {
    ReactDOM.render(
      <ThemeProvider theme={PureLightTheme}>
        <CustomSnackBarContext.Provider value={{ showSnackBar: mockSnack }}>
          <FieldExecutionSection
            workOrder={order}
            canEdit={canEdit}
            getFormattedDate={(d) => d}
          />
        </CustomSnackBarContext.Provider>
      </ThemeProvider>,
      container
    );
  });
const region = (label) =>
  container.querySelector(`section[aria-label="${label}"]`);
const clickAction = async () =>
  act(async () => {
    Simulate.click(container.querySelector('button'));
    await Promise.resolve();
  });
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-07T16:43:00Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  jest.clearAllMocks();
  mockDispatch.mockImplementation(() => Promise.resolve());
  getCoordinates.mockResolvedValue({ latitude: 0, longitude: 0.0001 });
});
afterEach(() => {
  act(() => ReactDOM.unmountComponentAtNode(container));
  container.remove();
  jest.useRealTimers();
});

it('presents an intentional pending state without addresses or a timer', () => {
  render(makeOrder());
  expect(region('execution_current_status').textContent).toContain(
    'not_started'
  );
  expect(container.querySelector('button').textContent).toContain(
    'start_travel'
  );
  expect(region('execution_travel_title').textContent).toContain(
    'execution_travel_waiting'
  );
  expect(region('execution_site_title').textContent).toContain(
    'execution_site_waiting'
  );
  expect(region('execution_closure_title').textContent).toContain(
    'execution_closure_waiting'
  );
  expect(container.querySelectorAll('input, textarea')).toHaveLength(0);
  expect(container.textContent).not.toMatch(
    /check_in_address|check_out_address|run_timer/
  );
});

it('shows travel time and the check-in action, recalculating locally each minute', () => {
  render(makeOrder({ departureAt: departure }));
  expect(region('execution_current_status').textContent).toContain('en_route');
  expect(container.querySelector('button').textContent).toContain(
    'make_check_in'
  );
  expect(region('execution_travel_title').textContent).toContain(departure);
  expect(region('execution_travel_title').textContent).toContain('35min');
  act(() => jest.advanceTimersByTime(60000));
  expect(region('execution_travel_title').textContent).toContain('36min');
  expect(mockDispatch).not.toHaveBeenCalled();
});

it('shows arrival, distance and on-site duration with the check-out action', () => {
  render(
    makeOrder({
      departureAt: departure,
      checkInAt: arrival,
      checkInLat: 0.000171,
      checkInLng: 0
    })
  );
  expect(region('execution_current_status').textContent).toContain('on_site');
  expect(container.querySelector('button').textContent).toContain(
    'make_check_out'
  );
  expect(region('execution_site_title').textContent).toContain(arrival);
  expect(region('execution_site_title').textContent).toContain('19 m');
  expect(region('execution_site_title').textContent).toContain('21min');
});

it('distinguishes field closure from work order completion', () => {
  render(
    makeOrder({
      departureAt: departure,
      checkInAt: arrival,
      checkOutAt: checkout
    })
  );
  expect(region('execution_current_status').textContent).toContain(
    'field_finished_work_order_open_helper'
  );
  expect(region('execution_current_status').textContent).not.toContain(
    'work_order_completed'
  );
  expect(container.querySelector('button')).toBeNull();
});

it('renders completed history, finalization and mileage without operational actions', () => {
  render(
    makeOrder({
      status: 'COMPLETE',
      departureAt: departure,
      checkInAt: arrival,
      checkOutAt: checkout,
      completedOn: '2026-10-07T16:44:00Z',
      completedBy: { firstName: 'Tecnico', lastName: 'Piloto' },
      mileageTraveled: 42.5
    })
  );
  expect(region('execution_current_status').textContent).toContain(
    'work_order_completed'
  );
  expect(region('finalization').textContent).toContain('Tecnico Piloto');
  expect(region('finalization').textContent).toContain('42.5 km');
  expect(container.querySelector('button')).toBeNull();
  expect(container.textContent).toContain('work_order_created');
  expect(container.textContent).toContain('service_in_progress');
});

it('uses the existing distance helpers for both records, including zero coordinates', () => {
  const order = makeOrder({
    departureAt: departure,
    checkInAt: arrival,
    checkOutAt: checkout,
    checkInLat: 0.000171,
    checkInLng: 0,
    checkOutLat: 0.000198,
    checkOutLng: 0
  });
  render(order);
  expect(
    formatDistanceLabel(
      getDistanceInMeters(order.checkInLat, order.checkInLng, 0, 0)
    )
  ).toBe('19 m');
  expect(region('execution_site_title').textContent).toContain('19 m');
  expect(region('execution_closure_title').textContent).toContain('22 m');
});

it('uses neutral fallbacks when coordinates are missing', () => {
  render(makeOrder({ checkInAt: arrival, location: null }));
  expect(region('execution_site_title').textContent).toContain('—');
  expect(container.textContent).not.toMatch(/undefined|NaN/);
});

it('keeps records visible but disables actions without permission', async () => {
  render(makeOrder(), false);
  expect(container.querySelector('button').disabled).toBe(true);
  await clickAction();
  expect(getCoordinates).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

it.each([
  ['depart', {}, 'departureLat', 'departureLng'],
  ['check-in', { departureAt: departure }, 'checkInLat', 'checkInLng'],
  [
    'check-out',
    { departureAt: departure, checkInAt: arrival },
    'checkOutLat',
    'checkOutLng'
  ]
])(
  'preserves the %s endpoint action, geolocation, payload and feedback',
  async (type, overrides, lat, lng) => {
    render(makeOrder(overrides));
    await clickAction();
    const payload = { [lat]: 0, [lng]: 0.0001 };
    if (type === 'check-in') payload.checkInAddress = null;
    if (type === 'check-out') payload.checkOutAddress = null;
    expect(mockDispatch).toHaveBeenCalledWith({ type, id: 71, payload });
    expect(mockSnack).toHaveBeenCalledWith(
      'field_execution_updated',
      'success'
    );
    expect(container.querySelector('button').disabled).toBe(false);
  }
);

it('continues the action with null coordinates when GPS is unavailable', async () => {
  getCoordinates.mockResolvedValue({ error: 'geolocation_permission_denied' });
  render(makeOrder());
  await clickAction();
  expect(mockSnack).toHaveBeenCalledWith(
    'geolocation_permission_denied',
    'error'
  );
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'depart',
    id: 71,
    payload: { departureLat: null, departureLng: null }
  });
});

it('restores the action after API failure and displays the existing error', async () => {
  mockDispatch.mockRejectedValueOnce(new Error('failure'));
  render(makeOrder());
  await clickAction();
  expect(mockSnack).toHaveBeenCalledWith('action_error', 'error');
  expect(container.querySelector('button').disabled).toBe(false);
});

it('reacts to refreshed work order props without starting a network timer', () => {
  render(makeOrder());
  render(makeOrder({ departureAt: departure }));
  expect(container.querySelector('button').textContent).toContain(
    'make_check_in'
  );
  render(makeOrder({ departureAt: departure, checkInAt: arrival }));
  expect(container.querySelector('button').textContent).toContain(
    'make_check_out'
  );
  expect(mockDispatch).not.toHaveBeenCalled();
});
