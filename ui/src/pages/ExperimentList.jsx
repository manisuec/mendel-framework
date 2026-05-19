import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listExperiments } from '../api';
import { useAsync } from '../hooks/useAsync';
import StatusBadge from '../components/StatusBadge';
import RolloutBadge from '../components/RolloutBadge';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';

export default function ExperimentList() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});

  const { data, loading, execute } = useAsync(
    () => listExperiments({ page, limit: 20, exp_name: search, ...filters }),
    [page, search, filters]
  );

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    execute();
  };

  const handleFilterChange = (key, value) => {
    setPage(0);
    const next = { ...filters };
    if (value === '' || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setFilters(next);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Experiments</h1>
        <Link to="/experiments/new" className="btn btn--primary">
          + New Experiment
        </Link>
      </div>

      <div className="toolbar">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
          <button type="submit" className="btn">Search</button>
        </form>

        <div className="filter-group">
          <select
            className="input input--select"
            value={filters.is_active ?? ''}
            onChange={(e) => handleFilterChange('is_active', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">All States</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <select
            className="input input--select"
            value={filters.success_status ?? ''}
            onChange={(e) => handleFilterChange('success_status', e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">All Statuses</option>
            <option value="0">Running</option>
            <option value="1">Success</option>
            <option value="-1">Failed</option>
          </select>

          <select
            className="input input--select"
            value={filters.roll_out_type ?? ''}
            onChange={(e) => handleFilterChange('roll_out_type', e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">All Types</option>
            <option value="0">A/B Testing</option>
            <option value="1">Feature Flag</option>
          </select>

          <input
            type="text"
            className="input"
            placeholder="environment (e.g. prod)"
            style={{ width: 180 }}
            value={filters.environment ?? ''}
            onChange={(e) => handleFilterChange('environment', e.target.value || undefined)}
          />
        </div>
      </div>

      {loading && <div className="loader">Loading...</div>}

      {!loading && data?.docs?.length === 0 && (
        <EmptyState
          title="No experiments found"
          message="Create your first experiment to get started."
          action={
            <Link to="/experiments/new" className="btn btn--primary">
              + New Experiment
            </Link>
          }
        />
      )}

      {!loading && data?.docs?.length > 0 && (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Env</th>
                  <th>Type</th>
                  <th>Rollout</th>
                  <th>Variants</th>
                  <th>Status</th>
                  <th>Active</th>
                  <th>Layer</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.docs.map((exp) => (
                  <tr key={exp._id}>
                    <td>
                      <Link to={`/experiments/${exp._id}`} className="link">
                        {exp.exp_name}
                      </Link>
                    </td>
                    <td className="text-muted">{exp.environment || 'prod'}</td>
                    <td className="text-muted">{exp.exp_type || 'general'}</td>
                    <td>
                      <RolloutBadge type={exp.roll_out_type} value={exp.roll_out_value} />
                    </td>
                    <td className="text-muted">{exp.variants?.length ?? 0}</td>
                    <td><StatusBadge status={exp.success_status} /></td>
                    <td>
                      <span className={`dot ${exp.is_active ? 'dot--green' : 'dot--red'}`} />
                    </td>
                    <td className="text-muted">{exp.layer_name || '—'}</td>
                    <td>
                      <Link to={`/experiments/${exp._id}`} className="btn btn--sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
