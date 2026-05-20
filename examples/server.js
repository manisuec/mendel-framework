'use strict';

/**
 * Minimal runnable server for local dev.
 * Connects to MongoDB, mounts the framework's client + admin routes,
 * and exposes them on http://localhost:3000.
 */

const express = require('express');
const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
const { errors: celebrateErrors } = require('celebrate');
const {
  createMendelFramework,
  express: { ExperimentController, mountRoutes, mountAdminRoutes },
} = require('../index');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mendel-framework';
const PORT      = Number(process.env.PORT || 3001);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(`[mongo] connected to ${MONGO_URI}`);

  // mongoose models with autoIndex disabled — build them once at boot.
  const indexBuilders = Object.values(mongoose.connection.models).map((m) =>
    m.createIndexes().catch((err) => console.warn(`[mongo] index ${m.modelName}`, err.message))
  );
  await Promise.all(indexBuilders);

  const { service, manager } = createMendelFramework(mongoose, {
    generateId      : uuid,
    environment     : process.env.NODE_ENV || 'prod',
    cache           : { enabled: true, ttlMs: 5000 },
    persistAudit    : true,
    persistExposure : false,

    onAuditEvent: (event, payload) => {
      console.log(`[audit] ${event}`, JSON.stringify(payload?.exp_name || payload?.layer_name || payload?.exp_id || ''));
    },
    onExposure: (e) => {
      console.log(`[exposure] ${e.exp_name} item=${e.item_id} variant=${e.variant_key} reason=${e.reason}`);
    },
  });

  const controller = new ExperimentController({
    experimentService : service,
    experimentManager : manager,
  });

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // permissive CORS for the local Vite proxy / direct browser hits
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin',  req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  const clientRouter = express.Router();
  mountRoutes(clientRouter, controller);
  app.use('/api/v1', clientRouter);

  const adminRouter = express.Router();
  mountAdminRoutes(adminRouter, controller, {
    authMiddleware: (req, _res, next) => { req.user = { id: 'local-dev' }; next(); },
  });
  app.use('/api/admin', adminRouter);

  // celebrate validation errors → JSON
  app.use(celebrateErrors());

  // catch-all error handler
  app.use((err, _req, res, _next) => {
    console.error('[error]', err.stack || err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Internal error' });
  });

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] client API: /api/v1   admin API: /api/admin`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
