import { matchesLocationSearch } from './locationSearch';

const location = (overrides = {}) => ({
  name: 'Praca do Loteamento Atalaia e Rodoviaria',
  address: '35 - Av. Frei Orestes Girardi, 3301',
  customId: 'LOC-001',
  referenceType: 'ID',
  referenceCode: '26',
  ...overrides
});

describe('matchesLocationSearch', () => {
  it('preserva a busca existente por name, address e customId', () => {
    expect(matchesLocationSearch(location(), 'atalaia')).toBe(true);
    expect(matchesLocationSearch(location(), 'orestes')).toBe(true);
    expect(matchesLocationSearch(location(), 'loc-001')).toBe(true);
  });

  it('encontra referenceCode sem prefixo para ID e PC', () => {
    expect(matchesLocationSearch(location(), '26')).toBe(true);
    expect(
      matchesLocationSearch(
        location({ referenceType: 'PC', referenceCode: '04' }),
        '04'
      )
    ).toBe(true);
  });

  it('restringe ID explicito ao tipo ID', () => {
    expect(matchesLocationSearch(location(), 'ID 26')).toBe(true);
    expect(
      matchesLocationSearch(location({ referenceType: 'PC' }), 'ID 26')
    ).toBe(false);
  });

  it('restringe PC explicito ao tipo PC', () => {
    const pc = location({ referenceType: 'PC', referenceCode: '04' });
    expect(matchesLocationSearch(pc, 'PC 04')).toBe(true);
    expect(
      matchesLocationSearch(
        location({ referenceType: 'ID', referenceCode: '04' }),
        'PC 04'
      )
    ).toBe(false);
  });

  it('trata o prefixo sem diferenca entre maiusculas e minusculas', () => {
    expect(matchesLocationSearch(location(), 'id 26')).toBe(true);
    expect(matchesLocationSearch(location(), 'Id 26')).toBe(true);
  });

  it('preserva zero a esquerda sem converter o codigo para numero', () => {
    const pc = location({ referenceType: 'PC', referenceCode: '04' });
    expect(matchesLocationSearch(pc, 'PC 04')).toBe(true);
    expect(matchesLocationSearch(pc, '04')).toBe(true);
  });

  it('aceita correspondencia parcial no codigo cru e prefixado', () => {
    const id = location({ referenceCode: '15540' });
    expect(matchesLocationSearch(id, '1554')).toBe(true);
    expect(matchesLocationSearch(id, 'ID 1554')).toBe(true);
  });

  it('continua encontrando Location sem referencia pelos campos existentes', () => {
    const withoutReference = location({
      referenceType: null,
      referenceCode: null
    });
    expect(matchesLocationSearch(withoutReference, 'atalaia')).toBe(true);
    expect(matchesLocationSearch(withoutReference, 'orestes')).toBe(true);
    expect(matchesLocationSearch(withoutReference, 'loc-001')).toBe(true);
  });

  it('nao transforma ID ou PC sem codigo em filtro por tipo', () => {
    expect(
      matchesLocationSearch(
        location({ name: 'Posto Central', referenceType: 'ID' }),
        'ID'
      )
    ).toBe(false);
    expect(
      matchesLocationSearch(
        location({ name: 'Unidade PC', referenceType: 'ID' }),
        'PC'
      )
    ).toBe(true);
  });

  it('considera busca vazia como compatível para preservar a lista completa', () => {
    expect(matchesLocationSearch(location(), '')).toBe(true);
    expect(matchesLocationSearch(location(), '   ')).toBe(true);
  });
});
