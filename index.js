'use strict';

const constants = require('./lib/constants');
const targeting = require('./lib/targeting');
const bucketing = require('./lib/bucketing');
const ExperimentService = require('./lib/ExperimentService');
const ExperimentManager = require('./lib/ExperimentManager');

const createExperimentListModel     = require('./lib/models/ExperimentList');
const createExperimentItemsModel    = require('./lib/models/ExperimentItems');
const createExperimentLayerModel    = require('./lib/models/ExperimentLayer');
const createExperimentAuditModel    = require('./lib/models/ExperimentAudit');
const createExperimentExposureModel = require('./lib/models/ExperimentExposure');

// Express integration (optional — only available if celebrate is installed)
let expressIntegration;
try {
  expressIntegration = {
    ExperimentController : require('./express/controller'),
    mountRoutes          : require('./express/routes'),
    mountAdminRoutes     : require('./express/adminRoutes'),
    validators           : require('./express/validators'),
  };
} catch {
  expressIntegration = null;
}

/**
 * Convenience initializer — creates models, service, and manager in one call.
 *
 * @param {import('mongoose')} mongoose
 * @param {object}   opts
 * @param {Function} opts.generateId
 * @param {object}   [opts.logger]
 * @param {string}   [opts.environment='prod']
 * @param {object}   [opts.cache] — { enabled, ttlMs, max }
 * @param {boolean}  [opts.persistAudit=false]
 * @param {boolean}  [opts.persistExposure=false]
 * @param {Function} [opts.onAuditEvent]   — (event, data) => void
 * @param {Function} [opts.onItemsChanged] — (expName, item, action) => void
 * @param {Function} [opts.onExposure]     — (event) => void
 * @returns {{service, manager, models, constants}}
 */
function createMendelFramework(mongoose, opts = {}) {
  const ExperimentList     = createExperimentListModel(mongoose);
  const ExperimentItems    = createExperimentItemsModel(mongoose);
  const ExperimentLayer    = createExperimentLayerModel(mongoose);
  const ExperimentAudit    = opts.persistAudit    ? createExperimentAuditModel(mongoose)    : null;
  const ExperimentExposure = opts.persistExposure ? createExperimentExposureModel(mongoose) : null;

  const models = {
    ExperimentList,
    ExperimentItems,
    ExperimentLayer,
    ...(ExperimentAudit    && { ExperimentAudit }),
    ...(ExperimentExposure && { ExperimentExposure }),
  };

  const service = new ExperimentService({
    ExperimentList,
    ExperimentItems,
    ExperimentLayer,
    ExperimentAudit,
    ExperimentExposure,
    logger          : opts.logger,
    generateId      : opts.generateId,
    environment     : opts.environment,
    onAuditEvent    : opts.onAuditEvent,
    onItemsChanged  : opts.onItemsChanged,
    onExposure      : opts.onExposure,
    persistAudit    : opts.persistAudit,
    persistExposure : opts.persistExposure,
  });

  const manager = new ExperimentManager({
    service,
    ExperimentList,
    ExperimentItems,
    logger      : opts.logger,
    environment : opts.environment,
    cache       : opts.cache,
  });

  // Bust the manager cache whenever data changes. Consumers using the
  // user-supplied `onAuditEvent` still see every event.
  if (opts.cache?.enabled) {
    const userHook = service.userAuditHook;
    service.userAuditHook = (event, payload) => {
      manager.invalidateCache();
      return userHook(event, payload);
    };
  }

  return { service, manager, models, constants };
}

module.exports = {
  createMendelFramework,

  // Core classes
  ExperimentService,
  ExperimentManager,

  // Model factories
  createExperimentListModel,
  createExperimentItemsModel,
  createExperimentLayerModel,
  createExperimentAuditModel,
  createExperimentExposureModel,

  // Utilities (also useful for SDKs evaluating client-side)
  ...bucketing,
  ...targeting,

  // Constants
  ...constants,

  // Express integration (null if celebrate is not installed)
  express: expressIntegration,
};
