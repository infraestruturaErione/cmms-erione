import { FilterField } from '../../../../models/owns/page';

export const getWorkOrderSearchText = (filters: FilterField[]): string => {
  const search = filters.find(
    (filter) => filter.field === 'title' && filter.operation === 'cn'
  );
  return typeof search?.value === 'string' ? search.value : '';
};

// Presentation only: compare defaults without changing the request's filter tree.
export const isDefaultFilter = (filter: FilterField, defaults: FilterField[]) => {
  const initial = defaults.find((entry) => entry.field === filter.field);
  if (!initial || filter.alternatives?.length || filter.operation !== initial.operation) return false;
  if (initial.values) {
    return filter.values?.length === initial.values.length &&
      initial.values.every((value) => filter.values.includes(value));
  }
  return filter.value === initial.value;
};

// Remove the selected predicate as a whole, including its OR branches. Other
// predicates retain their exact operators, values, joins and alternatives.
export const removeWorkOrderFilter = (
  filters: FilterField[], index: number, defaults: FilterField[]
): FilterField[] => {
  const initial = defaults.find((entry) => entry.field === filters[index]?.field);
  return filters.flatMap((filter, position) => {
    if (position !== index) return [filter];
    return initial
      ? [{ ...initial, ...(initial.values ? { values: [...initial.values] } : {}) }]
      : [];
  });
};
