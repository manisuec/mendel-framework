import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLayer, assignToLayer, listExperiments } from '../api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function LayerDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: layer, loading, execute: reload } = useAsync(
    () => getLayer(id),
    [id]
  );
  const [assignModal, setAssignModal] = useState(false);
  const [allExps, setAllExps] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [assigning, setAssigning] = useState(false);

  const openAssign = async () => {
    try {
      const result = await listExperiments({ limit: 200 });
      setAllExps(result.docs || []);
      const current = new Set((layer.experiments || []).map(e => e._id));
      setSelected(current);
      setAssignModal(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleExp = (expId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(expId)) next.delete(expId);
      else next.add(expId);
      return next;
    });
  };

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await assignToLayer(id, [...selected]);
      toast('Experiments assigned to layer', 'success');
      setAssignModal(false);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <div className="loader">Loading...</div>;
  if (!layer) return <div className="loader">Layer not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/layers" className="breadcrumb">Layers</Link>
          <h1>{layer.layer_name}</h1>
        </div>
        <button className="btn btn--primary" onClick={openAssign}>
          Manage Experiments
        </button>
      </div>

      <div className="stat-grid stat-grid--3">
        <div className="card stat-card">
          <div className="stat-label">Experiments in Layer</div>
          <div className="stat-value stat-number">{layer.experiments?.length || 0}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Holdout</div>
          <div className="stat-value stat-number">{layer.holdout_percentage || 0}%</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Default</div>
          <div className="stat-value">{layer.is_default ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div className="card">
        <h3>Details</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">ID</span>
            <span className="detail-value monospace">{layer._id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Salt</span>
            <span className="detail-value monospace">{layer.salt || layer.layer_name}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Experiments</h3>
        {(!layer.experiments || layer.experiments.length === 0) && (
          <div className="empty-inline">No experiments assigned to this layer.</div>
        )}
        {layer.experiments?.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Experiment Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {layer.experiments.map(exp => (
                <tr key={exp._id}>
                  <td>
                    <Link to={`/experiments/${exp._id}`} className="link">
                      {exp.exp_name}
                    </Link>
                  </td>
                  <td className="monospace text-muted">{exp._id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title={`Assign Experiments to "${layer.layer_name}"`}
      >
        <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
          Select which experiments should enforce mutual exclusion within this layer.
        </p>
        <div className="checkbox-list">
          {allExps.map(exp => (
            <label key={exp._id} className="checkbox-item">
              <input
                type="checkbox"
                checked={selected.has(exp._id)}
                onChange={() => toggleExp(exp._id)}
              />
              <span>{exp.exp_name}</span>
            </label>
          ))}
        </div>
        {allExps.length === 0 && (
          <div className="empty-inline">No experiments available.</div>
        )}
        <div className="form-actions">
          <button className="btn" onClick={() => setAssignModal(false)}>Cancel</button>
          <button
            className="btn btn--primary"
            onClick={handleAssign}
            disabled={assigning}
          >
            {assigning ? 'Saving...' : `Assign ${selected.size} Experiments`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
