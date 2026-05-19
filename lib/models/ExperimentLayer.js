'use strict';

/**
 * Factory that creates the ExperimentLayer model.
 *
 * Layers provide mutual exclusion: an item can be enrolled in at most one
 * experiment per layer. Layers may also reserve a holdout slice that is
 * excluded from all experiments in the layer (so the consumer can measure
 * cumulative experiment lift).
 *
 * @param {import('mongoose')} mongoose
 * @returns {import('mongoose').Model}
 */
module.exports = (mongoose) => {
  const schema = new mongoose.Schema(
    {
      _id : { type: String, required: true },

      layer_name : {
        type     : String,
        required : true,
        unique   : true,
      },

      // Bucketing salt for layer-level holdout decisions. Defaults to layer_name.
      salt : { type: String, required: true },

      // Percentage of items reserved as a holdout group [0..100].
      holdout_percentage : { type: Number, default: 0, min: 0, max: 100 },

      is_default : { type: Boolean, default: false },

      is_active : { type: Boolean, default: true },
    },
    {
      autoIndex  : false,
      timestamps : true,
    }
  );

  schema.pre('validate', function () {
    if (!this.salt) this.salt = this.layer_name;
  });

  return mongoose.model('ExperimentLayer', schema);
};
