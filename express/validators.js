'use strict';

const { celebrate, Joi: joi } = require('celebrate');
const {
  EXP_TYPE, ROLL_OUT_TYPE, SUCCESS_STATUS, TARGETING_OP, TARGETING_MATCH,
} = require('../lib/constants');

const allowedOps = Object.values(TARGETING_OP);

const ruleSchema = joi.object({
  attribute : joi.string().required(),
  op        : joi.string().valid(...allowedOps).required(),
  values    : joi.any(),
});

const targetingSchema = joi.object({
  rules : joi.array().items(ruleSchema).default([]),
  match : joi.string().valid(...Object.values(TARGETING_MATCH)).default('all'),
});

const variantSchema = joi.object({
  key     : joi.string().required(),
  weight  : joi.number().min(0).required(),
  payload : joi.any(),
});

const prerequisiteSchema = joi.object({
  exp_name : joi.string().required(),
  variant  : joi.string().allow(null, ''),
});

// ─── Client-facing ─────────────────────────────────────────────────

const validateGetFlags = celebrate(
  {
    query: joi.object({
      id         : joi.string().trim().required(),
      attributes : joi.string(), // JSON-encoded; parsed in the controller
    }),
  },
  { allowUnknown: true, warnings: true }
);

const validateAssignVariant = celebrate(
  {
    query: joi.object({
      item_id  : joi.string().required(),
      exp_name : joi.string().required(),
    }),
    body: joi.object({
      attributes: joi.object(),
    }).unknown(true),
  },
  { allowUnknown: true, warnings: true }
);

const validateEvaluate = celebrate(
  {
    query: joi.object({
      item_id  : joi.string().required(),
      exp_name : joi.string().required(),
    }),
    body: joi.object({
      attributes: joi.object(),
    }).unknown(true),
  },
  { allowUnknown: true, warnings: true }
);

// ─── Admin: Experiment CRUD ────────────────────────────────────────

const setupExperiment = celebrate(
  {
    body: joi.object({
      exp_name       : joi.string().required(),
      exp_type       : joi.string().valid(...Object.values(EXP_TYPE)),
      app_version    : joi.string().allow(''),
      environment    : joi.string().allow(''),
      salt           : joi.string().allow(''),
      meta_data      : joi.object(),
      start_date     : joi.number().greater(0),
      end_date       : joi.number().greater(joi.ref('start_date')),
      roll_out_type  : joi.number().valid(...Object.values(ROLL_OUT_TYPE)).required(),
      roll_out_value : joi.number().min(0).max(100).allow(null),
      variants       : joi.array().items(variantSchema),
      targeting      : targetingSchema,
      prerequisites  : joi.array().items(prerequisiteSchema),
      item_ids       : joi.array().items(joi.string().allow('')),
      hypothesis     : joi.string().allow(''),
      layer_name     : joi.string().allow(''),
      layer_id       : joi.string().allow('', null),
    }),
  },
  { allowUnknown: true, warnings: true }
);

const updateExperiment = celebrate(
  {
    body: joi.object({
      start_date        : joi.number().greater(0),
      end_date          : joi.number().greater(joi.ref('start_date')),
      roll_out_value    : joi.number().min(0).max(100).allow(null),
      is_active         : joi.boolean(),
      success_status    : joi.number().valid(...Object.values(SUCCESS_STATUS)),
      meta_data         : joi.object(),
      hypothesis        : joi.string().allow(''),
      variants          : joi.array().items(variantSchema),
      targeting         : targetingSchema,
      prerequisites     : joi.array().items(prerequisiteSchema),
      environment       : joi.string().allow(''),
      salt              : joi.string().allow(''),
      graduated_variant : joi.string().allow(null, ''),
    }),
  },
  { allowUnknown: true, warnings: true }
);

const validateClone = celebrate(
  {
    params: joi.object({ exp_id: joi.string().required() }),
    body  : joi.object({
      exp_name : joi.string(),
      salt     : joi.string(),
    }).unknown(true),
  },
  { allowUnknown: true, warnings: true }
);

const validateListExperiments = celebrate(
  {
    query: joi.object({
      page           : joi.number().default(0),
      limit          : joi.number().default(20),
      is_active      : joi.boolean(),
      success_status : joi.number(),
      roll_out_type  : joi.number(),
      environment    : joi.string(),
    }),
  },
  { allowUnknown: true, stripUnknown: false, warnings: true }
);

const validateParamId = celebrate(
  { params: joi.object({ id: joi.string().trim().required() }) },
  { allowUnknown: true, warnings: true }
);

const validateParamExpId = celebrate(
  { params: joi.object({ exp_id: joi.string().required() }) },
  { allowUnknown: true, warnings: true }
);

// ─── Admin: Item management ────────────────────────────────────────

const validateAddItems = celebrate(
  {
    body: joi.object({
      items       : joi.array().items(joi.string()).required(),
      variant_key : joi.string(),
      forced      : joi.boolean(),
    }),
    params: joi.object({ exp_id: joi.string().required() }),
  },
  { allowUnknown: true, warnings: true }
);

const validateForceAssign = celebrate(
  {
    body: joi.object({
      exp_name    : joi.string().required(),
      item_id     : joi.string().required(),
      variant_key : joi.string().required(),
    }),
  },
  { allowUnknown: true, warnings: true }
);

const validateRemoveItem = celebrate(
  {
    body: joi.object({ item_id: joi.string().required() }),
    params: joi.object({ exp_id: joi.string().required() }),
  },
  { allowUnknown: true, warnings: true }
);

const validateUpdateItem = celebrate(
  {
    params: joi.object({ record_id: joi.string().required() }),
    body: joi.object({
      is_active   : joi.boolean(),
      variant_key : joi.string().allow(null, ''),
      meta_data   : joi.object(),
    }),
  },
  { allowUnknown: true, stripUnknown: true, warnings: true }
);

const validateListItems = celebrate(
  {
    query: joi.object({
      page        : joi.number().default(0),
      limit       : joi.number().default(20),
      item_id     : joi.string(),
      variant_key : joi.string(),
    }),
    params: joi.object({ exp_id: joi.string().required() }),
  },
  { allowUnknown: true, stripUnknown: true, warnings: true }
);

const validateDeactivateItem = celebrate(
  {
    body: joi.object({
      item_id : joi.string().trim().required(),
      exp_id  : joi.string().trim().required(),
    }),
  },
  { allowUnknown: true, warnings: true }
);

const validateUpdateItemByName = celebrate(
  {
    params: joi.object({ name: joi.string().trim().required() }),
    body  : joi.object({ item_id: joi.string().trim().required() }),
  },
  { allowUnknown: true, warnings: true }
);

// ─── Admin: Layer management ───────────────────────────────────────

const validateAssignToLayer = celebrate(
  {
    body: joi.object({
      experiment_ids: joi.array().items(joi.string().required()).required(),
    }),
  },
  { allowUnknown: true, stripUnknown: true, warnings: true }
);

const validateCreateLayer = celebrate(
  {
    body: joi.object({
      layer_name         : joi.string().required(),
      salt               : joi.string(),
      holdout_percentage : joi.number().min(0).max(100),
      is_default         : joi.boolean(),
    }),
  },
  { allowUnknown: true, stripUnknown: true, warnings: true }
);

module.exports = {
  validateGetFlags,
  validateAssignVariant,
  validateEvaluate,
  setupExperiment,
  updateExperiment,
  validateClone,
  validateListExperiments,
  validateParamId,
  validateParamExpId,
  validateAddItems,
  validateForceAssign,
  validateRemoveItem,
  validateUpdateItem,
  validateListItems,
  validateDeactivateItem,
  validateUpdateItemByName,
  validateAssignToLayer,
  validateCreateLayer,
};
