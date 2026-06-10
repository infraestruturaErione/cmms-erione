const TIME_ZONE_SUFFIX_PATTERN = /(?:z|[+-]\d{2}:?\d{2})$/i;

export const ERIONE_TIME_ZONE = 'America/Sao_Paulo';

export const parseApiDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalizedValue = TIME_ZONE_SUFFIX_PATTERN.test(value)
    ? value
    : `${value}Z`;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};
