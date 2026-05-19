'use strict';

/**
 * Thin Express controller — maps HTTP requests to service / manager calls.
 *
 * @param {object} opts
 * @param {import('../lib/ExperimentService')} opts.experimentService
 * @param {import('../lib/ExperimentManager')} opts.experimentManager
 * @param {object} [opts.logger]
 */
class ExperimentController {
  constructor(opts) {
    this.experimentService = opts.experimentService;
    this.experimentManager = opts.experimentManager;
    this.logger = opts.logger || console;
  }

  // ─── Client-facing ───────────────────────────────────────────────

  async getConfigData(req, res, next) {
    const _ = this;
    try {
      const { id, attributes } = req.query;
      const itemIds = id.split(',').map((i) => i.trim()).filter(Boolean);
      let attrs = {};
      if (attributes) {
        try { attrs = JSON.parse(attributes); }
        catch { attrs = {}; }
      }
      if (req.body?.attributes) attrs = { ...attrs, ...req.body.attributes };

      const result = await _.experimentManager.getConfigData(itemIds, attrs);
      res.send(result);
    } catch (err) {
      _.logger.error(err.message);
      next(err);
    }
  }

  async evaluate(req, res, next) {
    const _ = this;
    try {
      const { exp_name, item_id } = req.query;
      const attrs = req.body?.attributes || {};
      const result = await _.experimentService.evaluate(exp_name, item_id, attrs);
      res.send(result);
    } catch (err) {
      _.logger.error(err.message);
      next(err);
    }
  }

  async assignVariant(req, res, next) {
    const _ = this;
    try {
      const { exp_name, item_id } = req.query;
      const attrs = req.body?.attributes || {};
      const result = await _.experimentService.assignVariant(exp_name, item_id, attrs);
      res.send(result);
    } catch (err) {
      _.logger.error(err.message);
      next(err);
    }
  }

  // ─── Admin: Experiments ──────────────────────────────────────────

  async createExperiment(req, res, next) {
    try { res.send(await this.experimentService.createExperiment(req.body, req.user)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  async updateExperiment(req, res, next) {
    try {
      const { exp_id } = req.params;
      res.send(await this.experimentService.updateExperiment(exp_id, req.body, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async cloneExperiment(req, res, next) {
    try {
      const { exp_id } = req.params;
      res.send(await this.experimentService.cloneExperiment(exp_id, req.body, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async getExperiment(req, res, next) {
    try { res.send(await this.experimentService.getExperiment(req.params.id)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  async listExperiments(req, res, next) {
    try { res.send(await this.experimentService.listExperiments(req.query)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  // ─── Admin: Items ────────────────────────────────────────────────

  async addItems(req, res, next) {
    try {
      const { exp_id } = req.params;
      const { items, variant_key, forced } = req.body;
      res.send(await this.experimentService.addItems(exp_id, items, req.user, { variant_key, forced }));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async addItemsBulk(req, res, next) {
    try {
      const { exp_id } = req.params;
      const { items, variant_key, forced } = req.body;
      res.send(await this.experimentService.addItemsBulk(exp_id, items, req.user, { variant_key, forced }));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async forceAssign(req, res, next) {
    try {
      const { exp_name, item_id, variant_key } = req.body;
      res.send(await this.experimentService.forceAssign(exp_name, item_id, variant_key, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async removeItem(req, res, next) {
    try {
      const { exp_id } = req.params;
      res.send(await this.experimentService.removeItem(exp_id, req.body.item_id, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async updateItem(req, res, next) {
    try {
      const { record_id } = req.params;
      res.send(await this.experimentService.updateItem(record_id, req.body, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async deactivateItem(req, res, next) {
    try {
      const { item_id, exp_id } = req.body;
      res.send(await this.experimentService.deactivateItem(item_id, exp_id, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async listItems(req, res, next) {
    try {
      const { exp_id } = req.params;
      res.send(await this.experimentService.listItems(exp_id, req.query));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async updateItemByName(req, res, next) {
    try {
      const { name } = req.params;
      const { item_id, ...metaData } = req.body;
      res.send(await this.experimentService.updateItemByExpName(
        name, item_id, metaData.meta_data || metaData, req.user
      ));
    } catch (err) { this.logger.error(err.message); next(err); }
  }

  async getItemExperiments(req, res, next) {
    try { res.send(await this.experimentService.getItemExperiments(req.query.item_id)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  // ─── Admin: Layers ───────────────────────────────────────────────

  async createLayer(req, res, next) {
    try { res.send(await this.experimentService.createLayer(req.body, req.user)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  async getActiveLayers(req, res, next) {
    try { res.send(await this.experimentService.getActiveLayers()); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  async getLayer(req, res, next) {
    try { res.send(await this.experimentService.getLayer(req.params.id)); }
    catch (err) { this.logger.error(err.message); next(err); }
  }

  async assignToLayer(req, res, next) {
    try {
      const { id } = req.params;
      const { experiment_ids } = req.body;
      res.send(await this.experimentService.assignToLayer(id, experiment_ids, req.user));
    } catch (err) { this.logger.error(err.message); next(err); }
  }
}

module.exports = ExperimentController;
