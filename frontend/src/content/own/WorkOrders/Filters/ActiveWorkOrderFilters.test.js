import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import ActiveWorkOrderFilters from './ActiveWorkOrderFilters';
import EnumFilter from './EnumFilter';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, fallback) => fallback || key }) }));
jest.mock('../../../../store', () => ({ useSelector: (select) => select({
  customers: { customersMini: [{ id: 3, name: 'Cliente A' }] },
  locations: { locationsMini: [] }, assets: { assetsMini: [] }, teams: { teamsMini: [] },
  users: { usersMini: [{ id: 5, firstName: 'Ana', lastName: 'Souza' }] },
  categories: { categories: { 'work-order-categories': [] } }
}) }));
jest.mock('../../../../utils/overall', () => ({
  pushOrRemove: (values, add, value) => add ? [...values, value] : values.filter((item) => item !== value)
}));

let container;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
const render = (element) => act(() => { ReactDOM.render(element, container); });

it('shows saved customer and responsible filters using available names, and removes only the clicked chip', () => {
  const onRemove = jest.fn();
  render(<ActiveWorkOrderFilters defaults={[]} filters={[
    { field: 'customers', operation: 'inm', value: '', values: [3] },
    { field: 'primaryUser', operation: 'in', value: '', values: [5] }
  ]}
    onRemove={onRemove}
    onReset={jest.fn()} />);
  expect(container.textContent).toContain('Cliente A');
  expect(container.textContent).toContain('Ana Souza');
  act(() => Simulate.click(container.querySelectorAll('.MuiChip-deleteIcon')[1]));
  expect(onRemove).toHaveBeenCalledWith(1);
  expect(onRemove).toHaveBeenCalledTimes(1);
});

it('retains a visible identifier when the mini record is not loaded, and offers reset', () => {
  const onReset = jest.fn();
  render(<ActiveWorkOrderFilters defaults={[]} filters={[
    { field: 'location', operation: 'in', value: '', values: [77] }
  ]}
    onRemove={jest.fn()}
    onReset={onReset} />);
  expect(container.textContent).toContain('77');
  act(() => Simulate.click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Restaurar filtros')));
  expect(onReset).toHaveBeenCalledTimes(1);
});

it('renders nothing when only default filters apply', () => {
  const filters = [{ field: 'archived', operation: 'eq', value: false }];
  render(<ActiveWorkOrderFilters defaults={filters} filters={filters} onRemove={jest.fn()} onReset={jest.fn()} />);
  expect(container.textContent).toBe('');
  expect(container.querySelector('.MuiChip-root')).toBeNull();
  expect(container.textContent).not.toContain('Restaurar filtros');
});

it('keeps STATUS/in and other predicates intact when toggling COMPLETE in the compact menu', () => {
  const onChange = jest.fn();
  const other = { field: 'customers', operation: 'inm', value: '', values: [3] };
  const filters = [{ field: 'status', operation: 'in', value: '', values: ['OPEN'], enumName: 'STATUS' }, other];
  render(<EnumFilter compact filterFields={filters} onChange={onChange} completeOptions={['OPEN', 'EN_ROUTE', 'COMPLETE']} fieldName="status" enumName="STATUS" icon={<span />} />);
  act(() => Simulate.click(container.querySelector('button')));
  act(() => Simulate.click(Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent.includes('COMPLETE'))));
  expect(onChange).toHaveBeenCalledWith([
    { ...filters[0], values: ['OPEN', 'COMPLETE'] }, other
  ]);
  expect(filters[0].values).toEqual(['OPEN']);
});
