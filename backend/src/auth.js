const jwt = require('jsonwebtoken');

const DEV_FALLBACK_SECRET = 'dev-insecure-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

if (JWT_SECRET === DEV_FALLBACK_SECRET && process.env.NODE_ENV === 'production') {
  // Fail loudly rather than silently running a production deployment with a
  // publicly-known signing secret — anyone could mint their own valid tokens.
  throw new Error(
    'JWT_SECRET must be set via environment in production. Refusing to start with the default dev secret.'
  );
}

/**
 * API_KEYS is a comma-separated `tenantId:apiKey` list, e.g.
 *   API_KEYS=acme:sk_live_9f2c...,demo:sk_demo_1a2b...
 * This keeps the demo self-contained (no user database required) while still
 * modeling a real multi-tenant credential: each caller gets its own key, and
 * every JWT minted from it carries that tenant's id, which is what scopes
 * their data everywhere else in the app.
 */
function loadApiKeyMap() {
  const raw = process.env.API_KEYS || '';
  const map = new Map();
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) return;
      const tenantId = entry.slice(0, separatorIndex).trim();
      const apiKey = entry.slice(separatorIndex + 1).trim();
      if (tenantId && apiKey) map.set(apiKey, tenantId);
    });
  return map;
}

/**
 * @param {string} apiKey
 * @returns {string | null} tenantId, or null if the key is unknown
 */
function tenantIdForApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null;
  return loadApiKeyMap().get(apiKey) || null;
}

/**
 * @param {string} tenantId
 * @returns {{ token: string, expiresIn: string }}
 */
function signToken(tenantId) {
  const token = jwt.sign({ tenantId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, expiresIn: JWT_EXPIRES_IN };
}

/**
 * @param {string} token
 * @returns {{ tenantId: string }}
 * @throws if the token is missing, expired, or has an invalid signature
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware. On success, sets `req.tenantId`. On failure, responds
 * 401 and does not call next().
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>.' });
  }
  try {
    const payload = verifyToken(token);
    if (!payload.tenantId) {
      return res.status(401).json({ error: 'Token is missing a tenant claim.' });
    }
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth, signToken, verifyToken, tenantIdForApiKey, JWT_SECRET };
