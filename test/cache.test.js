'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { TTLCache, cacheKey } = require('../lib/cache');

test('TTLCache returns null for missing keys', () => {
  const c = new TTLCache();
  assert.equal(c.get('nope'), null);
});

test('TTLCache returns the value before TTL elapses', () => {
  const c = new TTLCache({ ttlMs: 1000 });
  c.set('k', { hello: 'world' });
  assert.deepEqual(c.get('k'), { hello: 'world' });
});

test('TTLCache expires entries after the TTL', async () => {
  const c = new TTLCache({ ttlMs: 25 });
  c.set('k', 'v');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(c.get('k'), null);
});

test('TTLCache evicts the oldest entry when capacity is reached', () => {
  const c = new TTLCache({ ttlMs: 60_000, max: 2 });
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  assert.equal(c.get('a'), null);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('c'), 3);
});

test('TTLCache invalidate clears all entries', () => {
  const c = new TTLCache();
  c.set('a', 1);
  c.set('b', 2);
  c.invalidate();
  assert.equal(c.size(), 0);
  assert.equal(c.get('a'), null);
});

test('cacheKey is stable regardless of input ordering', () => {
  const k1 = cacheKey('prod', ['B', 'A', 'B'], { plan: 'pro', country: 'US' });
  const k2 = cacheKey('prod', ['A', 'B'],      { country: 'US', plan: 'pro' });
  assert.equal(k1, k2);
});

test('cacheKey differentiates env, ids, and attributes', () => {
  const base = cacheKey('prod', ['A'], { plan: 'pro' });
  assert.notEqual(base, cacheKey('staging', ['A'], { plan: 'pro' }));
  assert.notEqual(base, cacheKey('prod',    ['A', 'B'], { plan: 'pro' }));
  assert.notEqual(base, cacheKey('prod',    ['A'], { plan: 'free' }));
});

test('cacheKey handles nested attribute objects deterministically', () => {
  const k1 = cacheKey('prod', ['A'], { nested: { b: 2, a: 1 } });
  const k2 = cacheKey('prod', ['A'], { nested: { a: 1, b: 2 } });
  assert.equal(k1, k2);
});
