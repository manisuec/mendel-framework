'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ExperimentService = require('../lib/ExperimentService');
const {
  ROLL_OUT_TYPE,
  SUCCESS_STATUS,
  EXPOSURE_REASON,
  TARGETING_OP,
} = require('../lib/constants');

/**
 * `_evaluate` is pure of `mongoose` if we stub the few model methods it calls.
 * These tests exercise the decision tree end-to-end without standing up
 * MongoDB.
 */
function makeService(overrides = {}) {
  const noopChain = () => ({ lean: async () => null });

  const defaultModels = {
    ExperimentList  : { findOne: noopChain, findById: noopChain },
    ExperimentItems : { findOne: noopChain },
    ExperimentLayer : { findById: noopChain },
  };

  return new ExperimentService({
    ...defaultModels,
    ...overrides,
    generateId  : () => 'id',
    environment : 'prod',
    logger      : { error: () => {}, info: () => {} },
  });
}

const baseExperiment = {
  _id           : 'exp-1',
  exp_name      : 'exp_demo',
  salt          : 'exp_demo',
  environment   : 'prod',
  is_active     : true,
  success_status: SUCCESS_STATUS.RUNNING,
  roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
  roll_out_value: 100,
  variants: [
    { key: 'control',   weight: 50, payload: { ui: 'classic' } },
    { key: 'treatment', weight: 50, payload: { ui: 'new' } },
  ],
};

test('_evaluate returns NOT_FOUND when exp is missing', async () => {
  const svc = makeService();
  const r = await svc._evaluate(null, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.NOT_FOUND);
  assert.equal(r.variant, null);
});

test('_evaluate skips experiments in a different environment', async () => {
  const svc = makeService();
  const r = await svc._evaluate({ ...baseExperiment, environment: 'staging' }, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.ENVIRONMENT_MISS);
});

test('_evaluate honours is_active=false', async () => {
  const svc = makeService();
  const r = await svc._evaluate({ ...baseExperiment, is_active: false }, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.INACTIVE);
});

test('_evaluate gates by start_date / end_date', async () => {
  const svc = makeService();
  const now = Date.now();

  const future = await svc._evaluate({ ...baseExperiment, start_date: now + 10000 }, 'USER_1');
  assert.equal(future.reason, EXPOSURE_REASON.NOT_STARTED);

  const past = await svc._evaluate({ ...baseExperiment, end_date: now - 10000 }, 'USER_1');
  assert.equal(past.reason, EXPOSURE_REASON.ENDED);
});

test('_evaluate returns GRADUATED variant + payload for SUCCESS experiments', async () => {
  const svc = makeService();
  const r = await svc._evaluate({
    ...baseExperiment,
    success_status   : SUCCESS_STATUS.SUCCESS,
    graduated_variant: 'treatment',
  }, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.GRADUATED);
  assert.equal(r.variant, 'treatment');
  assert.deepEqual(r.payload, { ui: 'new' });
});

test('_evaluate filters by targeting rules', async () => {
  const svc = makeService();
  const exp = {
    ...baseExperiment,
    targeting: {
      match: 'all',
      rules: [{ attribute: 'plan', op: TARGETING_OP.EQ, values: 'pro' }],
    },
  };
  const miss = await svc._evaluate(exp, 'USER_1', { plan: 'free' });
  assert.equal(miss.reason, EXPOSURE_REASON.TARGETING_MISS);

  const hit = await svc._evaluate(exp, 'USER_1', { plan: 'pro' });
  assert.equal(hit.reason, EXPOSURE_REASON.BUCKETED);
  assert.ok(hit.variant);
});

test('_evaluate buckets deterministically into a variant', async () => {
  const svc = makeService();
  const a = await svc._evaluate(baseExperiment, 'USER_1');
  const b = await svc._evaluate(baseExperiment, 'USER_1');
  assert.equal(a.variant, b.variant);
  assert.equal(a.reason, EXPOSURE_REASON.BUCKETED);
});

test('_evaluate respects roll_out_value', async () => {
  const svc = makeService();
  const exp = { ...baseExperiment, roll_out_value: 0 };
  const r = await svc._evaluate(exp, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.ROLLOUT_MISS);
});

test('_evaluate honours forced enrollment over bucketing', async () => {
  const svc = makeService({
    ExperimentItems: {
      findOne: () => ({
        lean: async () => ({
          variant_key : 'control',
          is_active   : true,
          forced      : true,
        }),
      }),
    },
  });
  const r = await svc._evaluate(baseExperiment, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.FORCED);
  assert.equal(r.variant, 'control');
  assert.deepEqual(r.payload, { ui: 'classic' });
});

test('_evaluate for FEATURE_FLAG requires explicit enrollment', async () => {
  const ff = { ...baseExperiment, roll_out_type: ROLL_OUT_TYPE.FEATURE_FLAG };

  const notEnrolled = makeService({
    ExperimentItems: { findOne: () => ({ lean: async () => null }) },
  });
  const miss = await notEnrolled._evaluate(ff, 'USER_1');
  assert.equal(miss.reason, EXPOSURE_REASON.ROLLOUT_MISS);

  const enrolled = makeService({
    ExperimentItems: {
      // The service first queries with `forced: true` (must return null so
      // we fall through to the FF enrollment branch), then re-queries
      // without `forced` to look up the enrollment record.
      findOne: (q) => ({
        lean: async () => (
          q.forced === true
            ? null
            : { variant_key: 'treatment', is_active: true }
        ),
      }),
    },
  });
  const hit = await enrolled._evaluate(ff, 'USER_1');
  assert.equal(hit.reason, EXPOSURE_REASON.ENROLLED);
  assert.equal(hit.variant, 'treatment');
});

test('_evaluate puts items into HOLDOUT when the layer reserves them', async () => {
  // Pick an itemId we know falls within the first 90% of the holdout bucket
  // (any small percentage is enough — we'll use 100% to guarantee a hit).
  const svc = makeService({
    ExperimentLayer: {
      findById: () => ({
        lean: async () => ({ salt: 'layer1', holdout_percentage: 100 }),
      }),
    },
  });
  const exp = { ...baseExperiment, layer_id: 'layer1' };
  const r = await svc._evaluate(exp, 'USER_1');
  assert.equal(r.reason, EXPOSURE_REASON.HOLDOUT);
});

test('audit hook fires on createExperiment', async () => {
  const events = [];
  const created = [];

  const ExperimentList = {
    findOne: () => ({ lean: async () => null }),
    create : async (doc) => {
      created.push(doc);
      return { toObject: () => doc };
    },
  };
  const svc = new ExperimentService({
    ExperimentList,
    ExperimentItems : { findOne: () => ({ lean: async () => null }) },
    ExperimentLayer : { findById: () => ({ lean: async () => null }) },
    generateId      : () => 'gen-id',
    environment     : 'prod',
    onAuditEvent    : (event, payload) => events.push({ event, payload }),
    logger          : { error: () => {} },
  });

  const result = await svc.createExperiment({
    exp_name      : 'exp_demo',
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    variants      : baseExperiment.variants,
  }, { id: 'alice' });

  assert.equal(result.exp_name, 'exp_demo');
  assert.equal(created.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'experiment.created');
  assert.equal(events[0].payload.user.id, 'alice');
});
