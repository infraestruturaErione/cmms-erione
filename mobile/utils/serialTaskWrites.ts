// Session-only ordering, not a durable queue or an automatic offline retry.
const stores = new WeakMap<object, Map<string, Promise<unknown>>>();
const revisions = new WeakMap<object, number>();
export const taskWriteRevision = (store: object) => revisions.get(store) ?? 0;

export function serialTaskWrite<T>(
  store: object,
  key: string,
  run: () => Promise<T>
): Promise<T> {
  let writes = stores.get(store);
  if (!writes) {
    writes = new Map();
    stores.set(store, writes);
  }
  const previous = writes.get(key);
  revisions.set(store, taskWriteRevision(store) + 1);
  const current = (
    previous ? previous.catch(() => undefined) : Promise.resolve()
  ).then(run);
  writes.set(key, current);
  const clear = () => {
    revisions.set(store, taskWriteRevision(store) + 1);
    if (writes!.get(key) === current) writes!.delete(key);
  };
  current.then(clear, clear);
  return current;
}
