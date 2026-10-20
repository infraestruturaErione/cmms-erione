import type { OwnUser } from '../models/user';

export function authenticatedIdentity(user?: Partial<OwnUser> | null) {
  const name =
    [user?.firstName, user?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') || 'Nome não informado';
  const phone = user?.phone?.trim();
  if (!phone) return { name, phone: 'Telefone não informado' };
  const digits = phone.replace(/\D/g, '');
  const hasCountry =
    digits.startsWith('55') && [12, 13].includes(digits.length);
  const national = hasCountry ? digits.slice(2) : digits;
  // Do not reinterpret international numbers as Brazilian local numbers.
  if (
    (!phone.startsWith('+') || hasCountry) &&
    [10, 11].includes(national.length)
  ) {
    const split = national.length - 4;
    return {
      name,
      phone: `${hasCountry ? '+55 ' : ''}(${national.slice(
        0,
        2
      )}) ${national.slice(2, split)}-${national.slice(split)}`
    };
  }
  return { name, phone };
}
