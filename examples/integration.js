'use strict';

/**
 * Example: integrating Mendel Framework into an Express + Mongoose app.
 *
 * Mendel Framework is fully generic — no business concepts (paid plans, orgs,
 * users) are baked in. Audience selection is expressed as **targeting rules**
 * over an attribute bag the caller supplies at evaluation time. Variants and
 * bucketing are deterministic so the same item always lands in the same arm.
 */

const express = require('express');
const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
const {
  createMendelFramework,
  ROLL_OUT_TYPE,
  TARGETING_OP,
} = require('../index');

// ─── 1. Initialize Mendel Framework ───────────────────────────────

const { service, manager } = createMendelFramework(mongoose, {
  generateId  : uuid,
  environment : process.env.NODE_ENV || 'prod',

  // Optional caching for high-QPS read paths
  cache: { enabled: true, ttlMs: 5000, max: 1000 },

  // Optional durable audit + exposure logs
  persistAudit    : true,
  persistExposure : false,

  // Stream mutation events to your analytics pipeline
  onAuditEvent: (event, payload) => {
    console.log(`[audit] ${event}`, payload);
    // segment.track({ event, properties: payload });
  },

  // Record exposures (every flag evaluation). Forward to your analytics
  // platform so you can analyse experiment lift later.
  onExposure: (e) => {
    console.log(`[exposure] ${e.exp_name} → ${e.variant} (${e.reason})`);
  },

  // Fire side-effects when item enrollment changes
  onItemsChanged: (expName, item, action) => {
    console.log(`[experiment] ${expName} — ${action}`, item);
  },
});

// ─── 2. Create an experiment with targeting + variants ────────────

async function setupExperiment() {
  await service.createExperiment({
    exp_name      : 'exp_new_checkout',
    hypothesis    : 'Streamlined checkout improves conversion for enterprise customers.',
    exp_type      : 'flag',
    roll_out_type : ROLL_OUT_TYPE.A_B_TESTING,
    roll_out_value: 80,                                 // 80% of eligible traffic participates
    variants: [
      { key: 'control',   weight: 50, payload: { ui: 'classic' } },
      { key: 'treatment', weight: 50, payload: { ui: 'streamlined' } },
    ],
    targeting: {
      match: 'all',
      rules: [
        { attribute: 'plan',    op: TARGETING_OP.IN, values: ['pro', 'enterprise'] },
        { attribute: 'country', op: TARGETING_OP.EQ, values: 'US' },
      ],
    },
    prerequisites: [
      // Item must already be in the 'treatment' arm of this other experiment.
      { exp_name: 'exp_new_billing', variant: 'treatment' },
    ],
    start_date: Date.now(),
    end_date  : Date.now() + 30 * 24 * 60 * 60 * 1000,
  }, { id: 'admin' });
}

// ─── 3. Layers + holdout ──────────────────────────────────────────

async function setupLayer() {
  // 10% of items are reserved as a global holdout — they never see any
  // experiment in the layer, so we can measure cumulative lift.
  const layer = await service.createLayer({
    layer_name         : 'checkout_layer',
    holdout_percentage : 10,
  }, { id: 'admin' });

  await service.assignToLayer(layer._id, [/* exp ids */], { id: 'admin' });
}

// ─── 4. Evaluate flags / variants in application code ─────────────

async function applicationCode() {
  // The caller supplies attributes — the framework knows nothing about
  // "paid users", "orgs", "regions"; it just runs the rules.
  const attributes = {
    plan    : 'enterprise',
    country : 'US',
    tier    : 3,
  };

  // Full evaluation — returns variant, reason, payload
  const result = await service.evaluate('exp_new_checkout', 'USER_42', attributes);
  console.log(result);
  // → { variant: 'treatment', reason: 'bucketed', exp_id: '…', payload: { ui: 'streamlined' } }

  // Convenience helpers
  const variant   = await service.getVariant('exp_new_checkout', 'USER_42', attributes);
  const isEnabled = await service.isEnabled('exp_new_checkout', 'USER_42', attributes);

  // Multi-experiment lookup for the client SDK
  const config = await manager.getConfigData(['USER_42', 'ORG_7'], attributes);

  // Probabilistic enrollment (writes the assignment). Use for FEATURE_FLAG
  // experiments or when you want to freeze a bucket decision.
  await service.assignVariant('exp_new_checkout', 'USER_42', attributes);

  // QA / admin override: pin a specific variant.
  await service.forceAssign('exp_new_checkout', 'USER_42', 'treatment', { id: 'admin' });

  return { variant, isEnabled, config };
}

// ─── 5. Express wiring ────────────────────────────────────────────

const {
  express: { ExperimentController, mountRoutes, mountAdminRoutes },
} = require('../index');

const app = express();
app.use(express.json());

const controller = new ExperimentController({
  experimentService : service,
  experimentManager : manager,
});

const clientRouter = express.Router();
mountRoutes(clientRouter, controller);
app.use('/api/v1', clientRouter);

const adminRouter = express.Router();
mountAdminRoutes(adminRouter, controller, {
  authMiddleware: (req, res, next) => next(),
});
app.use('/api/admin', adminRouter);

module.exports = { app, service, manager, setupExperiment, setupLayer, applicationCode };
