'use strict';

/**
 * Seed sample data into a local MongoDB so you can poke at the admin UI
 * and the client API without having to invent your own experiments first.
 *
 * Usage:
 *   MONGO_URI=mongodb://127.0.0.1:27017/mendel-framework node examples/seed.js
 *   # or: npm run seed
 *
 * The script is idempotent in the sense that it drops the previously-seeded
 * experiments / layers (matched by name) before inserting fresh copies — so
 * you can re-run it after schema or config changes.
 */

const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
const {
  createMendelFramework,
  ROLL_OUT_TYPE,
  SUCCESS_STATUS,
  TARGETING_OP,
  TARGETING_MATCH,
  EXP_TYPE,
} = require('../index');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mendel-framework';
const ENV       = process.env.NODE_ENV || 'prod';

const DAY_MS = 24 * 60 * 60 * 1000;

const SEED_LAYERS = [
  {
    layer_name         : 'checkout_layer',
    holdout_percentage : 10,
    is_default         : false,
  },
  {
    layer_name         : 'growth_layer',
    holdout_percentage : 5,
    is_default         : true,
  },
];

const SEED_EXPERIMENTS = [
  {
    exp_name      : 'exp_new_checkout',
    hypothesis    : 'A streamlined checkout flow improves conversion for paying customers.',
    exp_type      : EXP_TYPE.FLAG,
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 80,
    layer_name    : 'checkout_layer',
    variants: [
      { key: 'control',   weight: 50, payload: { ui: 'classic' } },
      { key: 'treatment', weight: 50, payload: { ui: 'streamlined' } },
    ],
    targeting: {
      match: TARGETING_MATCH.ALL,
      rules: [
        { attribute: 'plan',    op: TARGETING_OP.IN, values: ['pro', 'enterprise'] },
        { attribute: 'country', op: TARGETING_OP.EQ, values: 'US' },
      ],
    },
    start_date: Date.now() - 1 * DAY_MS,
    end_date  : Date.now() + 30 * DAY_MS,
    seed_items: { ids: ['USER_1', 'USER_2', 'USER_3'], variant: 'treatment' },
  },
  {
    exp_name      : 'exp_new_billing',
    hypothesis    : 'New billing screen reduces cart abandonment.',
    exp_type      : EXP_TYPE.GENERAL,
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 100,
    layer_name    : 'checkout_layer',
    variants: [
      { key: 'control',   weight: 70 },
      { key: 'treatment', weight: 30, payload: { component: 'BillingV2' } },
    ],
    start_date: Date.now() - 7 * DAY_MS,
    end_date  : Date.now() + 60 * DAY_MS,
  },
  {
    exp_name      : 'flag_dark_mode',
    hypothesis    : 'Dark mode is requested by 20%+ of free-tier users.',
    exp_type      : EXP_TYPE.FLAG,
    roll_out_type : ROLL_OUT_TYPE.FEATURE_FLAG,
    roll_out_value: 100,
    variants: [
      { key: 'control', weight: 0 },
      { key: 'on',      weight: 100, payload: { theme: 'dark' } },
    ],
    targeting: {
      match: TARGETING_MATCH.ANY,
      rules: [
        { attribute: 'beta_opt_in', op: TARGETING_OP.EQ,     values: true },
        { attribute: 'plan',        op: TARGETING_OP.IN,     values: ['pro', 'enterprise'] },
      ],
    },
    start_date: Date.now() - 14 * DAY_MS,
    seed_items: { ids: ['USER_42', 'USER_7'], variant: 'on' },
  },
  {
    exp_name      : 'banner_summer_sale',
    hypothesis    : 'A site-wide summer banner lifts session value.',
    exp_type      : EXP_TYPE.BANNER,
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 100,
    variants: [
      { key: 'control', weight: 50 },
      { key: 'treatment', weight: 50, payload: { copy: 'Summer Sale — up to 40% off', link: '/sale' } },
    ],
    targeting: {
      rules: [
        { attribute: 'country', op: TARGETING_OP.IN, values: ['US', 'CA', 'GB'] },
      ],
    },
    start_date: Date.now() - 2 * DAY_MS,
    end_date  : Date.now() + 14 * DAY_MS,
  },
  {
    exp_name      : 'exp_checkout_upsell',
    hypothesis    : 'Offering a one-click upsell to billing-v2 users converts.',
    exp_type      : EXP_TYPE.GENERAL,
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 100,
    variants: [
      { key: 'control',   weight: 50 },
      { key: 'treatment', weight: 50, payload: { upsell: 'annual-plan' } },
    ],
    // Only run for items already on the treatment arm of exp_new_billing
    prerequisites: [
      { exp_name: 'exp_new_billing', variant: 'treatment' },
    ],
    start_date: Date.now(),
    end_date  : Date.now() + 30 * DAY_MS,
  },
  {
    exp_name        : 'exp_search_relevance',
    hypothesis      : 'Improved search ranker increased CTR by 8% — graduate to everyone.',
    exp_type        : EXP_TYPE.GENERAL,
    roll_out_type   : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value  : 100,
    variants: [
      { key: 'control',   weight: 50 },
      { key: 'treatment', weight: 50, payload: { ranker: 'v2' } },
    ],
    success_status   : SUCCESS_STATUS.SUCCESS,
    graduated_variant: 'treatment',
    start_date: Date.now() - 60 * DAY_MS,
    end_date  : Date.now() - 1 * DAY_MS,
  },
  {
    exp_name      : 'exp_retired_homepage',
    hypothesis    : 'New homepage layout did not move the needle. Stopping.',
    exp_type      : EXP_TYPE.GENERAL,
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 100,
    variants: [
      { key: 'control',   weight: 50 },
      { key: 'treatment', weight: 50 },
    ],
    success_status: SUCCESS_STATUS.FAILURE,
    is_active     : false,
    start_date: Date.now() - 90 * DAY_MS,
    end_date  : Date.now() - 30 * DAY_MS,
  },
];

async function clearPrevious(models, layerNames, expNames) {
  const { ExperimentList, ExperimentItems, ExperimentLayer } = models;

  const expDocs = await ExperimentList.find({ exp_name: { $in: expNames } }, { _id: 1 }).lean();
  const expIds  = expDocs.map((d) => d._id);

  await Promise.all([
    ExperimentItems.deleteMany({ exp_id: { $in: expIds } }),
    ExperimentList.deleteMany({ exp_name: { $in: expNames } }),
    ExperimentLayer.deleteMany({ layer_name: { $in: layerNames } }),
  ]);
}

async function main() {
  console.log(`[seed] connecting to ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);

  const { service, models } = createMendelFramework(mongoose, {
    generateId   : uuid,
    environment  : ENV,
    persistAudit : false,
  });

  await Promise.all(
    Object.values(mongoose.connection.models).map((m) =>
      m.createIndexes().catch((err) => console.warn(`[seed] index ${m.modelName}`, err.message))
    )
  );

  console.log('[seed] clearing previously seeded data');
  await clearPrevious(
    models,
    SEED_LAYERS.map((l) => l.layer_name),
    SEED_EXPERIMENTS.map((e) => e.exp_name),
  );

  const actor = { id: 'seed-script' };

  console.log('[seed] creating layers');
  const layersByName = new Map();
  for (const layer of SEED_LAYERS) {
    const created = await service.createLayer(layer, actor);
    layersByName.set(layer.layer_name, created);
    console.log(`        + ${layer.layer_name} (holdout ${layer.holdout_percentage}%)`);
  }

  console.log('[seed] creating experiments');
  const experimentsByName = new Map();
  for (const exp of SEED_EXPERIMENTS) {
    const { seed_items, layer_name, ...rest } = exp;
    const layer = layer_name ? layersByName.get(layer_name) : null;

    const created = await service.createExperiment(
      {
        ...rest,
        environment : ENV,
        layer_id    : layer?._id || null,
        layer_name  : layer?.layer_name || null,
      },
      actor,
    );
    experimentsByName.set(exp.exp_name, created);
    console.log(`        + ${exp.exp_name}`);

    if (seed_items?.ids?.length) {
      await service.addItems(created._id, seed_items.ids, actor, {
        variant_key: seed_items.variant,
        forced     : true,
      });
      console.log(`          ↳ pinned ${seed_items.ids.length} item(s) to "${seed_items.variant}"`);
    }
  }

  console.log('[seed] wiring layer ↔ experiment assignments');
  for (const [layerName, layer] of layersByName) {
    const expIds = SEED_EXPERIMENTS
      .filter((e) => e.layer_name === layerName)
      .map((e) => experimentsByName.get(e.exp_name)._id);
    if (expIds.length) {
      await service.assignToLayer(layer._id, expIds, actor);
      console.log(`        ${layerName} ← ${expIds.length} experiment(s)`);
    }
  }

  console.log(`\n[seed] done. ${SEED_LAYERS.length} layer(s), ${SEED_EXPERIMENTS.length} experiment(s) ready.`);
  console.log('       Try:');
  console.log('         curl localhost:3001/api/v1/experiments  # if the dev server is running');
  console.log('         node examples/server.js                  # to start it');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
