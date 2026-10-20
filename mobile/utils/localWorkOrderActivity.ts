// In-memory safety guard only: this is not an offline queue or persisted state.
let requests = 0;
const drafts = new Map<number, Set<symbol>>();

export async function trackLocalCacheRequest<T>(
  run: () => Promise<T>
): Promise<T> {
  requests++;
  try {
    return await run();
  } finally {
    requests--;
  }
}

export function blockLocalWorkOrderRemoval(id: number) {
  const token = Symbol();
  const tokens = drafts.get(id) ?? new Set<symbol>();
  tokens.add(token);
  drafts.set(id, tokens);
  return () => {
    tokens.delete(token);
    if (!tokens.size) drafts.delete(id);
  };
}

export function assertLocalWorkOrderIdle(id: number, includeOtherDrafts = false) {
  if (requests || drafts.get(id)?.size || (includeOtherDrafts && drafts.size)) {
    throw new Error(
      'Aguarde os carregamentos/salvamentos e feche os rascunhos antes de remover deste aparelho.'
    );
  }
}
