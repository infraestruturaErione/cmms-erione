import {
  getEffectiveEnumValues,
  replaceEnumFilterValues
} from '../enumFilterUtils';

const defaultStatuses = ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'];
const completeStatuses = [...defaultStatuses, 'COMPLETE'];

describe('work order enum filters', () => {
  it('restores active statuses when every status is unchecked', () => {
    expect(
      getEffectiveEnumValues(
        completeStatuses,
        completeStatuses.map(() => false),
        defaultStatuses,
        true
      )
    ).toEqual(defaultStatuses);
  });

  it('keeps COMPLETE available when explicitly selected', () => {
    expect(
      getEffectiveEnumValues(
        completeStatuses,
        completeStatuses.map((status) => status === 'COMPLETE'),
        defaultStatuses,
        true
      )
    ).toEqual(['COMPLETE']);
  });

  it('replaces values without mutating filter props', () => {
    const filterFields = [
      {
        field: 'status',
        operation: 'in',
        enumName: 'STATUS',
        value: '',
        values: ['OPEN']
      }
    ];
    const originalValues = filterFields[0].values;
    const result = replaceEnumFilterValues(
      filterFields,
      'status',
      defaultStatuses
    );

    expect(result).not.toBe(filterFields);
    expect(result[0]).not.toBe(filterFields[0]);
    expect(result[0].values).not.toBe(originalValues);
    expect(filterFields[0].values).toEqual(['OPEN']);
    expect(result[0]).toMatchObject({
      operation: 'in',
      enumName: 'STATUS',
      values: defaultStatuses
    });
  });
});
