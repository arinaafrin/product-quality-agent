const express = require('express');
const cors = require('cors');
const { router: validateRouter } = require('./routes/validate');
const { router: askRouter } = require('./routes/ask');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api', validateRouter);
app.use('/api', askRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`product-quality-agent backend listening on :${PORT}`));
}

module.exports = { app };
