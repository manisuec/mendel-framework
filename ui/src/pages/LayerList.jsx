import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getActiveLayers, createLayer } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

export default function LayerList() {
  const toast = useToast();
  const { data: layers, loading, execute: reload } = useAsync(getActiveLayers, []);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ layer_name: '', salt: '', holdout_percentage: 0 });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createLayer({
        layer_name         : form.layer_name,
        salt               : form.salt || undefined,
        holdout_percentage : Number(form.holdout_percentage) || 0,
      });
      toast('Layer created', 'success');
      setCreateModal(false);
      setForm({ layer_name: '', salt: '', holdout_percentage: 0 });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Layers</h1>
        <button className="btn btn--primary" onClick={() => setCreateModal(true)}>
          + New Layer
        </button>
      </div>

      <p className="text-muted subtitle">
        Layers enforce mutual exclusion — an item can belong to at most one experiment per layer.
        Optionally reserve a holdout slice to measure cumulative experiment lift.
      </p>

      {loading && <div className="loader">Loading...</div>}

      {!loading && (!layers || layers.length === 0) && (
        <EmptyState
          icon={'☰'}
          title="No layers yet"
          message="Create a layer to enforce experiment mutual exclusion."
          action={
            <button className="btn btn--primary" onClick={() => setCreateModal(true)}>
              + New Layer
            </button>
          }
        />
      )}

      {!loading && layers?.length > 0 && (
        <div className="layer-grid">
          {layers.map((layer) => (
            <Link to={`/layers/${layer._id}`} key={layer._id} className="card card--clickable">
              <div className="layer-card-content">
                <div className="layer-icon">{'☰'}</div>
                <div>
                  <h3>{layer.layer_name}</h3>
                  <p className="text-muted text-sm">
                    {layer.is_default ? 'Default layer · ' : ''}
                    {layer.holdout_percentage > 0
                      ? `${layer.holdout_percentage}% holdout`
                      : 'No holdout'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Layer">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="label">Layer Name *</label>
            <input
              className="input"
              value={form.layer_name}
              onChange={(e) => setForm((f) => ({ ...f, layer_name: e.target.value }))}
              placeholder="e.g. onboarding_experiments"
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Bucketing Salt</label>
            <input
              className="input"
              value={form.salt}
              onChange={(e) => setForm((f) => ({ ...f, salt: e.target.value }))}
              placeholder="(defaults to layer name)"
            />
          </div>
          <div className="form-group">
            <label className="label">Holdout %</label>
            <input
              type="number"
              min="0"
              max="100"
              className="input"
              value={form.holdout_percentage}
              onChange={(e) => setForm((f) => ({ ...f, holdout_percentage: e.target.value }))}
              placeholder="0"
            />
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              Percentage of items reserved from every experiment in this layer.
            </p>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setCreateModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={creating || !form.layer_name}>
              {creating ? 'Creating...' : 'Create Layer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
