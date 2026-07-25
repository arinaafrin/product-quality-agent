const express = require('express');
const { validateFeed, getRuleDocs } = require('../quality_engine');
const { ragStore } = require('../rag_store');

const router = express.Router();
const runHistory = [];
const MAX_HISTORY = 20;

router.post('/validate', (req, res) => {
  const records = req.body?.records;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Request body must be { "records": [...] }' });
  }
  const summary = validateFeed(records);
  ragStore.ingestValidationRun(summary);
  runHistory.unshift(summary);
  if (runHistory.length > MAX_HISTORY) runHistory.pop();
  res.json(summary);
});

router.get('/runs', (_req, res) => {
  res.json(runHistory.map(({ results, ...rest }) => rest)); // list view: omit full record dump
});

router.get('/runs/latest', (_req, res) => {
  if (runHistory.length === 0) return res.status(404).json({ error: 'No validation runs yet.' });
  res.json(runHistory[0]);
});

router.get('/rules', (_req, res) => {
  res.json(getRuleDocs());
});

module.exports = { router, runHistory };
