const jwt = require('jsonwebtoken');

const DEV_FALLBACK_SECRET = 'dev-insecure-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

if (JWT_SECRET === DEV_FALLBACK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'JWT_SECRET must be set via environment in production. Refusing to start with the default dev secret.'
  );
}

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
 * @returns {string | null} 
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
 * @throws 
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

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
