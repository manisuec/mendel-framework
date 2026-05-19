'use strict';

/**
 * Optional persisted audit log for mutations.
 *
 * The framework already emits an `onAuditEvent` callback; consumers who
 * want a durable trail can also enable this model and the service will
 * mirror events into it.
 *
 * @param {import('mongoose')} mongoose
 * @returns {import('mongoose').Model}
 */
module.exports = (mongoose) => {
  const schema = new mongoose.Schema(
    {
      _id   : { type: String, required: true },
      event : { type: String, required: true, index: true },

      exp_id   : { type: String, default: null, index: true },
      exp_name : { type: String, default: null, index: true },

      actor : { type: mongoose.Schema.Types.Mixed },
      data  : { type: mongoose.Schema.Types.Mixed },
    },
    {
      autoIndex  : false,
      timestamps : true,
    }
  );

  return mongoose.model('ExperimentAudit', schema);
};
