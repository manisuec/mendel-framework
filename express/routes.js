'use strict';

const {
  validateGetFlags,
  validateAssignVariant,
  validateEvaluate,
} = require('./validators');

/**
 * Mounts client-facing experiment routes onto the given Express router.
 *
 * @param {import('express').Router} router
 * @param {import('./controller')}   controller
 */
module.exports = (router, controller) => {
  /**
   * GET /config-data?id=<item_id_1>,<item_id_2>&attributes=<json>
   * Returns all variant assignments applicable to the given item IDs.
   * Attributes can also be POSTed via body.
   */
  router.get('/config-data', validateGetFlags, (req, res, next) =>
    controller.getConfigData(req, res, next)
  );
  router.post('/config-data', validateGetFlags, (req, res, next) =>
    controller.getConfigData(req, res, next)
  );

  /**
   * POST /evaluate?exp_name=<name>&item_id=<id>
   * Returns { variant, reason, payload } for a single experiment / item.
   */
  router.post('/evaluate', validateEvaluate, (req, res, next) =>
    controller.evaluate(req, res, next)
  );

  /**
   * POST /assign-variant?exp_name=<name>&item_id=<id>
   * Probabilistic enrollment (persists assignment).
   */
  router.post('/assign-variant', validateAssignVariant, (req, res, next) =>
    controller.assignVariant(req, res, next)
  );
};
