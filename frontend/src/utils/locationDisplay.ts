// Helpers de apresentacao para Location na UI web.
//
// Contexto: dados legados importados do Auvo por vezes tem um prefixo tipo
// "ID 1027 - " digitado manualmente dentro de Location.name ou
// Location.address, misturado com o texto livre. Location NAO tem campo de
// negocio proprio para esse "ID" (confirmado) - a Web nao apresenta mais esse
// prefixo como se fosse um campo independente, so' evita duplica-lo
// visualmente quando limpa Identificacao/Endereco pra exibicao.
//
// Estes helpers so' fazem parsing de apresentacao. Nao alteram o dado no
// backend/banco, e nao usam customId como substituto de nada disso.

export interface LocationDisplaySource {
  name?: string | null;
  address?: string | null;
}

export interface LocationReferenceSource {
  referenceType?: 'ID' | 'PC' | null;
  referenceCode?: string | null;
}

// Casa "ID 1010", "ID: 1010", "ID-1010", "ID1027" etc. apenas no INICIO do
// texto (com espacos opcionais antes) - usado so' para strip de prefixo
// duplicado em getLocationIdentification/getLocationDisplayAddress, onde o
// padrao real observado e' sempre um prefixo no comeco do campo.
const LEGACY_ID_PREFIX_RE = /^\s*ID[\s:.\-]{0,3}(\d{1,10})\b\s*[-–—:]?\s*/i;

const matchLegacyIdPrefix = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(LEGACY_ID_PREFIX_RE);
  return match ? { id: match[1], matchedText: match[0] } : null;
};

// Location.name sem o prefixo "ID N - " legado, quando presente. Se o nome
// nao tiver esse prefixo, retorna o nome original sem alteracao.
export const getLocationIdentification = (
  location: LocationDisplaySource | null | undefined
): string => {
  const name = location?.name?.trim() || '';
  const prefixMatch = matchLegacyIdPrefix(name);
  if (!prefixMatch) return name;
  const rest = name.slice(prefixMatch.matchedText.length).trim();
  return rest || name;
};

// Location.address evitando duplicacao visual quando o proprio address
// carrega o prefixo "ID N - " e/ou repete o texto de identificacao (padrao
// visto em parte dos dados legados: "ID 1010 - <mesmo texto do name> - Rua
// ..."). Nunca escreve nada de volta no backend - e' so' formatacao de tela.
export const getLocationDisplayAddress = (
  location: LocationDisplaySource | null | undefined
): string => {
  const address = location?.address?.trim() || '';
  if (!address) return address;

  const prefixMatch = matchLegacyIdPrefix(address);
  const withoutIdPrefix = prefixMatch
    ? address.slice(prefixMatch.matchedText.length).trim()
    : address;

  if (!withoutIdPrefix) return address;

  const identification = getLocationIdentification(location);
  if (identification) {
    const normalizedRest = withoutIdPrefix.toLowerCase();
    const normalizedIdentification = identification.toLowerCase();
    if (normalizedRest.startsWith(normalizedIdentification)) {
      const afterIdentification = withoutIdPrefix
        .slice(identification.length)
        .replace(/^\s*[-–—:]\s*/, '')
        .trim();
      if (afterIdentification) return afterIdentification;
    }
  }

  return withoutIdPrefix;
};

// Referencia Operacional (ID/PC) - unica fonte da regra "ID+codigo / PC+
// codigo / sem referencia", pra nao espalhar if(referenceType === 'ID')
// pelos componentes que mostram Location (tabela, autocomplete/preview de
// OS, lupa). Helper interno privado, compartilhado pelas duas funcoes
// publicas abaixo - decide SE existe uma referencia valida (type e code
// trimado, ambos presentes - mesma regra do backend) e devolve as partes ja
// normalizadas; cada funcao publica so' decide COMO formatar essas partes
// pro seu proprio contexto.
const getValidReference = (
  location: LocationReferenceSource | null | undefined
): { type: 'ID' | 'PC'; code: string } | null => {
  const type = location?.referenceType;
  const code = location?.referenceCode?.trim();
  if (!type || !code) return null;
  return { type, code };
};

// Coluna "ID / PC" da tabela de Enderecos.
// referenceType=ID, referenceCode="15540" => "15540"
// referenceType=PC, referenceCode="04"    => "PC 04"
// sem referencia                          => null (quem renderiza decide o
// placeholder visual, ex. "--" - este helper nunca devolve "--").
export const getLocationReferenceLabel = (
  location: LocationReferenceSource | null | undefined
): string | null => {
  const ref = getValidReference(location);
  if (!ref) return null;
  return ref.type === 'PC' ? `PC ${ref.code}` : ref.code;
};

// Segunda linha (endereco) na criacao de OS - prefixa a referencia quando
// existir, sempre sobre o endereco ja normalizado por
// getLocationDisplayAddress (nunca location.address cru), pra nao duplicar
// um prefixo "ID xxxx" legado que ainda exista em dados antigos com o novo
// prefixo estruturado.
// referenceType=ID, referenceCode="15540" => "ID 15540 - <endereco>"
// referenceType=PC, referenceCode="04"    => "PC 04 - <endereco>"
// sem referencia                          => "<endereco>"
export const getLocationAddressWithReference = (
  location: (LocationDisplaySource & LocationReferenceSource) | null | undefined
): string => {
  const address = getLocationDisplayAddress(location);
  const ref = getValidReference(location);
  if (!ref) return address;
  const prefix = `${ref.type} ${ref.code}`;
  return address ? `${prefix} - ${address}` : prefix;
};

