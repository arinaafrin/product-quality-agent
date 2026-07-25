const express = require('express');
const { ask } = require('../agent');

const router = express.Router();

router.post('/ask', async (req, res) => {
  const question = req.body?.question;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Request body must be { "question": "..." }' });
  }
  try {
    const result = await ask(question);
    res.json(result);
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'The agent failed to respond. Check server logs.' });
  }
});

module.exports = { router };
