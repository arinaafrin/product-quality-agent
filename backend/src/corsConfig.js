const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:8080'];

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_DEV_ORIGINS;
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return callback(null, true);
  return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
}

module.exports = { getAllowedOrigins, corsOriginCheck };
