import { FilterField } from '../../models/page';

export const getEffectiveEnumValues = (
  completeOptions: string[],
  statuses: boolean[],
  initialOptions: string[],
  restoreInitialOnEmpty: boolean
): string[] => {
  const selectedValues = completeOptions.filter((_, index) => statuses[index]);

  return restoreInitialOnEmpty && selectedValues.length === 0
    ? [...initialOptions]
    : selectedValues;
};

export const replaceEnumFilterValues = (
  filterFields: FilterField[],
  fieldName: string,
  values: string[]
): FilterField[] =>
  filterFields.map((filterField) =>
    filterField.field === fieldName
      ? { ...filterField, values: [...values] }
      : filterField
  );
