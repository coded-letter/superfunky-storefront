type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createAsyncSearchCache<T>(
  { ttlMs = 15_000, maxEntries = 48, now = Date.now }: {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
  } = {},
) {
  const cached = new Map<string, CacheEntry<T>>();
  const pending = new Map<string, Promise<T>>();

  return (key: string, load: () => Promise<T>): Promise<T> => {
    const entry = cached.get(key);
    if (entry && entry.expiresAt > now()) {
      cached.delete(key);
      cached.set(key, entry);
      return Promise.resolve(entry.value);
    }
    if (entry) cached.delete(key);

    const request = pending.get(key);
    if (request) return request;

    const next = Promise.resolve()
      .then(load)
      .then((value) => {
        cached.delete(key);
        cached.set(key, { value, expiresAt: now() + ttlMs });
        if (cached.size > maxEntries) {
          const oldestKey = cached.keys().next().value;
          if (oldestKey !== undefined) cached.delete(oldestKey);
        }
        return value;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, next);
    return next;
  };
}
