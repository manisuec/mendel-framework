'use strict';

const {
  ROLL_OUT_TYPE,
  SUCCESS_STATUS,
  EXP_TYPE,
  CONTROL_VARIANT,
} = require('../constants');

/**
 * Factory that creates the ExperimentList model.
 *
 * Generic A/B and feature-flag definitions. Consumers describe targeting
 * via rule predicates over arbitrary attributes (plan, country, etc.) — no
 * domain concepts are baked into the model.
 *
 * @param {import('mongoose')} mongoose
 * @returns {import('mongoose').Model}
 */
module.exports = (mongoose) => {
  const VariantSchema = new mongoose.Schema(
    {
      key     : { type: String, required: true },
      weight  : { type: Number, required: true, min: 0 },
      payload : { type: mongoose.Schema.Types.Mixed },
    },
    { _id: false }
  );

  const RuleSchema = new mongoose.Schema(
    {
      attribute : { type: String, required: true },
      op        : { type: String, required: true },
      values    : { type: mongoose.Schema.Types.Mixed },
    },
    { _id: false }
  );

  const TargetingSchema = new mongoose.Schema(
    {
      rules : { type: [RuleSchema], default: [] },
      match : { type: String, enum: ['all', 'any'], default: 'all' },
    },
    { _id: false }
  );

  const PrerequisiteSchema = new mongoose.Schema(
    {
      exp_name : { type: String, required: true },
      variant  : { type: String, default: null },
    },
    { _id: false }
  );

  const schema = new mongoose.Schema(
    {
      _id : { type: String, required: true },

      exp_name : {
        type     : String,
        required : true,
        unique   : true,
      },

      hypothesis : { type: String, default: null },

      // Bucketing salt — defaults to exp_name; allows reshuffling without renaming
      salt : { type: String, required: true },

      // Environment scoping — opaque string set by the consumer
      environment : { type: String, default: 'prod', index: true },

      // Layer-based mutual exclusion
      layer_id   : { type: String, default: null, index: true },
      layer_name : { type: String, default: null },

      roll_out_type : {
        type     : Number,
        required : true,
        enum     : Object.values(ROLL_OUT_TYPE),
      },

      // Overall percentage of eligible traffic that participates [0..100].
      // Within that traffic, variants split by their weights.
      roll_out_value : { type: Number, default: 100, min: 0, max: 100 },

      variants : {
        type    : [VariantSchema],
        default : () => [
          { key: CONTROL_VARIANT, weight: 50 },
          { key: 'treatment',     weight: 50 },
        ],
      },

      targeting    : { type: TargetingSchema, default: () => ({}) },
      prerequisites: { type: [PrerequisiteSchema], default: [] },

      meta_data : { type: mongoose.Schema.Types.Mixed },

      is_active : { type: Boolean, default: true },

      start_date : { type: Number },
      end_date   : { type: Number },

      success_status : {
        type    : Number,
        enum    : Object.values(SUCCESS_STATUS),
        default : SUCCESS_STATUS.RUNNING,
      },

      // When graduated, optionally pin the variant served to all eligible items.
      graduated_variant : { type: String, default: null },

      exp_type : {
        type    : String,
        default : EXP_TYPE.GENERAL,
        enum    : Object.values(EXP_TYPE),
      },

      app_version : { type: String },
    },
    {
      autoIndex  : false,
      timestamps : true,
    }
  );

  schema.pre('validate', function () {
    if (!this.salt) this.salt = this.exp_name;
  });

  return mongoose.model('ExperimentList', schema);
};
