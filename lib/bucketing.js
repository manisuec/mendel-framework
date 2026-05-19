'use strict';

/**
 * Deterministic bucketing utilities.
 *
 * Same (salt, item_id) pair always maps to the same bucket / variant.
 * This lets the SDK and the server evaluate flags identically without
 * coordinating through the database.
 */

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/**
 * FNV-1a 32-bit hash. Fast, dependency-free, sufficient for bucketing.
 *
 * @param {string} str
 * @returns {number} unsigned 32-bit integer
 */
function fnv1a(str) {
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

/**
 * Hash an (salt, item_id) pair to a float in [0, 1).
 */
function hashToUnit(salt, itemId) {
  const h = fnv1a(`${salt}:${itemId}`);
  return h / 0x100000000;
}

/**
 * Hash an (salt, item_id) pair to an integer bucket in [0, buckets).
 */
function bucketOf(salt, itemId, buckets = 10000) {
  return Math.floor(hashToUnit(salt, itemId) * buckets);
}

/**
 * Pick a variant deterministically from a weighted list.
 *
 * @param {Array<{key: string, weight: number}>} variants
 * @param {string} salt — usually the experiment salt (or layer salt for layer-level bucketing)
 * @param {string} itemId
 * @returns {string|null} variant key, or null if variants is empty / total weight is 0
 */
function pickVariant(variants, salt, itemId) {
  if (!variants?.length) return null;
  const total = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (total <= 0) return null;

  const point = hashToUnit(salt, itemId) * total;
  let acc = 0;
  for (const v of variants) {
    acc += v.weight || 0;
    if (point < acc) return v.key;
  }
  return variants[variants.length - 1].key;
}

/**
 * Decide whether an item falls within a roll-out percentage [0..100].
 * Uses a separate suffix so an item's rollout decision is independent
 * of its variant selection.
 */
function inRollout(salt, itemId, percentage) {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  const bucket = bucketOf(`${salt}:rollout`, itemId, 10000);
  return bucket < percentage * 100;
}

/**
 * Decide whether an item falls inside a holdout group.
 */
function inHoldout(layerSalt, itemId, holdoutPercentage) {
  if (!holdoutPercentage || holdoutPercentage <= 0) return false;
  const bucket = bucketOf(`${layerSalt}:holdout`, itemId, 10000);
  return bucket < holdoutPercentage * 100;
}

module.exports = {
  fnv1a,
  hashToUnit,
  bucketOf,
  pickVariant,
  inRollout,
  inHoldout,
};
