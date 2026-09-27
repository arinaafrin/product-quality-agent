const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { router: validateRouter } = require('./routes/validate');
const { router: askRouter } = require('./routes/ask');
const { router: authRouter } = require('./routes/auth');
const { initRealtime } = require('./realtime');
const { corsOriginCheck } = require('./corsConfig');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: corsOriginCheck }));
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api', apiLimiter);
app.use('/api', authRouter);
app.use('/api', validateRouter);
app.use('/api', askRouter);

app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const httpServer = http.createServer(app);

  initRealtime(httpServer).catch((err) => {
    console.error('[realtime] failed to initialize, continuing without it:', err.message);
  });

  httpServer.listen(PORT, () => console.log(`product-quality-agent backend listening on :${PORT}`));
}

module.exports = { app };
