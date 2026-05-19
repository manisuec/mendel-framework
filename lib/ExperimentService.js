'use strict';

const {
  ROLL_OUT_TYPE,
  SUCCESS_STATUS,
  CONTROL_VARIANT,
  EXPOSURE_REASON,
  AUDIT_EVENT,
} = require('./constants');
const { matchesTargeting } = require('./targeting');
const { pickVariant, inRollout, inHoldout } = require('./bucketing');

const BULK_BATCH_SIZE = 500;

/**
 * Core experiment service — manages experiments, items, and layers,
 * and evaluates flags / variants deterministically.
 *
 * All Mongoose models and helper functions are injected via `opts`
 * so there is zero coupling to a specific application.
 *
 * @param {object} opts
 * @param {import('mongoose').Model}  opts.ExperimentList
 * @param {import('mongoose').Model}  opts.ExperimentItems
 * @param {import('mongoose').Model}  opts.ExperimentLayer
 * @param {import('mongoose').Model}  [opts.ExperimentAudit]
 * @param {import('mongoose').Model}  [opts.ExperimentExposure]
 * @param {object}   [opts.logger]
 * @param {Function} opts.generateId
 * @param {string}   [opts.environment='prod']
 * @param {Function} [opts.onAuditEvent]   — (eventName, payload) => void
 * @param {Function} [opts.onItemsChanged] — (expName, item, action) => void | Promise
 * @param {Function} [opts.onExposure]     — (event) => void | Promise
 * @param {boolean}  [opts.persistAudit=false]    — mirror onAuditEvent into ExperimentAudit
 * @param {boolean}  [opts.persistExposure=false] — mirror onExposure into ExperimentExposure
 */
class ExperimentService {
  constructor(opts) {
    this.ExperimentList = opts.ExperimentList;
    this.ExperimentItems = opts.ExperimentItems;
    this.ExperimentLayer = opts.ExperimentLayer;
    this.ExperimentAudit = opts.ExperimentAudit || null;
    this.ExperimentExposure = opts.ExperimentExposure || null;

    this.logger = opts.logger || console;
    this.generateId = opts.generateId;
    this.environment = opts.environment || 'prod';

    this.userAuditHook = opts.onAuditEvent || (() => {});
    this.onItemsChanged = opts.onItemsChanged || (() => {});
    this.userExposureHook = opts.onExposure || (() => {});

    this.persistAudit = !!opts.persistAudit && !!this.ExperimentAudit;
    this.persistExposure = !!opts.persistExposure && !!this.ExperimentExposure;
  }

  // ─── Internal hooks ──────────────────────────────────────────────

  _emitAudit(event, payload) {
    try { this.userAuditHook(event, payload); } catch (err) {
      this.logger.error?.('audit hook failed:', err);
    }
    if (this.persistAudit) {
      this.ExperimentAudit.create({
        _id      : this.generateId(),
        event,
        exp_id   : payload?.exp_id   || null,
        exp_name : payload?.exp_name || null,
        actor    : payload?.user     || null,
        data     : payload,
      }).catch((err) => this.logger.error?.('audit persist failed:', err));
    }
  }

  _emitExposure(event) {
    try { this.userExposureHook(event); } catch (err) {
      this.logger.error?.('exposure hook failed:', err);
    }
    if (this.persistExposure) {
      this.ExperimentExposure.create({
        _id         : this.generateId(),
        exp_id      : event.exp_id,
        exp_name    : event.exp_name,
        item_id     : event.item_id,
        variant_key : event.variant_key,
        reason      : event.reason,
        attributes  : event.attributes,
      }).catch((err) => this.logger.error?.('exposure persist failed:', err));
    }
  }

  // ─── Experiment CRUD ─────────────────────────────────────────────

  async createExperiment(data, auditUser) {
    const _ = this;

    const existing = await _.ExperimentList.findOne({ exp_name: data.exp_name }).lean();
    if (existing) {
      const err = new Error(`Experiment with name "${data.exp_name}" already exists`);
      err.status = 409;
      throw err;
    }

    const doc = {
      _id            : _.generateId(),
      exp_name       : data.exp_name,
      hypothesis     : data.hypothesis || null,
      exp_type       : data.exp_type,
      app_version    : data.app_version,
      environment    : data.environment || _.environment,
      salt           : data.salt || data.exp_name,
      start_date     : data.start_date,
      end_date       : data.end_date,
      roll_out_type  : data.roll_out_type,
      roll_out_value : data.roll_out_value ?? 100,
      variants       : data.variants,
      targeting      : data.targeting,
      prerequisites  : data.prerequisites,
      meta_data      : data.meta_data,
      is_active      : data.is_active !== undefined ? data.is_active : true,
      layer_id       : data.layer_id || null,
      layer_name     : data.layer_name || null,
    };

    const experiment = await _.ExperimentList.create(doc);

    if (data.item_ids?.length) {
      await _.addItems(experiment._id, data.item_ids, auditUser);
    }

    _._emitAudit(AUDIT_EVENT.EXPERIMENT_CREATED, {
      exp_name : data.exp_name,
      exp_id   : experiment._id,
      user     : auditUser,
    });

    return experiment.toObject();
  }

  async updateExperiment(expId, data, auditUser) {
    const _ = this;

    const allowed = [
      'start_date', 'end_date', 'roll_out_value', 'roll_out_type',
      'success_status', 'is_active', 'meta_data', 'hypothesis',
      'layer_id', 'layer_name', 'variants', 'targeting', 'prerequisites',
      'environment', 'salt', 'graduated_variant',
    ];

    const update = {};
    for (const field of allowed) {
      if (data[field] !== undefined) update[field] = data[field];
    }

    const result = await _.ExperimentList.findByIdAndUpdate(expId, update, { new: true }).lean();

    _._emitAudit(AUDIT_EVENT.EXPERIMENT_UPDATED, {
      exp_id   : expId,
      exp_name : result?.exp_name,
      update,
      user     : auditUser,
    });

    return result;
  }

  async cloneExperiment(expId, overrides, auditUser) {
    const _ = this;

    const src = await _.ExperimentList.findById(expId).lean();
    if (!src) {
      const err = new Error('Experiment not found');
      err.status = 404;
      throw err;
    }

    const { _id, createdAt, updatedAt, exp_name, salt, ...rest } = src;
    const data = {
      ...rest,
      exp_name : overrides?.exp_name || `${exp_name}_copy`,
      salt     : overrides?.salt     || `${salt}_copy`,
      ...overrides,
    };

    const cloned = await _.createExperiment(data, auditUser);

    _._emitAudit(AUDIT_EVENT.EXPERIMENT_CLONED, {
      source_exp_id : expId,
      exp_id        : cloned._id,
      exp_name      : cloned.exp_name,
      user          : auditUser,
    });

    return cloned;
  }

  async getExperiment(expId) {
    const _ = this;
    const data = await _.ExperimentList.findById(expId).lean();
    if (!data) return null;

    const [active, inactive] = await Promise.all([
      _.ExperimentItems.countDocuments({ exp_id: expId, is_active: true }),
      _.ExperimentItems.countDocuments({ exp_id: expId, is_active: false }),
    ]);

    return { ...data, count: { active, inactive } };
  }

  async listExperiments(query = {}) {
    const _ = this;
    const { page = 0, limit = 20, exp_name, environment, ...filters } = query;

    const q = { ...filters };
    if (exp_name) q.exp_name = { $regex: exp_name, $options: 'i' };
    if (environment) q.environment = environment;

    const [docs, total] = await Promise.all([
      _.ExperimentList
        .find(q)
        .sort({ exp_name: 1 })
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean(),
      _.ExperimentList.countDocuments(q),
    ]);

    return { docs, total, page: Number(page), limit: Number(limit) };
  }

  // ─── Item / enrollment management ────────────────────────────────

  /**
   * Add items to an experiment, respecting layer mutual exclusion.
   * Items are pinned to a variant (defaults to first non-control variant
   * or the explicitly provided `variant_key`).
   */
  async addItems(expId, itemIds, auditUser, opts = {}) {
    const _ = this;

    const exp = await _.ExperimentList.findById(expId).lean();
    if (!exp) {
      const err = new Error('Experiment not found');
      err.status = 404;
      throw err;
    }

    const variantKey = opts.variant_key
      || exp.variants?.find((v) => v.key !== CONTROL_VARIANT)?.key
      || exp.variants?.[0]?.key
      || null;

    const items = itemIds
      .map((id) => (typeof id === 'string' ? id.trim() : id))
      .filter(Boolean)
      .map((itemId) => ({
        exp_name    : exp.exp_name,
        exp_id      : exp._id,
        item_id     : itemId,
        variant_key : variantKey,
        forced      : !!opts.forced,
        is_active   : true,
      }));

    const result = await _.safelyAddItems(items);

    _._emitAudit(AUDIT_EVENT.ITEMS_ADDED, {
      exp_id   : expId,
      exp_name : exp.exp_name,
      items    : itemIds,
      variant  : variantKey,
      user     : auditUser,
    });

    for (const id of itemIds) {
      _.onItemsChanged(exp.exp_name, { item_id: String(id).trim(), variant_key: variantKey, is_active: true }, 'added');
    }

    return result;
  }

  /**
   * Add many items efficiently. Items are chunked so a 100k batch does
   * not blow the Mongo command budget.
   */
  async addItemsBulk(expId, itemIds, auditUser, opts = {}) {
    const _ = this;
    const results = [];
    for (let i = 0; i < itemIds.length; i += BULK_BATCH_SIZE) {
      const chunk = itemIds.slice(i, i + BULK_BATCH_SIZE);
      results.push(await _.addItems(expId, chunk, auditUser, opts));
    }
    const filtered = results.flatMap((r) => r.filtered_items || []);
    return { filtered_items: filtered, status: 'success', batches: results.length };
  }

  async removeItem(expId, itemId, auditUser) {
    const _ = this;
    const removed = await _.ExperimentItems.findOneAndDelete({
      exp_id: expId, item_id: itemId,
    }).lean();

    _._emitAudit(AUDIT_EVENT.ITEM_REMOVED, {
      exp_id: expId, item_id: itemId, user: auditUser,
    });

    if (removed) {
      _.onItemsChanged(removed.exp_name, { item_id: itemId.trim(), is_active: false }, 'removed');
    }
    return removed;
  }

  async updateItem(recordId, data, auditUser) {
    const _ = this;
    const result = await _.ExperimentItems.findByIdAndUpdate(recordId, data, { new: true }).lean();

    _._emitAudit(AUDIT_EVENT.ITEM_UPDATED, {
      record_id: recordId, update: data, user: auditUser,
    });

    if (result) _.onItemsChanged(result.exp_name, result, 'updated');
    return result;
  }

  async deactivateItem(itemId, expId, auditUser) {
    const _ = this;
    const result = await _.ExperimentItems.findOneAndUpdate(
      { item_id: itemId, exp_id: expId },
      { is_active: false },
      { new: true }
    ).lean();

    _._emitAudit(AUDIT_EVENT.ITEM_DEACTIVATED, {
      item_id: itemId, exp_id: expId, user: auditUser,
    });
    return result;
  }

  async listItems(expId, query = {}) {
    const _ = this;
    const { page = 0, limit = 20, item_id, variant_key } = query;

    const q = { exp_id: expId };
    if (item_id) q.item_id = item_id;
    if (variant_key) q.variant_key = variant_key;

    const [docs, total] = await Promise.all([
      _.ExperimentItems.find(q)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit))
        .lean(),
      _.ExperimentItems.countDocuments(q),
    ]);

    return { docs, total, page: Number(page), limit: Number(limit) };
  }

  async updateItemByExpName(expName, itemId, metaData, auditUser) {
    const _ = this;

    const exp = await _.ExperimentList.findOne({ exp_name: expName, is_active: true }).lean();
    if (!exp) return null;

    const updateBody = {};
    for (const key in metaData) updateBody[`meta_data.${key}`] = metaData[key];

    const result = await _.ExperimentItems.findOneAndUpdate(
      { exp_name: expName, item_id: itemId },
      { $set: updateBody },
      { new: true }
    ).lean();

    _._emitAudit(AUDIT_EVENT.ITEM_META_UPDATED, {
      exp_name: expName, item_id: itemId, meta_data: metaData, user: auditUser,
    });
    return result;
  }

  // ─── Flag evaluation ─────────────────────────────────────────────

  /**
   * Evaluate an experiment for a single item.
   *
   * @param {string} expName
   * @param {string} itemId
   * @param {object} [attributes] — consumer-supplied bag (plan, country, …)
   * @param {object} [opts]
   * @param {boolean} [opts.logExposure=true]
   * @returns {Promise<{variant: string|null, reason: string, exp_id: string|null, payload: any}>}
   */
  async evaluate(expName, itemId, attributes = {}, opts = {}) {
    const _ = this;
    const exp = await _.ExperimentList.findOne({ exp_name: expName }).lean();
    const result = await _._evaluate(exp, itemId, attributes);

    if (opts.logExposure !== false && exp) {
      _._emitExposure({
        exp_id      : exp._id,
        exp_name    : expName,
        item_id     : itemId,
        variant_key : result.variant,
        reason      : result.reason,
        attributes,
      });
    }
    return result;
  }

  async _evaluate(exp, itemId, attributes = {}, opts = {}) {
    const _ = this;
    const now = Date.now();

    if (!exp) {
      return { variant: null, reason: EXPOSURE_REASON.NOT_FOUND, exp_id: null, payload: null };
    }

    if (exp.environment && _.environment && exp.environment !== _.environment) {
      return { variant: null, reason: EXPOSURE_REASON.ENVIRONMENT_MISS, exp_id: exp._id, payload: null };
    }

    if (!exp.is_active) {
      return { variant: null, reason: EXPOSURE_REASON.INACTIVE, exp_id: exp._id, payload: null };
    }

    if (exp.success_status === SUCCESS_STATUS.FAILURE) {
      return { variant: null, reason: EXPOSURE_REASON.FAILED, exp_id: exp._id, payload: null };
    }

    if (exp.start_date && now < exp.start_date) {
      return { variant: null, reason: EXPOSURE_REASON.NOT_STARTED, exp_id: exp._id, payload: null };
    }

    if (exp.end_date && now > exp.end_date) {
      return { variant: null, reason: EXPOSURE_REASON.ENDED, exp_id: exp._id, payload: null };
    }

    // Graduated experiments serve a fixed variant to the eligible audience.
    if (exp.success_status === SUCCESS_STATUS.SUCCESS) {
      if (!matchesTargeting(exp.targeting, attributes)) {
        return { variant: null, reason: EXPOSURE_REASON.TARGETING_MISS, exp_id: exp._id, payload: null };
      }
      const variantKey = exp.graduated_variant
        || exp.variants?.find((v) => v.key !== CONTROL_VARIANT)?.key
        || exp.variants?.[0]?.key
        || null;
      return {
        variant : variantKey,
        reason  : EXPOSURE_REASON.GRADUATED,
        exp_id  : exp._id,
        payload : exp.variants?.find((v) => v.key === variantKey)?.payload ?? null,
      };
    }

    // Forced enrollment — manual overrides win over everything below.
    if (!opts.skipEnrollment) {
      const forced = await _.ExperimentItems.findOne({
        exp_id  : exp._id,
        item_id : itemId,
        forced  : true,
      }).lean();
      if (forced && forced.is_active && forced.variant_key) {
        return {
          variant : forced.variant_key,
          reason  : EXPOSURE_REASON.FORCED,
          exp_id  : exp._id,
          payload : exp.variants?.find((v) => v.key === forced.variant_key)?.payload ?? null,
        };
      }
    }

    if (!matchesTargeting(exp.targeting, attributes)) {
      return { variant: null, reason: EXPOSURE_REASON.TARGETING_MISS, exp_id: exp._id, payload: null };
    }

    if (exp.prerequisites?.length) {
      for (const pre of exp.prerequisites) {
        const preExp = await _.ExperimentList.findOne({ exp_name: pre.exp_name }).lean();
        const preResult = await _._evaluate(preExp, itemId, attributes, { skipEnrollment: false });
        if (!preResult.variant) {
          return { variant: null, reason: EXPOSURE_REASON.PREREQ_MISS, exp_id: exp._id, payload: null };
        }
        if (pre.variant && preResult.variant !== pre.variant) {
          return { variant: null, reason: EXPOSURE_REASON.PREREQ_MISS, exp_id: exp._id, payload: null };
        }
      }
    }

    // Layer holdout
    if (exp.layer_id) {
      const layer = await _.ExperimentLayer.findById(exp.layer_id).lean();
      if (layer?.holdout_percentage > 0
          && inHoldout(layer.salt || layer.layer_name, itemId, layer.holdout_percentage)) {
        return { variant: null, reason: EXPOSURE_REASON.HOLDOUT, exp_id: exp._id, payload: null };
      }
    }

    // Feature flag rollout: explicit enrollment only.
    if (exp.roll_out_type === ROLL_OUT_TYPE.FEATURE_FLAG) {
      if (opts.skipEnrollment) {
        return { variant: null, reason: EXPOSURE_REASON.ROLLOUT_MISS, exp_id: exp._id, payload: null };
      }
      const enrolled = await _.ExperimentItems.findOne({
        exp_id  : exp._id,
        item_id : itemId,
      }).lean();
      if (!enrolled || !enrolled.is_active || !enrolled.variant_key) {
        return { variant: null, reason: EXPOSURE_REASON.ROLLOUT_MISS, exp_id: exp._id, payload: null };
      }
      return {
        variant : enrolled.variant_key,
        reason  : EXPOSURE_REASON.ENROLLED,
        exp_id  : exp._id,
        payload : exp.variants?.find((v) => v.key === enrolled.variant_key)?.payload ?? null,
      };
    }

    // A/B testing: deterministic bucketing.
    const salt = exp.salt || exp.exp_name;
    if (!inRollout(salt, itemId, exp.roll_out_value ?? 100)) {
      return { variant: null, reason: EXPOSURE_REASON.ROLLOUT_MISS, exp_id: exp._id, payload: null };
    }

    const variantKey = pickVariant(exp.variants, salt, itemId);
    return {
      variant : variantKey,
      reason  : EXPOSURE_REASON.BUCKETED,
      exp_id  : exp._id,
      payload : exp.variants?.find((v) => v.key === variantKey)?.payload ?? null,
    };
  }

  /**
   * Convenience: which variant is this item in? (null if not eligible).
   */
  async getVariant(expName, itemId, attributes, opts) {
    return (await this.evaluate(expName, itemId, attributes, opts)).variant;
  }

  /**
   * Convenience: is this item exposed to a non-control treatment?
   */
  async isEnabled(expName, itemIdOrIds, attributes, opts) {
    const ids = Array.isArray(itemIdOrIds) ? itemIdOrIds : [itemIdOrIds];
    for (const id of ids) {
      const variant = await this.getVariant(expName, id, attributes, opts);
      if (variant && variant !== CONTROL_VARIANT) return true;
    }
    return false;
  }

  /**
   * Force-assign an item to a specific variant (admin / QA override).
   */
  async forceAssign(expName, itemId, variantKey, auditUser) {
    const _ = this;
    const exp = await _.ExperimentList.findOne({ exp_name: expName }).lean();
    if (!exp) {
      const err = new Error('Experiment not found');
      err.status = 404;
      throw err;
    }
    if (!exp.variants?.some((v) => v.key === variantKey)) {
      const err = new Error(`Variant "${variantKey}" not defined on experiment`);
      err.status = 400;
      throw err;
    }

    const doc = await _.ExperimentItems.findOneAndUpdate(
      { exp_id: exp._id, item_id: itemId },
      {
        $setOnInsert : { _id: _.generateId(), exp_name: exp.exp_name, exp_id: exp._id, item_id: itemId },
        $set         : { variant_key: variantKey, forced: true, is_active: true },
      },
      { upsert: true, new: true }
    ).lean();

    _._emitAudit(AUDIT_EVENT.ITEM_UPDATED, {
      exp_id: exp._id, exp_name: expName, item_id: itemId,
      update: { variant_key: variantKey, forced: true },
      user: auditUser,
    });
    return doc;
  }

  /**
   * Enrol an item via probabilistic bucketing and persist the assignment.
   * If the item is already enrolled, returns the existing record.
   */
  async assignVariant(expName, itemId, attributes = {}) {
    const _ = this;

    const existing = await _.ExperimentItems.findOne({
      exp_name: expName, item_id: itemId,
    }).lean();
    if (existing) return existing;

    const exp = await _.ExperimentList.findOne({ exp_name: expName }).lean();
    if (!exp || !exp.is_active || exp.roll_out_type === ROLL_OUT_TYPE.FEATURE_FLAG) {
      return null;
    }

    const result = await _._evaluate(exp, itemId, attributes, { skipEnrollment: true });
    if (!result.variant) return null;

    await _.safelyAddItems([{
      exp_name    : expName,
      exp_id      : exp._id,
      item_id     : itemId,
      variant_key : result.variant,
      is_active   : true,
    }]);

    return { exp_name: expName, item_id: itemId, variant_key: result.variant, exp_id: exp._id };
  }

  /**
   * Lightweight: list active experiments enrolled for this item.
   * Returns Map<exp_name, { exp_id, variant_key }>.
   */
  async getEnabledExperiments(itemId) {
    const _ = this;
    const items = await _.ExperimentItems.find(
      { item_id: itemId, is_active: true },
      { exp_name: 1, exp_id: 1, variant_key: 1 }
    ).lean();

    const map = new Map();
    for (const item of items) {
      map.set(item.exp_name, { exp_id: item.exp_id, variant_key: item.variant_key });
    }
    return map;
  }

  async getItemExperiments(itemId) {
    return this.ExperimentItems.aggregate([
      { $match: { item_id: itemId } },
      {
        $lookup: {
          from: 'experimentlists', localField: 'exp_id', foreignField: '_id', as: 'exp_detail',
        },
      },
      {
        $project: {
          exp_name: 1, exp_id: 1, meta_data: 1, is_active: 1,
          variant_key: 1, item_id: 1, forced: 1,
          exp_detail: { $arrayElemAt: ['$exp_detail', 0] },
        },
      },
    ]);
  }

  // ─── Layer management ────────────────────────────────────────────

  async createLayer(data, auditUser) {
    const _ = this;
    const doc = {
      _id                : _.generateId(),
      layer_name         : data.layer_name,
      salt               : data.salt || data.layer_name,
      holdout_percentage : data.holdout_percentage ?? 0,
      is_default         : !!data.is_default,
      is_active          : true,
    };

    const result = await _.ExperimentLayer.create(doc);

    _._emitAudit(AUDIT_EVENT.LAYER_CREATED, {
      layer_name: data.layer_name, user: auditUser,
    });

    return result.toObject();
  }

  async getActiveLayers() {
    return this.ExperimentLayer.find({ is_active: true }).lean();
  }

  async getLayer(layerId) {
    const _ = this;
    const layer = await _.ExperimentLayer.findById(layerId).lean();
    if (!layer) return null;

    const experiments = await _.ExperimentList.find(
      { layer_id: layerId },
      { exp_name: 1 }
    ).lean();
    return { ...layer, experiments };
  }

  async assignToLayer(layerId, experimentIds, auditUser) {
    const _ = this;
    const layer = await _.ExperimentLayer.findById(layerId).lean();
    if (!layer) {
      const err = new Error('Layer not found');
      err.status = 404;
      throw err;
    }

    await Promise.all([
      _.ExperimentList.updateMany(
        { _id: { $in: experimentIds } },
        { layer_id: layerId, layer_name: layer.layer_name }
      ),
      _.ExperimentList.updateMany(
        { _id: { $nin: experimentIds }, layer_id: layerId },
        { layer_id: null, layer_name: null }
      ),
    ]);

    _._emitAudit(AUDIT_EVENT.LAYER_ASSIGNED, {
      layer_id: layerId, experiment_ids: experimentIds, user: auditUser,
    });
    return true;
  }

  // ─── Internal helpers ────────────────────────────────────────────

  /**
   * Add enrollment records while respecting layer mutual exclusion.
   * Items already enrolled in another experiment of the same layer are skipped.
   */
  async safelyAddItems(itemsArr) {
    const _ = this;
    const excluded = {};
    const itemIds = itemsArr.map((i) => i.item_id);

    if (!itemIds.length) {
      throw new Error('At least one item_id is required');
    }

    const expNames = [...new Set(itemsArr.map((i) => i.exp_name))];

    for (const expName of expNames) {
      const exp = await _.ExperimentList.findOne({ exp_name: expName }).lean();
      if (!exp) {
        return { filtered_items: itemIds, status: 'success' };
      }

      if (exp.layer_id) {
        const layerExps = await _.ExperimentList.find(
          { layer_id: exp.layer_id },
          { _id: 1 }
        ).lean();
        const layerExpIds = layerExps.map((e) => e._id);
        const conflicts = await _.ExperimentItems.find({
          exp_id  : { $in: layerExpIds },
          item_id : { $in: itemIds },
        }).lean();
        for (const c of conflicts) excluded[c.item_id] = true;
      } else {
        const dupes = await _.ExperimentItems.find({
          exp_id  : exp._id,
          item_id : { $in: itemIds },
        }).lean();
        for (const d of dupes) excluded[d.item_id] = true;
      }

      const toInsert = itemsArr
        .filter((i) => i.exp_name === expName && !excluded[i.item_id])
        .map((i) => ({
          _id         : _.generateId(),
          exp_id      : exp._id,
          exp_name    : exp.exp_name,
          item_id     : i.item_id,
          variant_key : i.variant_key ?? null,
          forced      : !!i.forced,
          is_active   : i.is_active !== false,
        }));

      if (toInsert.length) {
        await _.ExperimentItems.insertMany(toInsert, { ordered: false });
      }
    }

    return {
      filtered_items : Object.keys(excluded),
      status         : 'success',
    };
  }
}

module.exports = ExperimentService;
