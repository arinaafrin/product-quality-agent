import { useState } from 'react';
import { validateFeed, subscribeToValidationProgress } from '../api.js';
import ManifestStrip from './ManifestStrip.jsx';
import FailureTable from './FailureTable.jsx';

const SAMPLE_HINT = 'backend/src/data/sample_feed.json';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [progress, setProgress] = useState(null); 

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setLoading(true);
    setProgress(null);

    const jobId = crypto.randomUUID();
    const unsubscribe = subscribeToValidationProgress(jobId, {
      onProgress: ({ processed, total }) => setProgress({ processed, total }),
    });

    try {
      const text = await file.text();
      const records = JSON.parse(text);
      const result = await validateFeed(Array.isArray(records) ? records : records.records || [], {
        jobId,
      });
      setSummary(result);
    } catch (err) {
      setError(err.message || 'Could not read that file as a JSON product feed.');
    } finally {
      setLoading(false);
      setProgress(null);
      unsubscribe();
    }
  }

  return (
    <>
      <h1 className="page-title">Feed manifest</h1>
      <p className="page-subtitle">
        Upload a product feed export (JSON array of records) to validate it against the current
        rule set. Every record becomes one tick in the manifest below — hover a tick to see why
        it passed, warned, or was rejected. Try the sample at <code>{SAMPLE_HINT}</code>.
      </p>

      <div className="uploader">
        <label className="primary-btn" htmlFor="feed-upload" style={{ cursor: 'pointer' }}>
          {loading ? 'Validating…' : 'Upload feed (.json)'}
        </label>
        <input
          id="feed-upload"
          type="file"
          accept="application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {fileName && <span className="file-label">{fileName}</span>}
        <a className="secondary-btn" href="/api/sample-feed.json" download="sample_feed.json">
          Download sample JSON
        </a>
        <a className="secondary-btn" href="/api/sample-feed.csv" download="sample_feed.csv">
          Download sample CSV
        </a>
      </div>

      {loading && progress && (
        <div className="progress-row" role="status" aria-live="polite" style={{ marginTop: -18, marginBottom: 24 }}>
          <div
            style={{
              height: 6,
              borderRadius: 4,
              background: 'var(--border, #e2e2e2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round((progress.processed / progress.total) * 100)}%`,
                background: 'var(--ok, #2f9e44)',
                transition: 'width 120ms ease-out',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted, #666)' }}>
            Validated {progress.processed} of {progress.total} records — live over Socket.IO
          </span>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--error)', marginTop: -18, marginBottom: 24, fontSize: 13 }}>
          {error}
        </p>
      )}

      {summary && (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <div className="num">{summary.total}</div>
              <div className="label">Records</div>
            </div>
            <div className="stat-card ok">
              <div className="num">{summary.passed}</div>
              <div className="label">Passed</div>
            </div>
            <div className="stat-card error">
              <div className="num">{summary.rejected}</div>
              <div className="label">Rejected</div>
            </div>
          </div>

          <div className="manifest">
            <div className="manifest-heading">
              <h2>Manifest — run at {new Date(summary.timestamp).toLocaleString()}</h2>
              <time>{summary.results.length} ticks</time>
            </div>
            <ManifestStrip results={summary.results} />
          </div>

          <FailureTable results={summary.results} />
        </>
      )}

      {!summary && !loading && (
        <p className="manifest-empty">No feed validated yet — upload a JSON file to get started.</p>
      )}
    </>
  );
}
