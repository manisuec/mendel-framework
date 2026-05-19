const OPS = [
  'eq', 'neq', 'in', 'nin',
  'gt', 'gte', 'lt', 'lte',
  'contains', 'not_contains', 'starts_with', 'ends_with',
  'regex', 'exists', 'not_exists',
];

const MULTI_VALUE_OPS = new Set(['in', 'nin']);
const NO_VALUE_OPS    = new Set(['exists', 'not_exists']);

export default function TargetingEditor({ value, onChange }) {
  const targeting = value || { rules: [], match: 'all' };
  const rules = targeting.rules || [];

  const update = (patch) => onChange({ ...targeting, ...patch });

  const updateRule = (i, patch) => {
    update({
      rules: rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });
  };

  const addRule = () => {
    update({ rules: [...rules, { attribute: '', op: 'eq', values: '' }] });
  };

  const removeRule = (i) => {
    update({ rules: rules.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <label className="label">Targeting Rules</label>
        <div>
          <span className="editor-meta">Match:</span>
          <select
            className="input input--sm input--select"
            style={{ display: 'inline-block', width: 80, marginLeft: 8 }}
            value={targeting.match || 'all'}
            onChange={(e) => update({ match: e.target.value })}
          >
            <option value="all">all</option>
            <option value="any">any</option>
          </select>
        </div>
      </div>

      {rules.length === 0 && (
        <p className="editor-meta">No rules — experiment is eligible for every item.</p>
      )}

      {rules.length > 0 && (
        <table className="editor-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th style={{ width: 140 }}>Operator</th>
              <th>Value(s)</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="input input--sm"
                    value={r.attribute}
                    onChange={(e) => updateRule(i, { attribute: e.target.value })}
                    placeholder="plan"
                  />
                </td>
                <td>
                  <select
                    className="input input--sm input--select"
                    value={r.op}
                    onChange={(e) => updateRule(i, { op: e.target.value })}
                  >
                    {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </td>
                <td>
                  {NO_VALUE_OPS.has(r.op) ? (
                    <span className="editor-meta">—</span>
                  ) : (
                    <input
                      className="input input--sm"
                      value={Array.isArray(r.values) ? r.values.join(',') : (r.values ?? '')}
                      onChange={(e) => updateRule(i, {
                        values: MULTI_VALUE_OPS.has(r.op)
                          ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          : e.target.value,
                      })}
                      placeholder={MULTI_VALUE_OPS.has(r.op) ? 'pro, enterprise' : 'value'}
                    />
                  )}
                </td>
                <td>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => removeRule(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="btn btn--sm" onClick={addRule}>+ Add Rule</button>
    </div>
  );
}

/**
 * Coerce numeric / boolean string values when the operator demands it.
 */
export function normalizeTargeting(targeting) {
  if (!targeting?.rules?.length) return undefined;

  const NUMERIC = new Set(['gt', 'gte', 'lt', 'lte']);
  const rules = targeting.rules
    .filter((r) => r.attribute && r.op)
    .map((r) => {
      const out = { attribute: r.attribute, op: r.op };
      if (NO_VALUE_OPS.has(r.op)) return out;
      if (NUMERIC.has(r.op) && typeof r.values === 'string') {
        const n = Number(r.values);
        out.values = Number.isFinite(n) ? n : r.values;
      } else {
        out.values = r.values;
      }
      return out;
    });

  return { match: targeting.match || 'all', rules };
}
