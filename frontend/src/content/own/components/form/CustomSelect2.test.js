import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { Formik } from 'formik';
import { CustomSelect } from './CustomSelect2';

const mockState = {
  customers: { customersMini: [] },
  vendors: { vendorsMini: [] },
  locations: {
    locationsMini: [{ id: 1, name: 'Old address', address: 'Street A' }],
    locationsHierarchy: []
  },
  categories: { categories: {} },
  users: { usersMini: [] },
  assets: { assetsMini: [] },
  teams: { teamsMini: [] },
  roles: { roles: [] },
  currencies: { currencies: [] }
};
jest.mock('../../../../store', () => ({
  useSelector: (select) => select(mockState),
  useDispatch: () => jest.fn()
}));
jest.mock('../../../../utils/api', () => ({
  __esModule: true,
  default: {},
  getErrorMessage: () => 'error'
}));
jest.mock('../../../../hooks/useAuth', () => () => ({
  user: { companySettingsId: 1 },
  hasCreatePermission: () => false
}));
jest.mock('../../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({
    showSnackBar: jest.fn()
  })
}));
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '' }),
  useNavigate: () => jest.fn()
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));
jest.mock('./SelectAssetModal', () => () => null);
jest.mock('./SelectLocationModal', () => () => null);
jest.mock('./SelectParts', () => () => null);
jest.mock('./SelectTasks', () => () => null);

let container;
const field = {
  name: 'location',
  type2: 'location',
  label: 'Address',
  scopedByCustomer: true
};
const render = async (customer = { label: 'Customer A', value: 1 }) => {
  await act(async () => {
    ReactDOM.render(
      <Formik
        initialValues={{
          customers: customer,
          location: { label: 'Old address', value: 1 }
        }}
        onSubmit={jest.fn()}
      >
        {(formik) => (
          <>
            <CustomSelect
              field={field}
              handleChange={(current, name, value) =>
                current.setFieldValue(name, value, false)
              }
            />
            <button
              id="change-customer"
              onClick={() =>
                formik.setValues(
                  {
                    customers: { label: 'Customer B', value: 2 },
                    location: null
                  },
                  false
                )
              }
            >
              Change customer
            </button>
            <button
              id="clear-customer"
              onClick={() =>
                formik.setValues({ customers: null, location: null }, false)
              }
            >
              Clear customer
            </button>
            <button
              id="same-customer"
              onClick={() =>
                formik.setFieldValue('customers', { ...customer }, false)
              }
            >
              Same customer
            </button>
            <span id="selection">{JSON.stringify(formik.values.location)}</span>
          </>
        )}
      </Formik>,
      container
    );
  });
};
const click = (id) => act(() => Simulate.click(container.querySelector(id)));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});

it('clears the displayed address immediately when the customer changes', async () => {
  await render();
  expect(container.querySelector('input').value).toBe('Old address');
  click('#change-customer');
  expect(container.querySelector('input').value).toBe('');
  expect(container.querySelector('#selection').textContent).toBe('null');
});

it('clears a draft search and disables the address when the customer is removed', async () => {
  await render();
  act(() =>
    Simulate.change(container.querySelector('input'), {
      target: { value: 'Draft address' }
    })
  );
  click('#clear-customer');
  expect(container.querySelector('input').value).toBe('');
  expect(container.querySelector('input').disabled).toBe(true);
});

it('keeps the selected address when the customer id remains the same', async () => {
  await render();
  click('#same-customer');
  expect(container.querySelector('input').value).toBe('Old address');
});
