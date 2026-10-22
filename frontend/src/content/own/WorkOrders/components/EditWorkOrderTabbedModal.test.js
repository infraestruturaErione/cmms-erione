import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { ThemeProvider } from '@mui/material/styles';
import * as Yup from 'yup';
import { PureLightTheme } from '../../../../theme/schemes/PureLightTheme';
import Form from '../../components/form';
import EditWorkOrderTabbedModal, {
  getEditWorkOrderTab
} from './EditWorkOrderTabbedModal';

jest.mock('../../../../i18n/i18n', () => ({
  __esModule: true,
  default: { dir: () => 'ltr' }
}));

let mockCategories;
const mockDispatch = jest.fn(() => Promise.resolve());
jest.mock('../../../../store', () => ({
  useSelector: (select) =>
    select({ categories: { categories: mockCategories } }),
  useDispatch: () => mockDispatch
}));
jest.mock('../../../../slices/category', () => ({
  getCategories: (path) => ({ type: 'load-categories', path })
}));
jest.mock('../../../../hooks/useBrand', () => ({
  useBrand: () => ({ logo: { dark: '/logo.png' }, name: 'Erione CMMS' })
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key)
  })
}));
jest.mock('formik-error-focus', () => () => null);
// Exercise the real form/layout without asynchronous portal transition timers.
jest.mock('@mui/material/Dialog', () => ({
  __esModule: true,
  default: ({ open, children }) =>
    open ? <div role="dialog">{children}</div> : null
}));
jest.mock('../../components/form/SelectPartQuantities', () => () => null);
jest.mock('../../components/form/SelectMapCoordinates', () => () => null);
jest.mock('../../components/form/SignaturePad', () => () => null);
jest.mock('../../components/form/DateRangePicker', () => () => null);
jest.mock(
  '@mui/lab/DateTimePicker',
  () =>
    ({ value, onChange, renderInput }) =>
      renderInput({
        value: value ? value.toISOString() : '',
        onChange: (event) => onChange(new Date(event.target.value))
      })
);
jest.mock('../../components/form/CustomSelect2', () => ({
  CustomSelect: ({ field, handleChange }) => {
    const formik = require('formik').useFormikContext();
    return (
      <input
        aria-label={field.label}
        data-field={field.name}
        data-hide-checklist={String(Boolean(field.hideCategoryChecklistAlert))}
        value={JSON.stringify(formik.values[field.name] ?? null)}
        onChange={(event) =>
          handleChange(formik, field.name, JSON.parse(event.target.value))
        }
      />
    );
  }
}));
jest.mock('../../components/FileUpload', () => (props) => (
  <button
    data-upload={props.title}
    data-variant={props.variant}
    disabled={props.disabled}
    onClick={() =>
      props.onDrop([...(props.files || []), { id: 99, name: 'nova-foto.jpg' }])
    }
  >
    {props.title}: {(props.files || []).map((file) => file.name).join(', ')}
  </button>
));

const fields = [
  { name: 'geralGroup', type: 'titleGroupField', label: 'Em geral' },
  { name: 'title', type: 'text', label: 'Título', required: true },
  { name: 'description', type: 'text', label: 'Descrição', multiple: true },
  { name: 'category', type: 'select', label: 'Tipo de tarefa' },
  { name: 'priority', type: 'select', label: 'Prioridade' },
  { name: 'assetStatus', type: 'select', label: 'Status do ativo' },
  { name: 'requiredSignature', type: 'switch', label: 'Requer assinatura' },
  {
    name: 'customers',
    type: 'select',
    label: 'Cliente',
    clearsOnChange: ['location', 'asset']
  },
  {
    name: 'location',
    type: 'select',
    label: 'Endereço',
    clearsOnChange: ['asset']
  },
  { name: 'asset', type: 'select', label: 'Equipamento' },
  { name: 'primaryUser', type: 'select', label: 'Trabalhador principal' },
  { name: 'assignedTo', type: 'select', label: 'Adicionais', multiple: true },
  { name: 'team', type: 'select', label: 'Equipe' },
  { name: 'estimatedStartDate', type: 'date', label: 'Início estimado' },
  { name: 'dueDate', type: 'date', label: 'Prazo' },
  { name: 'estimatedDuration', type: 'number', label: 'Duração' },
  { name: 'tasks', type: 'select', label: 'Itens do questionário' },
  { name: 'files', type: 'file', label: 'Arquivos', multiple: true },
  { name: 'image', type: 'file', label: 'Imagem', fileType: 'image' },
  { name: 'customField_7', type: 'text', label: 'Referência interna' }
];
const values = {
  title: 'Manutenção preventiva',
  description: 'Inspecionar acesso',
  category: { value: 3, label: 'Manutenção' },
  requiredSignature: true,
  customers: { value: 1, label: 'Cliente A' },
  location: { value: 5, label: 'Endereço A' },
  asset: { value: 6, label: 'Câmera A' },
  primaryUser: { value: 4, label: 'Danilo' },
  assignedTo: [{ value: 7, label: 'Heberson' }],
  team: { value: 9, label: 'Equipe A' },
  tasks: [{ taskBase: { id: 11 } }],
  estimatedDuration: 2,
  estimatedStartDate: '2026-10-20T12:00:00Z',
  dueDate: null,
  files: [{ id: 10, name: 'arquivo.pdf' }],
  image: { id: 12, name: 'imagem.jpg' },
  customField_7: 'PC-100'
};
let container;
const submit = jest.fn(() => Promise.resolve());
const onClose = jest.fn();
const baseProps = {
  open: true,
  fields,
  values,
  validation: Yup.object({
    title: Yup.string().required('Título obrigatório')
  }),
  onSubmit: submit,
  onClose,
  workOrderCode: 'W000091'
};
const render = async (overrides = {}) =>
  act(async () => {
    ReactDOM.render(
      <ThemeProvider theme={PureLightTheme}>
        <EditWorkOrderTabbedModal {...baseProps} {...overrides} />
      </ThemeProvider>,
      container
    );
  });
const click = async (element) => act(async () => Simulate.click(element));
const tab = (index) => document.querySelectorAll('[role="tab"]')[index];
const button = (text) =>
  [...document.querySelectorAll('button')].find((node) =>
    node.textContent.includes(text)
  );
const change = async (node, value) =>
  act(async () =>
    Simulate.change(node, { target: { name: node.name, value } })
  );
const save = () => click(button('Salvar alterações'));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  jest.clearAllMocks();
  mockCategories = {
    'work-order-categories': [
      { id: 3, defaultChecklist: { id: 8, name: 'Questionário de manutenção' } }
    ]
  };
  mockDispatch.mockImplementation(() => Promise.resolve());
  submit.mockImplementation(() => Promise.resolve());
});
afterEach(async () => {
  await act(async () => ReactDOM.unmountComponentAtNode(container));
  container.remove();
});

it('replaces equipment and checklist editing with linked information without dropping stored values', async () => {
  await render();
  expect(document.querySelector('#wo-edit-title').textContent).toBe(
    'Editar ordem de serviço'
  );
  expect(document.body.textContent).toContain('W000091');
  expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
  expect(document.querySelector('[data-field="asset"]')).toBeNull();
  expect(document.querySelector('[data-field="assetStatus"]')).toBeNull();
  expect(document.querySelector('[data-field="tasks"]')).toBeNull();
  expect(document.querySelector('input[name="customField_7"]').value).toBe(
    'PC-100'
  );
  expect(document.body.textContent).not.toContain('Edit Work Order');
  expect(document.body.textContent).not.toContain('ao criar a OS');
  expect(
    document.body.textContent.match(/Questionário de manutenção/g)
  ).toHaveLength(1);
});

it('keeps drafts, assignees, dates, tasks and attachments across all tabs and submits the same shape', async () => {
  await render();
  await change(
    document.querySelector('input[name="title"]'),
    'Título alterado'
  );
  await click(tab(1));
  await click(tab(2));
  await click(document.querySelector('[data-upload="Arquivos"]'));
  await click(tab(0));
  await save();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][0]).toEqual({
    ...values,
    title: 'Título alterado',
    files: [...values.files, { id: 99, name: 'nova-foto.jpg' }]
  });
});

it('preserves customer/location cascade clearing in the real Form handler', async () => {
  await render();
  await change(
    document.querySelector('[data-field="customers"]'),
    JSON.stringify({ value: 2, label: 'Cliente B' })
  );
  await save();
  expect(submit.mock.calls[0][0]).toMatchObject({
    customers: { value: 2 },
    location: null,
    asset: null
  });
});

it('opens the tab with validation errors instead of silently blocking on a hidden input', async () => {
  await render({
    validation: Yup.object({
      dueDate: Yup.string().nullable().required('Defina o prazo')
    })
  });
  await click(tab(2));
  await save();
  expect(submit).not.toHaveBeenCalled();
  expect(tab(1).getAttribute('aria-selected')).toBe('true');
  expect(document.querySelector('[role="alert"]').textContent).toContain(
    'Confira os campos'
  );
  expect(document.body.textContent).toContain('Defina o prazo');
});

it('opens attachments when a required file is missing', async () => {
  await render({
    values: { ...values, files: [] },
    validation: Yup.object({ files: Yup.array().min(1, 'Anexe um arquivo') })
  });
  await save();
  expect(tab(2).getAttribute('aria-selected')).toBe('true');
  expect(submit).not.toHaveBeenCalled();
});

it('routes hidden validation errors when saving with Enter as well', async () => {
  await render({
    validation: Yup.object({
      dueDate: Yup.string().nullable().required('Prazo obrigatório')
    })
  });
  await act(async () =>
    Simulate.keyDown(document.querySelector('input[name="title"]'), {
      key: 'Enter'
    })
  );
  expect(tab(1).getAttribute('aria-selected')).toBe('true');
  expect(submit).not.toHaveBeenCalled();
});

it('locks actions until the actual async save finishes and prevents double submission', async () => {
  let finish;
  submit.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await render();
  await save();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(button('Salvando...').disabled).toBe(true);
  expect(button('Cancelar').disabled).toBe(true);
  expect(document.querySelector('[data-upload="Arquivos"]').disabled).toBe(
    true
  );
  await click(button('Salvando...'));
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(button('Salvar alterações').disabled).toBe(false);
});

it('retains edits and unlocks actions after a rejected save', async () => {
  submit.mockRejectedValue(
    new Error('API failure handled by the existing caller')
  );
  await render();
  await change(document.querySelector('input[name="title"]'), 'Não perder');
  await save();
  expect(document.querySelector('input[name="title"]').value).toBe(
    'Não perder'
  );
  expect(button('Salvar alterações').disabled).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
});

it('respects hidden fields and opts into light uploads without duplicate checklist banners', async () => {
  await render({
    fields: fields.filter(
      (field) => !['asset', 'primaryUser'].includes(field.name)
    )
  });
  expect(document.querySelector('[data-field="asset"]')).toBeNull();
  expect(document.querySelector('[data-field="primaryUser"]')).toBeNull();
  expect(
    document.querySelector('[data-upload="Arquivos"]').dataset.variant
  ).toBe('light');
  expect(
    document.querySelector('[data-field="category"]').dataset.hideChecklist
  ).toBe('true');
  expect(document.querySelector('[data-field="tasks"]')).toBeNull();
});

it('cancels without submitting and starts on General on the next opening', async () => {
  await render();
  await click(tab(2));
  await click(button('Cancelar'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
  await render({ open: false });
  await render();
  expect(tab(0).getAttribute('aria-selected')).toBe('true');
});

it('keeps the default shared form layout when the edit layout hook is not supplied', async () => {
  await act(async () =>
    ReactDOM.render(
      <ThemeProvider theme={PureLightTheme}>
        <Form fields={fields.slice(0, 3)} values={values} onSubmit={submit} />
      </ThemeProvider>,
      container
    )
  );
  expect(container.textContent).toContain('Em geral');
  expect(container.querySelector('input[name="title"]').value).toBe(
    values.title
  );
});

it('routes each known group and leaves unknown/custom fields in General', () => {
  expect(getEditWorkOrderTab('team')).toBe(1);
  expect(getEditWorkOrderTab('estimatedStartDate')).toBe(1);
  expect(getEditWorkOrderTab('image')).toBe(2);
  expect(getEditWorkOrderTab('customField_7')).toBe(0);
});

it('gives long task types a full row and pairs priority with signature on desktop', async () => {
  await render();
  const isHalfWidth = (name) =>
    document
      .querySelector(`[data-field="${name}"]`)
      .closest('.MuiGrid-item')
      .classList.contains('MuiGrid-grid-md-6');
  expect(isHalfWidth('category')).toBe(false);
  expect(isHalfWidth('priority')).toBe(true);
  expect(document.querySelector('[data-field="assetStatus"]')).toBeNull();
  expect(
    document
      .querySelector('input[name="requiredSignature"]')
      .closest('.MuiGrid-item')
      .classList.contains('MuiGrid-grid-md-6')
  ).toBe(true);
});

it('uses the real linked questionnaire name and updates it when the task type changes', async () => {
  mockCategories['work-order-categories'].push({
    id: 10,
    defaultChecklist: { id: 20, name: 'CARTÃO DE MEMORIA' }
  });
  await render();
  await change(
    document.querySelector('[data-field="category"]'),
    JSON.stringify({ value: 10, label: 'Outro tipo' })
  );
  expect(document.body.textContent).toContain('CARTÃO DE MEMORIA');
  expect(document.body.textContent).not.toContain('Questionário de manutenção');
  expect(document.querySelector('[data-field="tasks"]')).toBeNull();
  await save();
  expect(submit.mock.calls[0][0].tasks).toEqual(values.tasks);
  expect(submit.mock.calls[0][0].asset).toEqual(values.asset);
});

it('does not invent a template for types without one or reset the existing OS questionnaire', async () => {
  mockCategories['work-order-categories'] = [{ id: 3 }];
  await render();
  expect(document.body.textContent).toContain('Sem questionário padrão');
  expect(document.body.textContent).not.toContain(
    'Vinculado ao tipo de tarefa'
  );
  await save();
  expect(submit.mock.calls[0][0].tasks).toEqual(values.tasks);
});

it('loads the type metadata once without typing or opening the selector', async () => {
  mockCategories = {};
  await render();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch.mock.calls[0][0]).toEqual({
    type: 'load-categories',
    path: 'work-order-categories'
  });
  await change(
    document.querySelector('input[name="title"]'),
    'Outra descrição'
  );
  await click(tab(1));
  await click(tab(0));
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toContain('Sem questionário padrão');
});

it('distinguishes a failed metadata read from an absent questionnaire and allows retry', async () => {
  mockCategories = {};
  mockDispatch.mockRejectedValueOnce(new Error('Connection failed'));
  await render();
  expect(document.body.textContent).toContain('Não foi possível consultar');
  expect(document.body.textContent).not.toContain('Sem questionário padrão');
  await click(button('Tentar novamente'));
  expect(mockDispatch).toHaveBeenCalledTimes(2);
});

it('only exposes equipment as a recovery field when company validation requires a missing value', async () => {
  await render({
    fields: fields.map((field) =>
      field.name === 'asset' ? { ...field, required: true } : field
    )
  });
  expect(document.querySelector('[data-field="asset"]')).toBeNull();
  await change(
    document.querySelector('[data-field="customers"]'),
    JSON.stringify({ value: 2, label: 'Cliente B' })
  );
  expect(document.querySelector('[data-field="asset"]')).not.toBeNull();
  expect(document.body.textContent).toContain(
    'A configuração da empresa exige'
  );
});
