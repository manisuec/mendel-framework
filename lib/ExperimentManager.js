'use strict';

const { SUCCESS_STATUS, CONTROL_VARIANT, EXPOSURE_REASON } = require('./constants');
const { TTLCache, cacheKey } = require('./cache');

/**
 * High-level client-facing API.
 *
 * Resolves the full set of experiments applicable to one or more items
 * given a bag of attributes. Optionally caches results for hot paths.
 *
 * @param {object} opts
 * @param {import('./ExperimentService')} opts.service — used for variant evaluation
 * @param {import('mongoose').Model}      opts.ExperimentList
 * @param {import('mongoose').Model}      opts.ExperimentItems
 * @param {object}   [opts.logger]
 * @param {string}   [opts.environment='prod']
 * @param {object}   [opts.cache] — { enabled:boolean, ttlMs:number, max:number }
 */
class ExperimentManager {
  constructor(opts) {
    this.service = opts.service;
    this.ExperimentList = opts.ExperimentList;
    this.ExperimentItems = opts.ExperimentItems;
    this.logger = opts.logger || console;
    this.environment = opts.environment || 'prod';

    const cacheOpts = opts.cache || {};
    this.cacheEnabled = !!cacheOpts.enabled;
    this.cache = this.cacheEnabled
      ? new TTLCache({ ttlMs: cacheOpts.ttlMs ?? 5000, max: cacheOpts.max ?? 1000 })
      : null;
  }

  invalidateCache() {
    this.cache?.invalidate();
  }

  /**
   * Resolve the experiments that apply to the given item IDs and attribute
   * bag. Returns one record per (experiment × item) pair that produces a
   * non-null variant.
   *
   * @param {string[]} itemIds
   * @param {object}   [attributes]
   * @returns {Promise<{experiments: object[]}>}
   */
  async getConfigData(itemIds, attributes = {}) {
    const _ = this;
    _.logger.info?.('ExperimentManager.getConfigData');

    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean);
    if (!ids.length) return { experiments: [] };

    if (_.cacheEnabled) {
      const key = cacheKey(_.environment, ids, attributes);
      const cached = _.cache.get(key);
      if (cached) return cached;
    }

    const experiments = await _.ExperimentList.find(
      {
        is_active      : true,
        environment    : _.environment,
        success_status : { $in: [SUCCESS_STATUS.RUNNING, SUCCESS_STATUS.SUCCESS] },
      },
      {
        exp_name: 1, salt: 1, variants: 1, targeting: 1, prerequisites: 1,
        roll_out_type: 1, roll_out_value: 1, success_status: 1, graduated_variant: 1,
        start_date: 1, end_date: 1, layer_id: 1, meta_data: 1,
      }
    ).lean();

    const out = [];
    for (const exp of experiments) {
      for (const itemId of ids) {
        const result = await _.service._evaluate(exp, itemId, attributes);
        if (!result.variant) continue;
        if (result.reason !== EXPOSURE_REASON.GRADUATED && result.variant === CONTROL_VARIANT) {
          // Control rows are typically omitted from "applied experiments"
          // payloads — the absence of the treatment is the signal.
          continue;
        }
        out.push({
          _id        : exp._id,
          exp_name   : exp.exp_name,
          item_id    : itemId,
          variant    : result.variant,
          payload    : result.payload ?? null,
          meta_data  : exp.meta_data ?? null,
          reason     : result.reason,
          start_date : exp.start_date,
          end_date   : exp.end_date,
          is_active  : true,
        });
      }
    }

    const value = { experiments: out };
    if (_.cacheEnabled) {
      _.cache.set(cacheKey(_.environment, ids, attributes), value);
    }
    return value;
  }
}

module.exports = ExperimentManager;
