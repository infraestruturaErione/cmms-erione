import {
  getLocationAddressWithReference,
  getLocationReferenceLabel
} from './locationDisplay';

// Referencia Operacional (ID/PC) - so' as funcoes PURAS de formatacao
// (nenhum componente React envolvido). Cobre os 3 casos validos (ID, PC, sem
// referencia) nos 2 formatos (tabela vs. linha de endereco na criacao de
// OS), alem do caso critico de nao duplicar um prefixo "ID xxxx" legado ja
// presente em address.
describe('getLocationReferenceLabel (coluna "ID / PC" da tabela)', () => {
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

  it('sem referencia => null (nao "--" - quem renderiza decide o placeholder)', () => {
    expect(
      getLocationReferenceLabel({ referenceType: null, referenceCode: null })
    ).toBeNull();
    expect(getLocationReferenceLabel(null)).toBeNull();
    expect(getLocationReferenceLabel(undefined)).toBeNull();
  });

  it('type sem code, ou code sem type, e tratado como ausente (invariante do backend)', () => {
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

describe('getLocationAddressWithReference (linha de endereco na criacao de OS)', () => {
  it('ID + codigo + endereco => "ID <codigo> - <endereco>"', () => {
    expect(
      getLocationAddressWithReference({
        name: 'Camera Praca Central',
        address: 'Rua X, 123',
        referenceType: 'ID',
        referenceCode: '15540'
      })
    ).toBe('ID 15540 - Rua X, 123');
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

  // CASO CRITICO (pedido explicito): a composicao do novo prefixo usa o
  // endereco ja normalizado por getLocationDisplayAddress, NAO
  // location.address cru - dado legado do Auvo que ja tem "ID 1027 - "
  // digitado manualmente dentro de address nao pode duplicar com o novo
  // prefixo estruturado ("ID 15540 - ID 1027 - Rua X").
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
