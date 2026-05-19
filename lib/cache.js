'use strict';

/**
 * Tiny TTL cache used by ExperimentManager to short-circuit repeated
 * `getConfigData` calls. The cache key is the consumer-supplied tuple
 * (env, sorted item_ids, attributes hash). Entries are evicted when their
 * TTL elapses, when capacity is exceeded, or when `invalidate()` is called.
 *
 * Not safe for cross-process invalidation — consumers running multiple
 * instances should keep the TTL short (seconds) or wire `invalidate()` to
 * an external bus from the `onAuditEvent` hook.
 */

class TTLCache {
  constructor({ ttlMs = 5000, max = 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.store.size >= this.max) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function cacheKey(env, itemIds, attributes) {
  const ids = [...new Set(itemIds)].sort().join(',');
  return `${env || ''}|${ids}|${stableStringify(attributes || {})}`;
}

module.exports = { TTLCache, cacheKey };
