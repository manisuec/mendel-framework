'use strict';

const {
  setupExperiment,
  updateExperiment,
  validateClone,
  validateListExperiments,
  validateParamId,
  validateAddItems,
  validateForceAssign,
  validateRemoveItem,
  validateUpdateItem,
  validateListItems,
  validateDeactivateItem,
  validateUpdateItemByName,
  validateAssignToLayer,
  validateCreateLayer,
} = require('./validators');

/**
 * Mounts admin experiment routes onto the given Express router.
 *
 * @param {import('express').Router} router
 * @param {import('./controller')}   controller
 * @param {object}   [options]
 * @param {Function} [options.authMiddleware]
 */
module.exports = (router, controller, options = {}) => {
  const auth = options.authMiddleware || ((req, res, next) => next());

  // ─── Experiment CRUD ───────────────────────────────────────────

  router.get('/experiments', auth, validateListExperiments, (req, res, next) =>
    controller.listExperiments(req, res, next));

  router.get('/experiment/:id', auth, validateParamId, (req, res, next) =>
    controller.getExperiment(req, res, next));

  router.post('/experiment/setup', auth, setupExperiment, (req, res, next) =>
    controller.createExperiment(req, res, next));

  router.post('/experiment/:exp_id', auth, updateExperiment, (req, res, next) =>
    controller.updateExperiment(req, res, next));

  router.post('/experiment/:exp_id/clone', auth, validateClone, (req, res, next) =>
    controller.cloneExperiment(req, res, next));

  // ─── Item management ──────────────────────────────────────────

  router.get('/experiment/records/:exp_id', auth, validateListItems, (req, res, next) =>
    controller.listItems(req, res, next));

  router.get('/experiment/items', auth, (req, res, next) =>
    controller.getItemExperiments(req, res, next));

  router.post('/experiment/add-items/:exp_id', auth, validateAddItems, (req, res, next) =>
    controller.addItems(req, res, next));

  router.post('/experiment/add-items-bulk/:exp_id', auth, validateAddItems, (req, res, next) =>
    controller.addItemsBulk(req, res, next));

  router.post('/experiment/force-assign', auth, validateForceAssign, (req, res, next) =>
    controller.forceAssign(req, res, next));

  router.post('/experiment/remove-items/:exp_id', auth, validateRemoveItem, (req, res, next) =>
    controller.removeItem(req, res, next));

  router.put('/experiment/records/:record_id', auth, validateUpdateItem, (req, res, next) =>
    controller.updateItem(req, res, next));

  router.put('/experiment/:name', auth, validateUpdateItemByName, (req, res, next) =>
    controller.updateItemByName(req, res, next));

  router.delete('/experiment/record', auth, validateDeactivateItem, (req, res, next) =>
    controller.deactivateItem(req, res, next));

  // ─── Layer management ─────────────────────────────────────────

  router.get('/layer', auth, (req, res, next) =>
    controller.getActiveLayers(req, res, next));

  router.get('/layer/:id', auth, validateParamId, (req, res, next) =>
    controller.getLayer(req, res, next));

  router.post('/layer', auth, validateCreateLayer, (req, res, next) =>
    controller.createLayer(req, res, next));

  router.put('/layer/add-experiments/:id', auth, validateParamId, validateAssignToLayer, (req, res, next) =>
    controller.assignToLayer(req, res, next));
};
