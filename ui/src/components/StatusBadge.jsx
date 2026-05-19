const STATUS_MAP = {
  '-1': { label: 'Failed',  className: 'badge--danger' },
  '0':  { label: 'Running', className: 'badge--info' },
  '1':  { label: 'Success', className: 'badge--success' },
};

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[String(status)] || {
    label: `Custom (${status})`,
    className: 'badge--warn',
  };

  return <span className={`badge ${s.className}`}>{s.label}</span>;
}
