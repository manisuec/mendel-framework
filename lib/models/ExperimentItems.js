'use strict';

/**
 * Factory that creates the ExperimentItems model.
 *
 * Each row is an enrollment record: a single item's assignment to a single
 * experiment, including which variant the item is in. Enrollments are how
 * we (a) honour mutual exclusion within a layer and (b) override automatic
 * bucketing for forced overrides (e.g. QA on the treatment variant).
 *
 * @param {import('mongoose')} mongoose
 * @returns {import('mongoose').Model}
 */
module.exports = (mongoose) => {
  const schema = new mongoose.Schema(
    {
      _id : { type: String, required: true },

      exp_id : {
        type     : String,
        required : true,
        ref      : 'ExperimentList',
        index    : true,
      },

      exp_name : { type: String, required: true },

      /**
       * Target entity ID. Opaque to the framework — can be a user, org,
       * project, device, account, or anything the consumer chooses.
       */
      item_id : { type: String, index: true },

      /**
       * Which variant the item is assigned to. null = not enrolled.
       */
      variant_key : { type: String, default: null },

      /**
       * True if this assignment was manually pinned (forced override) and
       * should win over bucketing on subsequent evaluations.
       */
      forced : { type: Boolean, default: false },

      meta_data : { type: mongoose.Schema.Types.Mixed },

      is_active : { type: Boolean, default: true },
    },
    {
      autoIndex  : false,
      timestamps : true,
    }
  );

  schema.index(
    { exp_id: 1, item_id: 1 },
    { name: 'unique_exp_item', unique: true }
  );

  schema.index({ item_id: 1, is_active: 1 });

  return mongoose.model('ExperimentItems', schema);
};
