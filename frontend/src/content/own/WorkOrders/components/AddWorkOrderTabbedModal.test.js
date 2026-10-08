import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import * as Yup from 'yup';

jest.mock('../../../../store', () => ({
  useSelector: (select) =>
    select({
      categories: { categories: {} },
      locations: { locations: [], locationsMini: [] }
    })
}));
jest.mock('../../../../hooks/useAuth', () => () => ({ companySettings: {} }));
jest.mock('../../../../hooks/useBrand', () => ({
  useBrand: () => ({ logo: {}, name: 'Erione' })
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));
jest.mock('../../../../utils/serverClock', () => ({
  hasServerClock: () => true,
  getServerNow: () => new Date('2026-10-08T14:00:00Z'),
  syncServerClock: () => Promise.resolve(new Date('2026-10-08T14:00:00Z'))
}));
jest.mock('./EstimatedStartDateField', () => () => null);
jest.mock('../Details/LocationMiniMap', () => () => null);
jest.mock('../../components/FileUpload', () => () => null);
jest.mock('../../components/form/Field', () => () => null);
jest.mock('../../components/form/CustomSwitch', () => () => null);
jest.doMock('../../components/form/CustomSelect2', () => ({
  CustomSelect: ({ field, handleChange }) => {
    const formik = require('formik').useFormikContext();
    const mockTeam = { label: 'Team A', value: 10 };
    const mockPeople = [
      { label: 'Danilo', value: 1 },
      { label: 'Heberson', value: 2 }
    ];
    return (
      <button
        data-field={field.name}
        onClick={() =>
          handleChange(
            formik,
            field.name,
            field.type2 === 'team' ? mockTeam : mockPeople
          )
        }
      >
        {JSON.stringify(formik.values[field.name])}
      </button>
    );
  }
}));
jest.doMock('../../components/form', () => (props) => {
  const MockFormik = require('formik').Formik;
  return (
    <MockFormik initialValues={props.values} onSubmit={props.onSubmit}>
      {(formik) => (
        <>
          {props.renderContent(formik, (current, field, value) =>
            current.setFieldValue(field, value, false)
          )}
          {props.renderActions(formik)}
        </>
      )}
    </MockFormik>
  );
});

const AddWorkOrderTabbedModal = require('./AddWorkOrderTabbedModal').default;
let container;
const fields = ['primaryUser', 'assignedTo', 'team'].map((name) => ({
  name,
  type: 'select'
}));
const props = {
  open: true,
  onClose: jest.fn(),
  fields,
  validation: Yup.object(),
  values: {},
  onSubmit: jest.fn(),
  submitText: 'create'
};
const render = async (overrides = {}) => {
  await act(async () => {
    ReactDOM.render(
      <AddWorkOrderTabbedModal {...props} {...overrides} />,
      container
    );
  });
};
const click = (element) => act(() => Simulate.click(element));
const tab = (index) => document.querySelectorAll('[role="tab"]')[index];
const radio = (mode) => document.querySelector(`input[value="${mode}"]`);
const chooseMode = (mode) =>
  act(() =>
    Simulate.change(radio(mode), { target: { value: mode, checked: true } })
  );

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

it('keeps Team mode across tabs even before a team has been selected', async () => {
  await render();
  chooseMode('TEAM');
  click(tab(1));
  click(tab(0));
  expect(radio('TEAM').checked).toBe(true);
  expect(
    document.querySelector('[data-field="__selectedTeam"]')
  ).not.toBeNull();
});

it('keeps the selected team across tabs', async () => {
  await render();
  chooseMode('TEAM');
  click(document.querySelector('[data-field="__selectedTeam"]'));
  click(tab(1));
  click(tab(0));
  expect(radio('TEAM').checked).toBe(true);
  expect(
    document.querySelector('[data-field="__selectedTeam"]').textContent
  ).toContain('Team A');
});

it('keeps multiple collaborators across tabs', async () => {
  await render();
  click(document.querySelector('[data-field="__selectedCollaborators"]'));
  click(tab(1));
  click(tab(0));
  expect(radio('COLLABORATORS').checked).toBe(true);
  const selected = document.querySelector(
    '[data-field="__selectedCollaborators"]'
  ).textContent;
  expect(selected).toContain('Danilo');
  expect(selected).toContain('Heberson');
});

it('resets the mode on a new modal opening', async () => {
  await render();
  chooseMode('TEAM');
  await render({ open: false });
  await render();
  expect(radio('COLLABORATORS').checked).toBe(true);
});

it('shows Team for a preselected team', async () => {
  await render({ values: { team: { label: 'Initial team', value: 5 } } });
  expect(radio('TEAM').checked).toBe(true);
  expect(
    document.querySelector('[data-field="__selectedTeam"]').textContent
  ).toContain('Initial team');
});
