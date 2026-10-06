import { normalizeSearchText } from './formatters';

export interface LocationSearchSource {
  name?: string | null;
  label?: string | null;
  address?: string | null;
  customId?: string | null;
  referenceType?: 'ID' | 'PC' | null;
  referenceCode?: string | null;
}

const parseReferenceSearch = (
  normalizedSearch: string
): { type: 'ID' | 'PC'; code: string } | null => {
  for (const type of ['ID', 'PC'] as const) {
    const prefix = `${type.toLowerCase()} `;
    if (normalizedSearch.startsWith(prefix)) {
      const code = normalizedSearch.slice(prefix.length).trim();
      return code ? { type, code } : null;
    }
  }
  return null;
};

// Espelha a busca textual do backend para a lista de Locations que ja veio
// escopada pela API. Prefixos ID/PC filtram tipo + codigo; sem prefixo, o
// termo continua sendo procurado por substring em todos os campos suportados.
export const matchesLocationSearch = (
  location: LocationSearchSource,
  search: string
): boolean => {
  const normalizedSearch = normalizeSearchText(search);
  if (!normalizedSearch) return true;

  const referenceSearch = parseReferenceSearch(normalizedSearch);
  if (referenceSearch) {
    return (
      location.referenceType === referenceSearch.type &&
      normalizeSearchText(location.referenceCode || '').includes(
        referenceSearch.code
      )
    );
  }

  return [
    location.name,
    location.label,
    location.address,
    location.customId,
    location.referenceCode
  ].some((value) =>
    normalizeSearchText(value || '').includes(normalizedSearch)
  );
};
