import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createExperiment } from '../api';
import { useToast } from '../components/Toast';
import VariantsEditor, { normalizeVariants } from '../components/VariantsEditor';
import TargetingEditor, { normalizeTargeting } from '../components/TargetingEditor';
import PrerequisitesEditor, { normalizePrerequisites } from '../components/PrerequisitesEditor';

const INITIAL = {
  exp_name       : '',
  hypothesis     : '',
  exp_type       : 'general',
  environment    : 'prod',
  salt           : '',
  roll_out_type  : 1,
  roll_out_value : 100,
  start_date     : '',
  end_date       : '',
  item_ids       : '',
  layer_id       : '',
  layer_name     : '',
  app_version    : '',
  variants       : [
    { key: 'control',   weight: 50, payload: '' },
    { key: 'treatment', weight: 50, payload: '' },
  ],
  targeting      : { rules: [], match: 'all' },
  prerequisites  : [],
};

export default function ExperimentForm() {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        exp_name       : form.exp_name,
        hypothesis     : form.hypothesis || undefined,
        exp_type       : form.exp_type,
        environment    : form.environment || undefined,
        salt           : form.salt || undefined,
        roll_out_type  : Number(form.roll_out_type),
        roll_out_value : form.roll_out_value !== '' && form.roll_out_value !== null
          ? Number(form.roll_out_value)
          : undefined,
        start_date     : form.start_date ? new Date(form.start_date).getTime() : undefined,
        end_date       : form.end_date   ? new Date(form.end_date).getTime()   : undefined,
        item_ids       : form.item_ids
          ? form.item_ids.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        layer_id       : form.layer_id   || undefined,
        layer_name     : form.layer_name || undefined,
        app_version    : form.app_version || undefined,
        variants       : normalizeVariants(form.variants),
        targeting      : normalizeTargeting(form.targeting),
        prerequisites  : normalizePrerequisites(form.prerequisites),
      };
      const result = await createExperiment(body);
      toast('Experiment created successfully', 'success');
      navigate(`/experiments/${result._id}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>New Experiment</h1>
      </div>

      <form onSubmit={handleSubmit} className="form card">
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Experiment Name *</label>
            <input
              className="input"
              value={form.exp_name}
              onChange={(e) => set('exp_name', e.target.value)}
              placeholder="exp_my_feature"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Hypothesis</label>
            <input
              className="input"
              value={form.hypothesis}
              onChange={(e) => set('hypothesis', e.target.value)}
              placeholder="Enabling X will increase Y by Z%"
            />
          </div>

          <div className="form-group">
            <label className="label">Type</label>
            <select
              className="input input--select"
              value={form.exp_type}
              onChange={(e) => set('exp_type', e.target.value)}
            >
              <option value="general">General</option>
              <option value="flag">Flag</option>
              <option value="banner">Banner</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Environment</label>
            <input
              className="input"
              value={form.environment}
              onChange={(e) => set('environment', e.target.value)}
              placeholder="prod, staging, dev…"
            />
          </div>

          <div className="form-group">
            <label className="label">Rollout Type *</label>
            <select
              className="input input--select"
              value={form.roll_out_type}
              onChange={(e) => set('roll_out_type', e.target.value)}
            >
              <option value={1}>Feature Flag (explicit enrollment)</option>
              <option value={0}>A/B Testing (deterministic bucketing)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Rollout %</label>
            <input
              type="number"
              className="input"
              min="0"
              max="100"
              value={form.roll_out_value ?? ''}
              onChange={(e) => set('roll_out_value', e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="form-group">
            <label className="label">Bucketing Salt</label>
            <input
              className="input"
              value={form.salt}
              onChange={(e) => set('salt', e.target.value)}
              placeholder="(defaults to experiment name)"
            />
          </div>

          <div className="form-group">
            <label className="label">App Version</label>
            <input
              className="input"
              value={form.app_version}
              onChange={(e) => set('app_version', e.target.value)}
              placeholder="e.g. 2.0.0"
            />
          </div>

          <div className="form-group">
            <label className="label">Start Date</label>
            <input
              type="datetime-local"
              className="input"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">End Date</label>
            <input
              type="datetime-local"
              className="input"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
            />
          </div>

          <div className="form-group form-group--full">
            <label className="label">Initial Item IDs (comma-separated)</label>
            <input
              className="input"
              value={form.item_ids}
              onChange={(e) => set('item_ids', e.target.value)}
              placeholder="USER_123, ORG_456"
            />
          </div>

          <div className="form-group">
            <label className="label">Layer ID</label>
            <input
              className="input"
              value={form.layer_id}
              onChange={(e) => set('layer_id', e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label className="label">Layer Name</label>
            <input
              className="input"
              value={form.layer_name}
              onChange={(e) => set('layer_name', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <VariantsEditor
          value={form.variants}
          onChange={(v) => set('variants', v)}
        />

        <TargetingEditor
          value={form.targeting}
          onChange={(t) => set('targeting', t)}
        />

        <PrerequisitesEditor
          value={form.prerequisites}
          onChange={(p) => set('prerequisites', p)}
        />

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => navigate('/experiments')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !form.exp_name}
          >
            {submitting ? 'Creating...' : 'Create Experiment'}
          </button>
        </div>
      </form>
    </div>
  );
}
