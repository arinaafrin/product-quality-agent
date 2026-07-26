import { useEffect, useState } from 'react';
import { getRules } from '../api.js';

export default function RulesView() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRules().then(setRules).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1 className="page-title">Validation rules</h1>
      <p className="page-subtitle">
        The active rule set, generated directly from <code>quality_engine.js</code> so this list
        can never drift from what actually runs.
      </p>
      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
      <table className="failure-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Severity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td className="rule-id">{r.id}</td>
              <td>
                <span className={`severity-tag ${r.severity}`}>{r.severity}</span>
              </td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
