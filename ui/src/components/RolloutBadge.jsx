export default function RolloutBadge({ type, value }) {
  if (type === 1) {
    return <span className="badge badge--neutral">Feature Flag</span>;
  }
  return (
    <span className="badge badge--info">
      A/B {value != null ? `${value}%` : ''}
    </span>
  );
}
