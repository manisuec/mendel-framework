import { Link } from 'react-router-dom';
import { listExperiments, getActiveLayers } from '../api';
import { useAsync } from '../hooks/useAsync';

export default function Dashboard() {
  const { data: expData, loading: loadingExp } = useAsync(
    () => listExperiments({ limit: 200 }),
    []
  );
  const { data: layers, loading: loadingLayers } = useAsync(getActiveLayers, []);

  const experiments = expData?.docs || [];
  const loading = loadingExp || loadingLayers;

  const running  = experiments.filter(e => e.success_status === 0 && e.is_active);
  const success  = experiments.filter(e => e.success_status === 1);
  const failed   = experiments.filter(e => e.success_status === -1);
  const inactive = experiments.filter(e => !e.is_active);
  const abTests  = experiments.filter(e => e.roll_out_type === 0);
  const flags    = experiments.filter(e => e.roll_out_type === 1);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/experiments/new" className="btn btn--primary">
          + New Experiment
        </Link>
      </div>

      {loading && <div className="loader">Loading...</div>}

      {!loading && (
        <>
          {/* Stats row */}
          <div className="stat-grid stat-grid--4">
            <div className="card stat-card stat-card--accent">
              <div className="stat-number">{experiments.length}</div>
              <div className="stat-label">Total Experiments</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number stat-number--running">{running.length}</div>
              <div className="stat-label">Running</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number stat-number--success">{success.length}</div>
              <div className="stat-label">Graduated</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number stat-number--danger">{failed.length}</div>
              <div className="stat-label">Failed</div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="stat-grid stat-grid--3">
            <div className="card stat-card">
              <div className="stat-number">{abTests.length}</div>
              <div className="stat-label">A/B Tests</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">{flags.length}</div>
              <div className="stat-label">Feature Flags</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">{layers?.length || 0}</div>
              <div className="stat-label">Active Layers</div>
            </div>
          </div>

          {/* Recent running experiments */}
          <div className="card">
            <div className="card-header">
              <h3>Running Experiments</h3>
              <Link to="/experiments" className="btn btn--sm">View All</Link>
            </div>
            {running.length === 0 && (
              <div className="empty-inline">No experiments currently running.</div>
            )}
            {running.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Rollout</th>
                    <th>Layer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {running.slice(0, 10).map(exp => (
                    <tr key={exp._id}>
                      <td>
                        <Link to={`/experiments/${exp._id}`} className="link">
                          {exp.exp_name}
                        </Link>
                      </td>
                      <td className="text-muted">{exp.exp_type || 'general'}</td>
                      <td>
                        {exp.roll_out_type === 0
                          ? `A/B ${exp.roll_out_value ?? 0}%`
                          : 'Feature Flag'}
                      </td>
                      <td className="text-muted">{exp.layer_name || '—'}</td>
                      <td>
                        <Link to={`/experiments/${exp._id}`} className="btn btn--sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Inactive warning */}
          {inactive.length > 0 && (
            <div className="card card--warn">
              <h4>{inactive.length} inactive experiment{inactive.length > 1 ? 's' : ''}</h4>
              <p className="text-muted text-sm">
                These experiments are deactivated and no longer enrolling items.
                Consider cleaning them up.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
