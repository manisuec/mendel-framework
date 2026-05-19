export default function PrerequisitesEditor({ value, onChange }) {
  const prereqs = value || [];

  const update = (i, patch) => {
    onChange(prereqs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const add = () => onChange([...prereqs, { exp_name: '', variant: '' }]);
  const remove = (i) => onChange(prereqs.filter((_, idx) => idx !== i));

  return (
    <div className="editor">
      <div className="editor-header">
        <label className="label">Prerequisites</label>
        <span className="editor-meta">
          This experiment only fires when the items already match these other experiments.
        </span>
      </div>

      {prereqs.length === 0 && (
        <p className="editor-meta">None — experiment has no dependencies.</p>
      )}

      {prereqs.length > 0 && (
        <table className="editor-table">
          <thead>
            <tr>
              <th>Experiment Name</th>
              <th>Required Variant</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {prereqs.map((p, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="input input--sm"
                    value={p.exp_name}
                    onChange={(e) => update(i, { exp_name: e.target.value })}
                    placeholder="exp_other_feature"
                  />
                </td>
                <td>
                  <input
                    className="input input--sm"
                    value={p.variant ?? ''}
                    onChange={(e) => update(i, { variant: e.target.value })}
                    placeholder="(any non-control)"
                  />
                </td>
                <td>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="btn btn--sm" onClick={add}>+ Add Prerequisite</button>
    </div>
  );
}

export function normalizePrerequisites(prereqs) {
  return (prereqs || [])
    .filter((p) => p.exp_name)
    .map((p) => ({ exp_name: p.exp_name, variant: p.variant || null }));
}
