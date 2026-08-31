import {
  getLocationAddressWithReference,
  getLocationReferenceLabel
} from '../locationDisplay';

describe('getLocationReferenceLabel (mobile)', () => {
  it('ID + codigo => so o codigo, sem prefixo "ID"', () => {
    expect(
      getLocationReferenceLabel({ referenceType: 'ID', referenceCode: '15540' })
    ).toBe('15540');
  });

  it('PC + codigo => "PC <codigo>"', () => {
    expect(
      getLocationReferenceLabel({ referenceType: 'PC', referenceCode: '04' })
    ).toBe('PC 04');
  });

  it('sem referencia => null', () => {
    expect(
      getLocationReferenceLabel({ referenceType: null, referenceCode: null })
    ).toBeNull();
    expect(getLocationReferenceLabel(null)).toBeNull();
    expect(getLocationReferenceLabel(undefined)).toBeNull();
  });

  it('type sem code, ou code sem type, e tratado como ausente', () => {
    expect(
      getLocationReferenceLabel({ referenceType: 'ID', referenceCode: null })
    ).toBeNull();
    expect(
      getLocationReferenceLabel({ referenceType: null, referenceCode: '15540' })
    ).toBeNull();
  });

  it('code so espacos e tratado como ausente (trim)', () => {
    expect(
      getLocationReferenceLabel({ referenceType: 'ID', referenceCode: '   ' })
    ).toBeNull();
  });

  it('preserva zero a esquerda', () => {
    expect(
      getLocationReferenceLabel({ referenceType: 'PC', referenceCode: '04' })
    ).toBe('PC 04');
  });
});

describe('getLocationAddressWithReference (mobile - Work Order do tecnico)', () => {
  it('ID + codigo + endereco => "ID <codigo> - <endereco>"', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Camera Praca Central',
        address: 'Praça Rui Barbosa, 109',
        referenceType: 'ID',
        referenceCode: '1019'
      })
    ).toBe('ID 1019 - Praça Rui Barbosa, 109');
  });

  it('PC + codigo + endereco => "PC <codigo> - <endereco>"', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Ponto de Coleta Centro',
        address: 'Rua Y, 456',
        referenceType: 'PC',
        referenceCode: '04'
      })
    ).toBe('PC 04 - Rua Y, 456');
  });

  it('sem referencia => so o endereco', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Paço Municipal',
        address: 'Rua Z, 789',
        referenceType: null,
        referenceCode: null
      })
    ).toBe('Rua Z, 789');
  });

  it('sem referencia e sem endereco => string vazia (nunca "ID null"/"PC undefined")', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Sem endereco',
        address: '',
        referenceType: null,
        referenceCode: null
      })
    ).toBe('');
  });

  it('com referencia mas sem endereco => so o prefixo, nunca "ID 15540 - "', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Camera sem endereco',
        address: '',
        referenceType: 'ID',
        referenceCode: '15540'
      })
    ).toBe('ID 15540');
  });

  it('nunca renderiza "ID null"/"ID undefined"/"PC null"/"PC undefined"', () => {
    const result = getLocationAddressWithReference({
      name: 'Teste',
      address: 'Rua Teste, 1',
      referenceType: null,
      referenceCode: undefined
    });
    expect(result).not.toContain('null');
    expect(result).not.toContain('undefined');
  });

  it('nao duplica um prefixo "ID xxxx" legado ja existente em address', () => {
    const result = getLocationAddressWithReference({
      name: 'Camera Praca Central',
      address: 'ID 1027 - Rua X, 123',
      referenceType: 'ID',
      referenceCode: '15540'
    });
    expect(result).toBe('ID 15540 - Rua X, 123');
    expect(result).not.toContain('ID 1027');
  });
});
