export default function FailureTable({ results }) {
  const flagged = results.filter((r) => r.failures.length > 0);

  if (flagged.length === 0) {
    return <p className="manifest-empty">Every record passed with no warnings. Nothing to review.</p>;
  }

  return (
    <table className="failure-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Title</th>
          <th>Rule</th>
          <th>Severity</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {flagged.flatMap((r) =>
          r.failures.map((f, i) => (
            <tr key={`${r.index}-${i}`}>
              <td className="sku-cell">{r.sku || '—'}</td>
              <td>{r.title || <em>untitled</em>}</td>
              <td className="rule-id">{f.ruleId}</td>
              <td>
                <span className={`severity-tag ${f.severity}`}>{f.severity}</span>
              </td>
              <td>{f.message}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
