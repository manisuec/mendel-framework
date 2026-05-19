'use strict';

/**
 * Targeting rule evaluator.
 *
 * Rules describe predicates on consumer-supplied attributes
 * (e.g. plan, country, tier). Each experiment can require all
 * or any of its rules to match before an item is eligible.
 *
 * Rule shape:
 *   { attribute: string, op: TARGETING_OP, values: any[] | any }
 *
 * Example:
 *   { attribute: 'plan',    op: 'in',         values: ['pro', 'enterprise'] }
 *   { attribute: 'country', op: 'eq',         values: 'US' }
 *   { attribute: 'age',     op: 'gte',        values: 18 }
 *   { attribute: 'email',   op: 'ends_with',  values: '@example.com' }
 */

const OPS = Object.freeze({
  EQ          : 'eq',
  NEQ         : 'neq',
  IN          : 'in',
  NIN         : 'nin',
  GT          : 'gt',
  GTE         : 'gte',
  LT          : 'lt',
  LTE         : 'lte',
  CONTAINS    : 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH : 'starts_with',
  ENDS_WITH   : 'ends_with',
  REGEX       : 'regex',
  EXISTS      : 'exists',
  NOT_EXISTS  : 'not_exists',
});

const MATCH = Object.freeze({
  ALL : 'all',
  ANY : 'any',
});

const asArray = (v) => (Array.isArray(v) ? v : [v]);

function evaluateRule(rule, attributes) {
  const { attribute, op, values } = rule;
  const actual = attributes?.[attribute];

  switch (op) {
    case OPS.EQ:
      return actual === values;
    case OPS.NEQ:
      return actual !== values;
    case OPS.IN:
      return asArray(values).includes(actual);
    case OPS.NIN:
      return !asArray(values).includes(actual);
    case OPS.GT:
      return actual > values;
    case OPS.GTE:
      return actual >= values;
    case OPS.LT:
      return actual < values;
    case OPS.LTE:
      return actual <= values;
    case OPS.CONTAINS:
      return typeof actual === 'string' && actual.includes(values);
    case OPS.NOT_CONTAINS:
      return typeof actual === 'string' && !actual.includes(values);
    case OPS.STARTS_WITH:
      return typeof actual === 'string' && actual.startsWith(values);
    case OPS.ENDS_WITH:
      return typeof actual === 'string' && actual.endsWith(values);
    case OPS.REGEX:
      try {
        return typeof actual === 'string' && new RegExp(values).test(actual);
      } catch {
        return false;
      }
    case OPS.EXISTS:
      return actual !== undefined && actual !== null;
    case OPS.NOT_EXISTS:
      return actual === undefined || actual === null;
    default:
      return false;
  }
}

/**
 * Evaluate a set of targeting rules against an attribute bag.
 *
 * @param {object} targeting
 * @param {Array}  [targeting.rules]
 * @param {'all'|'any'} [targeting.match='all']
 * @param {object} attributes
 * @returns {boolean} true if the rules match (or no rules are defined)
 */
function matchesTargeting(targeting, attributes = {}) {
  if (!targeting?.rules?.length) return true;
  const match = targeting.match || MATCH.ALL;

  if (match === MATCH.ANY) {
    return targeting.rules.some((r) => evaluateRule(r, attributes));
  }
  return targeting.rules.every((r) => evaluateRule(r, attributes));
}

module.exports = {
  TARGETING_OP: OPS,
  TARGETING_MATCH: MATCH,
  evaluateRule,
  matchesTargeting,
};
