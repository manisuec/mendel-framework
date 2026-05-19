import { useState } from 'react';
import {
  listItems, addItems, addItemsBulk, removeItem, updateItem, forceAssign,
} from '../api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';

const BULK_THRESHOLD = 200;

export default function ItemManager({ expId, expName, variants = [], onCountChange }) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [searchId, setSearchId] = useState('');
  const [variantFilter, setVariantFilter] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [newItems, setNewItems] = useState('');
  const [addVariant, setAddVariant] = useState('');
  const [addForced, setAddForced] = useState(false);
  const [adding, setAdding] = useState(false);

  const [forceModal, setForceModal] = useState(false);
  const [forceForm, setForceForm] = useState({ item_id: '', variant_key: '' });

  const params = { page, limit: 20 };
  if (searchId) params.item_id = searchId;
  if (variantFilter) params.variant_key = variantFilter;

  const { data, loading, execute: reload } = useAsync(
    () => listItems(expId, params),
    [expId, page, searchId, variantFilter]
  );

  const defaultVariant = variants.find((v) => v.key !== 'control')?.key
    || variants[0]?.key
    || '';

  const openAdd = () => {
    setAddVariant(defaultVariant);
    setAddForced(false);
    setNewItems('');
    setAddModal(true);
  };

  const openForce = () => {
    setForceForm({ item_id: '', variant_key: defaultVariant });
    setForceModal(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const ids = newItems.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      if (!ids.length) return;

      const opts = {
        ...(addVariant ? { variant_key: addVariant } : {}),
        ...(addForced  ? { forced: true } : {}),
      };
      const fn = ids.length >= BULK_THRESHOLD ? addItemsBulk : addItems;
      const result = await fn(expId, ids, opts);
      const skipped = result.filtered_items?.length || 0;
      toast(
        `Added ${ids.length - skipped} items${skipped ? ` (${skipped} skipped — already in this layer)` : ''}`,
        'success'
      );
      setAddModal(false);
      setNewItems('');
      reload();
      onCountChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleForceAssign = async (e) => {
    e.preventDefault();
    try {
      await forceAssign(expName, forceForm.item_id, forceForm.variant_key);
      toast(`Forced ${forceForm.item_id} → ${forceForm.variant_key}`, 'success');
      setForceModal(false);
      reload();
      onCountChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleRemove = async (itemId) => {
    if (!confirm(`Remove item "${itemId}" from this experiment?`)) return;
    try {
      await removeItem(expId, itemId);
      toast('Item removed', 'success');
      reload();
      onCountChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleToggle = async (record) => {
    try {
      await updateItem(record._id, { is_active: !record.is_active });
      toast(`Item ${record.is_active ? 'deactivated' : 'activated'}`, 'success');
      reload();
      onCountChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleChangeVariant = async (record, newVariant) => {
    try {
      await updateItem(record._id, { variant_key: newVariant });
      toast(`Variant set to ${newVariant}`, 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Items</h3>
        <div className="card-header-actions">
          <form
            className="search-form search-form--sm"
            onSubmit={(e) => { e.preventDefault(); setPage(0); reload(); }}
          >
            <input
              type="text"
              className="input input--sm"
              placeholder="Filter by item ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
          </form>
          <select
            className="input input--sm input--select"
            value={variantFilter}
            onChange={(e) => { setVariantFilter(e.target.value); setPage(0); }}
          >
            <option value="">All variants</option>
            {variants.map((v) => (
              <option key={v.key} value={v.key}>{v.key}</option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={openForce}>
            Force Assign
          </button>
          <button className="btn btn--primary btn--sm" onClick={openAdd}>
            + Add Items
          </button>
        </div>
      </div>

      {loading && <div className="loader">Loading...</div>}

      {!loading && data?.docs?.length === 0 && (
        <div className="empty-inline">No items enrolled yet.</div>
      )}

      {!loading && data?.docs?.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Variant</th>
                <th>Active</th>
                <th>Forced</th>
                <th>Enrolled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.docs.map((item) => (
                <tr key={item._id}>
                  <td className="monospace">{item.item_id}</td>
                  <td>
                    {variants.length > 0 ? (
                      <select
                        className="input input--sm input--select"
                        value={item.variant_key || ''}
                        onChange={(e) => handleChangeVariant(item, e.target.value)}
                        style={{ minWidth: 120 }}
                      >
                        <option value="">—</option>
                        {variants.map((v) => (
                          <option key={v.key} value={v.key}>{v.key}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`variant-badge ${item.variant_key === 'control' ? 'variant-badge--control' : ''}`}>
                        {item.variant_key || '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`toggle ${item.is_active ? 'toggle--on' : 'toggle--off'}`}
                      onClick={() => handleToggle(item)}
                      title={item.is_active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {item.is_active ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td>
                    {item.forced ? <span className="variant-badge variant-badge--forced">forced</span> : '—'}
                  </td>
                  <td className="text-muted">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => handleRemove(item.item_id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Add items */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={`Add Items to ${expName}`}>
        <form onSubmit={handleAdd}>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Variant</label>
              <select
                className="input input--select"
                value={addVariant}
                onChange={(e) => setAddVariant(e.target.value)}
              >
                {variants.map((v) => (
                  <option key={v.key} value={v.key}>{v.key}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Forced override</label>
              <label className="checkbox-item" style={{ border: 'none', padding: 0 }}>
                <input
                  type="checkbox"
                  checked={addForced}
                  onChange={(e) => setAddForced(e.target.checked)}
                />
                <span>Pin variant (wins over bucketing)</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Item IDs (one per line or comma-separated)</label>
            <textarea
              className="input textarea"
              rows={8}
              value={newItems}
              onChange={(e) => setNewItems(e.target.value)}
              placeholder={"USER_001\nORG_002\nUSER_003"}
            />
          </div>
          <p className="text-muted text-sm">
            Items already in the same layer will be skipped. Batches of {BULK_THRESHOLD}+
            items are submitted via the bulk endpoint.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setAddModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={adding || !newItems.trim()}>
              {adding ? 'Adding...' : 'Add Items'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Force assign */}
      <Modal open={forceModal} onClose={() => setForceModal(false)} title="Force Assign Variant">
        <form onSubmit={handleForceAssign}>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Pin a specific item to a specific variant. The assignment overrides
            targeting and bucketing for that item.
          </p>
          <div className="form-group">
            <label className="label">Item ID</label>
            <input
              className="input"
              value={forceForm.item_id}
              onChange={(e) => setForceForm((f) => ({ ...f, item_id: e.target.value }))}
              placeholder="USER_42"
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Variant</label>
            <select
              className="input input--select"
              value={forceForm.variant_key}
              onChange={(e) => setForceForm((f) => ({ ...f, variant_key: e.target.value }))}
              required
            >
              <option value="">Select variant…</option>
              {variants.map((v) => (
                <option key={v.key} value={v.key}>{v.key}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setForceModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">Assign</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
