import { useState } from 'react';
import { validateFeed, subscribeToValidationProgress, downloadSampleFeed } from '../api.js';
import ManifestStrip from './ManifestStrip.jsx';
import FailureTable from './FailureTable.jsx';


const SAMPLE_HINT = 'backend/src/data/sample_feed.json';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [progress, setProgress] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  async function handleDownload(format) {
    setDownloadError(null);
    try {
      await downloadSampleFeed(format);
    } catch (err) {
      setDownloadError(err.message || `Could not download the sample ${format.toUpperCase()} feed.`);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const originalName = file.name;
    setFileName(originalName);
    setError(null);
    setLoading(true);
    setProgress(null);

    if (!originalName.toLowerCase().endsWith('.json')) {
      setError('Invalid file extension. Please upload a file ending in .json');
      setLoading(false);
      return;
    }

    const jobId = crypto.randomUUID();
    const unsubscribe = subscribeToValidationProgress(jobId, {
      onProgress: ({ processed, total }) => setProgress({ processed, total }),
    });

    try {
      const text = await file.text();

      if (text.trim().startsWith('<')) {
        throw new Error('This file contains HTML code, not valid JSON records.');
      }

      const records = JSON.parse(text);
      const result = await validateFeed(Array.isArray(records) ? records : records.records || [], {
        jobId,
      });
      setSummary(result);
    } catch (err) {
      setError(err.message || 'Could not parse this file. Ensure it is formatted as a valid JSON array.');
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
        <button type="button" className="secondary-btn" onClick={() => handleDownload('json')}>
          Download sample JSON
        </button>
        <button type="button" className="secondary-btn" onClick={() => handleDownload('csv')}>
          Download sample CSV
        </button>
      </div>
      {downloadError && (
        <p role="alert" className="download-error">
          {downloadError}
        </p>
      )}

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
