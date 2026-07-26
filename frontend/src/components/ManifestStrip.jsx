export default function ManifestStrip({ results }) {
  if (!results || results.length === 0) {
    return <p className="manifest-empty">Nothing to show yet.</p>;
  }

  return (
    <div className="manifest-strip" role="list" aria-label="Validation results per record">
      {results.map((r) => {
        const title =
          r.failures.length === 0
            ? `${r.sku || `record ${r.index}`}: passed`
            : `${r.sku || `record ${r.index}`}: ${r.failures.map((f) => f.message).join(' ')}`;
        return (
          <div
            key={r.index}
            role="listitem"
            className={`manifest-tick ${r.status}`}
            title={title}
            tabIndex={0}
          />
        );
      })}
    </div>
  );
}
