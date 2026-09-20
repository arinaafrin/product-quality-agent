/**
 * ALLOWED_ORIGINS is a comma-separated list, e.g.
 *   ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
 * Falls back to common local-dev origins so `npm run dev` keeps working
 * out of the box, but production deployments should always set this
 * explicitly — see SECURITY.md.
 */
const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:8080'];

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_DEV_ORIGINS;
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Express `cors` origin callback. Allows same-origin/no-origin requests
 * (curl, server-to-server, tests) and any origin on the allowlist; rejects
 * everything else instead of the previous behaviour of reflecting any
 * `Origin` header back (i.e. `cors()` with no options).
 */
function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return callback(null, true);
  return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
}

module.exports = { getAllowedOrigins, corsOriginCheck };
