import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getExperiment, updateExperiment, cloneExperiment, evaluate } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import RolloutBadge from '../components/RolloutBadge';
import Modal from '../components/Modal';
import VariantsEditor, { normalizeVariants } from '../components/VariantsEditor';
import TargetingEditor, { normalizeTargeting } from '../components/TargetingEditor';
import PrerequisitesEditor, { normalizePrerequisites } from '../components/PrerequisitesEditor';
import ItemManager from './ItemManager';

const OP_LABELS = {
  eq: '=', neq: '≠', in: 'in', nin: 'not in',
  gt: '>', gte: '≥', lt: '<', lte: '≤',
  contains: 'contains', not_contains: 'does not contain',
  starts_with: 'starts with', ends_with: 'ends with',
  regex: 'matches', exists: 'exists', not_exists: 'is unset',
};

export default function ExperimentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: exp, loading, execute: reload } = useAsync(
    () => getExperiment(id),
    [id]
  );
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [evalModal, setEvalModal] = useState(false);
  const [evalForm, setEvalForm] = useState({ item_id: '', attributes: '{}' });
  const [evalResult, setEvalResult] = useState(null);

  const openEdit = useCallback(() => {
    if (!exp) return;
    setEditForm({
      success_status    : exp.success_status,
      is_active         : exp.is_active,
      roll_out_value    : exp.roll_out_value ?? '',
      hypothesis        : exp.hypothesis || '',
      environment       : exp.environment || 'prod',
      salt              : exp.salt || '',
      graduated_variant : exp.graduated_variant || '',
      variants          : (exp.variants || []).map((v) => ({
        ...v,
        payload: v.payload != null ? JSON.stringify(v.payload) : '',
      })),
      targeting         : exp.targeting || { rules: [], match: 'all' },
      prerequisites     : exp.prerequisites || [],
    });
    setEditModal(true);
  }, [exp]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const body = {
        success_status    : Number(editForm.success_status),
        is_active         : editForm.is_active,
        hypothesis        : editForm.hypothesis,
        environment       : editForm.environment,
        salt              : editForm.salt || undefined,
        graduated_variant : editForm.graduated_variant || null,
        variants          : normalizeVariants(editForm.variants),
        targeting         : normalizeTargeting(editForm.targeting),
        prerequisites     : normalizePrerequisites(editForm.prerequisites),
      };
      if (editForm.roll_out_value !== '') body.roll_out_value = Number(editForm.roll_out_value);
      await updateExperiment(id, body);
      toast('Experiment updated', 'success');
      setEditModal(false);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleClone = async (e) => {
    e.preventDefault();
    try {
      const result = await cloneExperiment(id, cloneName ? { exp_name: cloneName } : {});
      toast('Experiment cloned', 'success');
      setCloneModal(false);
      navigate(`/experiments/${result._id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleEvaluate = async (e) => {
    e.preventDefault();
    try {
      let attrs = {};
      if (evalForm.attributes.trim()) {
        try { attrs = JSON.parse(evalForm.attributes); }
        catch { toast('Attributes must be valid JSON', 'error'); return; }
      }
      const result = await evaluate(exp.exp_name, evalForm.item_id, attrs);
      setEvalResult(result);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <div className="loader">Loading...</div>;
  if (!exp) return <div className="loader">Experiment not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/experiments" className="breadcrumb">Experiments</Link>
          <h1>{exp.exp_name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => { setEvalResult(null); setEvalModal(true); }}>
            Evaluate
          </button>
          <button className="btn" onClick={() => { setCloneName(`${exp.exp_name}_copy`); setCloneModal(true); }}>
            Clone
          </button>
          <button className="btn btn--primary" onClick={openEdit}>
            Edit
          </button>
        </div>
      </div>

      <div className="stat-grid stat-grid--4">
        <div className="card stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value"><StatusBadge status={exp.success_status} /></div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Rollout</div>
          <div className="stat-value">
            <RolloutBadge type={exp.roll_out_type} value={exp.roll_out_value} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Active Items</div>
          <div className="stat-value stat-number">{exp.count?.active ?? 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Variants</div>
          <div className="stat-value stat-number">{exp.variants?.length ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <h3>Details</h3>
        <div className="detail-grid">
          <Detail label="ID" value={exp._id} />
          <Detail label="Type" value={exp.exp_type || 'general'} />
          <Detail label="Active" value={exp.is_active ? 'Yes' : 'No'} />
          <Detail label="Environment" value={exp.environment || 'prod'} />
          <Detail label="Salt" value={exp.salt || '—'} />
          <Detail label="App Version" value={exp.app_version || '—'} />
          <Detail label="Layer" value={exp.layer_name || '—'} />
          <Detail label="Graduated Variant" value={exp.graduated_variant || '—'} />
          <Detail label="Hypothesis" value={exp.hypothesis || '—'} />
          <Detail
            label="Start Date"
            value={exp.start_date ? new Date(exp.start_date).toLocaleString() : '—'}
          />
          <Detail
            label="End Date"
            value={exp.end_date ? new Date(exp.end_date).toLocaleString() : '—'}
          />
          {exp.meta_data && (
            <div className="detail-item detail-item--full">
              <span className="detail-label">Meta Data</span>
              <pre className="detail-pre">{JSON.stringify(exp.meta_data, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Variants */}
      <div className="card">
        <h3>Variants</h3>
        {exp.variants?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th style={{ width: 100 }}>Weight</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {exp.variants.map((v) => (
                <tr key={v.key}>
                  <td>
                    <span className={`variant-badge ${v.key === 'control' ? 'variant-badge--control' : ''}`}>
                      {v.key}
                    </span>
                  </td>
                  <td>{v.weight}</td>
                  <td>
                    {v.payload != null
                      ? <pre className="detail-pre" style={{ margin: 0 }}>{JSON.stringify(v.payload, null, 2)}</pre>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-inline">No variants configured.</p>
        )}
      </div>

      {/* Targeting */}
      <div className="card">
        <h3>Targeting</h3>
        {exp.targeting?.rules?.length ? (
          <>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Eligible when <strong>{exp.targeting.match || 'all'}</strong> of the following match:
            </p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {exp.targeting.rules.map((r, i) => (
                <li key={i} style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  <strong>{r.attribute}</strong> {OP_LABELS[r.op] || r.op}{' '}
                  {r.values != null && (
                    <code>{Array.isArray(r.values) ? r.values.join(', ') : String(r.values)}</code>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-inline">No targeting rules — applies to every item.</p>
        )}
      </div>

      {/* Prerequisites */}
      {exp.prerequisites?.length > 0 && (
        <div className="card">
          <h3>Prerequisites</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {exp.prerequisites.map((p, i) => (
              <li key={i} style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                <strong>{p.exp_name}</strong>
                {p.variant ? <> = <span className="variant-badge">{p.variant}</span></> : <> (any non-control)</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ItemManager
        expId={id}
        expName={exp.exp_name}
        variants={exp.variants || []}
        onCountChange={reload}
      />

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Experiment" size="large">
        <form onSubmit={handleUpdate}>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Status</label>
              <select
                className="input input--select"
                value={editForm.success_status}
                onChange={(e) => setEditForm((f) => ({ ...f, success_status: e.target.value }))}
              >
                <option value={0}>Running</option>
                <option value={1}>Success (Graduate)</option>
                <option value={-1}>Failed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Active</label>
              <select
                className="input input--select"
                value={String(editForm.is_active)}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Rollout %</label>
              <input
                type="number"
                className="input"
                min="0"
                max="100"
                value={editForm.roll_out_value}
                onChange={(e) => setEditForm((f) => ({ ...f, roll_out_value: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="label">Environment</label>
              <input
                className="input"
                value={editForm.environment || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, environment: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="label">Bucketing Salt</label>
              <input
                className="input"
                value={editForm.salt || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, salt: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="label">Graduated Variant</label>
              <input
                className="input"
                value={editForm.graduated_variant || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, graduated_variant: e.target.value }))}
                placeholder="(when status = Success)"
              />
            </div>
            <div className="form-group form-group--full">
              <label className="label">Hypothesis</label>
              <input
                className="input"
                value={editForm.hypothesis || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, hypothesis: e.target.value }))}
              />
            </div>
          </div>

          <VariantsEditor
            value={editForm.variants}
            onChange={(v) => setEditForm((f) => ({ ...f, variants: v }))}
          />
          <TargetingEditor
            value={editForm.targeting}
            onChange={(t) => setEditForm((f) => ({ ...f, targeting: t }))}
          />
          <PrerequisitesEditor
            value={editForm.prerequisites}
            onChange={(p) => setEditForm((f) => ({ ...f, prerequisites: p }))}
          />

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setEditModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">Save</button>
          </div>
        </form>
      </Modal>

      {/* Clone modal */}
      <Modal open={cloneModal} onClose={() => setCloneModal(false)} title="Clone Experiment">
        <form onSubmit={handleClone}>
          <div className="form-group">
            <label className="label">New Experiment Name</label>
            <input
              className="input"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={`${exp.exp_name}_copy`}
            />
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            All settings (variants, targeting, prerequisites) will be duplicated.
            Item enrollments will not be copied.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setCloneModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">Clone</button>
          </div>
        </form>
      </Modal>

      {/* Evaluate modal */}
      <Modal open={evalModal} onClose={() => setEvalModal(false)} title="Evaluate For Item">
        <form onSubmit={handleEvaluate}>
          <div className="form-group">
            <label className="label">Item ID</label>
            <input
              className="input"
              value={evalForm.item_id}
              onChange={(e) => setEvalForm((f) => ({ ...f, item_id: e.target.value }))}
              placeholder="USER_42"
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Attributes (JSON)</label>
            <textarea
              className="input textarea"
              rows={4}
              value={evalForm.attributes}
              onChange={(e) => setEvalForm((f) => ({ ...f, attributes: e.target.value }))}
              placeholder='{"plan":"pro","country":"US"}'
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setEvalModal(false)}>Close</button>
            <button type="submit" className="btn btn--primary">Run</button>
          </div>
          {evalResult && (
            <div style={{ marginTop: 16 }}>
              <label className="label">Result</label>
              <pre className="json-block">{JSON.stringify(evalResult, null, 2)}</pre>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
