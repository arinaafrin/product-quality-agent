const express = require('express');
const path = require('path');
const { validateFeed, getRuleDocs } = require('../quality_engine');
const { ragStore } = require('../rag_store');
const { getIO } = require('../realtime');

const router = express.Router();
const runHistory = [];
const MAX_HISTORY = 20;
const PROGRESS_BATCH_SIZE = 5;

router.get('/sample-feed.csv', (_req, res) => {
  res.download(path.join(__dirname, '../data/sample_feed.csv'), 'sample_feed.csv');
});

router.get('/sample-feed.json', (_req, res) => {
  res.download(path.join(__dirname, '../data/sample_feed.json'), 'sample_feed.json');
});

router.post('/validate', (req, res) => {
  const records = req.body?.records;
  const jobId = req.body?.jobId;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Request body must be { "records": [...] }' });
  }
  const io = jobId ? getIO() : null;
  let batch = [];

  const summary = validateFeed(records, (result, index, total) => {
    if (!io) return;
    try {
      batch.push(result);
      const isLastRecord = index === total - 1;
      if (batch.length >= PROGRESS_BATCH_SIZE || isLastRecord) {
        io.to(jobId).emit('validation:progress', {
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
    io.to(jobId).emit('validation:complete', {
      jobId,
      total: summary.total,
      passed: summary.passed,
      rejected: summary.rejected,
      timestamp: summary.timestamp,
    });
  }

  ragStore.ingestValidationRun(summary);
  runHistory.unshift(summary);
  if (runHistory.length > MAX_HISTORY) runHistory.pop();
  res.json(summary);
});

router.get('/runs', (_req, res) => {
  res.json(runHistory.map(({ results, ...rest }) => rest)); 
});

router.get('/runs/latest', (_req, res) => {
  if (runHistory.length === 0) return res.status(404).json({ error: 'No validation runs yet.' });
  res.json(runHistory[0]);
});

router.get('/rules', (_req, res) => {
  res.json(getRuleDocs());
});

module.exports = { router, runHistory };
