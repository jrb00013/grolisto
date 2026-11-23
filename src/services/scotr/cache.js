/** Simple TTL cache — TTL passed in from config, nothing baked in. */

export function createTtlCache({ ttlMs }) {
  if (!ttlMs || ttlMs <= 0) throw new Error('ttlMs required from config');
  const map = new Map();

  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() > hit.expires) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      map.set(key, { value, expires: Date.now() + ttlMs });
    },
    clear() {
      map.clear();
    },
  };
}
