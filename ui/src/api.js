const BASE = '/api/admin';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Experiments ────────────────────────────────────────────────

export function listExperiments(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/experiments${qs ? `?${qs}` : ''}`);
}

export function getExperiment(id) {
  return request(`/experiment/${id}`);
}

export function createExperiment(body) {
  return request('/experiment/setup', { method: 'POST', body });
}

export function updateExperiment(expId, body) {
  return request(`/experiment/${expId}`, { method: 'POST', body });
}

export function cloneExperiment(expId, body = {}) {
  return request(`/experiment/${expId}/clone`, { method: 'POST', body });
}

// ─── Evaluation (debug) ─────────────────────────────────────────

export function evaluate(expName, itemId, attributes = {}) {
  const qs = new URLSearchParams({ exp_name: expName, item_id: itemId }).toString();
  return fetch(`/api/v1/evaluate?${qs}`, {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ attributes }),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed: ${res.status}`);
    }
    return res.json();
  });
}

// ─── Items ──────────────────────────────────────────────────────

export function listItems(expId, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/experiment/records/${expId}${qs ? `?${qs}` : ''}`);
}

export function addItems(expId, items, opts = {}) {
  return request(`/experiment/add-items/${expId}`, {
    method: 'POST',
    body  : { items, ...opts },
  });
}

export function addItemsBulk(expId, items, opts = {}) {
  return request(`/experiment/add-items-bulk/${expId}`, {
    method: 'POST',
    body  : { items, ...opts },
  });
}

export function forceAssign(expName, itemId, variantKey) {
  return request('/experiment/force-assign', {
    method: 'POST',
    body  : { exp_name: expName, item_id: itemId, variant_key: variantKey },
  });
}

export function removeItem(expId, itemId) {
  return request(`/experiment/remove-items/${expId}`, {
    method: 'POST',
    body  : { item_id: itemId },
  });
}

export function updateItem(recordId, body) {
  return request(`/experiment/records/${recordId}`, {
    method: 'PUT',
    body,
  });
}

export function deactivateItem(itemId, expId) {
  return request('/experiment/record', {
    method: 'DELETE',
    body  : { item_id: itemId, exp_id: expId },
  });
}

// ─── Layers ─────────────────────────────────────────────────────

export function getActiveLayers() {
  return request('/layer');
}

export function getLayer(id) {
  return request(`/layer/${id}`);
}

export function createLayer(body) {
  return request('/layer', { method: 'POST', body });
}

export function assignToLayer(layerId, experimentIds) {
  return request(`/layer/add-experiments/${layerId}`, {
    method: 'PUT',
    body  : { experiment_ids: experimentIds },
  });
}
