'use strict';

const { TARGETING_OP, TARGETING_MATCH } = require('./targeting');

/**
 * How the experiment surfaces to the client.
 */
const EXP_TYPE = Object.freeze({
  BANNER  : 'banner',
  FLAG    : 'flag',
  GENERAL : 'general',
});

/**
 * Rollout strategy.
 * A_B_TESTING  — bucket items into variants via deterministic hashing.
 * FEATURE_FLAG — explicit opt-in per item (no variants, no bucketing).
 */
const ROLL_OUT_TYPE = Object.freeze({
  A_B_TESTING  : 0,
  FEATURE_FLAG : 1,
});

/**
 * Lifecycle status of an experiment.
 * RUNNING — actively bucketing / enrolling items.
 * SUCCESS — graduated to 100% (enabled for everyone in the eligible audience).
 * FAILURE — terminated, no longer applicable.
 */
const SUCCESS_STATUS = Object.freeze({
  FAILURE : -1,
  RUNNING :  0,
  SUCCESS :  1,
});

/**
 * Reserved control variant key — when present, items in it
 * are considered "in the experiment but not seeing the treatment".
 */
const CONTROL_VARIANT = 'control';

/**
 * Environments. Consumers may use any string — this is a hint, not an enum.
 */
const ENVIRONMENT = Object.freeze({
  DEV     : 'dev',
  STAGING : 'staging',
  PROD    : 'prod',
});

/**
 * Reasons returned alongside an evaluation result.
 * Helpful for debugging and exposure logging.
 */
const EXPOSURE_REASON = Object.freeze({
  NOT_FOUND        : 'not_found',
  INACTIVE         : 'inactive',
  ENVIRONMENT_MISS : 'environment_miss',
  NOT_STARTED      : 'not_started',
  ENDED            : 'ended',
  FAILED           : 'failed',
  GRADUATED        : 'graduated',
  TARGETING_MISS   : 'targeting_miss',
  PREREQ_MISS      : 'prereq_miss',
  HOLDOUT          : 'holdout',
  ROLLOUT_MISS     : 'rollout_miss',
  ENROLLED         : 'enrolled',
  BUCKETED         : 'bucketed',
  FORCED           : 'forced',
});

/**
 * Audit event names.
 */
const AUDIT_EVENT = Object.freeze({
  EXPERIMENT_CREATED     : 'experiment.created',
  EXPERIMENT_UPDATED     : 'experiment.updated',
  EXPERIMENT_CLONED      : 'experiment.cloned',
  ITEMS_ADDED            : 'experiment.items.added',
  ITEM_REMOVED           : 'experiment.items.removed',
  ITEM_UPDATED           : 'experiment.item.updated',
  ITEM_DEACTIVATED       : 'experiment.item.deactivated',
  ITEM_META_UPDATED      : 'experiment.item.meta_updated',
  LAYER_CREATED          : 'layer.created',
  LAYER_ASSIGNED         : 'layer.experiments.assigned',
});

module.exports = {
  EXP_TYPE,
  ROLL_OUT_TYPE,
  SUCCESS_STATUS,
  CONTROL_VARIANT,
  ENVIRONMENT,
  EXPOSURE_REASON,
  AUDIT_EVENT,
  TARGETING_OP,
  TARGETING_MATCH,
};
