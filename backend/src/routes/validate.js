const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateFeed, getRuleDocs, activeEngine } = require('../quality_engine');
const { ragStore } = require('../rag_store');
const { getIO, roomName } = require('../realtime');
const { requireAuth } = require('../auth');
const { validateBodySchema, validateBody } = require('../validation');

const router = express.Router();

const SAMPLE_FEEDS = {
  product: { json: 'sample_feed.json', csv: 'sample_feed.csv' },
  invoice: { json: 'sample_invoice_feed.json', csv: 'sample_invoice_feed.csv' },
};

function sampleFeedPath(format) {
  const files = SAMPLE_FEEDS[activeEngine] || SAMPLE_FEEDS.product;
  const filename = files[format];
  const fullPath = path.join(__dirname, '../data', filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

const runHistoryByTenant = new Map();
const MAX_HISTORY = 20;
const PROGRESS_BATCH_SIZE = 5;

function getHistory(tenantId) {
  if (!runHistoryByTenant.has(tenantId)) runHistoryByTenant.set(tenantId, []);
  return runHistoryByTenant.get(tenantId);
}

router.get('/sample-feed.csv', requireAuth, (_req, res) => {
  const filePath = sampleFeedPath('csv');
  if (!filePath) return res.status(404).json({ error: `No sample CSV feed for engine "${activeEngine}".` });
  res.download(filePath, path.basename(filePath));
});

router.get('/sample-feed.json', requireAuth, (_req, res) => {
  const filePath = sampleFeedPath('json');
  if (!filePath) return res.status(404).json({ error: `No sample JSON feed for engine "${activeEngine}".` });
  res.download(filePath, path.basename(filePath));
});

router.post('/validate', requireAuth, validateBody(validateBodySchema), (req, res) => {
  const { records, jobId } = req.body;
  const { tenantId } = req;
  const io = jobId ? getIO() : null;
  const room = jobId ? roomName(tenantId, jobId) : null;
  let batch = [];

  const summary = validateFeed(records, (result, index, total) => {
    if (!io) return;
    try {
      batch.push(result);
      const isLastRecord = index === total - 1;
      if (batch.length >= PROGRESS_BATCH_SIZE || isLastRecord) {
        io.to(room).emit('validation:progress', {
          jobId,
          processed: index + 1,
          total,
          batch,
        });
        batch = [];
      }
    } catch (err) {
      console.error('[validate] progress emit failed:', err.message);
    }
  });

  if (io) {
    io.to(room).emit('validation:complete', {
      jobId,
      total: summary.total,
      passed: summary.passed,
      rejected: summary.rejected,
      timestamp: summary.timestamp,
    });
  }

  ragStore.ingestValidationRun(summary);
  const history = getHistory(tenantId);
  history.unshift(summary);
  if (history.length > MAX_HISTORY) history.pop();
  res.json(summary);
});

router.get('/runs', requireAuth, (req, res) => {
  const history = getHistory(req.tenantId);
  res.json(history.map(({ results: _results, ...rest }) => rest));
});

router.get('/runs/latest', requireAuth, (req, res) => {
  const history = getHistory(req.tenantId);
  if (history.length === 0) return res.status(404).json({ error: 'No validation runs yet.' });
  res.json(history[0]);
});

router.get('/rules', requireAuth, (_req, res) => {
  res.json(getRuleDocs());
});

module.exports = { router, runHistoryByTenant };
