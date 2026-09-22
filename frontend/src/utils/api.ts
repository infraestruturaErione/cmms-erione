import { apiUrl } from '../config';
import { recordServerDate } from './serverClock';

type Options = RequestInit & { raw?: boolean; headers?: HeadersInit };
function api<T>(url: string, options: Options): Promise<T> {
  return fetch(url, { headers: authHeader(false), ...options }).then(
    async (response) => {
      // Toda resposta ja carrega o relogio do servidor no header Date: e' de
      // graca e mantem o offset fresco sem nenhuma requisicao extra.
      recordServerDate(response.headers.get('Date'));
      if (!response.ok) {
        throw new Error(JSON.stringify(await response.json()));
      }
      if (options?.raw) return response as unknown as Promise<T>;
      return response.json() as Promise<T>;
    }
  );
}

function get<T>(url, options?: Options) {
  return api<T>(apiUrl + url, options);
}

function post<T>(url, data, options?: Options, isNotJson?: boolean) {
  return api<T>(apiUrl + url, {
    ...options,
    method: 'POST',
    body: isNotJson ? data : JSON.stringify(data)
  });
}

function patch<T>(url, data, options?: Options) {
  return api<T>(apiUrl + url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

function deletes<T>(url, options?: Options) {
  return api<T>(apiUrl + url, { ...options, method: 'DELETE' });
}

export function authHeader(publicRoute: boolean): HeadersInit {
  // return authorization header with jwt token
  let accessToken = localStorage.getItem('accessToken');

  if (!publicRoute && accessToken) {
    return {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
  } else {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
  }
}

export const getErrorMessage = (
  error: any,
  defaultMessage?: string
): string => {
  try {
    const parsed = JSON.parse(error.message);
    return parsed?.message ?? error.message ?? defaultMessage;
  } catch {
    return error.message ?? defaultMessage;
  }
};

export default { get, patch, post, deletes };
