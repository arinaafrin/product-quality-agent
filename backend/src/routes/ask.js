const express = require('express');
const { ask } = require('../agent');
const { requireAuth } = require('../auth');
const { askBodySchema, validateBody } = require('../validation');

const router = express.Router();

router.post('/ask', requireAuth, validateBody(askBodySchema), async (req, res) => {
  const { question } = req.body;
  try {
    const result = await ask(question);
    res.json(result);
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: 'The agent failed to respond. Check server logs.' });
  }
});

module.exports = { router };
