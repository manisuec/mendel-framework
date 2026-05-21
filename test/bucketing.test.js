'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fnv1a,
  hashToUnit,
  bucketOf,
  pickVariant,
  inRollout,
  inHoldout,
} = require('../lib/bucketing');

test('fnv1a is deterministic for the same input', () => {
  assert.equal(fnv1a('hello'), fnv1a('hello'));
  assert.notEqual(fnv1a('hello'), fnv1a('world'));
});

test('fnv1a returns a 32-bit unsigned integer', () => {
  const h = fnv1a('any-input-here');
  assert.ok(Number.isInteger(h));
  assert.ok(h >= 0 && h <= 0xffffffff);
});

test('hashToUnit returns a value in [0, 1)', () => {
  for (const id of ['a', 'b', 'c', 'USER_42', '0', '', '🚀']) {
    const v = hashToUnit('salt', id);
    assert.ok(v >= 0 && v < 1, `expected [0,1), got ${v} for ${id}`);
  }
});

test('hashToUnit changes with the salt', () => {
  const a = hashToUnit('salt-a', 'USER_1');
  const b = hashToUnit('salt-b', 'USER_1');
  assert.notEqual(a, b);
});

test('bucketOf is bounded by the buckets argument', () => {
  for (let i = 0; i < 1000; i++) {
    const b = bucketOf('salt', `id-${i}`, 100);
    assert.ok(b >= 0 && b < 100);
  }
});

test('pickVariant returns null for empty / zero-weight inputs', () => {
  assert.equal(pickVariant([], 'salt', 'id'), null);
  assert.equal(pickVariant(null, 'salt', 'id'), null);
  assert.equal(pickVariant([{ key: 'a', weight: 0 }], 'salt', 'id'), null);
});

test('pickVariant is deterministic for the same (salt, item)', () => {
  const variants = [
    { key: 'control',   weight: 50 },
    { key: 'treatment', weight: 50 },
  ];
  const a = pickVariant(variants, 'salt-X', 'USER_42');
  const b = pickVariant(variants, 'salt-X', 'USER_42');
  assert.equal(a, b);
});

test('pickVariant respects weight distribution at scale (≈ within 3%)', () => {
  const variants = [
    { key: 'control',   weight: 25 },
    { key: 'treatment', weight: 75 },
  ];
  const N = 20000;
  let treat = 0;
  for (let i = 0; i < N; i++) {
    if (pickVariant(variants, 'distribution-salt', `id-${i}`) === 'treatment') treat++;
  }
  const ratio = treat / N;
  assert.ok(ratio > 0.72 && ratio < 0.78, `expected ~0.75, got ${ratio}`);
});

test('inRollout short-circuits at 0% and 100%', () => {
  assert.equal(inRollout('salt', 'id', 0),   false);
  assert.equal(inRollout('salt', 'id', 100), true);
});

test('inRollout produces ≈ target percentage at scale', () => {
  const N = 20000;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    if (inRollout('rollout-salt', `id-${i}`, 30)) inside++;
  }
  const ratio = inside / N;
  assert.ok(ratio > 0.27 && ratio < 0.33, `expected ~0.30, got ${ratio}`);
});

test('inHoldout short-circuits at 0%', () => {
  assert.equal(inHoldout('layer', 'id', 0),    false);
  assert.equal(inHoldout('layer', 'id', null), false);
});

test('inHoldout and inRollout use independent dimensions', () => {
  // For 10 random items, the two should disagree at least once across 100 items.
  let disagreements = 0;
  for (let i = 0; i < 100; i++) {
    const id = `id-${i}`;
    if (inRollout('shared-salt', id, 50) !== inHoldout('shared-salt', id, 50)) {
      disagreements++;
    }
  }
  assert.ok(disagreements > 0, 'rollout and holdout should be independent dimensions');
});
