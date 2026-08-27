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

