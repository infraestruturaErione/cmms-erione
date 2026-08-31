// Helper de apresentacao para Location no mobile - porta da mesma regra ja
// usada na Web (frontend/src/utils/locationDisplay.ts). So' formatacao de
// tela: nao persiste nada, nao altera Location no backend/banco.
//
// Contexto: dados legados as vezes tem um prefixo tipo "ID 1027 - " digitado
// manualmente dentro de Location.address. Este helper evita duplicar esse
// prefixo quando a Location tambem tem referenceType/referenceCode
// estruturados.

export interface LocationDisplaySource {
  name?: string | null;
  address?: string | null;
}

export interface LocationReferenceSource {
  referenceType?: 'ID' | 'PC' | null;
  referenceCode?: string | null;
}

const LEGACY_ID_PREFIX_RE = /^\s*ID[\s:.\-]{0,3}(\d{1,10})\b\s*[-–—:]?\s*/i;

const matchLegacyIdPrefix = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(LEGACY_ID_PREFIX_RE);
  return match ? { id: match[1], matchedText: match[0] } : null;
};

export const getLocationIdentification = (
  location: LocationDisplaySource | null | undefined
): string => {
  const name = location?.name?.trim() || '';
  const prefixMatch = matchLegacyIdPrefix(name);
  if (!prefixMatch) return name;
  const rest = name.slice(prefixMatch.matchedText.length).trim();
  return rest || name;
};

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

const getValidReference = (
  location: LocationReferenceSource | null | undefined
): { type: 'ID' | 'PC'; code: string } | null => {
  const type = location?.referenceType;
  const code = location?.referenceCode?.trim();
  if (!type || !code) return null;
  return { type, code };
};

export const getLocationReferenceLabel = (
  location: LocationReferenceSource | null | undefined
): string | null => {
  const ref = getValidReference(location);
  if (!ref) return null;
  return ref.type === 'PC' ? `PC ${ref.code}` : ref.code;
};

// referenceType=ID, referenceCode="1019" => "ID 1019 - <endereco>"
// referenceType=PC, referenceCode="04"   => "PC 04 - <endereco>"
// sem referencia                         => "<endereco>"
export const getLocationAddressWithReference = (
  location: (LocationDisplaySource & LocationReferenceSource) | null | undefined
): string => {
  const address = getLocationDisplayAddress(location);
  const ref = getValidReference(location);
  if (!ref) return address;
  const prefix = `${ref.type} ${ref.code}`;
  return address ? `${prefix} - ${address}` : prefix;
};
