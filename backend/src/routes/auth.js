const express = require('express');
const rateLimit = require('express-rate-limit');
const { signToken, tenantIdForApiKey } = require('../auth');

const router = express.Router();

// Deliberately much stricter than the general API limiter: this is the one
// endpoint an attacker would hammer to brute-force an API key, so it gets a
// tight per-IP budget independent of the rest of the app's traffic.
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many token requests. Try again later.' },
});

router.post('/auth/token', tokenLimiter, (req, res) => {
  const apiKey = req.body?.apiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Request body must be { "apiKey": "..." }' });
  }

  const tenantId = tenantIdForApiKey(apiKey);
  if (!tenantId) {
    return res.status(401).json({ error: 'Invalid API key.' });
  }

  const { token, expiresIn } = signToken(tenantId);
  res.json({ token, expiresIn, tokenType: 'Bearer' });
});

module.exports = { router };
