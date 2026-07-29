/**
 * Creates a cancellable API request wrapper using AbortController.
 * Returns a function that manages the abort controller lifecycle.
 */

interface CancellableRequest {
  abort: () => void;
  signal: AbortSignal | null;
}

/**
 * Um AbortController por chave.
 *
 * Antes existia um unico controller no escopo do modulo, entao QUALQUER chamada
 * abortava a requisicao anterior, mesmo sendo de outro recurso. Como
 * `getLocationsMini` e `getAssetsMini` sao disparados em sequencia na mesma tela
 * (ex.: relatorio operacional), a busca de localizacoes era cancelada pela de
 * ativos e o filtro de Localizacao ficava permanentemente vazio.
 *
 * Com a chave, cada recurso so cancela a propria requisicao anterior — que era a
 * intencao original (evitar resposta obsoleta ao refazer a mesma busca).
 */
const controllers = new Map<string, AbortController>();

/**
 * Creates a new cancellable request, aborting any previous request with the same key.
 * @param key identifies the request family. Requests with different keys never
 *            cancel each other.
 * @returns CancellableRequest object with abort function and signal
 */
export function createCancellableRequest(key: string): CancellableRequest {
  // Abort previous request for this key only
  controllers.get(key)?.abort();

  const controller = new AbortController();
  controllers.set(key, controller);

  return {
    abort: () => controller.abort(),
    signal: controller.signal
  };
}

/**
 * Checks if an error is an AbortError (request was cancelled).
 */
export function isAbortError(error: any): boolean {
  return error?.name === 'AbortError';
}
