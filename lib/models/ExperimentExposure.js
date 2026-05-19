'use strict';

/**
 * Optional persisted exposure log.
 *
 * One row per evaluation (when exposure logging is enabled). Consumers
 * typically stream this to a data warehouse or analytics platform — the
 * collection should be capped or routinely archived if write volume is
 * high.
 *
 * @param {import('mongoose')} mongoose
 * @returns {import('mongoose').Model}
 */
module.exports = (mongoose) => {
  const schema = new mongoose.Schema(
    {
      _id      : { type: String, required: true },

      exp_id   : { type: String, required: true, index: true },
      exp_name : { type: String, required: true, index: true },
      item_id  : { type: String, required: true, index: true },

      variant_key : { type: String, default: null },
      reason      : { type: String, default: null },

      attributes : { type: mongoose.Schema.Types.Mixed },
    },
    {
      autoIndex  : false,
      timestamps : { createdAt: true, updatedAt: false },
    }
  );

  return mongoose.model('ExperimentExposure', schema);
};
