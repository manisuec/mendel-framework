import { useMemo } from 'react';

const DEFAULT_VARIANTS = () => ([
  { key: 'control',   weight: 50, payload: '' },
  { key: 'treatment', weight: 50, payload: '' },
]);

export default function VariantsEditor({ value, onChange }) {
  const variants = value?.length ? value : DEFAULT_VARIANTS();

  const total = useMemo(
    () => variants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0),
    [variants]
  );

  const update = (i, patch) => {
    const next = variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v));
    onChange(next);
  };

  const add = () => {
    onChange([...variants, { key: `variant_${variants.length}`, weight: 0, payload: '' }]);
  };

  const remove = (i) => {
    onChange(variants.filter((_, idx) => idx !== i));
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <label className="label">Variants</label>
        <span className={`editor-meta ${total === 100 ? '' : 'editor-meta--warn'}`}>
          Total weight: {total}{total !== 100 && ' (weights need not sum to 100, but conventionally do)'}
        </span>
      </div>
      <table className="editor-table">
        <thead>
          <tr>
            <th>Key</th>
            <th style={{ width: 110 }}>Weight</th>
            <th>Payload (JSON)</th>
            <th style={{ width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v, i) => (
            <tr key={i}>
              <td>
                <input
                  className="input input--sm"
                  value={v.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                  placeholder="control"
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  className="input input--sm"
                  value={v.weight}
                  onChange={(e) => update(i, { weight: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  className="input input--sm"
                  value={typeof v.payload === 'string' ? v.payload : JSON.stringify(v.payload)}
                  onChange={(e) => update(i, { payload: e.target.value })}
                  placeholder='{"ui":"streamlined"}'
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
      <button type="button" className="btn btn--sm" onClick={add}>+ Add Variant</button>
    </div>
  );
}

/**
 * Normalize the editor's loose `payload: string` form into the wire format
 * the backend expects. Empty payloads are dropped; invalid JSON is sent as
 * a raw string so the user can see the validation error.
 */
export function normalizeVariants(variants) {
  return (variants || []).map((v) => {
    const out = { key: v.key, weight: Number(v.weight) || 0 };
    if (v.payload !== '' && v.payload !== null && v.payload !== undefined) {
      if (typeof v.payload === 'string') {
        try { out.payload = JSON.parse(v.payload); }
        catch { out.payload = v.payload; }
      } else {
        out.payload = v.payload;
      }
    }
    return out;
  });
}
