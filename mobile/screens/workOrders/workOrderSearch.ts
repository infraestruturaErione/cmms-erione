import isEqual from 'lodash/isEqual';
import { SearchCriteria } from '../../models/page';

const fields = ['title', 'description', 'feedback', 'customId'];

export const getWorkOrderSearchText = (criteria: SearchCriteria): string => {
  const filter = criteria.filterFields.find(
    (item) =>
      fields.includes(item.field) &&
      item.operation === 'cn' &&
      typeof item.value === 'string'
  );
  return filter?.value ?? '';
};

// Preserve the existing text-search fields/OR contract and all non-text filters.
export function applyWorkOrderSearch(
  criteria: SearchCriteria,
  text: string
): SearchCriteria {
  const value = text.trim();
  const filterFields = criteria.filterFields.filter(
    (item) => !fields.includes(item.field)
  );
  if (value) {
    filterFields.push({
      field: fields[0],
      value,
      operation: 'cn',
      alternatives: fields.slice(1).map((field) => ({
        field,
        operation: 'cn',
        value
      }))
    });
  }
  const next = { ...criteria, filterFields, pageNum: 0 };
  return isEqual(criteria, next) ? criteria : next;
}
