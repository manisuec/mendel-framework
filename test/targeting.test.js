'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TARGETING_OP,
  TARGETING_MATCH,
  evaluateRule,
  matchesTargeting,
} = require('../lib/targeting');

const attrs = {
  plan    : 'pro',
  country : 'US',
  age     : 25,
  email   : 'alice@example.com',
  tier    : null,
};

test('eq / neq', () => {
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.EQ,  values: 'pro' }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.EQ,  values: 'free' }, attrs), false);
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.NEQ, values: 'free' }, attrs), true);
});

test('in / nin', () => {
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.IN,  values: ['pro', 'enterprise'] }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.IN,  values: ['free'] }, attrs), false);
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.NIN, values: ['free'] }, attrs), true);
});

test('in accepts a non-array values', () => {
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.IN, values: 'pro' }, attrs), true);
});

test('numeric comparisons', () => {
  assert.equal(evaluateRule({ attribute: 'age', op: TARGETING_OP.GT,  values: 18 }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'age', op: TARGETING_OP.GTE, values: 25 }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'age', op: TARGETING_OP.LT,  values: 25 }, attrs), false);
  assert.equal(evaluateRule({ attribute: 'age', op: TARGETING_OP.LTE, values: 25 }, attrs), true);
});

test('string match operators', () => {
  assert.equal(evaluateRule({ attribute: 'email', op: TARGETING_OP.CONTAINS,     values: '@example' }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'email', op: TARGETING_OP.NOT_CONTAINS, values: '@other'   }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'email', op: TARGETING_OP.STARTS_WITH,  values: 'alice'    }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'email', op: TARGETING_OP.ENDS_WITH,    values: '.com'     }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'email', op: TARGETING_OP.REGEX,        values: '^alice@'  }, attrs), true);
});

test('regex with invalid pattern returns false rather than throwing', () => {
  assert.equal(
    evaluateRule({ attribute: 'email', op: TARGETING_OP.REGEX, values: '(' }, attrs),
    false,
  );
});

test('exists / not_exists treat null and undefined as absent', () => {
  assert.equal(evaluateRule({ attribute: 'plan', op: TARGETING_OP.EXISTS },     attrs), true);
  assert.equal(evaluateRule({ attribute: 'tier', op: TARGETING_OP.EXISTS },     attrs), false);
  assert.equal(evaluateRule({ attribute: 'tier', op: TARGETING_OP.NOT_EXISTS }, attrs), true);
  assert.equal(evaluateRule({ attribute: 'missing', op: TARGETING_OP.NOT_EXISTS }, attrs), true);
});

test('unknown op returns false', () => {
  assert.equal(evaluateRule({ attribute: 'plan', op: 'not-an-op', values: 'pro' }, attrs), false);
});

test('matchesTargeting returns true when no rules are defined', () => {
  assert.equal(matchesTargeting(undefined, attrs), true);
  assert.equal(matchesTargeting({}, attrs),        true);
  assert.equal(matchesTargeting({ rules: [] }, attrs), true);
});

test('matchesTargeting honours ALL semantics', () => {
  const targeting = {
    match: TARGETING_MATCH.ALL,
    rules: [
      { attribute: 'plan',    op: TARGETING_OP.EQ, values: 'pro' },
      { attribute: 'country', op: TARGETING_OP.EQ, values: 'US' },
    ],
  };
  assert.equal(matchesTargeting(targeting, attrs), true);
  assert.equal(matchesTargeting(targeting, { ...attrs, country: 'IN' }), false);
});

test('matchesTargeting honours ANY semantics', () => {
  const targeting = {
    match: TARGETING_MATCH.ANY,
    rules: [
      { attribute: 'plan',    op: TARGETING_OP.EQ, values: 'free' },     // miss
      { attribute: 'country', op: TARGETING_OP.EQ, values: 'US' },        // hit
    ],
  };
  assert.equal(matchesTargeting(targeting, attrs), true);
  assert.equal(matchesTargeting(targeting, { ...attrs, country: 'IN' }), false);
});

test('matchesTargeting defaults missing match mode to ALL', () => {
  const targeting = {
    rules: [
      { attribute: 'plan',    op: TARGETING_OP.EQ, values: 'pro' },
      { attribute: 'country', op: TARGETING_OP.EQ, values: 'CA' },
    ],
  };
  assert.equal(matchesTargeting(targeting, attrs), false);
});
