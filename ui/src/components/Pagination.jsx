export default function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="btn btn--sm"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </button>
      <span className="pagination-info">
        Page {page + 1} of {totalPages} ({total} total)
      </span>
      <button
        className="btn btn--sm"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
